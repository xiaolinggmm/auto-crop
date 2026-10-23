import { buildMahInputBundle } from "../runtime/mahInputBundle";
import { createProjectRuntimeActionChannel } from "../runtime/runtimeActionChannel";
import { applyTaskTransition } from "../runtime/taskTransition";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { Locale, ProofType } from "@auto-crop/core";
import type { createRepositories } from "../db/repositories";
import { mahTerminalStates, type MahExecution } from "../db/mahExecutions";
import { collectMahFileDelivery, fileDeliveryInstructions } from "../runtime/mahFileDelivery";
import { parseArtifactEnvelope } from "../runtime/artifactEnvelope";
import type { AgentAdapter, AgentRunRequest, AgentRunResult } from "./types";

export type MahCommand = (args: string[]) => Promise<{exitCode:number|null;stdout:string;stderr:string}>;
export type MahCliOptions = {
  repositories: ReturnType<typeof createRepositories>;
  projectRoot: string;
  mahProjectRoot?: string;
  command?: MahCommand;
  pollMs?: number;
};
export function mahCommand(executable = process.env.AUTO_CROP_MAH_CLI ?? "mah"): MahCommand {
  return args => new Promise(resolveResult => {
    execFile(executable, args, { timeout: 15_000, maxBuffer: 12_000_000, encoding: "utf8" }, (error, stdout, stderr) => {
      resolveResult({ exitCode: error ? (typeof error.code === "number" ? error.code : null) : 0, stdout, stderr: stderr || error?.message || "" });
    });
  });
}
const unknownResult = (detail: string): AgentRunResult => ({ status: "failed", exitCode: null, stdout: "", stderr: detail, failureReason: "termination_unconfirmed", terminationConfirmed: false });
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const flatFile = (name: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== "delivery.json";

/** No external retry: the durable claim is consumed before invoking the submit CLI. */
export function createMahCliAdapter(options: MahCliOptions): AgentAdapter {
  const command = options.command ?? mahCommand();
  return {
    id: "mah", name: "MAH", capabilities: [], contractCapabilities: ["file_delivery"],
    detect: async () => { try { return (await command(["--version"])).exitCode === 0; } catch { return false; } },
    async run(request) {
      if (request.signal?.aborted) return options.repositories.mahExecutions.list(request.taskId).length
        ? unknownResult("Aborted with a prior MAH execution; its termination is not confirmed.")
        : { status: "failed", exitCode: null, stdout: "", stderr: "Cancelled before MAH submission.", failureReason: "cancelled" };
      const context = request.runtimeActions?.mcp;
      let projectRoot = options.mahProjectRoot ?? process.env.AUTO_CROP_MAH_PROJECT_ROOT;
      if (!context || !projectRoot || !isAbsolute(projectRoot)) return { status: "failed", exitCode: null, stdout: "", stderr: "MAH requires a trusted Run context and an explicit absolute AUTO_CROP_MAH_PROJECT_ROOT.", failureReason: "agent_failed" };
      try { projectRoot = realpathSync(projectRoot); }
      catch { return { status: "failed", exitCode: null, stdout: "", stderr: "MAH project root does not exist.", failureReason: "agent_failed" }; }
      if (request.grant?.withheld.length) return { status: "failed", exitCode: null, stdout: "", stderr: "MAH CLI cannot enforce withheld Auto-Crop capabilities; delegation refused.", failureReason: "agent_failed" };
      let inputBundle: ReturnType<typeof buildMahInputBundle>;
      try { inputBundle = buildMahInputBundle(request.inputDirectories ?? []); }
      catch (error) { return { status: "failed", exitCode: null, stdout: "", stderr: `MAH input preparation failed before submission: ${String(error)}`, failureReason: "missing_deliverable" }; }
      const requestDigest = digest(JSON.stringify({ prompt: request.prompt, projectRoot: resolve(projectRoot), context, grant: request.grant, inputBundle }));
      let record: MahExecution;
      try {
        record = options.repositories.transaction(() => {
          options.repositories.reassignments.lockTask(request.taskId);
          const existing = options.repositories.mahExecutions.get(context.runId);
          if (existing) {
            if (existing.requestDigest !== requestDigest) throw new Error("MAH request content conflict; submission is not repeated.");
            return existing;
          }
          if (options.repositories.mahExecutions.blocksDispatch(request.taskId)) throw new Error("An earlier MAH execution is unresolved. Query its UUID; do not create another task.");
          const next: MahExecution = { runId: context.runId, taskId: request.taskId, companyId: context.companyId, mahTaskId: randomUUID(),
            projectRoot: resolve(projectRoot), requestDigest, inputBundleDigest: inputBundle.files.length ? digest(JSON.stringify(inputBundle)) : undefined, ownerEpoch: options.repositories.getTaskExecutionEpoch(request.taskId), context: { locale: context.locale, requireExecutionDetails: context.requireExecutionDetails, proofSchemaId: context.proofSchemaId, acceptedProofTypes: context.acceptedProofTypes }, state: "prepared", detail: "", createdAt: new Date().toISOString() };
          options.repositories.mahExecutions.save(next); return next;
        });
      } catch (error) { return unknownResult(String(error)); }
      const identity = { companyId: record.companyId, taskId: record.taskId, runId: record.runId, mahTaskId: record.mahTaskId };
      const root = join(options.projectRoot, ".auto-crop", "mah", record.mahTaskId);
      mkdirSync(root, { recursive: true });
      const promptPath = join(root, "handoff.md");
      // MAH owns provider selection and worktrees. Local workspace paths are inputs, not its output authority.
      const prompt = `${request.prompt}\n\n${fileDeliveryInstructions(identity, root)}\n\nMAH owns executor selection. Do not call Auto-Crop MCP tools. This is a delegated task, not a request for an execution brief.
If an autocrop-inputs.json attachment is present, decode each base64 file into its stated relative path inside your own work area and verify its SHA-256 before using it. Those files are the accepted upstream evidence/verification snapshots. Do not read original Auto-Crop absolute paths. Preserve the supplied snapshots; perform checks on copies. Work in your MAH Task work area; modify managed project source only when the task explicitly calls for it.`;
      if (options.repositories.mahExecutions.claimSubmission(record.runId)) {
        try {
          writeFileSync(promptPath, prompt, { flag: "wx", mode: 0o600 });
          const attachment = join(root, "autocrop-inputs.json");
          if (inputBundle.files.length) writeFileSync(attachment, JSON.stringify(inputBundle), { flag: "wx", mode: 0o600 });
          const returned = await command(["task", "submit", "--cwd", record.projectRoot, "--task-id", record.mahTaskId,
            "--description-file", promptPath, "--personal-os-slot", "background", "--write", "--format", "json", ...(inputBundle.files.length ? ["--attach", attachment] : [])]);
          const response = returned.exitCode === 0 ? JSON.parse(returned.stdout) : null;
          record = { ...record, state: response?.task_id === record.mahTaskId && ["ready", "running", "queued", "deferred"].includes(response.admission_status) ? "submitted" : "unknown",
            detail: returned.stderr || "Submission consumed. Reconcile by UUID; never resubmit." };
        } catch (error) { record = { ...record, state: "unknown", detail: String(error) }; }
        options.repositories.mahExecutions.save(record);
      }
      const deadline = Date.now() + (request.timeoutMs ?? 60_000);
      do {
        if (request.signal?.aborted) {
          try { await command(["task", "cancel", record.mahTaskId, "--cwd", record.projectRoot, "--format", "json"]); } catch { /* cancellation acknowledgement is not termination */ }
          options.repositories.mahExecutions.save({ ...record, state: "unknown", detail: "Cancellation requested; termination unconfirmed. Reconcile before recovery." });
          return unknownResult("MAH cancellation requested; no termination guarantee. Query before recovery.");
        }
        record = await reconcileMahExecution({ ...options, command }, record.runId);
        if (record.state === "completed") {
          try {
            const snapshot = await receiveDelivery(options, command, record, request, root);
            options.repositories.mahExecutions.save({ ...record, deliveryWorkspacePath: snapshot.workspacePath, deliveryManifestSha256: snapshot.manifestSha256 });
            const accepted = request.runtimeActions!.submitArtifactEnvelope(snapshot.envelope) as { ok?: boolean; errors?: string[] };
            if (!accepted?.ok) throw new Error(`Candidate rejected: ${accepted?.errors?.join("; ") ?? "run is closed"}`);
            options.repositories.mahExecutions.save({ ...record, deliveryWorkspacePath: snapshot.workspacePath, deliveryManifestSha256: snapshot.manifestSha256 });
            return { status: "complete", exitCode: 0, stdout: "", stderr: "", deliveryWorkspacePath: snapshot.workspacePath, deliveryManifestSha256: snapshot.manifestSha256 };
          } catch (error) {
            const detail = `MAH delivery needs correction without re-executing the task: ${String(error)}`;
            options.repositories.mahExecutions.save({ ...options.repositories.mahExecutions.get(record.runId)!, detail });
            return { status: "failed", exitCode: 0, stdout: "", stderr: detail, failureReason: "invalid_business_artifact" };
          }
        }
        if (record.state === "failed" || record.state === "cancelled") return { status: "failed", exitCode: 1, stdout: "", stderr: `MAH task ${record.mahTaskId}: ${record.state}`, failureReason: record.state === "cancelled" ? "cancelled" : "agent_failed" };
        if (Date.now() < deadline) await new Promise(r => setTimeout(r, Math.min(options.pollMs ?? 1000, Math.max(0, deadline - Date.now()))));
      } while (Date.now() < deadline);
      return unknownResult(`MAH task ${record.mahTaskId} is unresolved (${record.state}). Submission will not be repeated; use reconciliation.`);
    },
  };
}

/** Explicit file-only recovery; never invokes submit, run, input or follow-up. */
export async function receiveMahExecution(options: MahCliOptions, runId: string): Promise<MahExecution> {
  let record = options.repositories.mahExecutions.get(runId);
  if (!record?.context) throw new Error("MAH delivery context not found");
  const context = record.context;
  const assertEligible = () => {
    const task = options.repositories.getTask(record!.taskId);
    if (!task || !["failed", "blocked"].includes(task.status)
      || options.repositories.reassignments.latestRunId(task.id) !== runId
      || options.repositories.getTaskExecutionEpoch(task.id) !== record!.ownerEpoch
      || options.repositories.hasRuntimeCandidateDisposition(task.companyId, task.id, runId)
      || options.repositories.listRunningAgentRuns(task.companyId).some(r => r.taskId === task.id)
      || options.repositories.listWorkspaceClaims().some(c => c.taskId === task.id)
      || options.repositories.listTaskLocks().some(c => c.taskId === task.id)
      || options.repositories.listOpenTaskHolds(task.id).some(h => !["invalid_business_artifact", "runtime_interrupted"].includes(h.kind))) {
      throw new Error("MAH delivery recovery is stale or blocked by active ownership, a protected Hold, or committed settlement.");
    }
    return task;
  };
  assertEligible();
  record = await reconcileMahExecution(options, runId);
  if (record.state !== "completed") throw new Error("MAH completion is not confirmed; delivery remains pending.");
  const command = options.command ?? mahCommand();
  const root = join(options.projectRoot, ".auto-crop", "mah", record.mahTaskId);
  mkdirSync(root, { recursive: true });
  const request: AgentRunRequest = { taskId: record.taskId, prompt: "", promptPath: "", workspacePath: root, metadata: {},
    runtimeActions: { submitArtifactEnvelope: () => {}, mcp: { ...context, candidateDir: "", companyId: record.companyId, taskId: record.taskId, runId } } };
  const snapshot = await receiveDelivery(options, command, record, request, root);
  options.repositories.mahExecutions.save({ ...options.repositories.mahExecutions.get(runId)!, deliveryWorkspacePath: snapshot.workspacePath, deliveryManifestSha256: snapshot.manifestSha256 });
  assertEligible();
  const imported = createProjectRuntimeActionChannel(options.projectRoot).importFileCandidate(
    { companyId: record.companyId, taskId: record.taskId, runId }, snapshot.envelope,
    { locale: context.locale as Locale, requireDetails: context.requireExecutionDetails, proofRefs: { proofSchemaId: context.proofSchemaId, acceptedTypes: context.acceptedProofTypes as ProofType[] } });
  if (!imported.ok) throw new Error(imported.errors.join("; "));
  options.repositories.transaction(() => {
    options.repositories.reassignments.lockTask(record!.taskId);
    const task = assertEligible();
    options.repositories.updateTaskWorkspacePath(task.id, snapshot.workspacePath);
    applyTaskTransition({ repositories: options.repositories, task, status: "failed", resolvesHoldKinds: ["invalid_business_artifact", "runtime_interrupted"],
      executionSummary: { latestFailureReason: "no_proof", latestFailureMessage: "MAH file delivery received without rerunning execution. Refresh to validate evidence and settle." } });
  });
  return options.repositories.mahExecutions.get(runId)!;
}

/** Cancellation is a request, never proof of termination or permission to resubmit. */
export async function cancelMahExecution(options: MahCliOptions, runId: string): Promise<MahExecution> {
  const record = options.repositories.mahExecutions.get(runId);
  if (!record) throw new Error("MAH execution not found");
  if (mahTerminalStates.has(record.state)) return record;
  const command = options.command ?? mahCommand();
  try { await command(["task", "cancel", record.mahTaskId, "--cwd", record.projectRoot, "--format", "json"]); } catch { /* preserve uncertainty */ }
  const next: MahExecution = { ...record, state: "unknown", detail: "Cancellation requested; query task and carriers before recovery. Process termination is not confirmed." };
  options.repositories.mahExecutions.save(next); return next;
}

/** Read-only CLI operations. Status consistency is evidence for delivery, not proof all descendant PIDs exited. */
export async function reconcileMahExecution(options: MahCliOptions, runId: string): Promise<MahExecution> {
  const record = options.repositories.mahExecutions.get(runId);
  if (!record) throw new Error("MAH execution not found");
  const command = options.command ?? mahCommand();
  let state: MahExecution["state"] = "unknown";
  let detail = "MAH state is unavailable or conflicting; no new submission is permitted.";
  try {
    const showResult = await command(["task", "show", record.mahTaskId, "--cwd", record.projectRoot, "--format", "json"]);
    const carriersResult = await command(["task", "execution-carriers", "--task-id", record.mahTaskId, "--cwd", record.projectRoot, "--format", "json"]);
    if (showResult.exitCode === 0 && carriersResult.exitCode === 0) {
      const show = JSON.parse(showResult.stdout); const carriers = JSON.parse(carriersResult.stdout);
      const facts = carriers.schema_version === 1 && carriers.project_root === record.projectRoot && Array.isArray(carriers.carrier_facts) ? carriers.carrier_facts.filter((r: {task_id?:string}) => r.task_id === record.mahTaskId) : [];
      const fact = facts.length === 1 ? facts[0] : null;
      const status = show?.task?.status;
      if (show.ok === true && show.task.task_id === record.mahTaskId && fact) {
        const sources = [fact.task_runtime, fact.task_index, fact.scheduler];
        if (mahTerminalStates.has(status) && fact.task_runtime?.read_state === "ready"
            && sources.every(s => s?.read_state === "absent" || (s?.read_state === "ready" && s.status === status))) {
          state = status; detail = `MAH task and carrier projections agree: ${status}.`;
        } else if (["active", "queued", "running", "waiting_for_user", "follow_up"].includes(status)) {
          state = "submitted"; detail = `MAH status: ${status}.`;
        }
      }
    }
  } catch (error) { detail = String(error); }
  const current = options.repositories.mahExecutions.get(runId)!;
  // Submission claim is consumed forever; observed lifecycle may regress on follow-up or unavailable readback.
  const next = { ...current, state, detail };
  options.repositories.mahExecutions.save(next);
  return next;
}

async function receiveDelivery(options: MahCliOptions, command: MahCommand, record: MahExecution, request: AgentRunRequest, root: string) {
  const context = request.runtimeActions!.mcp!;
  const identity = { companyId: record.companyId, taskId: record.taskId, runId: record.runId, mahTaskId: record.mahTaskId };
  const contract = { locale: context.locale as Locale, requireDetails: context.requireExecutionDetails, proofRefs: { proofSchemaId: context.proofSchemaId, acceptedTypes: context.acceptedProofTypes as ProofType[] } };
  const archiveRoot = join(options.projectRoot, ".auto-crop", "mah", "snapshots");
  // A capture may have completed just before the process died and persisted its DB pointer.
  const snapshotDirectory = join(archiveRoot, digest(JSON.stringify(identity)));
  if (existsSync(snapshotDirectory)) {
    const captured = collectMahFileDelivery({ deliveryRoot: root, archiveRoot, expected: identity, contract });
    if (record.deliveryManifestSha256 && captured.manifestSha256 !== record.deliveryManifestSha256) throw new Error("MAH snapshot manifest integrity mismatch");
    return captured;
  }
  let inputFiles: ReturnType<typeof buildMahInputBundle>["files"] = [];
  if (record.inputBundleDigest) {
    const rawInputs = readFileSync(join(root, "autocrop-inputs.json"), "utf8");
    if (digest(rawInputs) !== record.inputBundleDigest) throw new Error("MAH input bundle integrity mismatch");
    inputFiles = JSON.parse(rawInputs).files;
  }
  const deliveryRoot = mkdtempSync(join(root, "receive-"));
  async function read(name: string) {
    const result = await command(["task", "context", record.mahTaskId, "--cwd", record.projectRoot, "--read", `artifacts/${name}`, "--format", "json"]);
    if (result.exitCode !== 0) throw new Error(`MAH artifact read failed: ${name}`);
    const content = JSON.parse(result.stdout).content;
    if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > 2_000_000 || content.includes("\0")) throw new Error(`Missing, binary or oversized MAH artifact: ${name}`);
    writeFileSync(join(deliveryRoot, name), content, { flag: "wx", mode: 0o600 });
    return content;
  }
  const raw = await read("delivery.json");
  const parsed = parseArtifactEnvelope(JSON.parse(raw).envelope);
  if (!parsed.success) throw new Error(parsed.errors.join("; "));
  const refs = new Set((parsed.value.fileRefs ?? []).map(f => f.path));
  for (const proof of parsed.value.proofRefs ?? []) if (!(["url", "deployment"].includes(proof.type) && /^https?:\/\//i.test(proof.uri))) refs.add(proof.uri);
  if (refs.size > 128) throw new Error("Too many MAH artifacts (maximum 128)");
  for (const name of refs) { if (!flatFile(name)) throw new Error(`MAH transport requires a flat filename: ${name}`); await read(name); }
  return collectMahFileDelivery({ deliveryRoot, archiveRoot, expected: identity, contract, inputFiles });
}

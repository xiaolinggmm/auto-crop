import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseClient } from "../db/client";
import { createRepositories } from "../db/repositories";
import { openState } from "../runtime/fixtures/budgetState";
import { createMahCliAdapter, preflightMahSlot, receiveMahExecution, reconcileMahExecution, type MahCommand } from "./mahCli";
import * as mahCliModule from "./mahCli";
import { createProjectRuntimeActionChannel } from "../runtime/runtimeActionChannel";
import { recoverProofIfPossible } from "../runtime/taskRefresh";
import { applyTaskTransition } from "../runtime/taskTransition";
import type { AgentRunRequest } from "./types";

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(f => f()));
function fixture(command: MahCommand) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "mah-adapter-")));
  mkdirSync(join(root, ".auto-crop"));
  const { repositories, client } = openState(root);
  cleanups.push(() => { client.close(); rmSync(root, { recursive: true, force: true }); });
  const context = { companyId: "company_1", taskId: "task_1", runId: "run-1" };
  const received: unknown[] = [];
  const request: AgentRunRequest = { taskId: "task_1", workspacePath: root, promptPath: "", prompt: "Do the work", metadata: {}, timeoutMs: 25,
    grant: { id: "workspace", granted: ["workspace_read", "workspace_write"], withheld: [] },
    runtimeActions: { submitArtifactEnvelope: e => { received.push(e); return { ok: true }; }, mcp: { ...context, candidateDir: "", locale: "en", requireExecutionDetails: false, proofSchemaId: "product-brief", acceptedProofTypes: ["file"] } } };
  const options = { repositories, projectRoot: root, mahProjectRoot: root, command, pollMs: 0 };
  return { root, repositories, options, request, received, adapter: createMahCliAdapter(options) };
}
const json = (v: unknown) => ({ exitCode: 0, stdout: JSON.stringify(v), stderr: "" });
const carriers = (id: string, status = "completed", projectRoot = "") => json({ schema_version: 1, project_root: projectRoot, carrier_facts: [{ task_id: id, task_runtime: { read_state: "ready", status }, task_index: { read_state: "ready", status }, scheduler: { read_state: "absent" } }] });

describe("MAH CLI delegation", () => {
  it("resolves only supported execution slot configuration", () => {
    const resolveSlot = (mahCliModule as unknown as { resolveMahSlotClass?: (value?: string) => string }).resolveMahSlotClass;
    expect(resolveSlot).toBeTypeOf("function");
    expect(resolveSlot!()).toBe("background");
    expect(resolveSlot!("background")).toBe("background");
    expect(resolveSlot!("interactive")).toBe("interactive");
    expect(() => resolveSlot!("review")).toThrow(/AUTO_CROP_MAH_SLOT.*background.*interactive/);
  });

  it("exposes a startup preflight for MAH slot availability", () => {
    expect((mahCliModule as unknown as { preflightMahSlot?: unknown }).preflightMahSlot).toBeTypeOf("function");
  });

  it("passes startup preflight when the selected MAH slot is available", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "mah-preflight-")));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    await expect(preflightMahSlot({
      command: async args => {
        expect(args).toEqual(["personal-os", "quota", "list", "--project-root", root, "--format", "json"]);
        return json({ ok: true, agent_slots: { interactive: 1, background: 1, review: 0 } });
      },
      mahProjectRoot: root,
      slotClass: "background",
    })).resolves.toBeUndefined();
  });

  it("fails startup preflight with an interactive opt-in hint before submitting", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "mah-preflight-")));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    await expect(preflightMahSlot({
      command: async () => json({ ok: true, agent_slots: { interactive: 1, background: 0, review: 0 } }),
      mahProjectRoot: root,
      slotClass: "background",
    })).rejects.toThrow(/background.*unavailable.*AUTO_CROP_MAH_SLOT=interactive/i);
  });

  it("uses MAH routing and task artifacts, snapshots delivery and never runs a preparation provider", async () => {
    const calls: string[][] = [];
    let id = "";
    const f = fixture(async args => {
      calls.push(args);
      if (args[1] === "submit") { id = args[args.indexOf("--task-id") + 1]!; expect(readFileSync(args[args.indexOf("--description-file") + 1]!, "utf8")).toContain("artifacts/"); return json({ task_id: id, admission_status: "ready" }); }
      if (args[1] === "show") return json({ ok: true, task: { task_id: id, status: "completed" } });
      if (args[1] === "execution-carriers") return carriers(id, "completed", f.root);
      if (args.includes("artifacts/delivery.json")) return json({ content: JSON.stringify({ schemaVersion: 1, companyId: "company_1", taskId: "task_1", runId: "run-1", mahTaskId: id, envelope: { artifact_kind: "deliverable", artifact_role: "findings", artifact_subtype: "brief", task_type: "research", payload: { outcome_summary: "Complete", execution_report: { conclusion: "Done", vision_impact: "Useful", remaining_gap: "None", recommendation: "Continue" } }, lineage: {}, file_refs: [{ path: "report.txt" }] } }) });
      return json({ content: "completed work" });
    });
    const result = await f.adapter.run(f.request);
    expect(result.status, result.stderr).toBe("complete");
    expect(f.received).toHaveLength(1);
    expect(readFileSync(join(result.deliveryWorkspacePath!, "report.txt"), "utf8")).toBe("completed work");
    expect(calls.filter(a => a[1] === "submit")).toHaveLength(1);
    expect(calls[0]).toContain("--personal-os-slot");
    expect(calls.flat()).not.toContain("--agent");
    expect(f.adapter.contractCapabilities).not.toContain("structured_execution_brief");
    expect(f.repositories.mahExecutions.list("task_1")[0]?.state).toBe("completed");
  });

  it("submits and persists the explicitly selected interactive slot", async () => {
    const calls: string[][] = [];
    let id = "";
    const f = fixture(async args => {
      calls.push(args);
      if (args[1] === "submit") { id = args[args.indexOf("--task-id") + 1]!; return json({ task_id: id, admission_status: "ready" }); }
      if (args[1] === "show") return json({ ok: true, task: { task_id: id, status: "failed" } });
      return carriers(id, "failed", f.root);
    });

    await createMahCliAdapter({ ...f.options, slotClass: "interactive" } as typeof f.options).run(f.request);

    const submit = calls.find(args => args[1] === "submit")!;
    expect(submit[submit.indexOf("--personal-os-slot") + 1]).toBe("interactive");
    expect(f.repositories.mahExecutions.list("task_1")[0]).toMatchObject({ slotClass: "interactive" });
  });

  it("persists UUID before submit and never resubmits after an ambiguous failure, including a new adapter", async () => {
    let submits = 0;
    const f = fixture(async args => {
      if (args[1] === "submit") { submits++; expect(f.repositories.mahExecutions.list("task_1")[0]?.state).toBe("submitting"); throw new Error("response lost"); }
      return { exitCode: 1, stdout: "", stderr: "task not found" };
    });
    expect(await f.adapter.run(f.request)).toMatchObject({ status: "failed", terminationConfirmed: false });
    const id = f.repositories.mahExecutions.list("task_1")[0]!.mahTaskId;
    const reopened = createDatabaseClient(join(f.root, ".auto-crop", "state.sqlite"));
    try {
      const repositories = createRepositories(reopened);
      expect(repositories.mahExecutions.blocksDispatch("task_1")).toBe(true);
      expect(await createMahCliAdapter({ ...f.options, repositories }).run(f.request)).toMatchObject({ status: "failed", terminationConfirmed: false });
    } finally { reopened.close(); }
    expect(submits).toBe(1);
    expect(f.repositories.mahExecutions.list("task_1")[0]!.mahTaskId).toBe(id);
    const next = { ...f.request, runtimeActions: { ...f.request.runtimeActions!, mcp: { ...f.request.runtimeActions!.mcp!, runId: "run-2" } } };
    expect(await f.adapter.run(next)).toMatchObject({ status: "failed", terminationConfirmed: false });
    expect(submits).toBe(1);
  });

  it("does not accept conflicting carriers as completion or collect files before completion", async () => {
    let id = ""; let reads = 0;
    const f = fixture(async args => {
      if (args[1] === "submit") { id = args[args.indexOf("--task-id") + 1]!; return json({ task_id: id, admission_status: "ready" }); }
      if (args[1] === "show") return json({ ok: true, task: { task_id: id, status: "completed" } });
      if (args[1] === "execution-carriers") return carriers(id, "running", f.root);
      reads++; return json({ content: "not eligible" });
    });
    expect(await f.adapter.run(f.request)).toMatchObject({ status: "failed", terminationConfirmed: false });
    expect(reads).toBe(0);
    expect(f.received).toHaveLength(0);
  });

  it("repairs file delivery from the original UUID without another execution", async () => {
    let id = ""; let valid = false; let submits = 0;
    const f = fixture(async args => {
      if (args[1] === "submit") { submits++; id = args[args.indexOf("--task-id") + 1]!; return json({ task_id: id, admission_status: "ready" }); }
      if (args[1] === "show") return json({ ok: true, task: { task_id: id, status: "completed" } });
      if (args[1] === "execution-carriers") return carriers(id, "completed", f.root);
      return json({ content: valid ? JSON.stringify({ schemaVersion: 1, companyId: "company_1", taskId: "task_1", runId: "run-1", mahTaskId: id,
        envelope: { artifact_kind: "blocker", artifact_role: "none", artifact_subtype: "missing_input", task_type: "research", payload: { reason: "Need input", unblock_request: { needed: "Access", why: "Login required", evidence_requirements: ["Access granted"] } }, lineage: {} } }) : "broken json" });
    });
    expect(await f.adapter.run(f.request)).toMatchObject({ status: "failed", failureReason: "invalid_business_artifact" });
    expect(f.repositories.mahExecutions.blocksDispatch("task_1")).toBe(true);
    const channel = createProjectRuntimeActionChannel(f.root);
    channel.selectRunSubmission({ companyId: "company_1", taskId: "task_1", runId: "run-1" });
    f.repositories.createAgentRun({ id: "run-1", taskId: "task_1", agentId: "mah", status: "failed", logPath: "log", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
    applyTaskTransition({ repositories: f.repositories, task: "task_1", status: "failed", executionSummary: { latestFailureReason: "invalid_business_artifact" } });
    valid = true;
    expect((await receiveMahExecution(f.options, "run-1")).deliveryWorkspacePath).toBeTruthy();
    expect(channel.selectRunSubmission({ companyId: "company_1", taskId: "task_1", runId: "run-1" }).envelope?.artifactKind).toBe("blocker");
    expect(submits).toBe(1);
    expect(f.repositories.getTask("task_1")?.latestFailureReason).toBe("no_proof");
    const recovered = recoverProofIfPossible({ repositories: f.repositories, taskId: "task_1", runtimeActionChannel: channel, proofSchemas: [{ id: "repo-diff", description: "diff", acceptedTypes: ["diff"] }] }, f.repositories.getTask("task_1")!);
    expect(recovered.kind).toBe("recovered");
    expect(f.repositories.getTask("task_1")?.latestFailureReason).toBe("awaiting_human_action");
    expect(f.repositories.mahExecutions.blocksDispatch("task_1")).toBe(false);
  });

  it("canonicalizes symlinked project roots before submission and reconciliation", async () => {
    let id = "";
    const f = fixture(async args => {
      if (args[1] === "submit") { id = args[args.indexOf("--task-id") + 1]!; expect(args[args.indexOf("--cwd") + 1]).toBe(f.root); return json({ task_id: id, admission_status: "ready" }); }
      if (args[1] === "show") return json({ ok: true, task: { task_id: id, status: "failed" } });
      return carriers(id, "failed", f.root);
    });
    const alias = join(f.root, "alias"); symlinkSync(f.root, alias);
    const result = await createMahCliAdapter({ ...f.options, mahProjectRoot: alias }).run(f.request);
    expect(result.failureReason).toBe("agent_failed");
    expect(f.repositories.mahExecutions.list("task_1")[0]?.state).toBe("failed");
  });

  it("does not submit a task whose abort signal is already set", async () => {
    let calls = 0; const f = fixture(async () => { calls++; return json({}); });
    const controller = new AbortController(); controller.abort();
    expect(await f.adapter.run({ ...f.request, signal: controller.signal })).toMatchObject({ status: "failed", failureReason: "cancelled" });
    expect(calls).toBe(0);
    expect(f.repositories.mahExecutions.list("task_1")).toEqual([]);
    f.repositories.mahExecutions.save({ runId: "run-1", taskId: "task_1", companyId: "company_1", mahTaskId: "uuid", projectRoot: f.root, requestDigest: "digest", state: "unknown", createdAt: "now", detail: "response lost" });
    expect(await f.adapter.run({ ...f.request, signal: controller.signal })).toMatchObject({ status: "failed", terminationConfirmed: false });
    expect(calls).toBe(0);
  });

  it("persists an old task becoming unknown while a newer task is unresolved", async () => {
    const f = fixture(async () => ({ exitCode: 1, stdout: "", stderr: "unavailable" }));
    const record = { runId: "old", taskId: "task_1", companyId: "company_1", mahTaskId: "old-id", projectRoot: f.root, requestDigest: "digest", state: "failed" as const, createdAt: "now", detail: "" };
    f.repositories.mahExecutions.save(record);
    f.repositories.mahExecutions.save({ ...record, runId: "new", mahTaskId: "new-id", state: "submitting" });
    expect((await reconcileMahExecution(f.options, "old")).state).toBe("unknown");
    expect(f.repositories.mahExecutions.get("old")?.state).toBe("unknown");
    expect(f.repositories.mahExecutions.blocksDispatch("task_1")).toBe(true);
  });

  it("reconciliation queries the existing UUID without dispatch or automatic retry", async () => {
    let submits = 0;
    const f = fixture(async args => { if (args[1] === "submit") submits++; return { exitCode: 1, stdout: "", stderr: "unavailable" }; });
    await f.adapter.run(f.request);
    const queried = await reconcileMahExecution(f.options, "run-1");
    expect(queried.state).toBe("unknown");
    expect(submits).toBe(1);
  });
});

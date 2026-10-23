import { createHash } from "node:crypto";
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArtifactEnvelope, type ArtifactEnvelope } from "./artifactEnvelope";
import { artifactEnvelopeContractErrors, type ArtifactEnvelopeContractOptions } from "./businessArtifact";

export type MahFileDeliveryIdentity = { companyId: string; taskId: string; runId: string; mahTaskId: string };
export type MahFileDeliveryInput = {
  deliveryRoot: string;
  archiveRoot: string;
  expected: MahFileDeliveryIdentity;
  contract: ArtifactEnvelopeContractOptions;
  inputFiles?: Array<{path: string; data: string; sha256: string}>;
};
export type MahFileDeliverySnapshot = {
  envelope: ArtifactEnvelope;
  workspacePath: string;
  manifestPath: string;
  manifestSha256: string;
};
const MAX_BYTES = 2_000_000;
const MAX_FILES = 256;
const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const identityKeys = ["companyId", "taskId", "runId", "mahTaskId"] as const;

type Manifest = { schemaVersion: 1; identity: MahFileDeliveryIdentity; envelope: ArtifactEnvelope; files: { path: string; sha256: string }[] };

/** Capture before candidate submission; this function never publishes task state or retries execution. */
export function collectMahFileDelivery(input: MahFileDeliveryInput): MahFileDeliverySnapshot {
  const identity = Object.fromEntries(identityKeys.map(key => [key, input.expected[key]])) as MahFileDeliveryIdentity;
  if (identityKeys.some(key => typeof identity[key] !== "string" || !identity[key].trim())) throw new Error("MAH delivery requires every expected identity.");
  const archiveRoot = resolve(input.archiveRoot);
  mkdirSync(archiveRoot, { recursive: true });
  const runDir = join(archiveRoot, hash(JSON.stringify(identity)));
  const replay = (): MahFileDeliverySnapshot => {
    const raw = readRegular(runDir, "manifest.json");
    const manifest = JSON.parse(raw.toString("utf8")) as Manifest;
    checkIdentity(manifest.identity, identity);
    const envelope = validateEnvelope(manifest.envelope, input.contract);
    const workspacePath = join(runDir, "workspace");
    for (const file of manifest.files) {
      if (hash(readRegular(workspacePath, file.path)) !== file.sha256) throw new Error(`MAH snapshot integrity hash mismatch: ${file.path}`);
    }
    return { envelope, workspacePath, manifestPath: join(runDir, "manifest.json"), manifestSha256: hash(raw) };
  };
  if (existsSync(runDir)) return replay();
  const raw = readRegular(input.deliveryRoot, "delivery.json");
  // Content-addressed audit copies preserve even rejected JSON; originals are never edited.
  const auditDir = join(archiveRoot, "audit", hash(JSON.stringify(identity)));
  mkdirSync(auditDir, { recursive: true });
  const auditPath = join(auditDir, `${hash(raw)}.json`);
  if (!existsSync(auditPath)) writeFileSync(auditPath, raw, { flag: "wx", mode: 0o600 });
  let document: Record<string, unknown>;
  try { document = JSON.parse(raw.toString("utf8")); } catch (error) {
    throw new Error(`MAH delivery invalid JSON; original preserved for audit at ${auditPath}: ${String(error)}`);
  }
  if (!document || document.schemaVersion !== 1) throw new Error("MAH delivery schemaVersion must be 1.");
  checkIdentity(document, identity);
  const envelope = validateEnvelope(document.envelope, input.contract);
  const paths = new Set((envelope.fileRefs ?? []).map(ref => ref.path));
  for (const ref of envelope.proofRefs ?? []) {
    if ((ref.type === "url" || ref.type === "deployment") && /^https?:\/\//i.test(ref.uri)) continue;
    paths.add(ref.uri);
  }
  if (paths.size > MAX_FILES) throw new Error(`MAH delivery exceeds ${MAX_FILES} referenced files.`);
  const stage = mkdtempSync(join(archiveRoot, ".capture-"));
  try {
    const workspacePath = join(stage, "workspace"); mkdirSync(workspacePath);
    const files: Manifest["files"] = [];
    for (const path of [...paths].sort()) {
      const bytes = readRegular(input.deliveryRoot, path);
      const target = join(workspacePath, safeRelativePath(path));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
      files.push({ path, sha256: hash(bytes) });
    }
    for (const inputFile of input.inputFiles ?? []) {
      const path = safeRelativePath(inputFile.path);
      const bytes = Buffer.from(inputFile.data, "base64");
      if (bytes.length > MAX_BYTES || hash(bytes) !== inputFile.sha256) throw new Error(`MAH input integrity mismatch: ${path}`);
      const target = join(workspacePath, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
      files.push({ path, sha256: inputFile.sha256 });
    }
    const manifest: Manifest = { schemaVersion: 1, identity, envelope, files };
    writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
    // rename cannot replace an already populated run directory. A competing capture wins intact.
    try { renameSync(stage, runDir); } catch (error) { if (!existsSync(runDir)) throw error; }
  } finally { rmSync(stage, { recursive: true, force: true }); }
  return replay();
}

function checkIdentity(document: Record<string, unknown> | MahFileDeliveryIdentity, expected: MahFileDeliveryIdentity): void {
  for (const key of identityKeys) if (document?.[key] !== expected[key]) throw new Error(`MAH delivery ${key} mismatch.`);
}
function validateEnvelope(value: unknown, contract: ArtifactEnvelopeContractOptions): ArtifactEnvelope {
  const parsed = parseArtifactEnvelope(value);
  if (!parsed.success) throw new Error(`MAH delivery envelope invalid: ${parsed.errors.join("; ")}`);
  const errors = artifactEnvelopeContractErrors(parsed.value, contract);
  if (errors.length) throw new Error(`MAH delivery contract invalid: ${errors.join("; ")}`);
  return parsed.value;
}
function safeRelativePath(path: string): string {
  if (!path || isAbsolute(path) || /[\\\0:]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error(`MAH delivery requires a relative path without traversal: ${path}`);
  }
  return path;
}
function readRegular(root: string, path: string): Buffer {
  const safe = safeRelativePath(path);
  const canonicalRoot = realpathSync(root);
  let candidate = canonicalRoot;
  for (const part of safe.split("/")) {
    candidate = join(candidate, part);
    if (lstatSync(candidate).isSymbolicLink()) throw new Error(`MAH delivery symlink is not permitted: ${path}`);
  }
  const rel = relative(canonicalRoot, realpathSync(candidate));
  if (isAbsolute(rel) || rel.startsWith("..")) throw new Error(`MAH delivery path escapes root: ${path}`);
  const fd = openSync(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error(`MAH delivery reference is not a regular file: ${path}`);
    if (stat.size > MAX_BYTES) throw new Error(`MAH delivery file size exceeds 2,000,000 bytes: ${path}`);
    const bytes = readFileSync(fd);
    if (bytes.length > MAX_BYTES) throw new Error(`MAH delivery file size exceeds 2,000,000 bytes: ${path}`);
    return bytes;
  } finally { closeSync(fd); }
}

export function fileDeliveryInstructions(expected: MahFileDeliveryIdentity, deliveryRoot: string): string {
  return [
    "Deliver through the MAH Task artifact file protocol. Write artifacts/delivery.json in your MAH Task scope, not a tool call or final prose.",
    "Write all referenced files as flat UTF-8 files in artifacts/ (each at most 2,000,000 bytes). References use only the filename relative to the delivery root, without the artifacts/ prefix. Binary files are unsupported.",
    "Use JSON.stringify (or an equivalent JSON serializer); write a temporary file then perform an atomic rename to artifacts/delivery.json after all referenced files exist.",
    `The exact wrapper is ${JSON.stringify({ schemaVersion: 1, ...expected, envelope: { artifact_kind: "deliverable", artifact_role: "report", artifact_subtype: "<subtype>", task_type: "<task type>", payload: {}, lineage: {}, proof_refs: [], file_refs: [{ path: "report.md" }] } })}. Follow the task's existing envelope payload and proof-type contracts.`,
    "Reference all delivery files in file_refs and all evidence in proof_refs. Preserve original outputs. A malformed deliverable must never trigger a whole-task rerun; report the validation problem without repeating research or execution.",
    `Runtime transport destination (informational only; do not write here): ${join(deliveryRoot, "delivery.json")}`,
  ].join("\n");
}

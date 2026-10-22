import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseArtifactEnvelope, type ArtifactEnvelope } from "./artifactEnvelope";
import { artifactEnvelopeContractErrors, type ArtifactEnvelopeContractOptions } from "./businessArtifact";

export type RuntimeActionRunContext = { companyId: string; taskId: string; runId: string };
export type RuntimeActionTaskContext = Omit<RuntimeActionRunContext, "runId">;
export type DeliveryContractOptions = ArtifactEnvelopeContractOptions;
export type RunSubmission = { envelope: ArtifactEnvelope | null; rejection: string[] | null };
export type SubmitArtifactEnvelopeResult =
  | { ok: true; ignoredIdentityFields: string[] }
  | { ok: false; code: "invalid_artifact_envelope" | "run_closed" | "submission_conflict"; errors: string[]; ignoredIdentityFields: string[] };

/** Legacy execution candidates, not MAH bindings. Selection closes admission but retains every
 * immutable revision. Business settlement never deletes evidence or writes this separate store.
 * A future MAH integration still needs atomic business disposition and protected evidence blobs. */
export type RuntimeActionChannel = {
  submitArtifactEnvelope(context: RuntimeActionRunContext, envelope: unknown, contract?: DeliveryContractOptions, submissionId?: string): SubmitArtifactEnvelopeResult;
  beginRun(context: RuntimeActionRunContext): void;
  revokeRun(context: RuntimeActionRunContext): void;
  latestTaskRunContext(context: RuntimeActionTaskContext): RuntimeActionRunContext | null;
  selectRunSubmission(context: RuntimeActionRunContext): RunSubmission;
  /** Compatibility read-and-hide. Settlement must use selectRunSubmission instead. */
  consumeRunSubmission(context: RuntimeActionRunContext): RunSubmission;
  latestTaskSubmission(context: RuntimeActionTaskContext): RunSubmission;
  /** Revocation changes eligibility only; evidence is retained. */
  discardTask(context: RuntimeActionTaskContext): void;
  auditRunSubmissions(context: RuntimeActionRunContext): RunSubmission[];
};
const NOTHING: RunSubmission = { envelope: null, rejection: null };
export type RuntimeActionChannelOptions = { candidateDir?: string };
export function runtimeActionCandidateDir(projectRoot: string): string { return join(projectRoot, ".auto-crop", "runtime-actions"); }
export function createProjectRuntimeActionChannel(projectRoot: string): RuntimeActionChannel {
  return createRuntimeActionChannel({ candidateDir: runtimeActionCandidateDir(projectRoot) });
}

export function createRuntimeActionChannel(options: RuntimeActionChannelOptions = {}): RuntimeActionChannel {
  if (options.candidateDir) mkdirSync(options.candidateDir, { recursive: true });
  const memory = options.candidateDir ? null : new DatabaseSync(":memory:");
  function withStore<T>(work: (db: DatabaseSync) => T): T {
    const db = memory ?? new DatabaseSync(join(options.candidateDir!, "candidates.sqlite"));
    try {
      db.exec(`PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS runs (company TEXT, task TEXT, run TEXT, closed INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(company, task, run));
        CREATE TABLE IF NOT EXISTS submissions (sequence INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, task TEXT NOT NULL, run TEXT NOT NULL, submission_id TEXT NOT NULL, content TEXT NOT NULL, envelope TEXT, rejection TEXT, result TEXT NOT NULL, UNIQUE(company, task, run, submission_id));
        CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
        BEGIN IMMEDIATE;`);
      try { importLegacy(db); const result = work(db); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    } finally { if (!memory) db.close(); }
  }
  function importLegacy(db: DatabaseSync): void {
    if (!options.candidateDir || db.prepare("SELECT 1 FROM migrations WHERE name='legacy-json'").get()) return;
    for (const name of readdirSync(options.candidateDir).filter((name) => name.endsWith(".json"))) {
      let candidate: { context?: RuntimeActionRunContext; envelope?: unknown; rejection?: unknown };
      try { candidate = JSON.parse(readFileSync(join(options.candidateDir, name), "utf8")); } catch { continue; }
      const context = candidate?.context;
      if (!context || ![context.companyId, context.taskId, context.runId].every((value) => typeof value === "string")) continue;
      const parsed = parseArtifactEnvelope(candidate.envelope);
      const rejection = Array.isArray(candidate.rejection) && candidate.rejection.every((value) => typeof value === "string") ? candidate.rejection : null;
      if (!parsed.success && !rejection) continue;
      ensureRun(db, context);
      const result = parsed.success ? { ok: true, ignoredIdentityFields: [] } : { ok: false, code: "invalid_artifact_envelope", errors: rejection, ignoredIdentityFields: [] };
      db.prepare("INSERT OR IGNORE INTO submissions(company,task,run,submission_id,content,envelope,rejection,result) VALUES (?,?,?,?,?,?,?,?)").run(
        ...identity(context), `legacy:${name}`, canonical(candidate.envelope), parsed.success ? JSON.stringify(parsed.value) : null, parsed.success ? null : JSON.stringify(rejection), JSON.stringify(result),
      );
    }
    db.prepare("INSERT INTO migrations(name) VALUES ('legacy-json')").run();
  }
  const identity = (context: RuntimeActionRunContext) => [context.companyId, context.taskId, context.runId];
  function ensureRun(db: DatabaseSync, context: RuntimeActionRunContext) {
    db.prepare("INSERT OR IGNORE INTO runs(company,task,run) VALUES (?,?,?)").run(...identity(context));
  }
  function read(db: DatabaseSync, context: RuntimeActionRunContext): RunSubmission {
    const run = db.prepare("SELECT revoked,hidden FROM runs WHERE company=? AND task=? AND run=?").get(...identity(context));
    if (!run || run.revoked || run.hidden) return NOTHING;
    const row = db.prepare("SELECT envelope,rejection FROM submissions WHERE company=? AND task=? AND run=? ORDER BY (envelope IS NOT NULL) DESC, sequence DESC LIMIT 1").get(...identity(context));
    return row ? decode(row) : NOTHING;
  }
  return {
    submitArtifactEnvelope(context, envelope, contract, submissionId = randomUUID()) {
      return withStore((db) => {
        ensureRun(db, context);
        const run = db.prepare("SELECT closed,revoked FROM runs WHERE company=? AND task=? AND run=?").get(...identity(context))!;
        if (run.revoked) return reject("run_closed", "This run no longer accepts submissions.");
        const content = canonical({ envelope, contract: contract ?? null });
        const previous = db.prepare("SELECT content,result FROM submissions WHERE company=? AND task=? AND run=? AND submission_id=?").get(...identity(context), submissionId);
        if (previous) return previous.content === content ? JSON.parse(previous.result as string) as SubmitArtifactEnvelopeResult : reject("submission_conflict", "Submission ID already has different content.");
        if (run.closed) return reject("run_closed", "This run no longer accepts new submissions.");
        const parsed = parseArtifactEnvelope(envelope);
        const errors = parsed.success ? contract ? artifactEnvelopeContractErrors(parsed.value, contract) : [] : parsed.errors;
        const valid = parsed.success && errors.length === 0;
        const result: SubmitArtifactEnvelopeResult = valid ? { ok: true, ignoredIdentityFields: parsed.ignoredIdentityFields }
          : { ok: false, code: "invalid_artifact_envelope", errors, ignoredIdentityFields: parsed.ignoredIdentityFields };
        db.prepare("INSERT INTO submissions(company,task,run,submission_id,content,envelope,rejection,result) VALUES (?,?,?,?,?,?,?,?)").run(...identity(context), submissionId, content, valid ? JSON.stringify(parsed.value) : null, valid ? null : JSON.stringify(errors), JSON.stringify(result));
        db.prepare("UPDATE runs SET hidden=0 WHERE company=? AND task=? AND run=?").run(...identity(context));
        return result;
      });
    },
    beginRun(context) {
      withStore((db) => {
        // A retried old begin must not revoke the already-running successor.
        if (db.prepare("SELECT 1 FROM runs WHERE company=? AND task=? AND run=?").get(...identity(context))) return;
        db.prepare("UPDATE runs SET revoked=1,closed=1 WHERE company=? AND task=? AND run<>?").run(...identity(context));
        ensureRun(db, context);
      });
    },
    revokeRun(context) {
      withStore((db) => {
        ensureRun(db, context);
        db.prepare("UPDATE runs SET revoked=1,closed=1 WHERE company=? AND task=? AND run=?").run(...identity(context));
      });
    },
    latestTaskRunContext(context) {
      return withStore((db) => {
        const row = db.prepare("SELECT run FROM runs WHERE company=? AND task=? AND revoked=0 AND hidden=0 ORDER BY rowid DESC LIMIT 1").get(context.companyId, context.taskId);
        return row ? { ...context, runId: row.run as string } : null;
      });
    },
    selectRunSubmission(context) {
      return withStore((db) => {
        ensureRun(db, context);
        db.prepare("UPDATE runs SET closed=1 WHERE company=? AND task=? AND run=?").run(...identity(context));
        return read(db, context);
      });
    },
    consumeRunSubmission(context) {
      return withStore((db) => {
        const result = read(db, context);
        db.prepare("UPDATE runs SET hidden=1 WHERE company=? AND task=? AND run=?").run(...identity(context));
        return result;
      });
    },
    latestTaskSubmission(context) {
      return withStore((db) => {
        const row = db.prepare("SELECT run FROM runs WHERE company=? AND task=? AND revoked=0 AND hidden=0 ORDER BY rowid DESC LIMIT 1").get(context.companyId, context.taskId);
        return row ? read(db, { ...context, runId: row.run as string }) : NOTHING;
      });
    },
    discardTask(context) {
      withStore((db) => { db.prepare("UPDATE runs SET revoked=1,closed=1 WHERE company=? AND task=?").run(context.companyId, context.taskId); });
    },
    auditRunSubmissions(context) {
      return withStore((db) => db.prepare("SELECT envelope,rejection FROM submissions WHERE company=? AND task=? AND run=? ORDER BY sequence").all(...identity(context)).map(decode));
    },
  };
}
function decode(row: Record<string, unknown>): RunSubmission {
  return { envelope: row.envelope ? JSON.parse(row.envelope as string) as ArtifactEnvelope : null, rejection: row.rejection ? JSON.parse(row.rejection as string) as string[] : null };
}
function reject(code: "run_closed" | "submission_conflict", message: string): SubmitArtifactEnvelopeResult {
  return { ok: false, code, errors: [message], ignoredIdentityFields: [] };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

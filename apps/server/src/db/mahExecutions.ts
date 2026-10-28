import type { DatabaseClient } from "./client";

export type MahExecutionState = "prepared" | "submitting" | "submitted" | "unknown" | "completed" | "failed" | "cancelled";
export type MahSlotClass = "background" | "interactive";
export type MahExecution = {
  runId: string; taskId: string; companyId: string; mahTaskId: string;
  projectRoot: string; requestDigest: string; state: MahExecutionState;
  createdAt: string; detail: string; deliveryWorkspacePath?: string;
  slotClass?: MahSlotClass;
  ownerEpoch?: number;
  inputBundleDigest?: string;
  deliveryManifestSha256?: string;
  context?: { locale: string; requireExecutionDetails: boolean; proofSchemaId: string; acceptedProofTypes: string[] };
};
export const mahTerminalStates = new Set<string>(["completed", "failed", "cancelled"]);
export function createMahExecutionStore(db: DatabaseClient) {
  return {
    get(runId: string): MahExecution | null {
      const row = db.prepare("SELECT record FROM mah_executions WHERE run_id = ?").get(runId) as {record:string}|undefined;
      return row ? JSON.parse(row.record) : null;
    },
    list(taskId: string): MahExecution[] {
      return (db.prepare("SELECT record FROM mah_executions WHERE task_id = ? ORDER BY rowid").all(taskId) as {record:string}[]).map(r => JSON.parse(r.record));
    },
    blocksDispatch(taskId: string): boolean {
      return Boolean(db.prepare(`SELECT 1 FROM mah_executions m WHERE m.task_id = ? AND
        (m.state NOT IN ('completed','failed','cancelled') OR (m.state='completed' AND NOT EXISTS
          (SELECT 1 FROM runtime_candidate_dispositions d WHERE d.task_id=m.task_id AND d.run_id=m.run_id))) LIMIT 1`).get(taskId));
    },
    save(record: MahExecution): void {
      db.prepare(`INSERT INTO mah_executions(run_id,task_id,record,state) VALUES(?,?,?,?)
        ON CONFLICT(run_id) DO UPDATE SET record=excluded.record,state=excluded.state`).run(record.runId, record.taskId, JSON.stringify(record), record.state);
    },
    claimSubmission(runId: string): boolean {
      const row = this.get(runId);
      if (!row) return false;
      return db.prepare("UPDATE mah_executions SET state='submitting', record=? WHERE run_id=? AND state='prepared'")
        .run(JSON.stringify({ ...row, state: "submitting" }), runId).changes === 1;
    },
  };
}

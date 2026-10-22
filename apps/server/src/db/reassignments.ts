import type { DatabaseClient } from "./client";

export type ReassignmentDecision = {
  id: string;
  taskId: string;
  companyId: string;
  requestDigest: string;
  ceoAgentId: string;
  previousAssigneeAgentId: string;
  assigneeAgentId: string | null;
  previousRunId: string | null;
  previousDecisionId: string | null;
  revision: number;
  status: "pending" | "applied" | "declined" | "failed" | "withdrawn";
  reason: string;
  basis: string;
  createdAt: string;
};

export function createReassignmentStore(database: DatabaseClient) {
  return {
    /** First write of the caller's transaction, before reading planning state. */
    lockTask(taskId: string): void {
      database.prepare("UPDATE tasks SET id = id WHERE id = ?").run(taskId);
    },
    get(taskId: string, id: string): ReassignmentDecision | null {
      const row = database.prepare("SELECT record FROM reassignment_decisions WHERE task_id = ? AND id = ?").get(taskId, id) as { record: string } | undefined;
      return row ? JSON.parse(row.record) as ReassignmentDecision : null;
    },
    list(taskId: string): ReassignmentDecision[] {
      return (database.prepare("SELECT record FROM reassignment_decisions WHERE task_id = ? ORDER BY rowid").all(taskId) as Array<{ record: string }>).map(row => JSON.parse(row.record) as ReassignmentDecision);
    },
    save(decision: ReassignmentDecision): void {
      database.prepare(`INSERT INTO reassignment_decisions (task_id, id, record) VALUES (?, ?, ?)
        ON CONFLICT(task_id, id) DO UPDATE SET record = excluded.record`).run(decision.taskId, decision.id, JSON.stringify(decision));
    },
    latestRunId(taskId: string): string | null {
      const row = database.prepare("SELECT id FROM agent_runs WHERE task_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1").get(taskId) as { id: string } | undefined;
      return row?.id ?? null;
    },
    linkRun(runId: string, taskId: string): void {
      const applied = this.list(taskId).filter(d => d.status === "applied").at(-1);
      if (applied) database.prepare("INSERT INTO reassignment_run_lineage (run_id, task_id, decision_id) VALUES (?, ?, ?)").run(runId, taskId, applied.id);
    },
    runLineage(runId: string): { taskId: string; decisionId: string } | null {
      const row = database.prepare("SELECT task_id, decision_id FROM reassignment_run_lineage WHERE run_id = ?").get(runId) as { task_id: string; decision_id: string } | undefined;
      return row ? { taskId: row.task_id, decisionId: row.decision_id } : null;
    },
    /** Internal write: called only in the validated CEO decision transaction. */
    setAssignee(taskId: string, expected: string, replacement: string): void {
      const changed = database.prepare("UPDATE tasks SET assignee_agent_id = ? WHERE id = ? AND assignee_agent_id = ?").run(replacement, taskId, expected);
      if (changed.changes !== 1) throw new Error("Reassignment source assignee changed");
    },
  };
}

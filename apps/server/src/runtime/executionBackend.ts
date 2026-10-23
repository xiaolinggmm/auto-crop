/** Explicit execution plane; MAH owns its internal executor selection (ADR 0050). */
export type ExecutionBackend = "direct" | "mah";

export class ExecutionBackendUnavailableError extends Error {
  readonly code: "mah_configuration_missing" | "invalid_execution_backend";
  constructor(backend: string) {
    super(backend === "mah"
      ? "MAH execution requires AUTO_CROP_MAH_PROJECT_ROOT pointing to an existing managed project. Direct-adapter fallback is forbidden."
      : `Unknown execution backend: ${backend}`);
    this.code = backend === "mah" ? "mah_configuration_missing" : "invalid_execution_backend";
  }
}

export function assertExecutionBackendAvailable(backend: string = process.env.AUTO_CROP_EXECUTION_BACKEND ?? "direct", mahConfigured = Boolean(process.env.AUTO_CROP_MAH_PROJECT_ROOT)): void {
  if (backend !== "direct" && !(backend === "mah" && mahConfigured)) throw new ExecutionBackendUnavailableError(backend);
}

/** A launch refusal is evidence only for this assignment and ownership generation. */
export function executorRefusalMarker(agentId: string, epoch: number): string {
  return `executor-refusal:${JSON.stringify({ agentId, epoch })}`;
}

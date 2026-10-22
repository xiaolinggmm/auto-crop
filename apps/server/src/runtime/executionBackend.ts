/** MAH is a reserved backend until its supported binding protocol is available. */
export type ExecutionBackend = "direct" | "mah";

export class ExecutionBackendUnavailableError extends Error {
  readonly code: "mah_protocol_unavailable" | "invalid_execution_backend";
  constructor(backend: string) {
    super(backend === "mah"
      ? "MAH execution is disabled: the required executor/action binding and settlement protocol is unavailable. Direct-adapter fallback is forbidden."
      : `Unknown execution backend: ${backend}`);
    this.code = backend === "mah" ? "mah_protocol_unavailable" : "invalid_execution_backend";
  }
}

export function assertExecutionBackendAvailable(backend: string = process.env.AUTO_CROP_EXECUTION_BACKEND ?? "direct"): void {
  if (backend !== "direct") throw new ExecutionBackendUnavailableError(backend);
}

/** A launch refusal is evidence only for this assignment and ownership generation. */
export function executorRefusalMarker(agentId: string, epoch: number): string {
  return `executor-refusal:${JSON.stringify({ agentId, epoch })}`;
}

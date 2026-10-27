# MAH Direct Tasks Bind One Executor and One Runtime Action Surface

Status: superseded by [ADR 0050](0050-mah-cli-delegation-and-file-delivery.md) for MAH integration. The body records the previous executor-binding proposal; durable Candidate and settlement principles are retained.

## Context

Cordantry is now a standard MAH project and will use MAH as its execution plane after the CEO assigns work. The current MAH carrier cannot express a required executor or a task-scoped Runtime Action Channel, while Cordantry's scheduler can silently substitute capability-matching adapters. Cordantry and MAH also use different Agent identity spaces. Prompt wording, global CLI configuration, and process-wide command wrappers cannot provide strict, auditable, concurrent execution.

## Decision

Cordantry submits an idempotent **Execution Request** containing typed **Execution Requirements**. It names a required Agent through a versioned **Executor Mapping**, forbids executor substitution, and references one registered Runtime Action Server by logical major version. Cordantry never supplies MAH's internal `to`, `forced_agent`, model snapshot, launcher command, arbitrary environment, path, or Governance Snapshot.

MAH validates static requirements at submission and volatile authentication, quota, capability, and local readiness immediately before launch. It then atomically freezes the required executor, a model chosen within that Agent, the Runtime Action Binding, and governance identity. The resulting **Execution Binding Receipt** records exact identities, mapping version, server implementation version and digest, and binding IDs. Repeating the same `execution_request_id` with identical content returns the same result; different content is a conflict.

One Task may have only one active Agent Run. A MAH continuation of the same admitted executor process retains the same Cordantry `runId` and bindings. Restarting a provider invocation requires Cordantry to create a new Agent Run, `runId`, and Execution Request. Cancellation, stopping, or reassignment terminates or fences the previous run and revokes its Runtime Action Binding; late candidates remain audit evidence but are ineligible for settlement.

MAH never substitutes another executor. It returns structured failures with retry and reassignment attributes. Cordantry's CEO may respond with a **Reassignment Decision** that keeps the Task and Key Result, creates a Planning Revision and new Agent Run, and preserves lineage. The default Reassignment Budget is two. A new model within the same Agent consumes execution recovery, not reassignment budget.

The project declares a logical Runtime Action Server and required tools; the machine-local MAH Registry resolves its trusted launcher. Task context is typed and allowlisted, initially including company, task, run, locale, Proof Schema, and execution-report requirements. Secrets are opaque references. The domain contract is the **Runtime Action Binding**; MCP stdio is its first adapter projection.

Every MAH-executed Cordantry Agent Run requires exactly one Runtime Action Binding. Within a run, the last valid Runtime Action Candidate wins and later invalid submissions do not erase it. Executor completion, candidate acceptance, and Business Settlement are distinct states. A candidate must remain replayable and idempotent until settlement commits. MAH records `awaiting_external_settlement` after executor completion; Cordantry returns a Runtime Action Settlement Receipt before the integration lifecycle becomes terminal. A settlement timeout remains queryable and never triggers a blind provider restart.

Claude and Codex are the first supported projections. AGY tasks requiring the Runtime Action Channel are rejected until AGY offers safe task-scoped MCP configuration; MAH must not mutate the user's global MCP registry or reassign the work. Once a project enables the MAH backend, it never silently falls back to Cordantry's legacy direct adapters.

## Consequences

- Cordantry's scheduler must stop capability-based substitution after an assignee is chosen.
- CEO replan must be able to change `assigneeAgentId` through a budgeted Reassignment Decision; execution layers still cannot change it.
- Runtime Action Candidate consumption must become durable across settlement rollback.
- Cordantry and MAH both persist receipt IDs, binding IDs, mapping versions, and immutable digests for reconciliation.
- Unknown execution state is resolved by querying `execution_request_id`; a new run waits for terminal state or a valid fence.
- The first release is accepted only when Claude and Codex route exactly and invoke the Runtime Action Channel, AGY rejects safely, global MCP configuration remains unchanged, retries are idempotent, revoked bindings reject late calls, interrupted runs reconcile, and candidates survive until committed settlement.

## Relationship To Existing Decisions

ADR 0040's prohibition on silent adapter switching remains authoritative. For the first MAH release, the backend uses an explicitly degraded minimal Execution Brief without a separate provider invocation. Structured preparation may return only when its invocation identity and budget are modeled explicitly.

ADR 0041 continues to define Artifact Envelope and Runtime Action Channel semantics. This ADR supersedes its rule that dispatch discards earlier candidates and its implication that consumption may delete a candidate before settlement commits. Superseded candidates lose settlement eligibility, but remain audit evidence. The channel remains a domain concept; MCP remains a projection.

ADR 0043's ordinary Revision still cannot change the assigned Agent. A CEO Reassignment Decision is the only exception, with its own authorization, lineage and budget; allowing an arbitrary `assigneeAgentId` in a general revision is not that exception. This ADR does not remove existing Founder approval requirements for other planning changes.

ADR 0035 remains the authority for one-writer Business Settlement. Candidate disposition, settlement receipt and receipt-delivery outbox join the same business transaction. Network calls and filesystem publication remain outside it.

## Recovery And Authority Clarifications

- Atomic freezing is local to MAH's durable admission boundary. Executor, model, Runtime Action Binding, governance identity and receipt are committed together before provider launch. It is not a distributed transaction with Cordantry. A durable launch claim prevents concurrent starts; an uncertain launch is reconciled or fenced, never blindly repeated.
- Request identity is scoped to the authenticated integration principal and MAH project. A versioned canonical request digest includes all caller-supplied execution semantics. Duplicate submission returns the same request identity and immutable admission result when available; a query returns its evolving lifecycle state. A persisted rejection is not re-evaluated under the same ID. A later attempt requires a new Run and request after the prior attempt is closed or fenced.
- Each Runtime Action submission has an idempotency key. The authoritative store assigns its sequence on first acceptance. Replaying an older submission does not make it newest. Invalid submissions never replace the latest valid candidate. Settlement selects an immutable candidate revision and digest after admission of further submissions is closed.
- Candidate persistence includes replayable evidence material: referenced workspace files must be retained or snapshotted with integrity checks before the workspace can be reused. Revocation changes eligibility, not retention. Candidate cleanup cannot occur before committed disposition and acknowledged receipt delivery; later cleanup follows an explicit audit-retention policy.
- Runtime Action submission and settlement both enforce binding identity, revocation and the current Run generation. A cancellation request is not a fence acknowledgement. A fence can exclude an old Run from business settlement without proving its process has stopped; shared workspace reuse still requires confirmed termination or effective write isolation.
- MAH session resume that starts a new provider process, active-turn restart and a model change are new invocations, even if the provider session ID is unchanged. They require a new Cordantry Run and request. The first projection must disable hidden restart paths or return a structured recovery requirement.
- Only the CEO can authorize reassignment. Applying that decision checks its expected planning revision and prior Run, records lineage and increments the task-lifetime reassignment count once in the same transaction. Ordinary revisions and execution retries do not reset that count. The default limit is two; exhausting it requires explicit business resolution, not an execution-layer substitution.
- Provider completion, failure or cancellation closes the execution phase, not business settlement. An admitted execution with no valid candidate still receives a durable rejected settlement outcome. Admission rejection before binding needs no candidate settlement receipt. Settlement receipt delivery is retried idempotently from a durable outbox; failure to deliver never reruns the provider.

## Implementation Gate

The implementation sequence, protocol state machine, crash recovery cases and release acceptance matrix are in [the implementation plan](../mah-execution-binding-plan.md). Proposed wire names there are requirements for a supported MAH extension, not claims about installed CLI support. MAH implementation is blocked until a development source checkout and supported build/test entry points are identified. `/Applications/MAH.app` is read-only evidence and must never be patched.

# MAH Execution Binding Implementation Plan

Historical plan: superseded for MAH integration by [the CLI delegation plan](mah-cli-delegation-plan.md) and ADR 0050. The Cordantry-only delivery record below describes commit 4ebcaf5, not the new backend.

Status: full MAH integration remains proposed and blocked at P0. A separately authorized Cordantry-only foundation is implemented on `codex/mah-execution-governance`; see the bounded acceptance record below. No live MAH/provider acceptance is claimed.

Authority: [ADR 0049](adr/0049-mah-direct-tasks-bind-executor-and-runtime-action.md), [Execution Governance Glossary](../GLOSSARY.md), [ADR 0035](adr/0035-a-settlement-is-one-transaction.md).

## Scope And Verified Baseline

After CEO assignment, Cordantry delegates execution to MAH while retaining planning and business settlement authority. Claude and Codex are the first supported projections. AGY requests requiring the Runtime Action Channel must be rejected before provider launch. Neither MAH executor substitution nor Cordantry legacy-adapter fallback is permitted.

Read-only inspection on 2026-10-20 found:

- Installed CLI: `/Applications/MAH.app/Contents/Resources/bin/mah`; runtime package version `0.1.1896`.
- Public `mah task submit` supports descriptions, task IDs and metadata. Its help does not expose the execution-binding protocol required here.
- Installed `packages/mah-protocol/dist/schema/task-request.js` requires a carrier addressed to `orchestrator` and rejects runtime routing fields including `forced_agent`. Metadata injection is not a supported substitute for Execution Requirements.
- Installed `mah-task-runtime/dist/core/direct-runtime-snapshot-host.js` already contains executor/model snapshot machinery. It is a seam to investigate in source, not proof of atomic Runtime Action binding support.
- Installed `mah-task-runtime/dist/adapters/shared/active-turn-restart-effect-host.js` can restart provider turns through session resume. That path must not silently retain a Cordantry Run identity.
- A MAH development source checkout has not been located. `/Users/shiyuncong/code/mah` contains operational material, not a verified development checkout.

The installed app is evidence only. Do not patch it, import private distribution modules as the integration contract, change global MCP registries, or use process-wide CLI wrappers. First identify the MAH repository, its governance, protocol ownership and supported build/test workflow. No proposed command or field below should be presented as currently available.

### P0 Execution Record — 2026-10-20

User authorized execution of this plan after the documentation review. Read-only discovery was performed through the installed CLI and filesystem:

| Check | Observed result |
|---|---|
| `mah --help`, `mah task submit --help`, `mah run --help` | Task execution CLI exists; no documented execution-binding or external-settlement submission contract |
| `mah app --help`, `mah project --help`, `mah project runtime --help` | App upgrade and project runtime management exist; no MAH source build command advertised |
| `mah project runtime list --format json` | Registered roots: `~/Documents/MAH Projects/mah-test-project`, `~/Documents/MAH Projects/my-mah-project`, `~/code/auto-crop`; no MAH development root |
| `mah bundle list --format json` | Empty registry |
| Installed package metadata outside `node_modules` | Version `0.1.1896`; no `scripts`, `repository` or `homepage` fields identifying a development build/source entry |
| Bounded home-directory package search | No MAH-named source package located within searched depth; dependency/build/cache directories were excluded, so this is not proof that no checkout exists elsewhere |
| Installed release scripts | Release/finalization process helpers exist; their presence does not supply source, a source build script or a supported protocol extension |

P0 remains blocked on an accessible MAH development checkout or a supported extension providing the required protocol. CLI presence is confirmed, but it does not satisfy this gate. A source location was requested from the user while discovery continued. No provider task was submitted, no installation/configuration was changed, and no implementation package is marked complete. P1–P5 retain their dependencies; do not invent an unsupported transport or enable the backend to bypass this gate.

Cordantry seams:

| Area | Existing code | Required change |
|---|---|---|
| Dispatch | `apps/server/src/runtime/scheduler.ts`, `adapterCandidates` | Exact assignee; backend selection cannot fall through to legacy |
| Preparation | `runtime/executionBrief.ts` | MAH first release synthesizes a degraded minimal brief without provider launch |
| Reassignment | `runtime/replanPlanner.ts`, `runtime/replan.ts` | Dedicated CEO-authorized decision, separate from ordinary Revision |
| Candidates | `runtime/runtimeActionChannel.ts` | Durable immutable submissions, sequence, idempotency and eligibility |
| Runtime tool | `runtime/runtimeActionMcpServer.ts` | Trusted binding verification and revocation checks on every call |
| Settlement | `runtime/executionSettlement.ts`, scheduler finalization | Candidate disposition, receipt and outbox inside the existing single-writer transaction |
| Recovery | `runtime/taskRefresh.ts`, `runtime/taskRecovery.ts`, reconciliation | No pre-commit deletion; reconcile by request and binding identity |

## Ownership

Cordantry owns Task, Key Result, CEO decisions, Planning Revisions, Run identity, execution recovery and reassignment budgets, Candidate validation and Business Settlement. It persists requests before sending them, verifies receipts against requirements, and reconciles unknown states.

MAH owns authenticated admission, executor resolution, machine-local Registry, readiness checks, atomic binding freeze, governance capture, provider launch, task-scoped tool projection, process termination evidence and external-settlement lifecycle.

The integration jointly defines versioned request, receipt, error and reconciliation contracts. MAH is authoritative for execution facts; Cordantry is authoritative for business outcome. Neither side infers the other's successful commit from a timeout.

## Proposed Protocol Contract

Transport and public CLI/API names must be agreed in the MAH source repository before coding. The following are semantic requirements.

| Record or operation | Required semantics |
|---|---|
| Execution Request | Schema version; request ID; company/task/run/planning-revision identity; required executor mapping reference/version/digest; substitution forbidden; logical Runtime Action Server major version and required tools; allowlisted delivery context |
| Request digest | Versioned canonical encoding of all caller execution semantics; reject unknown fields; retain canonical bytes and digest; exclude server-generated lifecycle timestamps |
| Executor Mapping | Explicit Cordantry assignee to MAH executor translation; resolve a fixed version, never infer from similar names; updates require a new request |
| Execution Binding Receipt | Request ID/digest, exact executor/model, mapping version/digest, binding IDs, governance identity/digest, Runtime Action Server implementation version/digest and frozen context digest |
| Candidate submission | Binding-authenticated context plus submission ID and envelope; caller envelope cannot assert trusted identities; store-assigned acceptance sequence, immutable candidate ID/digest and evidence references |
| Settlement receipt | Receipt ID, request/run/binding identity, candidate ID/digest or explicit absence, committed accepted/rejected disposition, reason and business outcome reference |
| Query | Lookup by request ID within authenticated principal/project scope; return immutable admission facts plus lifecycle revision, launch evidence, fence status and settlement acknowledgement |
| Cancel/fence | Idempotent request and durable acknowledgement, revocation generation, business-eligibility boundary and separate process/write-isolation evidence |
| Failure | Stable code, stage, request/binding IDs when present, retryable/reassignment-allowed attributes and recovery scope; those attributes never authorize MAH to reassign |

Cordantry does not supply `to`, `forced_agent`, model snapshots, launcher commands, arbitrary environment, filesystem paths or Governance Snapshots. MAH resolves workspace and launcher details from trusted project/Registry configuration. Secrets are opaque references. Frozen digests must be checked against material actually launched; changed or unavailable material fails closed.

Request IDs are unique within the authenticated integration principal and MAH project. Same ID and canonical content returns the existing request and its immutable admission result when available; lifecycle queries may advance. Different content conflicts. Concurrent submissions have one durable winner. Persisted rejection is final for that ID; later retries create a new Cordantry Run/request after safe closure. Transport retries reuse the existing ID.

Required failure classes include unsupported protocol, invalid requirements, mapping conflict, unsupported executor projection, executor unavailable, authentication/quota unavailable, binding failure, request-content conflict, revoked binding, unknown launch state and external-settlement timeout. AGY uses unsupported projection, not a fallback suggestion.

## State Machine

These are integration lifecycle states, not replacements for existing Cordantry Task statuses.

| State | Durable facts and allowed progression |
|---|---|
| `request_pending` | Cordantry has persisted Run/request before transport. Retry transport with same ID or query; do not create a replacement on timeout. |
| `admission_pending` | MAH has stored ID/digest. Static checks and volatile readiness precede freeze; no provider runs yet. |
| `admission_rejected` | Immutable failure without binding. Cordantry closes its attempt; no external Candidate settlement is required. |
| `bound` | MAH atomically persists executor, model, action binding, governance and receipt. Provider may start only through the unique launch claim. |
| `executing` | Launch evidence belongs to this binding and Run. Same-process interaction may continue; a new process requires a new request. |
| `awaiting_external_settlement` | Execution ended or was safely fenced. New candidate admission is closed. Frozen candidate selection or explicit absence awaits Cordantry disposition. |
| `settlement_committed` | Cordantry committed business outcome, Candidate disposition, receipt and outbox together. MAH may still report awaiting delivery. |
| `terminal` | MAH durably acknowledged the matching receipt, or the request was rejected before binding. Historical execution and fence evidence remain queryable. |

Revocation is a monotonic binding fact that can happen during execution; it cannot be undone by a late completion event. Fencing permits replacement only after the old Run loses business eligibility. Reusing a shared writable workspace additionally requires confirmed process termination or enforced write isolation. An old fenced integration may still await its rejected settlement receipt while the successor executes.

Failure or cancellation after binding follows external settlement with a rejected disposition if delivery is not eligible. Successful execution with no valid Candidate is also rejected; it is not silently treated as delivered. If all submissions were invalid, preserve the last validation errors. A valid pre-failure Candidate may be retained for an explicitly authorized recovery path only while its binding remains eligible; cancellation, stop or supersession makes it audit-only.

## Candidate And Settlement Discipline

1. Persist a submission before acknowledging it. Duplicate submission ID/content returns its prior result; different content conflicts. Sequence is assigned once, so an old retry cannot replace a newer valid submission.
2. Verify binding/revocation/current Run generation atomically with candidate acceptance. Invalid calls are recorded separately and do not clear a valid Candidate.
3. Close admission and select the last valid eligible Candidate under the same authority boundary. A concurrent submission either precedes closure and participates in selection, or is rejected. Store the selected revision and digest.
4. Preserve evidence referenced by the selected envelope. Capture immutable file snapshots outside the business transaction while holding workspace protection; verify digests before use. Candidate text alone is not sufficient replayability when its files can disappear.
5. Business settlement uses the existing first-write claim and epoch guard. Candidate disposition, business changes, Holds, Proof, event outbox, settlement receipt and delivery outbox commit together. No filesystem or network work runs inside this transaction.
6. After commit, publish existing handoff material through its established recovery boundary and deliver the receipt. Delivery failure retries the same receipt, never business effects or provider execution.
7. Garbage collection requires committed disposition and receipt acknowledgement plus the configured audit-retention policy. Replaced and late submissions stay ineligible evidence; dispatch never deletes them as a shortcut.

Prefer integrating Candidate metadata and receipt state into the existing durable database to make the transactional boundary enforceable. Evidence blobs may remain outside it with immutable references and lifecycle protection. Final storage schema is an implementation decision to review before migration.

## CEO Reassignment

The dedicated decision records decision ID, CEO authority, expected planning revision and prior Run, old/new assignee, reason, triggering failure and lineage. Apply it with a compare-and-set transaction that increments the task-lifetime reassignment count once and creates the new Planning Revision and successor Run/request record. It preserves Task and Key Result identity.

A successor is not admitted while the prior Run's launch state is unknown or its fence is unconfirmed. A decision may be recorded as pending while that prerequisite is resolved. Ordinary Revision, runtime retry and upstream recovery do not reset the reassignment count. Default budget: two committed reassignment decisions. Duplicate application returns the original decision without spending again. Same-Agent model changes spend execution recovery and still create a new invocation identity.

Founder approval rules for unrelated plan changes remain intact; Founder actions and execution-layer failure handlers cannot directly choose a replacement executor. No generic assignee patch endpoint bypasses this decision.

## Crash And Reconciliation Matrix

| Interruption | Required recovery |
|---|---|
| Cordantry persisted request, transport did not finish | Query/retry identical request; no new Run |
| MAH persisted rejection, response lost | Return same rejection |
| Binding committed, launch not yet claimed | Recover unique launch claim with the same immutable binding |
| Launch claimed, process-start outcome unknown | Reconcile using durable launch/process identity; if unresolved, stop and fence before any replacement |
| Provider active, Cordantry restarts | Query existing request; renew/reconcile ownership without dispatching a second provider |
| Candidate stored, tool response lost | Return original submission result; preserve sequence |
| Candidate selected, settlement rolls back | Reopen and retry same selection; no deletion or partial business state |
| Business commit succeeded, receipt send failed | Replay receipt outbox; no duplicate settlement |
| MAH acknowledged receipt, response lost | Identical receipt replay returns acknowledgement |
| Old completion/candidate arrives after fence | Reject eligibility; retain audit evidence; never unlock or settle successor |
| External-settlement deadline expires | Keep queryable awaiting state, surface recovery need, do not restart provider |

## Implementation Work Packages

| Package | Owner | Depends on | Deliverable and gate |
|---|---|---|---|
| P0 | Joint | None | Identify MAH source checkout/build/test entry points; agree versioned schemas, transition ownership and fixture vectors. No MAH code work until located. |
| P1 | MAH | P0 | Supported submit/query/cancel/receipt interface, durable idempotency, atomic freeze and unique launch claim; crash tests pass |
| P2 | Cordantry | P0 | Request/receipt/outbox persistence, immutable Candidate store and shared settlement integration; rollback/reopen tests pass |
| P3 | MAH | P1 | Registry resolution, task-scoped Claude/Codex projection, hidden-restart prohibition, revocation and AGY rejection |
| P4 | Cordantry | P1, P2 | Explicit MAH backend, exact assignee, degraded minimal brief, CEO-only reassignment and independent budgets |
| P5 | Joint | P3, P4 | Reconciliation, workspace safety and real-provider acceptance; enable backend only after matrix passes |

Each package must carry the pinned governance binding for its own repository, explicit writable paths, shared contract version, dependencies and acceptance evidence. Package definitions are a plan only; this document does not submit them or authorize provider runs. Shared contracts must be settled before independent implementations diverge.

## Release Acceptance Matrix

| ID | Scenario | Required evidence |
|---|---|---|
| A01 | CEO assigns Claude and Codex separately | Receipt identity matches actual provider launch; each invokes the bound Runtime Action tool and settles |
| A02 | Required executor unavailable/auth expired/quota exhausted | Structured failure; zero alternative-executor launches |
| A03 | AGY requires Runtime Action | Rejected before launch; zero global MCP changes and zero automatic reassignment |
| A04 | Runtime Action registration missing, digest changed or tool unavailable | No provider launch or partial binding |
| A05 | Duplicate/concurrent identical request, including lost response | Same request/receipt; one launch claim and no duplicate invocation |
| A06 | Same request ID with changed content | Conflict with no additional effects |
| A07 | Mapping/Registry changes before or after freeze | Fixed requested version; existing binding never drifts |
| A08 | Same-process continuation versus process/session resume | Same-process keeps identity; new invocation requires new Run/request even with same session ID |
| A09 | Cancel/stop/reassignment races with candidate and completion | Revoked calls fail; old output cannot settle or release successor ownership |
| A10 | Valid A, invalid B, valid C, then replay A | C selected; B never erases A; old replay never becomes newest |
| A11 | Candidate acknowledgement followed by server crash | Candidate and protected evidence survive reopen |
| A12 | Fail before/after business outbox insertion | Transaction rolls back wholly; selected Candidate remains replayable |
| A13 | Receipt lost after commit or acknowledgement | Same receipt retransmitted; exactly one business disposition |
| A14 | Two CEO reassignments, third attempt, duplicate decision | Two allowed by default; third refused; duplicate spends once; ordinary Revision cannot reset budget |
| A15 | Non-CEO assignee edit or runtime substitution | Authorization failure and no assignment change |
| A16 | Two dispatchers, stale epochs, unknown launch state | One eligible Run; no blind restart; stale writer cannot commit |
| A17 | Fenced provider still alive in shared workspace | Workspace reuse blocked until termination or effective isolation |
| A18 | MAH unavailable/unsupported protocol | Visible failure/pending recovery; zero legacy direct-adapter invocations |
| A19 | No Candidate, all-invalid Candidate, cancellation or provider failure | Explicit committed rejection with relevant errors; integration can acknowledge terminal outcome |
| A20 | Settlement timeout | Queryable unresolved state; no provider restart |
| A21 | Concurrent tasks with different bindings | Context cannot cross company/task/run boundaries; global MCP config hashes unchanged |
| A22 | Preparation under MAH backend | Explicit minimal/degraded brief and no extra provider invocation |

Use deterministic contract tests, two-connection/database-reopen tests and fault injection for P1–P4. P5 additionally requires real Claude/Codex evidence and before/after global-configuration hashes without exposing secrets. Passing mocks alone does not establish CLI compatibility. Record tested MAH/provider versions and binding digests in the acceptance report.

## Cordantry-Only Delivery Record — 2026-10-21

After source discovery failed and the user confirmed no MAH source URL was available, the user authorized independently verifiable Cordantry changes on a new branch. This does not waive P0 or complete P1–P5. `/Applications/MAH.app` was not modified. No real provider task was submitted for these checks.

### Delivered boundary

- The direct scheduler selects only the Task assignee. Missing/unavailable executors are refused; no capability-based substitution occurs. Refusal evidence is scoped to executor and execution epoch.
- `CORDANTRY_EXECUTION_BACKEND` defaults to `direct`. `mah` is reserved and throws `mah_protocol_unavailable` before scheduler dispatch; unknown values also fail closed. This is a disablement gate, not a MAH adapter. Existing direct preparation/brief behavior remains unchanged.
- Dedicated reassignment requests invoke only the configured CEO with a no-tool planning grant. The caller cannot name the replacement. Decisions persist pending/applied/declined/failed/withdrawn states, request digest, prior executor/Run/decision, and successor Run lineage. Duplicate requests replay; conflicting content fails. Two applied decisions exhaust the Task-lifetime budget, independently of execution-attempt resets.
- Assignment, epoch advancement, execution-attempt revision marker, Hold resolution, event and applied decision commit together. Protected Holds and active execution/workspace ownership block reassignment. Only after that commit is the named old Candidate Run revoked; failed/stale decisions retain its evidence eligibility. The main database epoch is the atomic business fence across the two stores.
- Runtime Action submissions now use a SQLite journal. Submission IDs provide content-conflict detection and stable replay ordering. Invalid submissions do not erase a valid Candidate. Admission closes before selection; selection is replayable after rollback. Superseded evidence is retained for audit. Legacy JSON candidates are imported once without deleting their originals.
- Business settlement/recovery records Candidate disposition within its transaction. Proof recovery first claims the expected status and epoch and checks execution/workspace ownership, preventing stale or duplicate business effects.

### API and operational recovery

`POST /api/tasks/:taskId/reassignment-decisions` accepts only `{"requestId":"unique-id","note":"optional context"}`. The configured CEO chooses an eligible executor or declines. `GET` on the same URL returns decision history. Repeating a request ID with identical content returns its existing result; use a new ID after a failed or withdrawn request.

If a process interruption leaves a request pending, inspect its history, then explicitly withdraw planning authority with `DELETE /api/tasks/:taskId/reassignment-decisions/:requestId`. Withdrawal is durable and idempotent; late CEO output cannot apply. It does not claim provider termination. The API has no new dashboard control in this slice.

### Bounded acceptance matrix

| Check | Evidence | Boundary |
|---|---|---|
| Exact assignee and disabled MAH backend | Scheduler tests for unavailable/missing assignee and pre-dispatch rejection | Does not prove MAH launch readiness or Claude/Codex projection |
| CEO-only choice and request idempotency | Reassignment and API tests; duplicate/pending/conflict/withdrawn requests | Planning uses mock adapters in acceptance |
| Lifetime budget and atomic revision | Two decisions allowed, third denied; event-write rollback; protected Holds; successor lineage | Full MAH request/receipt lineage remains future work |
| Candidate survives settlement rollback | Channel reopen and scheduler rollback tests | Durable envelope JSON only; referenced files are not immutable snapshots |
| Submission ordering and revocation | Invalid-after-valid, replay/conflict, closed/revoked, delayed duplicate begin tests | Does not implement MAH authenticated binding verification |
| Old-run business fence and duplicate recovery | Task refresh epoch race and durable disposition tests | MAH launch/process fence protocol still unavailable |
| Failed reassignment preserves Candidate | Old failed Run plus persisted Candidate; stale CEO response and injected transaction rollback | Revocation follows successful assignment commit |

The full release matrix A01–A22 is **not passed**. In particular, atomic Executor/Runtime Action Binding, authenticated MAH request admission, task-scoped Claude/Codex tool projection, explicit AGY projection rejection, immutable evidence blobs, external settlement receipts/outbox, process reconciliation and real-provider checks remain blocked or unimplemented. Because every MAH dispatch is disabled, no AGY MAH task can launch, but this is not acceptance of its future structured rejection protocol.

### Verification record — 2026-10-22

- `vitest run apps/server apps/cli packages/core`: **65 files / 935 tests passed**. Includes the final API withdrawal checks and both reassignment Candidate rollback regressions.
- `tsc --noEmit` for server, CLI, core and dashboard: passed. Server typecheck was repeated after the final API test additions.
- Spec review accepted the bounded slice; quality review identified premature old-Run revocation. The fix was reproduced with failing tests, corrected and reviewed closed.
- `git diff --check`: passed.
- Full root `vitest run` was **not green**: six dashboard suites lacked the dashboard-specific jsdom setup; two dashboard tests expected obsolete onboarding text; one CLI supervisor test timed out and its late cleanup reported a SQLite error. The complete backend/CLI/core rerun above passed, including supervisor tests.
- Running dashboard tests from `apps/dashboard` with their own config removed the environment failures: **155 passed / 2 failed**. Both remaining failures are in unchanged `App.test.tsx` and expect `说出愿景，组建你的团队`; unchanged `Onboarding.tsx` renders `app.title`, whose Chinese translation is `CEO 办公室`. No dashboard or test configuration changes are included in this branch. Full-repository green status is not claimed.

This delivery is recorded on `codex/mah-execution-governance` in the component repository (`components/auto-crop`), including the ADR and Glossary. The outer MAH project is a separate Git repository. No merge, push or installation update was performed.

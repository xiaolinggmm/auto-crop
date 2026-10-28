# Cordantry

Cordantry is an open-source local agent-company runtime.

It helps a founder run a "zero-person company" from their own computer: create a company, select a local agent such as Claude Code or Codex as the CEO, write a founder vision, and let Cordantry turn that vision into objectives, departments, tasks, proof, reviews, and follow-up work.

The project currently includes a local CLI runtime, a React dashboard, a SQLite-backed server, built-in Claude Code and Codex adapters, and a scheduler that coordinates agent work with proof collection, review, recovery, and a kill switch.

## Install the desktop app

For normal use, download the installer for your operating system from GitHub Releases. The desktop app
contains its own runtime and Dashboard, so Node.js, pnpm, terminal commands, and a source checkout are
not required. On first launch, choose the local project Cordantry may operate on.

Claude Code or Codex must still be installed and signed in locally. Cordantry detects them after the
project opens. See the [desktop installation and release guide](docs/desktop-distribution.md).

## What It Looks Like

Cordantry gives you a local control panel for running an agent company. Departments, tasks, proof, reviews, and recovery stay visible in one dashboard.

![Cordantry control panel](docs/assets/control-panel.png)

The output can be a real working artifact. In this example, a founder vision was turned into a runnable AI cover letter generator website.

![generated website example](docs/assets/generated-website-example.png)

## Quick Start From Source

1. Clone the repository:

```bash
git clone <repo-url> cordantry
cd cordantry
```

2. Install dependencies:

```bash
pnpm install
```

3. Run tests and type checks:

```bash
pnpm test
pnpm typecheck
```

4. Start the local Cordantry runtime:

```bash
CORDANTRY_PORT=8787 pnpm --filter @cordantry/cli start
```

`start` launches a Supervisor and its Worker. The Supervisor consumes execution events even when
no dashboard is open; `supervise` is an alias for the same supervised entry point. Ctrl-C or SIGTERM
stops the Supervisor and waits for the Worker to exit. The existing port, scheduler interval and
project-root environment settings are inherited by the Worker.

Only one Supervisor may run against a project's state directory. A second launch exits with an error
before starting a Worker. Startup records live in `.cordantry/supervisor.sqlite`; after a crash, they
are reclaimed only when both recorded local processes are confirmed absent. A surviving Worker,
reused PID, unavailable process check or another hostname causes a conservative refusal. Stop and
verify the recorded processes before retrying; do not delete the ownership file while they run.
This guards local CLI startup, not remote hosts or direct programmatic `startCordantry` callers.
When a Worker exits, the Supervisor reconciles its startup identity before launching a replacement.
Active run workspaces enter termination-confirmation isolation because detached Agents may still run.
Verify those processes have stopped before using the task's **Confirm termination** action. Isolation
has no lease expiry. Startup/restart reconciliation errors block Worker startup; pending identities
survive Supervisor restarts. Supervisor/host failure still needs a system process manager for restart.


Execution scheduling defaults to `observe`. The new lifecycle budget and independent health policy
can be explicitly enabled with `CORDANTRY_EXECUTION_POLICY=budget-v1`. See the
[isolated trial, controls and rollback guide](docs/execution-budget-opt-in.md) before enabling it.
The Task execution panel exposes budget balances, stop evidence and explicit continuation authorization;
automatic recovery remains report-only by default. P5 adds opt-in `brief-only-v1` recovery and initial
Codex samples; see the [scope, evidence and remaining threshold gates](docs/execution-health-p5-report.md).
Execution history retention is on by default: the Supervisor compacts old activity windows and removes
delivered events and intermediate metering once nothing reads them. Set `CORDANTRY_RETENTION=off` to keep
everything; periods and ceilings are in the [guide](docs/execution-budget-opt-in.md#执行历史保留).

5. In another terminal, start the dashboard:

```bash
VITE_CORDANTRY_API_URL=http://127.0.0.1:8787 pnpm --filter @cordantry/dashboard dev
```

6. Open the dashboard URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Environment Requirements

Required:

- Node.js 24 or newer.
- pnpm 11 or newer.
- Git.

Recommended package manager version:

```text
pnpm 11.9.0
```

The project uses Node's built-in `node:sqlite` module, so Node.js 24+ is required. On Node 24, `node:sqlite` may print an experimental warning during local runs and tests.

Python is not required for the current project runtime.

Optional:

- Claude Code, if you want to use Claude Code as a local CEO or worker agent.
- Codex CLI, if you want to use Codex as a local CEO or worker agent.
- Playwright Chromium, if you want to run dashboard E2E tests.

Main dependency versions currently used by the project include:

- TypeScript `^5.9.2`
- Vitest `^3.2.4`
- tsx `^4.23.12`
- React `^19.1.1`
- Vite `^7.1.3`
- Playwright `^1.62.1`
- Zod `^4.1.5`

## Usage

Start Cordantry from the repository you want it to operate on:

```bash
CORDANTRY_PORT=8787 pnpm --filter @cordantry/cli start
```

The CLI will:

- Create local runtime state under `.cordantry/`.
- Create `.cordantry/state.sqlite`.
- Start the local API server.
- Detect available Claude Code and Codex adapters.
- Print the local dashboard/API URL.

Choose an execution mode at the beginning of the company-creation form:

- **Direct dispatch (default):** the CEO plans work and Cordantry dispatches department tasks to their assigned local Agents. MAH is not required.
- **MAH coordination (advanced):** the CEO still plans work, but execution is delegated to MAH. Select an existing managed MAH project by its absolute path, and provide the MAH executable path if it is not on `PATH` (for example `/Applications/MAH.app/Contents/Resources/bin/mah`).

Both modes require an available CEO Agent. MAH creation checks project identity and slot availability before creating the company, preserving the form if checks fail. The slot defaults to `background`; advanced settings allow an explicit `interactive` choice. Slots never change automatically.

Each company saves its own mode and MAH project binding. The mode cannot be changed after creation. Settings can repair the connection to the same MAH project after an installation or directory move, but cannot replace the project. Existing unresolved MAH executions retain their UUIDs and must be reconciled before a new execution.

MAH outages do not prevent the app or Direct companies from running. The old global `CORDANTRY_EXECUTION_BACKEND`, `CORDANTRY_MAH_PROJECT_ROOT` and `CORDANTRY_MAH_SLOT` settings no longer select company execution behavior. `CORDANTRY_MAH_CLI` can still supply the default executable when a creation request omits it. Existing test companies are not migrated to infer their historical mode.

During development, run the dashboard separately:

```bash
VITE_CORDANTRY_API_URL=http://127.0.0.1:8787 pnpm --filter @cordantry/dashboard dev
```

In the dashboard:

1. Enter a company name.
2. Select a detected CEO agent.
3. Write the founder vision.
4. Choose a permission mode.
5. Create the company.
6. Review generated departments, tasks, proof, approvals, and live events.

## Development Commands

Run all tests:

```bash
pnpm test
```

Run type checks:

```bash
pnpm typecheck
```

Run the execution-health smoke (macOS/Linux; Windows skips this POSIX process test):

```bash
pnpm smoke:execution-health
```

This uses the real `start` CLI and production adapter with a local mock executable, temporary SQLite databases, and no paid model calls. It checks Worker death, rollback and restart after a reconciliation failure, workspace isolation while an Agent still writes, and duplicate delivery after a lost acknowledgement. The delivery lease is advanced in the disposable database to avoid waiting 30 seconds.

Run the older business-workflow mock smoke test (currently fails at SSE connection because the script omits the required `companyId`; see the [baseline record](docs/execution-health-p0-baseline.md)):

```bash
pnpm smoke:mock
```

Run a real-agent smoke test:

```bash
pnpm smoke:real-agent
```

Use Codex for the real-agent smoke test:

```bash
CORDANTRY_REAL_AGENT=codex pnpm smoke:real-agent
```

Run dashboard tests:

```bash
pnpm --filter @cordantry/dashboard test
pnpm --filter @cordantry/dashboard typecheck
```

Install Playwright Chromium and run E2E tests:

```bash
pnpm --filter @cordantry/dashboard exec playwright install chromium
pnpm --filter @cordantry/dashboard e2e
```

## Local Runtime Files

Cordantry stores local state inside the workspace it operates on:

```text
.cordantry/
  state.sqlite
  companies/<companyId>/
    departments/<departmentId>/Memory.md
    tasks/
    artifacts/
    proof/
    reviews/
    logs/
  workspaces/<taskId>/
```

Do not run Cordantry against a repository unless you are comfortable with it creating and modifying files under that workspace.

## Credits

This project is made by MAH.

MAH: [https://mah.bot/](https://mah.bot/)

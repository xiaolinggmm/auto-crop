# Desktop distribution

Cordantry ships as a self-contained desktop application. People using a release do not need Node.js,
pnpm, or a source checkout. They still need at least one supported Agent CLI installed and signed in:
Claude Code or Codex.

## First launch

1. Install and open Cordantry.
2. Choose the local project directory the company may operate on.
3. Cordantry starts its supervised Worker, opens the dashboard, and detects supported Agent CLIs.
4. Use **Cordantry → Open Project…** to change projects later.

The selected project is remembered. Runtime state and generated work remain inside that project under
`.cordantry/`. Desktop logs use the operating system's standard application log directory.

## Build locally

```bash
pnpm install
pnpm build
pnpm smoke:desktop
pnpm dist
```

Installers are written to `apps/desktop/release/`. The configured targets are:

- macOS: DMG and ZIP, arm64 or x64.
- Windows: NSIS installer.
- Linux: AppImage.

The desktop shell bundles the production dashboard, the Node runtime supplied by Electron, the
Cordantry Worker, and its Runtime Action MCP server. It does not download a runtime on first launch.

## GitHub Releases

Pushing a tag such as `v0.1.0` runs `.github/workflows/release-desktop.yml`. It builds each operating
system on its native runner, uploads the installers, and creates a GitHub Release.

Unsigned builds are suitable for local testing. Frictionless public installation requires platform
signing. Configure `CSC_LINK` and `CSC_KEY_PASSWORD` for macOS/Windows signing. For Apple notarization,
also configure `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` as repository secrets.

## Security boundary

The dashboard and API bind to a random loopback port. The Electron renderer has Node integration off,
context isolation on, and Chromium sandboxing on. Agent execution remains governed by Cordantry's
existing capability grants and Supervisor lifecycle.

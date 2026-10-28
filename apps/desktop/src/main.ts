import { spawn } from "node:child_process";
import { appendFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, Menu } from "electron";
import { superviseCordantry, type SupervisedCordantry } from "../../cli/src/commands/supervise";
import { agentPath, configuredProjectRoot, loadDesktopSettings, saveDesktopSettings } from "./runtime";

let window: BrowserWindow | null = null;
let supervised: SupervisedCordantry | null = null;
let shuttingDown = false;
const currentDir = dirname(fileURLToPath(import.meta.url));

function logPath(): string {
  return join(app.getPath("logs"), "cordantry.log");
}

function log(line: string): void {
  const message = `${new Date().toISOString()} ${line}\n`;
  process.stdout.write(message);
  try { appendFileSync(logPath(), message); } catch { /* Console logging remains available. */ }
}

function dashboardRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "dashboard")
    : resolve(currentDir, "../../dashboard/dist");
}

function resourcePath(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(currentDir, name);
}

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

async function selectProject(force = false): Promise<string | null> {
  const saved = configuredProjectRoot(
    process.env.CORDANTRY_PROJECT_ROOT,
    loadDesktopSettings(settingsPath()).projectRoot,
  );
  if (!force && saved && existsSync(saved) && statSync(saved).isDirectory()) return saved;

  const options = {
    title: "Choose the project Cordantry will operate on",
    buttonLabel: "Use this project",
    properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">,
  };
  const selected = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  const projectRoot = selected.filePaths[0];
  if (selected.canceled || !projectRoot) return null;
  saveDesktopSettings(settingsPath(), { projectRoot });
  return projectRoot;
}

async function startProject(projectRoot: string): Promise<void> {
  await supervised?.close();
  supervised = null;
  const port = await availablePort();
  const url = `http://127.0.0.1:${port}`;
  const workerPath = resourcePath("worker.mjs");
  const actionServerPath = resourcePath("runtime-action.mjs");
  const env = {
    ...process.env,
    PATH: agentPath(homedir(), process.env.PATH),
    ELECTRON_RUN_AS_NODE: "1",
    CORDANTRY_DASHBOARD_ROOT: dashboardRoot(),
    CORDANTRY_PORT: String(port),
    CORDANTRY_PROJECT_ROOT: projectRoot,
    CORDANTRY_RUNTIME_ACTION_SERVER: actionServerPath,
  };

  supervised = await superviseCordantry({
    projectRoot,
    log,
    spawnWorker: () => {
      const child = spawn(process.execPath, [workerPath], {
        cwd: projectRoot,
        env,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      child.stdout?.on("data", (chunk) => log(String(chunk).trimEnd()));
      child.stderr?.on("data", (chunk) => log(String(chunk).trimEnd()));
      return child;
    },
  });

  await waitForServer(`${url}/api/agents`, 30_000);
  if (!window || window.isDestroyed()) {
    window = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      title: "Cordantry",
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
  }
  await window.loadURL(url);
  window.show();
}

async function switchProject(): Promise<void> {
  const projectRoot = await selectProject(true);
  if (!projectRoot) return;
  try {
    await startProject(projectRoot);
  } catch (error) {
    dialog.showErrorBox("Cordantry could not start", `${(error as Error).message}\n\nLogs: ${logPath()}`);
  }
}

function installMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Cordantry",
      submenu: [
        { label: "Open Project…", accelerator: "CmdOrCtrl+O", click: () => void switchProject() },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

async function availablePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a local dashboard port."));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* The supervised worker is still starting. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`The local runtime did not become ready within ${Math.round(timeoutMs / 1000)} seconds.`);
}

app.on("before-quit", (event) => {
  if (shuttingDown || !supervised) return;
  event.preventDefault();
  shuttingDown = true;
  void supervised.close().finally(() => app.quit());
});

app.on("window-all-closed", () => app.quit());

void (async () => {
  await app.whenReady();
  installMenu();
  const projectRoot = await selectProject();
  if (!projectRoot) {
    app.quit();
    return;
  }
  try {
    await startProject(projectRoot);
  } catch (error) {
    dialog.showErrorBox("Cordantry could not start", `${(error as Error).message}\n\nLogs: ${logPath()}`);
    app.quit();
  }
})().catch((error) => {
  dialog.showErrorBox("Cordantry could not start", (error as Error).message);
  app.quit();
});

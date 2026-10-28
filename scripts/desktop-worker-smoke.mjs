import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(new URL("../apps/desktop/package.json", import.meta.url));
const electron = require("electron");

const projectRoot = mkdtempSync(join(tmpdir(), "cordantry-desktop-smoke-"));
const port = await availablePort();
const root = resolve(import.meta.dirname, "..");
const child = spawn(electron, [join(root, "apps/desktop/dist/worker.mjs")], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    CORDANTRY_DASHBOARD_ROOT: join(root, "apps/dashboard/dist"),
    CORDANTRY_PORT: String(port),
    CORDANTRY_PROJECT_ROOT: projectRoot,
    CORDANTRY_RUNTIME_ACTION_SERVER: join(root, "apps/desktop/dist/runtime-action.mjs"),
  },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

try {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`Worker handshake timed out.\n${output}`)), 15_000);
    child.once("error", reject);
    child.on("message", (message) => {
      if (message !== "worker-ready") return;
      child.send({ type: "worker-start", ownerId: "desktop-smoke-worker" });
      clearTimeout(timer);
      resolveReady();
    });
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}/api/agents`, 30_000);
  const [dashboard, agents] = await Promise.all([
    fetch(url),
    fetch(`${url}/api/agents`),
  ]);
  if (!dashboard.ok || !(await dashboard.text()).includes("<title>Cordantry</title>")) {
    throw new Error(`Dashboard was not served by the packaged worker.\n${output}`);
  }
  if (!agents.ok || !Array.isArray((await agents.json()).agents)) {
    throw new Error(`Agent API was not served by the packaged worker.\n${output}`);
  }
  console.log(`Desktop worker smoke passed at ${url}`);
} finally {
  child.kill("SIGTERM");
  await new Promise((resolveExit) => child.once("exit", resolveExit));
  rmSync(projectRoot, { recursive: true, force: true });
}

async function availablePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No TCP port was assigned."));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Desktop server did not become ready.\n${output}`);
}

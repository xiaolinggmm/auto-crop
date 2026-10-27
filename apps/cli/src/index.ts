#!/usr/bin/env node

import { startCordantry } from "./commands/start";
import { superviseCordantry } from "./commands/supervise";
import { resolveProjectRoot } from "./projectRoot";

const [, , command] = process.argv;

if (command === "start" || command === "supervise") {
  let stopping = false;
  let running: Awaited<ReturnType<typeof superviseCordantry>> | undefined;
  const stop = () => {
    stopping = true;
    if (running) void running.close().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    running = await superviseCordantry({ projectRoot: resolveProjectRoot() });
    if (stopping) await running.close();
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
} else if (command === "__worker" && process.send && process.connected) {
  // IPC permission is sent only after the parent has durably recorded this child's PID.
  // Parent death removes permission to dispatch, including during asynchronous adapter detection.
  process.on("disconnect", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  const permitted = new Promise<string>((resolve) => {
    process.once("message", (message) => {
      if (!message || typeof message !== "object" || !("type" in message) || message.type !== "worker-start"
        || !("ownerId" in message) || typeof message.ownerId !== "string" || !message.ownerId || !process.connected) process.exit(1);
      resolve(message.ownerId);
    });
  });
  process.send("worker-ready");
  const workerId = await permitted;
  process.on("message", message => {
    if (message && typeof message === "object" && "type" in message && message.type === "worker-probe" && process.connected) {
      process.send?.({ type: "worker-responsive", ownerId: workerId });
    }
  });
  await startCordantry({
    workerId,
    projectRoot: resolveProjectRoot(),
    port: Number(process.env.CORDANTRY_PORT ?? 0),
  });
} else {
  console.log("Usage: cordantry start | cordantry supervise");
  process.exitCode = 1;
}

export { startCordantry, superviseCordantry };

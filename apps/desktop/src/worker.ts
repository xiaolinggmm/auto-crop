import { startCordantry } from "../../cli/src/commands/start";

process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

if (!process.send || !process.connected) {
  throw new Error("The desktop worker must be launched by the Cordantry supervisor.");
}

const permitted = new Promise<string>((resolve) => {
  process.once("message", (message) => {
    if (!message || typeof message !== "object" || !("type" in message)
      || message.type !== "worker-start" || !("ownerId" in message)
      || typeof message.ownerId !== "string" || !message.ownerId || !process.connected) process.exit(1);
    resolve(message.ownerId);
  });
});

process.send("worker-ready");
void (async () => {
  const workerId = await permitted;
  await startCordantry({
    workerId,
    projectRoot: process.env.CORDANTRY_PROJECT_ROOT ?? process.cwd(),
    dashboardRoot: process.env.CORDANTRY_DASHBOARD_ROOT,
    port: Number(process.env.CORDANTRY_PORT ?? 0),
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

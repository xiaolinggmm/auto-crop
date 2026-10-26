import { build } from "esbuild";

const shared = {
  bundle: true,
  external: ["electron"],
  logLevel: "info",
  platform: "node",
  sourcemap: true,
  target: "node24",
};

await Promise.all([
  build({ ...shared, entryPoints: ["src/main.ts"], format: "esm", outfile: "dist/main.mjs" }),
  build({ ...shared, entryPoints: ["src/worker.ts"], format: "esm", outfile: "dist/worker.mjs" }),
  build({ ...shared, entryPoints: ["src/runtimeAction.ts"], format: "esm", outfile: "dist/runtime-action.mjs" }),
]);

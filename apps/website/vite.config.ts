import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/cordantry/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
} as UserConfig & { test: { environment: string; setupFiles: string } });

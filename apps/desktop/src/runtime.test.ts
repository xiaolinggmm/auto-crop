import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentPath, configuredProjectRoot, loadDesktopSettings, saveDesktopSettings } from "./runtime";

describe("desktop runtime", () => {
  it("adds common user CLI locations without dropping the inherited PATH", () => {
    const value = agentPath("/Users/founder", "/usr/bin:/bin", "darwin");

    expect(value.split(":")) .toEqual(expect.arrayContaining([
      "/Users/founder/.local/bin",
      "/Users/founder/.npm-global/bin",
      "/Users/founder/.bun/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ]));
  });

  it("persists the selected project and tolerates missing or invalid settings", () => {
    const root = mkdtempSync(join(tmpdir(), "cordantry-desktop-settings-"));
    const path = join(root, "settings.json");

    expect(loadDesktopSettings(path)).toEqual({});
    saveDesktopSettings(path, { projectRoot: "/work/my-company" });
    expect(loadDesktopSettings(path)).toEqual({ projectRoot: "/work/my-company" });

    writeFileSync(path, "not-json");
    expect(loadDesktopSettings(path)).toEqual({});
  });

  it("uses an explicit project root only when it is an existing directory", () => {
    const root = mkdtempSync(join(tmpdir(), "cordantry-desktop-project-"));

    expect(configuredProjectRoot(root, "/saved/project")).toBe(root);
    expect(configuredProjectRoot(join(root, "missing"), "/saved/project")).toBe("/saved/project");
  });
});

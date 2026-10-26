import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type DesktopSettings = {
  projectRoot?: string;
};

export function agentPath(home: string, inheritedPath: string | undefined, platform = process.platform): string {
  const separator = platform === "win32" ? ";" : ":";
  const additions = platform === "win32"
    ? []
    : [
        join(home, ".local", "bin"),
        join(home, ".npm-global", "bin"),
        join(home, ".bun", "bin"),
        join(home, ".cargo", "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
      ];
  return [...new Set([...additions, ...(inheritedPath ?? "").split(separator).filter(Boolean)])].join(separator);
}

export function loadDesktopSettings(path: string): DesktopSettings {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object") return {};
    const projectRoot = (value as { projectRoot?: unknown }).projectRoot;
    return typeof projectRoot === "string" && projectRoot ? { projectRoot } : {};
  } catch {
    return {};
  }
}

export function saveDesktopSettings(path: string, settings: DesktopSettings): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(temporary, path);
}

export function configuredProjectRoot(explicit: string | undefined, saved: string | undefined): string | undefined {
  if (explicit && existsSync(explicit) && statSync(explicit).isDirectory()) return explicit;
  return saved;
}

import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Company, CompanyMahConfig } from "@auto-crop/core";
import { mahCommand, preflightMahSlot, type MahCommand } from "../adapters/mahCli";

/** A stable managed-project identity, independent of its current filesystem location. */
export function readMahProjectIdentity(projectRoot: string): { projectRoot: string; projectId: string } {
  if (!isAbsolute(projectRoot)) throw new Error("Choose an absolute path to an existing MAH managed project.");
  try {
    const root = realpathSync(projectRoot);
    const manifest = JSON.parse(readFileSync(join(root, ".mah-project", "project.json"), "utf8"));
    if (typeof manifest.project_id !== "string" || !manifest.project_id.trim()) throw new Error("Missing project identity");
    return { projectRoot: root, projectId: manifest.project_id };
  } catch {
    throw new Error("MAH project is unavailable or has no .mah-project/project.json identity. Choose an existing managed project.");
  }
}

export async function checkCompanyMahConfig(value: unknown, command?: MahCommand): Promise<CompanyMahConfig> {
  if (!value || typeof value !== "object") throw new Error("Select an existing MAH project before creating this company.");
  const input = value as Record<string, unknown>;
  if (typeof input.projectRoot !== "string") throw new Error("MAH project path is required.");
  const identity = readMahProjectIdentity(input.projectRoot);
  const slotClass = input.slotClass ?? "background";
  if (slotClass !== "background" && slotClass !== "interactive") throw new Error("Choose a background or interactive MAH slot.");
  if (input.cliPath !== undefined && typeof input.cliPath !== "string") throw new Error("MAH executable path must be text.");
  const cliPath = (input.cliPath as string | undefined)?.trim() || process.env.AUTO_CROP_MAH_CLI || "mah";
  await preflightMahSlot({ command: command ?? mahCommand(cliPath), mahProjectRoot: identity.projectRoot, slotClass });
  return { ...identity, cliPath, slotClass };
}

type Readiness = { key: string; value: CompanyMahConfig | Error; expiresAt: number };
const readinessByRuntime = new WeakMap<object, Map<string, Readiness>>();

/** Poll external readiness independently: an offline CLI must never hold up Direct dispatch. */
export function companyMahReadiness(runtime: object, company: Company, command?: MahCommand): CompanyMahConfig | Error {
  if (!company.mahConfig) return new Error("MAH connection is missing. Repair this company's connection.");
  try {
    const identity = readMahProjectIdentity(company.mahConfig.projectRoot);
    if (identity.projectId !== company.mahConfig.projectId) return new Error("MAH project identity changed. Restore the original project connection.");
  } catch (error) { return error instanceof Error ? error : new Error(String(error)); }
  let entries = readinessByRuntime.get(runtime);
  if (!entries) { entries = new Map(); readinessByRuntime.set(runtime, entries); }
  const key = JSON.stringify(company.mahConfig);
  const cached = entries.get(company.id);
  if (cached?.key === key && cached.expiresAt > Date.now()) return cached.value;
  const pending: Readiness = { key, value: new Error("Checking this company's MAH connection. Tasks wait until it is ready."), expiresAt: Infinity };
  entries.set(company.id, pending);
  void checkCompanyMahConfig(company.mahConfig, command).then(config => {
    pending.value = config;
    pending.expiresAt = Date.now() + 30_000;
  }, error => {
    pending.value = error instanceof Error ? error : new Error(String(error));
    pending.expiresAt = Date.now() + 5_000;
  });
  return pending.value;
}

export function invalidateCompanyMahReadiness(runtime: object, companyId: string): void {
  readinessByRuntime.get(runtime)?.delete(companyId);
}

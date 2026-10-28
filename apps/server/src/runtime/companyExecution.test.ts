import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { Company } from "@cordantry/core";
import { checkCompanyMahConfig, companyMahReadiness, invalidateCompanyMahReadiness } from "./companyExecution";

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, {recursive: true, force: true})); });
function project(id: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "company-mah-")));
  roots.push(root);
  mkdirSync(join(root, ".mah-project"));
  writeFileSync(join(root, ".mah-project/project.json"), JSON.stringify({project_id: id}));
  return root;
}
const quota = {exitCode: 0, stdout: JSON.stringify({ok: true, agent_slots: {background: 1, interactive: 1}}), stderr: ""};
function company(id: string, projectRoot: string): Company {
  return {id, name: id, founderVision: "Work", locale: "en", selectedCeoAgentId: "codex", playbookId: "ai-saas", status: "active", createdAt: "now", updatedAt: "now", executionMode: "mah", mahConfig: {projectId: id, projectRoot, cliPath: "mah", slotClass: "background"}};
}

it("requires managed project identity and checks the explicitly selected slot", async () => {
  const root = project("one");
  let calls = 0;
  const command = async () => { calls++; return {...quota, stdout: JSON.stringify({ok: true, agent_slots: {background: 0, interactive: 1}})}; };
  await expect(checkCompanyMahConfig({projectRoot: root}, command)).rejects.toThrow(/background/);
  await expect(checkCompanyMahConfig({projectRoot: root, slotClass: "interactive"}, command)).resolves.toMatchObject({projectId: "one", slotClass: "interactive"});
  await expect(checkCompanyMahConfig({projectRoot: root, slotClass: "review"}, command)).rejects.toThrow(/background or interactive/);
  await expect(checkCompanyMahConfig({projectRoot: roots[0] + "/missing"}, command)).rejects.toThrow(/managed project/);
  expect(calls).toBe(2);
});

it("keeps independent pending checks and reuses a ready result for the same company", async () => {
  const runtime = {};
  const first = company("one", project("one"));
  const second = company("two", project("two"));
  const checked: string[][] = [];
  const command = async (args: string[]) => { checked.push(args); return quota; };
  expect(companyMahReadiness(runtime, first, command)).toBeInstanceOf(Error);
  expect(companyMahReadiness(runtime, second, command)).toBeInstanceOf(Error);
  await vi.waitFor(() => expect(companyMahReadiness(runtime, first, command)).toMatchObject({projectId: "one"}));
  expect(companyMahReadiness(runtime, second, command)).toMatchObject({projectId: "two"});
  expect(checked).toHaveLength(2);
  expect(checked.map(args => args[args.indexOf("--project-root") + 1])).toEqual([first.mahConfig!.projectRoot, second.mahConfig!.projectRoot]);
});

it("invalidates a failed check after repair and rejects replaced project identities even while cached", async () => {
  const runtime = {};
  const owner = company("one", project("one"));
  const offline = async () => ({exitCode: 1, stdout: "", stderr: "MAH offline"});
  companyMahReadiness(runtime, owner, offline);
  await vi.waitFor(() => expect((companyMahReadiness(runtime, owner, offline) as Error).message).toContain("offline"));
  invalidateCompanyMahReadiness(runtime, owner.id);
  const online = async () => quota;
  companyMahReadiness(runtime, owner, online);
  await vi.waitFor(() => expect(companyMahReadiness(runtime, owner, online)).toMatchObject({projectId: "one"}));
  writeFileSync(join(owner.mahConfig!.projectRoot, ".mah-project/project.json"), JSON.stringify({project_id: "replacement"}));
  expect((companyMahReadiness(runtime, owner, online) as Error).message).toContain("identity changed");
});

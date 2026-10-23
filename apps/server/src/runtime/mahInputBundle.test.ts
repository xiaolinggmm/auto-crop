import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildMahInputBundle } from "./mahInputBundle";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(p => rmSync(p, {recursive:true,force:true})));
it("transports only explicit handoff/verification directories with stable relative paths", () => {
  const root = mkdtempSync(join(tmpdir(), "mah-input-")); roots.push(root);
  mkdirSync(join(root,"files")); writeFileSync(join(root,"files","report.md"), "approved evidence");
  const bundle = buildMahInputBundle([{ path: root, mountPath: ".auto-crop-inputs/task-1" }]);
  expect(bundle.files).toHaveLength(1);
  expect(bundle.files[0]?.path).toBe(".auto-crop-inputs/task-1/files/report.md");
  expect(Buffer.from(bundle.files[0]!.data,"base64").toString()).toBe("approved evidence");
  expect(bundle.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  symlinkSync("/etc/passwd", join(root,"leak"));
  expect(() => buildMahInputBundle([{path:root,mountPath:"inputs"}])).toThrow(/symlink/i);
});
it("rejects traversal, duplicate mounts and excessive input", () => {
  const root = mkdtempSync(join(tmpdir(), "mah-input-")); roots.push(root);
  writeFileSync(join(root,"a"),"a");
  expect(() => buildMahInputBundle([{path:root,mountPath:"../outside"}])).toThrow(/path/i);
  expect(() => buildMahInputBundle([{path:root,mountPath:"inputs"},{path:root,mountPath:"inputs"}])).toThrow(/duplicate/i);
  writeFileSync(join(root,"big"),Buffer.alloc(2_000_001));
  expect(() => buildMahInputBundle([{path:root,mountPath:"inputs"}])).toThrow(/size|large/i);
});

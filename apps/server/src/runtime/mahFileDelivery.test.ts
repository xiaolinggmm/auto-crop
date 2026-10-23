import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import * as delivery from "./mahFileDelivery";

const roots: string[] = [];
const expected = { companyId: "company", taskId: "task", runId: "run", mahTaskId: "mah" };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mah-files-")); roots.push(root);
  const deliveryRoot = join(root, "source"); mkdirSync(deliveryRoot);
  const input = { deliveryRoot, archiveRoot: join(root, "archive"), expected, contract: { locale: "en" as const, requireDetails: false, proofRefs: { proofSchemaId: "files", acceptedTypes: ["file" as const] } } };
  const envelope = { artifact_kind: "deliverable", artifact_role: "report", artifact_subtype: "report", task_type: "research", payload: { outcome_summary: "Complete", execution_report: { conclusion: "Done", vision_impact: "Useful", remaining_gap: "None", recommendation: "Continue" } }, lineage: {}, file_refs: [{ path: "report.md" }], proof_refs: [{ type: "file", uri: "report.md" }] };
  writeFileSync(join(deliveryRoot, "report.md"), "Original report");
  const publish = (changes = {}) => writeFileSync(join(deliveryRoot, "delivery.json"), JSON.stringify({ schemaVersion: 1, ...expected, envelope, ...changes }));
  publish(); return { root, input, envelope, publish };
}
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
describe("MAH file delivery", () => {
  it("snapshots referenced files and replays unchanged after source disappears", () => {
    const { input } = fixture(); const first = delivery.collectMahFileDelivery(input);
    expect(first.workspacePath).not.toBe(input.deliveryRoot);
    expect(readFileSync(join(first.workspacePath, "report.md"), "utf8")).toBe("Original report");
    expect(first.envelope.proofRefs?.[0].uri).toBe("report.md");
    expect(first.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    rmSync(input.deliveryRoot, { recursive: true });
    expect(delivery.collectMahFileDelivery(input)).toEqual(first);
  });
  it("retains the exact verification inputs alongside output and verifies them on replay", () => {
    const { input } = fixture();
    const content = Buffer.from("accepted upstream version");
    const inputFiles = [{ path: ".auto-crop-verification/upstream/files/report.md", data: content.toString("base64"), sha256: createHash("sha256").update(content).digest("hex") }];
    const snapshot = delivery.collectMahFileDelivery({ ...input, inputFiles });
    expect(readFileSync(join(snapshot.workspacePath, inputFiles[0]!.path), "utf8")).toBe("accepted upstream version");
    writeFileSync(join(snapshot.workspacePath, inputFiles[0]!.path), "changed version");
    expect(() => delivery.collectMahFileDelivery({ ...input, inputFiles })).toThrow(/integrity/);
  });
  it("never overwrites a captured run", () => {
    const { input, publish } = fixture(); const first = delivery.collectMahFileDelivery(input);
    writeFileSync(join(input.deliveryRoot, "report.md"), "Changed"); publish({ taskId: "wrong" });
    expect(delivery.collectMahFileDelivery(input)).toEqual(first);
    expect(readFileSync(join(first.workspacePath, "report.md"), "utf8")).toBe("Original report");
  });
  it.each(["companyId", "taskId", "runId", "mahTaskId"])("rejects mismatched %s", field => {
    const { input, publish } = fixture(); publish({ [field]: "wrong" });
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(field);
  });
  it.each(["../outside", "/etc/passwd", "folder/../../outside", "C:\\outside", "report.md/.."])("rejects unsafe reference %s", path => {
    const { input, envelope, publish } = fixture(); envelope.file_refs = [{ path }]; publish();
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/relative|traversal|path/i);
  });
  it("rejects symlink escapes and directory references", () => {
    const { input } = fixture(); rmSync(join(input.deliveryRoot, "report.md"));
    symlinkSync("/etc/passwd", join(input.deliveryRoot, "report.md"));
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/symlink|regular/i);
    rmSync(join(input.deliveryRoot, "report.md")); mkdirSync(join(input.deliveryRoot, "report.md"));
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/regular/i);
  });
  it("rejects envelope symlinks and oversize input", () => {
    const { input } = fixture(); rmSync(join(input.deliveryRoot, "delivery.json"));
    symlinkSync("/etc/passwd", join(input.deliveryRoot, "delivery.json"));
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/symlink|regular/i);
    rmSync(join(input.deliveryRoot, "delivery.json")); writeFileSync(join(input.deliveryRoot, "delivery.json"), " ".repeat(2 * 1024 * 1024 + 1));
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/2 MiB|size/i);
  });
  it("preserves malformed originals for audit without repair", () => {
    const { input } = fixture(); const raw = '{"broken'; writeFileSync(join(input.deliveryRoot, "delivery.json"), raw);
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/invalid JSON.*audit/i);
    expect(readFileSync(join(input.deliveryRoot, "delivery.json"), "utf8")).toBe(raw);
  });
  it("uses existing delivery and proof contracts", () => {
    const { input, envelope, publish } = fixture(); envelope.payload = {} as typeof envelope.payload; publish();
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/outcome_summary|execution_report/);
    const other = fixture(); other.envelope.proof_refs[0].type = "url"; other.publish();
    expect(() => delivery.collectMahFileDelivery(other.input)).toThrow(/not accepted/);
  });
  it("detects a modified snapshot on replay", () => {
    const { input } = fixture(); const first = delivery.collectMahFileDelivery(input);
    writeFileSync(join(first.workspacePath, "report.md"), "tampered");
    expect(() => delivery.collectMahFileDelivery(input)).toThrow(/hash|integrity/i);
  });
  it("states the exact file protocol and preserves work after malformed delivery", () => {
    const prompt = delivery.fileDeliveryInstructions(expected, "/trusted/run");
    for (const value of ["/trusted/run/delivery.json", "schemaVersion", "JSON.stringify", "atomic", "relative", "rerun", "mahTaskId"]) expect(prompt).toContain(value);
  });
});

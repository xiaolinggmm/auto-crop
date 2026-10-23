import { expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proofRefsToProof } from "./proofReferences";
it("uses snapshotted command output for file delivery instead of the MAH CLI log", () => {
  const root = mkdtempSync(join(tmpdir(),"mah-proof-"));
  try {
    writeFileSync(join(root,"checks.txt"),"3 tests passed");
    const input = { refs: [{ type: "command_output" as const, uri: "checks.txt" }], task: { id:"t",proofSchemaId:"checks",workspacePath:root }, proofSchema: { id:"checks",acceptedTypes:["command_output" as const] }, logPath:"mah-status.log", createId:()=>"proof", commandOutputFromFile:true };
    expect(proofRefsToProof(input).proofs[0]?.uri).toBe(join(root,"checks.txt"));
    expect(proofRefsToProof({...input,refs:[{type:"command_output",uri:"absent.txt"}]}).errors).not.toEqual([]);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

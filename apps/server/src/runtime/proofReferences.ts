import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Proof, ProofSchema, Task } from "@cordantry/core";
import type { ProofReference } from "./artifactEnvelope";
import { proofRefTypeErrors } from "./businessArtifact";

export function proofRefsToProof(input: {
  refs: ProofReference[];
  task: Pick<Task, "id" | "proofSchemaId" | "workspacePath">;
  proofSchema?: Pick<ProofSchema, "id" | "acceptedTypes">;
  commandOutputFromFile?: boolean;
  logPath: string;
  createId: (prefix: string) => string;
}): { proofs: Proof[]; errors: string[] } {
  if (!input.proofSchema) {
    return { proofs: [], errors: [`no proof schema configured for ${input.task.proofSchemaId}`] };
  }

  const proofs: Proof[] = [];
  const policy = { proofSchemaId: input.proofSchema.id, acceptedTypes: input.proofSchema.acceptedTypes };
  const errors = proofRefTypeErrors(input.refs, policy);
  input.refs.forEach((ref, index) => {
    if (!policy.acceptedTypes.includes(ref.type)) {
      return;
    }

    const uri = resolveProofRefUri({
      ref,
      index,
      commandOutputFromFile: input.commandOutputFromFile,
      workspacePath: input.task.workspacePath,
      logPath: input.logPath,
      errors,
    });
    if (!uri) {
      return;
    }

    proofs.push({
      id: input.createId("proof"),
      taskId: input.task.id,
      type: ref.type,
      uri,
      summary: ref.summary ?? `Proof reference: ${uri}`,
      verifiedAt: null,
    });
  });

  return { proofs, errors };
}

function resolveProofRefUri(input: {
  ref: ProofReference;
  index: number;
  workspacePath: string | null;
  commandOutputFromFile?: boolean;
  logPath: string;
  errors: string[];
}): string | null {
  if (input.ref.type === "command_output" && !input.commandOutputFromFile) {
    return input.logPath;
  }

  if (input.ref.type === "url" || input.ref.type === "deployment") {
    try {
      const url = new URL(input.ref.uri);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return input.ref.uri;
      }
    } catch {
      // fall through to the structured error below
    }
    input.errors.push(`proof_refs[${input.index}].uri must be an http(s) URL for ${input.ref.type}`);
    return null;
  }

  if (!input.workspacePath) {
    input.errors.push(`proof_refs[${input.index}].uri cannot be resolved because the task has no workspace`);
    return null;
  }

  const absolute = resolve(input.workspacePath, input.ref.uri);
  const relativePath = relative(input.workspacePath, absolute);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    input.errors.push(`proof_refs[${input.index}].uri resolves outside the task workspace`);
    return null;
  }
  if (!existsSync(absolute)) {
    input.errors.push(`proof_refs[${input.index}].uri does not exist in the task workspace`);
    return null;
  }
  return absolute;
}


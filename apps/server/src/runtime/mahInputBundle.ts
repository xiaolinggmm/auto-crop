import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type MahInputDirectory = { path: string; mountPath: string };
/** Only runtime-selected accepted handoffs and verification snapshots; never scans the project. */
export function buildMahInputBundle(directories: MahInputDirectory[]) {
  const files: { path: string; encoding: "base64"; data: string; sha256: string }[] = [];
  let total = 0;
  const paths = new Set<string>();
  function visit(source: string, target: string) {
    if (!target || isAbsolute(target) || /[\\\0:]/.test(target) || target.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Unsafe MAH input mount path");
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error("MAH input symlink refused");
    if (stat.isDirectory()) { for (const name of readdirSync(source).sort()) visit(join(source, name), `${target}/${name}`); return; }
    if (!stat.isFile() || stat.size > 2_000_000) throw new Error("MAH input file type or size unsupported");
    if (paths.has(target)) throw new Error("Duplicate MAH input path");
    paths.add(target);
    const fd = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let bytes: Buffer;
    try {
      if (!fstatSync(fd).isFile()) throw new Error("MAH input is not a regular file");
      bytes = readFileSync(fd);
    } finally { closeSync(fd); }
    total += bytes.length;
    if (bytes.length > 2_000_000 || total > 8_000_000 || files.length >= 128) throw new Error("MAH input bundle exceeds size/count limit");
    files.push({ path: target, encoding: "base64", data: bytes.toString("base64"), sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  for (const directory of directories) visit(directory.path, directory.mountPath);
  return { schemaVersion: 1, files };
}

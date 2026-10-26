import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function serveDashboardFile(
  response: ServerResponse,
  dashboardRoot: string,
  pathname: string,
): Promise<boolean> {
  if (pathname.startsWith("/api/")) return false;

  const root = resolve(dashboardRoot);
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return false;
  }

  const requested = resolve(root, relativePath || "index.html");
  const filePath = requested === root || !requested.startsWith(`${root}${sep}`)
    ? resolve(root, "index.html")
    : await isFile(requested) ? requested : resolve(root, "index.html");

  if (!filePath.startsWith(`${root}${sep}`) || !(await isFile(filePath))) return false;

  const body = await readFile(filePath);
  const isIndex = filePath === resolve(root, "index.html");
  response.writeHead(200, {
    "cache-control": isIndex ? "no-cache" : "public, max-age=31536000, immutable",
    "content-type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
  });
  response.end(body);
  return true;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

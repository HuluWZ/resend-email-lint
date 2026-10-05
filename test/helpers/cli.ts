import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
export const MCP = fileURLToPath(new URL("../../dist/mcp.js", import.meta.url));

export function runCli(args: string[], input?: string) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, input, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

import { execFileSync } from "node:child_process";

/** E2E tests exercise the built binaries, so make sure dist/ is fresh. */
export default function setup(): void {
  // Run tsup through node: "npx" is npx.cmd on Windows, which execFileSync cannot spawn without a shell.
  execFileSync(process.execPath, ["node_modules/tsup/dist/cli-default.js", "--silent"], {
    stdio: "inherit",
  });
}

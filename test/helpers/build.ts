import { execFileSync } from "node:child_process";

/** E2E tests exercise the built binaries, so make sure dist/ is fresh. */
export default function setup(): void {
  execFileSync("npx", ["tsup", "--silent"], { stdio: "inherit" });
}

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, runCli } from "../helpers/cli.js";

const BAD = "examples/bad.html";
const GOOD = "examples/good.html";

describe("cli", () => {
  it("exits 1 and prints diagnostics for a bad file", () => {
    const r = runCli([BAD]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("(img-alt)");
    expect(r.stdout).toMatch(/4 errors, 5 warnings/);
  });

  it("exits 0 for a clean file", () => {
    const r = runCli([GOOD]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("No problems found in 1 file.");
  });

  it("lints directories recursively", () => {
    const r = runCli(["examples", "-f", "json"]);
    expect(r.code).toBe(1);
    const files = (JSON.parse(r.stdout) as { file: string }[]).map((x) => x.file);
    expect(files).toEqual([join("examples", "bad.html"), join("examples", "good.html")]);
  });

  it("lints stdin with -", () => {
    const r = runCli(["-"], '<img src="a.png">');
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("<stdin>");
  });

  it("supports --ignore and --max-warnings", () => {
    const ignoreErrors = ["-i", "img-alt", "-i", "img-src-relative", "-i", "link-href", "-i", "no-script"];
    expect(runCli([BAD, ...ignoreErrors]).code).toBe(0);
    expect(runCli([BAD, ...ignoreErrors, "--max-warnings", "0"]).code).toBe(1);
    expect(runCli([BAD, ...ignoreErrors, "--max-warnings", "5"]).code).toBe(0);
  });

  it("--marketing enables bulk-mail rules", () => {
    expect(runCli([GOOD]).stdout).not.toContain("missing-unsubscribe");
    expect(runCli([GOOD, "--marketing"]).stdout).toContain("missing-unsubscribe");
  });

  it("reads .emaillintrc.json and lets CLI flags add to it", () => {
    const dir = mkdtempSync(join(tmpdir(), "emaillint-"));
    const html = join(ROOT, GOOD);
    writeFileSync(
      join(dir, ".emaillintrc.json"),
      JSON.stringify({ marketing: true, ignore: ["missing-unsubscribe"] }),
    );
    expect(runCli([html], undefined, dir).stdout).not.toContain("missing-unsubscribe");
    writeFileSync(join(dir, ".emaillintrc.json"), JSON.stringify({ marketing: true }));
    expect(runCli([html], undefined, dir).stdout).toContain("missing-unsubscribe");
    expect(runCli([html, "-i", "missing-unsubscribe"], undefined, dir).stdout).not.toContain(
      "missing-unsubscribe",
    );
  });

  it("exits 2 on an invalid config", () => {
    const dir = mkdtempSync(join(tmpdir(), "emaillint-"));
    writeFileSync(join(dir, ".emaillintrc.json"), '{"ignore":"html-lang"}');
    const r = runCli([join(ROOT, GOOD)], undefined, dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ignore must be an array");
  });

  it("--list-rules and --help exit 0", () => {
    expect(runCli(["--list-rules"]).stdout).toContain("img-alt");
    expect(runCli(["-h"]).stdout).toContain("Usage:");
  });

  it.each([
    [["nope.html"], "File not found"],
    [[GOOD, "-f", "xml"], "Unknown format"],
    [[GOOD, "-i", "bogus"], "Unknown rule"],
    [[GOOD, "--max-warnings", "abc"], "non-negative integer"],
    [[], "Usage:"],
  ])("exits 2 for usage error %j", (args, message) => {
    const r = runCli(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(message);
  });

  it("exits 2 when a directory has no html files", () => {
    const r = runCli(["test/helpers"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("No .html files found");
    expect(ROOT).toBeTruthy();
  });
});

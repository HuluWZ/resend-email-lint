import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectFiles } from "../../src/files.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rel-"));
  await mkdir(join(dir, "sub"));
  await mkdir(join(dir, "node_modules"));
  await mkdir(join(dir, ".hidden"));
  for (const f of ["b.html", "a.HTM", "notes.txt", "sub/c.html", "node_modules/x.html", ".hidden/y.html"]) {
    await writeFile(join(dir, f), "<p></p>");
  }
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe("collectFiles", () => {
  it("walks directories recursively, sorted, skipping node_modules, dotfolders and non-html", async () => {
    expect(await collectFiles([dir])).toEqual([
      join(dir, "a.HTM"),
      join(dir, "b.html"),
      join(dir, "sub/c.html"),
    ]);
  });

  it("passes explicit files through untouched, even without an html extension", async () => {
    const f = join(dir, "notes.txt");
    expect(await collectFiles([f])).toEqual([f]);
  });

  it("rejects a missing path with ENOENT", async () => {
    await expect(collectFiles([join(dir, "nope")])).rejects.toMatchObject({ code: "ENOENT" });
  });
});

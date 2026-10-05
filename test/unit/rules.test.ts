import { describe, expect, it } from "vitest";
import { lintHtml, ruleIds, rules } from "../../src/index.js";

describe("rule registry", () => {
  it("has unique ids and non-empty descriptions", () => {
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
    for (const r of rules) expect(r.description.length).toBeGreaterThan(10);
  });
});

describe("diagnostic positions", () => {
  it("reports 1-based line and column", () => {
    const r = lintHtml('<p>hi</p>\n  <img src="https://x.co/a.png">');
    expect(r.diagnostics[0]).toMatchObject({ rule: "img-alt", line: 2, column: 3 });
  });

  it("sorts diagnostics by position", () => {
    const r = lintHtml('<script></script>\n<img src="https://x.co/a.png">');
    expect(r.diagnostics.map((d) => d.line)).toEqual([1, 2]);
  });
});

describe("other rules", () => {
  const ids = (html: string, o = {}) => lintHtml(html, o).diagnostics.map((d) => d.rule);

  it("flags external stylesheets only", () => {
    expect(ids('<link rel="stylesheet" href="https://x.co/a.css">')).toContain("no-external-css");
    expect(ids('<link rel="icon" href="https://x.co/a.ico">')).not.toContain("no-external-css");
  });

  it("flags scripts", () => {
    expect(ids("<script>1</script>")).toContain("no-script");
  });

  it("only applies document rules to full documents", () => {
    expect(ids("<p>fragment</p>")).toEqual([]);
    expect(ids("<html><body></body></html>")).toEqual(
      expect.arrayContaining(["missing-doctype", "html-lang", "missing-title"]),
    );
  });

  it("accepts a doctype preceded by a comment", () => {
    const html = '<!-- c --><!DOCTYPE html><html lang="en"><head><title>t</title></head></html>';
    expect(ids(html)).toEqual([]);
  });

  it("requires a real unsubscribe link in marketing mode", () => {
    expect(ids("<p>unsubscribe</p>", { marketing: true })).toContain("missing-unsubscribe");
    expect(ids('<a href="https://x.co/unsubscribe">Leave</a>', { marketing: true })).not.toContain(
      "missing-unsubscribe",
    );
    expect(ids("<p>nothing</p>")).not.toContain("missing-unsubscribe");
  });

  it("honours ignore", () => {
    expect(ids("<script></script>", { ignore: ["no-script"] })).toEqual([]);
  });
});

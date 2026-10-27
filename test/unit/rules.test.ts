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
    const r = lintHtml('<script></script>\n<img src="https://x.co/a.png" width="1" height="1">');
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

describe("client compatibility rules", () => {
  const ids = (html: string) => lintHtml(html).diagnostics.map((d) => d.rule);

  it("css-unsupported flags flex, grid and positioning in style attrs and <style>", () => {
    expect(ids('<div style="display:flex">x</div>')).toContain("css-unsupported");
    expect(ids('<div style="Position: absolute">x</div>')).toContain("css-unsupported");
    expect(ids("<style>.a{display:grid}</style>")).toContain("css-unsupported");
    expect(ids('<div style="display:block;position:relative">x</div>')).not.toContain("css-unsupported");
  });

  it("style-in-body flags <style> in the body only", () => {
    const doc = (head: string, body: string) =>
      `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
    expect(ids(doc("", "<style>a{}</style>"))).toContain("style-in-body");
    expect(ids(doc("<style>a{}</style>", ""))).not.toContain("style-in-body");
  });

  it("table-role flags layout tables without a role", () => {
    expect(ids("<table><tr><td>x</td></tr></table>")).toContain("table-role");
    expect(ids('<table role="presentation"><tr><td>x</td></tr></table>')).not.toContain("table-role");
    expect(ids("<table><tr><th>x</th></tr></table>")).not.toContain("table-role");
  });

  it("link-text flags generic link text only", () => {
    expect(ids('<a href="https://x.co"> Click Here </a>')).toContain("link-text");
    expect(ids('<a href="https://x.co">Reset your password</a>')).not.toContain("link-text");
    expect(
      ids('<a href="https://x.co"><img src="https://x.co/a.png" alt="" width="1" height="1"></a>'),
    ).not.toContain("link-text");
  });
});

describe("inline disables", () => {
  it("silences listed rules on the next line only", () => {
    const html =
      '<!-- email-lint-disable-next-line img-alt, img-dimensions -->\n<img src="https://x.co/a.png">\n<img src="https://x.co/b.png">';
    const r = lintHtml(html).diagnostics;
    expect(r.every((d) => d.line === 3)).toBe(true);
    expect(r.map((d) => d.rule)).toContain("img-alt");
  });
});

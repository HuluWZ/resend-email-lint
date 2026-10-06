import { describe, expect, it } from "vitest";
import { GMAIL_CLIP_BYTES, lintHtml } from "../../src/index.js";

const ids = (html: string, opts = {}) => lintHtml(html, opts).diagnostics.map((d) => d.rule);

const GOOD_DOC = `<!DOCTYPE html>
<html lang="en"><head><title>Welcome</title></head>
<body><img src="https://cdn.example.com/a.png" alt="Logo" width="120" height="40"><a href="https://example.com">Go</a></body></html>`;

describe("lintHtml", () => {
  it("passes a clean document", () => {
    const r = lintHtml(GOOD_DOC);
    expect(r.diagnostics).toEqual([]);
    expect(r.errorCount).toBe(0);
  });

  it("flags images without alt but allows empty alt", () => {
    expect(ids('<img src="https://x.co/a.png">')).toContain("img-alt");
    expect(ids('<img src="https://x.co/a.png" alt="">')).not.toContain("img-alt");
  });

  it("flags relative image URLs, accepts absolute, cid and data", () => {
    expect(ids('<img src="/a.png" alt="">')).toContain("img-src-relative");
    expect(ids('<img src="a.png" alt="">')).toContain("img-src-relative");
    for (const src of ["https://x.co/a.png", "cid:logo", "data:image/png;base64,AAA", "//x.co/a.png"]) {
      expect(ids(`<img src="${src}" alt="">`)).not.toContain("img-src-relative");
    }
  });

  it("warns on images missing width or height", () => {
    const msg = (html: string) => lintHtml(html).diagnostics.find((d) => d.rule === "img-dimensions");
    expect(msg('<img src="https://x.co/a.png" alt="" height="40">')).toMatchObject({
      severity: "warning",
      message: expect.stringMatching(/no width attribute.*Outlook/),
    });
    expect(msg('<img src="https://x.co/a.png" alt="" width="120">')?.message).toMatch(/no height attribute/);
    expect(msg('<img src="https://x.co/a.png" alt="">')?.message).toMatch(/no width or height attribute/);
    expect(msg('<img src="https://x.co/a.png" alt="" width="120" height="40">')).toBeUndefined();
  });

  it("flags empty, hash and javascript links", () => {
    expect(ids('<a href="">x</a>')).toContain("link-href");
    expect(ids('<a href="#">x</a>')).toContain("link-href");
    expect(ids('<a href="javascript:alert(1)">x</a>')).toContain("link-href");
    expect(ids("<a>x</a>")).toContain("link-href");
    expect(ids('<a href="mailto:a@b.co">x</a>')).not.toContain("link-href");
  });

  it("warns on http links", () => {
    const r = lintHtml('<a href="http://example.com">x</a>');
    expect(r.diagnostics[0]).toMatchObject({ rule: "link-https", severity: "warning" });
  });

  it("flags script tags and external stylesheets", () => {
    expect(ids("<script>1</script>")).toContain("no-script");
    expect(ids('<link rel="stylesheet" href="https://x.co/a.css">')).toContain("no-external-css");
    expect(ids('<link rel="icon" href="x.ico">')).not.toContain("no-external-css");
  });

  it("warns when HTML exceeds the Gmail clipping size", () => {
    const big = "<p>" + "a".repeat(GMAIL_CLIP_BYTES) + "</p>";
    expect(ids(big)).toContain("html-size");
    expect(ids("<p>small</p>")).not.toContain("html-size");
  });

  it("only applies document rules to full documents", () => {
    expect(ids("<p>fragment</p>")).toEqual([]);
    const doc = ids("<html><body><p>hi</p></body></html>");
    expect(doc).toEqual(expect.arrayContaining(["missing-doctype", "html-lang", "missing-title"]));
  });

  it("runs marketing rules only when enabled", () => {
    expect(ids("<p>sale</p>")).not.toContain("missing-unsubscribe");
    expect(ids("<p>sale</p>", { marketing: true })).toContain("missing-unsubscribe");
    expect(ids('<a href="https://x.co/unsubscribe">Unsubscribe</a>', { marketing: true })).not.toContain(
      "missing-unsubscribe",
    );
  });

  it("honours ignore", () => {
    expect(ids('<img src="https://x.co/a.png">', { ignore: ["img-alt", "img-dimensions"] })).toEqual([]);
  });

  it("reports 1-based line and column", () => {
    const r = lintHtml('<p>ok</p>\n<p>\n  <img src="https://x.co/a.png">\n</p>');
    expect(r.diagnostics[0]).toMatchObject({ rule: "img-alt", line: 3, column: 3 });
  });

  it("sorts diagnostics by position and counts severities", () => {
    const r = lintHtml('<a href="http://x.co">x</a>\n<img src="https://x.co/a.png" width="1" height="1">');
    expect(r.diagnostics.map((d) => d.line)).toEqual([1, 2]);
    expect(r.errorCount).toBe(1);
    expect(r.warningCount).toBe(1);
  });
});

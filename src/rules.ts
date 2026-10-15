import type { HTMLElement } from "node-html-parser";
import type { LintOptions, Severity } from "./types.js";

export interface RuleContext {
  root: HTMLElement;
  html: string;
  options: LintOptions;
  /** True when the input is a full document rather than a fragment. */
  isDocument: boolean;
  report: (offset: number, message: string) => void;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  /** Only run when `marketing` is enabled. */
  marketingOnly?: boolean;
  /** Only run on full documents, not fragments. */
  documentOnly?: boolean;
  check: (ctx: RuleContext) => void;
}

/** Gmail clips messages larger than roughly 102 KB. */
export const GMAIL_CLIP_BYTES = 102 * 1024;

const start = (el: HTMLElement) => el.range[0];

export const rules: Rule[] = [
  {
    id: "img-alt",
    severity: "error",
    description: "Images need an alt attribute; many clients block images by default.",
    check({ root, report }) {
      for (const img of root.querySelectorAll("img")) {
        if (!img.hasAttribute("alt")) {
          report(start(img), 'Image has no alt attribute. Add alt="" if it is decorative.');
        }
      }
    },
  },
  {
    id: "img-src-relative",
    severity: "error",
    description: "Image URLs must be absolute; a relative path will not load in an inbox.",
    check({ root, report }) {
      for (const img of root.querySelectorAll("img")) {
        const src = img.getAttribute("src")?.trim();
        if (!src) {
          report(start(img), "Image has an empty or missing src.");
        } else if (!/^(https?:|data:|cid:)/i.test(src) && !src.startsWith("//")) {
          report(
            start(img),
            `Image src "${src}" is relative. Use an absolute https:// URL or a cid: reference.`,
          );
        }
      }
    },
  },
  {
    id: "img-dimensions",
    severity: "warning",
    description: "Images need width and height attributes; Outlook on Windows ignores CSS sizes.",
    check({ root, report }) {
      for (const img of root.querySelectorAll("img")) {
        const missing = ["width", "height"].filter((a) => !img.hasAttribute(a));
        if (missing.length > 0) {
          report(
            start(img),
            `Image has no ${missing.join(" or ")} attribute. Outlook ignores CSS sizes and may render it at its natural size.`,
          );
        }
      }
    },
  },
  {
    id: "link-href",
    severity: "error",
    description: "Links need a real destination.",
    check({ root, report }) {
      for (const a of root.querySelectorAll("a")) {
        const href = a.getAttribute("href")?.trim();
        if (!href || href === "#") {
          report(start(a), "Link has an empty href.");
        } else if (/^javascript:/i.test(href)) {
          report(start(a), "javascript: links are removed by email clients.");
        }
      }
    },
  },
  {
    id: "link-https",
    severity: "warning",
    description: "Prefer https links; http links trigger security warnings and tracking issues.",
    check({ root, report }) {
      for (const a of root.querySelectorAll("a")) {
        const href = a.getAttribute("href")?.trim() ?? "";
        if (/^http:\/\//i.test(href)) {
          report(start(a), `Link "${href}" uses http. Use https.`);
        }
      }
    },
  },
  {
    id: "no-script",
    severity: "error",
    description: "Email clients strip <script>; it also hurts deliverability.",
    check({ root, report }) {
      for (const s of root.querySelectorAll("script")) {
        report(start(s), "<script> is not supported in email and will be removed.");
      }
    },
  },
  {
    id: "no-external-css",
    severity: "warning",
    description: "External stylesheets are not loaded by most clients. Inline your CSS.",
    check({ root, report }) {
      for (const l of root.querySelectorAll("link")) {
        if (l.getAttribute("rel")?.toLowerCase() === "stylesheet") {
          report(start(l), "External stylesheet will not load in most email clients. Inline the CSS.");
        }
      }
    },
  },
  {
    id: "html-size",
    severity: "warning",
    description: "Gmail clips messages over ~102 KB, hiding content and the unsubscribe link.",
    check({ html, report }) {
      const bytes = Buffer.byteLength(html, "utf8");
      if (bytes > GMAIL_CLIP_BYTES) {
        report(0, `HTML is ${(bytes / 1024).toFixed(1)} KB. Gmail clips messages over 102 KB.`);
      }
    },
  },
  {
    id: "missing-doctype",
    severity: "warning",
    description: "Documents should declare a doctype for consistent rendering.",
    documentOnly: true,
    check({ html, report }) {
      if (!/^\s*(<!--[\s\S]*?-->\s*)*<!doctype/i.test(html)) {
        report(0, "Missing <!DOCTYPE html>.");
      }
    },
  },
  {
    id: "html-lang",
    severity: "warning",
    description: "Set lang on <html> so screen readers pick the right pronunciation.",
    documentOnly: true,
    check({ root, report }) {
      const el = root.querySelector("html");
      if (el && !el.getAttribute("lang")) {
        report(start(el), "<html> has no lang attribute.");
      }
    },
  },
  {
    id: "missing-title",
    severity: "warning",
    description: "A <title> improves accessibility and some clients' tab and print views.",
    documentOnly: true,
    check({ root, report }) {
      const title = root.querySelector("title");
      if (!title || !title.text.trim()) {
        report(0, "Missing or empty <title>.");
      }
    },
  },
  {
    id: "missing-unsubscribe",
    severity: "warning",
    description: "Bulk mail needs an unsubscribe link (required by Gmail and Yahoo for bulk senders).",
    marketingOnly: true,
    check({ root, html, report }) {
      const has =
        /unsubscribe/i.test(html) &&
        root.querySelectorAll("a").some((a) => /unsubscribe/i.test(a.text + (a.getAttribute("href") ?? "")));
      if (!has) {
        report(0, "No unsubscribe link found.");
      }
    },
  },
];

export const ruleIds = rules.map((r) => r.id);

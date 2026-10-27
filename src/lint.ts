import { parse } from "node-html-parser";
import { rules } from "./rules.js";
import type { Diagnostic, LintOptions, LintResult } from "./types.js";

function positionAt(html: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < offset && i < html.length; i++) {
    if (html.charCodeAt(i) === 10) {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: offset - lastBreak };
}

/** Lint an HTML email. Pure and synchronous: no I/O, no network. */
export function lintHtml(html: string, options: LintOptions = {}): LintResult {
  const ignore = new Set(options.ignore ?? []);
  const root = parse(html, { comment: false });
  const isDocument = /<html[\s>]/i.test(html);
  let diagnostics: Diagnostic[] = [];

  for (const rule of rules) {
    if (ignore.has(rule.id)) continue;
    if (rule.marketingOnly && !options.marketing) continue;
    if (rule.documentOnly && !isDocument) continue;

    rule.check({
      root,
      html,
      options,
      isDocument,
      report: (offset, message) => {
        diagnostics.push({
          rule: rule.id,
          severity: rule.severity,
          message,
          ...positionAt(html, offset),
        });
      },
    });
  }

  // `<!-- email-lint-disable-next-line rule-a, rule-b -->` silences those rules on the following line.
  const disabled = new Set<string>();
  for (const m of html.matchAll(/<!--\s*email-lint-disable-next-line\s+([\w\s,-]+?)\s*-->/g)) {
    const line = positionAt(html, m.index ?? 0).line + 1;
    for (const id of (m[1] ?? "").split(/[\s,]+/)) disabled.add(`${line}:${id}`);
  }
  diagnostics = diagnostics.filter((d) => !disabled.has(`${d.line}:${d.rule}`));

  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  return { diagnostics, errorCount, warningCount: diagnostics.length - errorCount };
}

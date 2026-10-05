import type { LintResult } from "./types.js";

export interface FileResult {
  file: string;
  result: LintResult;
}

export function formatText(results: FileResult[]): string {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;

  for (const { file, result } of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    if (result.diagnostics.length === 0) continue;
    lines.push(file);
    for (const d of result.diagnostics) {
      lines.push(`  ${d.line}:${d.column}  ${d.severity.padEnd(7)}  ${d.message}  (${d.rule})`);
    }
    lines.push("");
  }

  if (errors + warnings === 0) {
    lines.push(`No problems found in ${results.length} file${results.length === 1 ? "" : "s"}.`);
  } else {
    lines.push(`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`);
  }
  return lines.join("\n");
}

export function formatJson(results: FileResult[]): string {
  return JSON.stringify(results, null, 2);
}

import { describe, expect, it } from "vitest";
import { formatJson, formatText, type FileResult } from "../../src/format.js";

const clean: FileResult = { file: "a.html", result: { diagnostics: [], errorCount: 0, warningCount: 0 } };
const dirty: FileResult = {
  file: "b.html",
  result: {
    diagnostics: [{ rule: "img-alt", severity: "error", message: "No alt", line: 3, column: 5 }],
    errorCount: 1,
    warningCount: 0,
  },
};

describe("formatText", () => {
  it("reports a clean run, pluralising file count", () => {
    expect(formatText([clean])).toBe("No problems found in 1 file.");
    expect(formatText([clean, clean])).toBe("No problems found in 2 files.");
  });

  it("lists diagnostics under the file name with a summary", () => {
    const out = formatText([clean, dirty]);
    expect(out).toContain("b.html\n  3:5  error");
    expect(out).toContain("(img-alt)");
    expect(out).not.toContain("a.html");
    expect(out.endsWith("1 error, 0 warnings")).toBe(true);
  });

  it("pluralises warnings and errors", () => {
    const w: FileResult = { file: "c.html", result: { diagnostics: [], errorCount: 2, warningCount: 1 } };
    expect(formatText([w])).toContain("2 errors, 1 warning");
  });
});

describe("formatJson", () => {
  it("round-trips", () => {
    expect(JSON.parse(formatJson([dirty]))).toEqual([dirty]);
  });
});

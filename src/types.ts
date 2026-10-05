export type Severity = "error" | "warning";

export interface Diagnostic {
  rule: string;
  severity: Severity;
  message: string;
  /** 1-based line in the linted HTML. */
  line: number;
  /** 1-based column in the linted HTML. */
  column: number;
}

export interface LintOptions {
  /** Rule ids to skip. */
  ignore?: string[];
  /** Enable rules meant for bulk/marketing mail, such as `missing-unsubscribe`. */
  marketing?: boolean;
}

export interface LintResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
}

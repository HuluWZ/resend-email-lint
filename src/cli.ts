#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { collectFiles, readStdin } from "./files.js";
import { formatJson, formatText, type FileResult } from "./format.js";
import { lintHtml } from "./lint.js";
import { ruleIds, rules } from "./rules.js";

const HELP = `resend-email-lint: lint email HTML before you send it

Usage:
  resend-email-lint <file|dir>...   Lint .html files (directories are searched recursively)
  cat email.html | resend-email-lint -   Lint from stdin

Options:
  -f, --format <text|json>   Output format (default: text)
      --marketing            Also run bulk-mail rules (e.g. missing-unsubscribe)
  -i, --ignore <rule>        Skip a rule; repeatable
      --max-warnings <n>     Exit 1 if warnings exceed n (default: no limit)
      --list-rules           Print all rules and exit
  -h, --help                 Show this help

Config: reads .emaillintrc.json from the current directory if present
  ({ "ignore": ["html-lang"], "marketing": true, "maxWarnings": 0 }). CLI flags override it.

Exit codes: 0 clean, 1 lint errors found, 2 usage or I/O error.

Note: lint rendered HTML. For React Email, render first (e.g. \`email export\`).`;

interface Config {
  ignore?: string[];
  marketing?: boolean;
  maxWarnings?: number;
}

/** Reads .emaillintrc.json from the cwd. Returns {} when absent; throws on invalid content. */
async function loadConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(resolve(".emaillintrc.json"), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  let c: Config;
  try {
    c = JSON.parse(raw) as Config;
  } catch {
    throw new Error(".emaillintrc.json is not valid JSON.");
  }
  const { ignore, marketing, maxWarnings } = c;
  if (ignore !== undefined && !(Array.isArray(ignore) && ignore.every((i) => typeof i === "string"))) {
    throw new Error(".emaillintrc.json: ignore must be an array of rule ids.");
  }
  if (marketing !== undefined && typeof marketing !== "boolean") {
    throw new Error(".emaillintrc.json: marketing must be a boolean.");
  }
  if (maxWarnings !== undefined && !(Number.isInteger(maxWarnings) && maxWarnings >= 0)) {
    throw new Error(".emaillintrc.json: maxWarnings must be a non-negative integer.");
  }
  return c;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      format: { type: "string", short: "f", default: "text" },
      marketing: { type: "boolean", default: false },
      ignore: { type: "string", short: "i", multiple: true, default: [] },
      "max-warnings": { type: "string" },
      "list-rules": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values["list-rules"]) {
    for (const r of rules) {
      console.log(`${r.id.padEnd(22)} ${r.severity.padEnd(8)} ${r.description}`);
    }
    return 0;
  }
  if (values.format !== "text" && values.format !== "json") {
    console.error(`Unknown format "${values.format}". Use text or json.`);
    return 2;
  }
  const config = await loadConfig();
  const ignore = [...(config.ignore ?? []), ...(values.ignore ?? [])];
  const unknown = ignore.filter((id) => !ruleIds.includes(id));
  if (unknown.length > 0) {
    console.error(`Unknown rule(s): ${unknown.join(", ")}. Run --list-rules.`);
    return 2;
  }
  let maxWarnings = config.maxWarnings ?? Infinity;
  if (values["max-warnings"] !== undefined) {
    maxWarnings = Number(values["max-warnings"]);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      console.error("--max-warnings must be a non-negative integer.");
      return 2;
    }
  }
  if (positionals.length === 0) {
    console.error(HELP);
    return 2;
  }

  const options = { marketing: values.marketing || config.marketing, ignore };
  const results: FileResult[] = [];

  if (positionals.length === 1 && positionals[0] === "-") {
    results.push({ file: "<stdin>", result: lintHtml(await readStdin(), options) });
  } else {
    const files = await collectFiles(positionals);
    if (files.length === 0) {
      console.error("No .html files found.");
      return 2;
    }
    for (const file of files) {
      results.push({ file, result: lintHtml(await readFile(file, "utf8"), options) });
    }
  }

  console.log(values.format === "json" ? formatJson(results) : formatText(results));

  const errors = results.reduce((n, r) => n + r.result.errorCount, 0);
  const warnings = results.reduce((n, r) => n + r.result.warningCount, 0);
  return errors > 0 || warnings > maxWarnings ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: NodeJS.ErrnoException) => {
    console.error(err.code === "ENOENT" ? `File not found: ${err.path}` : `Error: ${err.message}`);
    process.exit(2);
  },
);

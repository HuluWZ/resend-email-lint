#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lintHtml } from "./lint.js";
import { ruleIds, rules } from "./rules.js";

/** Cap input so an agent cannot hand the linter an unbounded document. */
const MAX_HTML_BYTES = 2 * 1024 * 1024;

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const server = new McpServer({ name: "resend-email-lint", version });

// Security by design: both tools are pure. No file access, no network, no env access.
// The agent passes HTML in and gets diagnostics back, nothing else.

server.registerTool(
  "lint_email_html",
  {
    title: "Lint email HTML",
    description:
      "Check rendered email HTML for common problems (missing alt text, relative image URLs, broken links, " +
      "scripts, Gmail clipping size, missing lang/doctype). Call this before sending an email. " +
      "Returns diagnostics with rule id, severity, line and column. Fix every error before sending.",
    inputSchema: {
      html: z.string().min(1).describe("The rendered HTML of the email."),
      marketing: z
        .boolean()
        .optional()
        .describe("Also run bulk-mail rules such as requiring an unsubscribe link."),
      ignore: z.array(z.string()).optional().describe("Rule ids to skip."),
    },
  },
  async ({ html, marketing, ignore }) => {
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return {
        isError: true,
        content: [
          { type: "text", text: `HTML is larger than ${MAX_HTML_BYTES / 1024 / 1024} MB; refusing to lint.` },
        ],
      };
    }
    const unknown = (ignore ?? []).filter((id) => !ruleIds.includes(id));
    if (unknown.length > 0) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown rule id(s): ${unknown.join(", ")}. Valid ids: ${ruleIds.join(", ")}.`,
          },
        ],
      };
    }
    const result = lintHtml(html, { marketing, ignore });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "list_rules",
  {
    title: "List lint rules",
    description: "List every lint rule with its id, severity and what it checks.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          rules.map(({ id, severity, description, marketingOnly }) => ({
            id,
            severity,
            description,
            marketingOnly: marketingOnly ?? false,
          })),
          null,
          2,
        ),
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());

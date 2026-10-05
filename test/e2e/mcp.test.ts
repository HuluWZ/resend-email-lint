import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCP } from "../helpers/cli.js";

let client: Client;

beforeAll(async () => {
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [MCP] }));
});

afterAll(() => client.close());

const text = (r: unknown) => (r as { content: { text: string }[] }).content[0]?.text ?? "";

describe("mcp server", () => {
  it("exposes both tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["lint_email_html", "list_rules"]);
  });

  it("lints html and returns structured diagnostics", async () => {
    const r = await client.callTool({
      name: "lint_email_html",
      arguments: { html: '<img src="a.png"><script></script>' },
    });
    const result = JSON.parse(text(r)) as { errorCount: number; diagnostics: { rule: string }[] };
    expect(result.errorCount).toBe(3);
    expect(result.diagnostics.map((d) => d.rule)).toEqual(
      expect.arrayContaining(["img-alt", "img-src-relative", "no-script"]),
    );
  });

  it("honours marketing and ignore", async () => {
    const r = await client.callTool({
      name: "lint_email_html",
      arguments: { html: "<p>hi</p>", marketing: true, ignore: ["img-alt"] },
    });
    expect(text(r)).toContain("missing-unsubscribe");
  });

  it("rejects unknown rule ids", async () => {
    const r = await client.callTool({
      name: "lint_email_html",
      arguments: { html: "<p>x</p>", ignore: ["nope"] },
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("Unknown rule id");
  });

  it("rejects oversized input", async () => {
    const r = await client.callTool({
      name: "lint_email_html",
      arguments: { html: "x".repeat(2 * 1024 * 1024 + 1) },
    });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("larger than");
  });

  it("rejects empty html via schema validation", async () => {
    const r = await client
      .callTool({ name: "lint_email_html", arguments: { html: "" } })
      .catch((e: unknown) => e);
    expect(r instanceof Error || (r as { isError?: boolean }).isError).toBeTruthy();
  });

  it("lists rules", async () => {
    const rules = JSON.parse(text(await client.callTool({ name: "list_rules", arguments: {} }))) as {
      id: string;
      marketingOnly: boolean;
    }[];
    expect(rules.find((r) => r.id === "missing-unsubscribe")?.marketingOnly).toBe(true);
    expect(rules.find((r) => r.id === "img-alt")?.marketingOnly).toBe(false);
  });
});

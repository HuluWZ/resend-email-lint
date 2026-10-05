# resend-email-lint

Lint email HTML before you send it. One rule set, three interfaces:

- a **library** for your code,
- a **CLI** for CI,
- an **MCP server** so an AI agent can check an email before sending it.

Email clients are unforgiving. Missing `alt` text, relative image URLs, `javascript:` links, `<script>` tags and
messages over Gmail's ~102 KB clipping limit all fail silently. This tool catches them with clear messages and line numbers.

It works with any sender. It does not call any email API.

## CLI

```sh
npx resend-email-lint ./emails
```

```
examples/bad.html
  1:1  warning  Missing <!DOCTYPE html>.  (missing-doctype)
  3:3  error    Image has no alt attribute. Add alt="" if it is decorative.  (img-alt)
  3:3  error    Image src "/logo.png" is relative. Use an absolute https:// URL or a cid: reference.  (img-src-relative)
  5:3  error    Link has an empty href.  (link-href)
  6:3  error    <script> is not supported in email and will be removed.  (no-script)

4 errors, 4 warnings
```

Exit codes: `0` clean, `1` lint errors (or too many warnings), `2` usage or I/O error.

| Option                    | Meaning                                     |
| ------------------------- | ------------------------------------------- |
| `-f, --format text\|json` | Output format                               |
| `--marketing`             | Also run bulk-mail rules (unsubscribe link) |
| `-i, --ignore <rule>`     | Skip a rule (repeatable)                    |
| `--max-warnings <n>`      | Fail if warnings exceed `n`                 |
| `--list-rules`            | Print every rule                            |

Read from stdin with `-`: `cat email.html | npx resend-email-lint -`

**React Email:** lint the rendered HTML, not the `.tsx`. Render first (for example with `email export`, or `render()` from
`@react-email/render`), then point the CLI at the output.

### In CI

```yaml
- run: npx resend-email-lint ./out/emails --max-warnings 0
```

## Library

```ts
import { lintHtml } from "resend-email-lint";

const { diagnostics, errorCount } = lintHtml(html, { marketing: false, ignore: ["html-lang"] });
if (errorCount > 0) throw new Error(diagnostics.map((d) => d.message).join("\n"));
```

Example with Resend, checking before you send:

```ts
import { Resend } from "resend";
import { lintHtml } from "resend-email-lint";

const resend = new Resend(process.env.RESEND_API_KEY);
const { diagnostics } = lintHtml(html);
if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics));
await resend.emails.send({ from, to, subject, html });
```

This guard fails on warnings as well as errors. Some warnings matter at send time: `html-size` means Gmail will clip the message and hide the footer and unsubscribe link. To block only errors plus oversized HTML, filter instead:

```ts
const blocking = diagnostics.filter((d) => d.severity === "error" || d.rule === "html-size");
```

`lintHtml` is pure and synchronous: no I/O, no network.

## MCP server

Add to your MCP client config (Claude Desktop, Cursor, and so on):

```json
{
  "mcpServers": {
    "email-lint": {
      "command": "npx",
      "args": ["-y", "-p", "resend-email-lint", "resend-email-lint-mcp"]
    }
  }
}
```

Tools:

- `lint_email_html`: takes `html` (and optional `marketing`, `ignore`) and returns diagnostics with rule id, severity, line and column.
- `list_rules`: lists every rule.

**Designed for agents as users.** Tool descriptions say when to call them ("before sending"). Errors name the valid rule ids so an
agent can self-correct. Diagnostics are structured JSON an agent can act on. The server is also deliberately **pure**: it has no
filesystem, network or environment access, and caps input at 2 MB, so handing it to an agent adds no new permissions.

## Rules

| Rule                  | Severity | Checks                                                   |
| --------------------- | -------- | -------------------------------------------------------- |
| `img-alt`             | error    | `<img>` has an `alt` attribute                           |
| `img-src-relative`    | error    | Image URL is absolute (or `cid:` / `data:`)              |
| `link-href`           | error    | Links have a real href (not empty, `#` or `javascript:`) |
| `no-script`           | error    | No `<script>`                                            |
| `link-https`          | warning  | Links use https                                          |
| `no-external-css`     | warning  | No external stylesheets                                  |
| `html-size`           | warning  | Under Gmail's 102 KB clipping limit                      |
| `missing-doctype`     | warning  | Documents declare a doctype                              |
| `html-lang`           | warning  | `<html lang>` is set                                     |
| `missing-title`       | warning  | `<title>` is present                                     |
| `missing-unsubscribe` | warning  | Unsubscribe link present (`--marketing` only)            |

Document-level rules only run when the input contains an `<html>` tag, so fragments are not flagged.

## Contributing

New rules are the easiest way in. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

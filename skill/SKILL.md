---
name: email-html-lint
description: Lint email HTML before sending or committing it. Use when writing, editing, or sending HTML emails (React Email, MJML, Resend, hand-written templates), or when asked to check an email for Gmail clipping, missing alt text, broken links, or unsubscribe links.
---

# Email HTML lint

Uses the `resend-email-lint` MCP server (`lint_email_html`, `list_rules`) or the CLI.

## When

Run it on **rendered** HTML (not JSX/MJML source) every time you create or change an email, and before sending one.

## Steps

1. Render the template to HTML first (e.g. React Email `render()`).
2. Call `lint_email_html` with `html`. Set `marketing: true` for newsletters/bulk mail (adds the unsubscribe-link check).
3. Fix every `error`, then re-lint until clean. Fix `warning`s unless the user says otherwise.
4. Skip a rule only if the user agrees, via `ignore: ["rule-id"]`. Use `list_rules` for valid ids.

## No MCP? Use the CLI

```
npx resend-email-lint ./out/emails --marketing --max-warnings 0
```

## Fix hints

- `img-alt`: add `alt` (use `alt=""` for decorative images).
- `img-src-relative`: use an absolute `https://` URL or `cid:`.
- `img-dimensions`: set `width`/`height` on images.
- `html-size`: Gmail clips around 102 KB; trim inline CSS/markup.
- `no-script`, `no-external-css`: remove; inline the styles.
- `missing-doctype`, `html-lang`, `missing-title`: add to the document.
- `missing-unsubscribe`: add an unsubscribe link (marketing only).

## Setup

```json
{ "mcpServers": { "resend-email-lint": { "command": "npx", "args": ["-y", "-p", "resend-email-lint", "resend-email-lint-mcp"] } } }
```

# Contributing

Thanks for helping. The easiest contribution is a new rule.

## Setup

```sh
npm install
npm test
npm run build
```

## Adding a rule

1. Add an entry to the `rules` array in `src/rules.ts` with a stable `id`, a `severity`
   (`error` only if the problem breaks the email or is plainly wrong), and a one-line `description`.
2. Call `report(offset, message)` for each problem. Messages should say what is wrong and how to fix it.
3. Add tests in `test/lint.test.ts`: one case that triggers the rule and one that must not.
4. Run `npm run typecheck && npm test`.

Rules should have a low false-positive rate. If a rule can be wrong on valid email, make it a `warning`.

## Principles

- The linter is pure: no network, no file access inside `lintHtml`.
- The MCP server must stay pure too (see the comment in `src/mcp.ts`).
- Rule ids are public API. Renaming one is a breaking change.

## Good first issues

Ideas: `img-dimensions` (width/height attributes for Outlook), `table-role` (layout tables need
`role="presentation"`), `preheader` detection, `button-contrast`.

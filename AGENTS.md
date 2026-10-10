# AGENTS.md

## Project

- SalesFlow - interactive sales pipeline overview & management dashboard.
- Built with: React, Next.js, Tailwind CSS.
- Language: TypeScript.

## Package manager

- Use `npm` for this workspace. The lockfile is `package-lock.json`.
- Run package scripts with `npm run <script>`.

## Commands

```bash
npm run lint         # run linter
```

No formatter, test runner is configured.

## Architecture

- Project: salesflow-dashboard.

## Runtime assets and packaging

- TypeScript uses module `esnext`, target `ES2020`, strict mode.

## Testing and launch

- Tests are present, but no `test` package script was detected; inspect the test config before running broad suites.

## Key Conventions

- Components use JSX/TSX; prefer functional components.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections so files remain easy to scan.
- Use JSDoc blocks only when an API, intent, edge case, or constraint needs explanation; do not restate the code.

## Caveats

- No formatter detected — no Prettier config or format script.

## Boundaries

- Prefer existing local patterns and helper APIs before adding new abstractions.
- Keep generated, packaged, and runtime asset boundaries intact; do not move files across host/webview ownership without updating build and packaging config.

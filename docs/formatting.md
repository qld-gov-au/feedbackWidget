<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# Code formatting (Prettier)

This repository uses Prettier to keep formatting consistent and avoid whitespace-only diffs.

## Commands

- `npm run format` formats all supported files in the repo.
- `npm run format:check` checks formatting without changing files.

## Pre-commit hook

Husky + lint-staged run on commit and auto-format staged files before they are committed.

- Hook: `.husky/pre-commit`
- Scope: `*.{js,mjs,json,md,html,ftl,yml,yaml}`

If a commit fails because files were reformatted, review the changes and commit again.

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

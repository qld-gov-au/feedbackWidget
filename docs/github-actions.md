<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# GitHub Actions

A single workflow (`build.yml`) handles all environments. It derives the build target and release branch automatically from the triggering branch.

| Trigger                      | Branch | Build command        | Publishes to         |
| ---------------------------- | ------ | -------------------- | -------------------- |
| Pull request → `development` | any    | `npm run build:dev`  | `release-dev`        |
| Pull request → `uat`         | any    | `npm run build:uat`  | `release-uat`        |
| Pull request → `main`        | any    | `npm run build:prod` | `release-production` |

The workflow only runs when `src/`, `build.mjs`, `package.json`, or `package-lock.json` change.

Each run:

1. Checks out source on `ubuntu-latest` with Node 24.
2. Runs `npm install`.
3. Builds using the appropriate reCAPTCHA key from repository secrets (`RECAPTCHA_DEV` or `RECAPTCHA_PROD`).
4. Injects endpoint path vars (`FSH_PROJECT` + `FSH_ENDPOINT_DEV/UAT/PROD`) and smoke test endpoint (`SMOKE_FSH_ENDPOINT`) from repository variables.
5. Runs Playwright smoke tests against the source HTML fragment in `src/html/index.html` with the built `dist/feedback.${env}.min.js`, including a live success path and a forced failure-path assertion.
6. Runs automated accessibility checks (`npm run test:a11y`) and fails the workflow if serious/critical Axe issues are found.
7. Pushes only the `dist/` folder to the target release branch via a git worktree (skips the commit if nothing changed).

## Required repository secrets

| Secret           | Used by            |
| ---------------- | ------------------ |
| `RECAPTCHA_DEV`  | dev and UAT builds |
| `RECAPTCHA_PROD` | production build   |

Set these under **Settings → Secrets and variables → Actions** in the GitHub repository.

## Repository variables

| Variable             | Used by                                     |
| -------------------- | ------------------------------------------- |
| `FSH_PROJECT`        | final submission path segment 1             |
| `FSH_ENDPOINT_DEV`   | development branch release endpoint         |
| `FSH_ENDPOINT_UAT`   | UAT branch release endpoint                 |
| `FSH_ENDPOINT_PROD`  | production branch release endpoint          |
| `SMOKE_FSH_ENDPOINT` | smoke tests only; prevents live email sends |

These are read in GitHub Actions and written into `.env` before build. `build.mjs` selects the endpoint directly from build mode (`dev`, `uat`, `prod`).

Release path examples:
`/services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT_DEV}` for `build:dev`
`/services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT_UAT}` for `build:uat`
`/services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT_PROD}` for `build:prod`

Smoke test path:
`/services/submissions/email/{FSH_PROJECT}/{SMOKE_FSH_ENDPOINT}`

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

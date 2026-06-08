# Footer feedback widget

A lightweight page feedback component for Queensland Government websites. Collects a yes/no helpfulness response and optional comments, then submits to the Smart Service QLD feedback endpoint.

## Structure

```
src/
  html/     — Form markup (index.html)
  js/       — Form behaviour and submission logic (feedback.js)
dist/       — Build output (feedback.min.html, feedback.min.js) — not committed
tests/
  smoke.spec.js  — Playwright smoke tests against src/html/index.html + built JS
```

## Setup

### Prerequisites

- Node.js 24 or later
- A `.env` file at the project root (copy from `.env.sample`)

If you use `nvm`, run:

```bash
nvm use
```

This project pins Node via `.nvmrc`.

### Environment variables

```
# .env
RECAPTCHA_DEV=<your reCAPTCHA v3 dev site key>
RECAPTCHA_PROD=<your reCAPTCHA v3 prod site key>
# optional submission path suffix: /services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT}
FSH_PROJECT=feedback
FSH_ENDPOINT=feedback-v3-*
PLAYWRIGHT_HEADLESS=true
```

> The `.env.sample` file lists all required keys. Never commit real keys.

### Install dependencies

```bash
npm install
```

## Code formatting (Prettier)

This repository uses Prettier to keep formatting consistent and avoid whitespace-only diffs.

### Commands

- `npm run format` formats all supported files in the repo.
- `npm run format:check` checks formatting without changing files.

### Pre-commit hook

Husky + lint-staged run on commit and auto-format staged files before they are committed.

- Hook: `.husky/pre-commit`
- Scope: `*.{js,mjs,json,md,html,ftl,yml,yaml}`

If a commit fails because files were reformatted, review the changes and commit again.

## Build

| Command              | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `npm run build:dev`  | Builds against `test.smartservice.qld.gov.au` using `RECAPTCHA_DEV` |
| `npm run build:prod` | Builds against `www.smartservice.qld.gov.au` using `RECAPTCHA_PROD` |

Both commands output minified files to `dist/`:

- `dist/feedback.min.js`
- `dist/feedback.min.html`

Copy these two files into your CMS.

## How it works

1. On page load the widget is ready to collect page metadata directly from `document` and `window`
2. The user selects Yes or No, optionally enters a comment, and submits
3. The JS wraps all fields under a `data[...]` parent and posts to the Smart Service submissions endpoint as `application/json`
4. The FreeMarker template on the server reads the submitted fields, checks for spam, and routes the email to the appropriate team based on URL, referrer, or franchise

## Smoke Tests

Testing behavior and scenarios are documented in `docs/testing.md`.

Use this as the source of truth to avoid duplicated test documentation in multiple files.

### Optional: use real reCAPTCHA tokens in smoke tests

By default, smoke tests mock `grecaptcha` and use `test-token` for stability.
To exercise real token generation in Playwright, set:

```bash
SMOKE_USE_REAL_RECAPTCHA=true
SMOKE_RECAPTCHA_SITE_KEY=<frontend site key>
```

Notes:

- If `SMOKE_USE_REAL_RECAPTCHA=true` and no site key is provided, tests fail fast.

Example GitHub Actions step:

```yaml
- name: Run smoke tests
  env:
    SMOKE_USE_REAL_RECAPTCHA: 'true'
    SMOKE_RECAPTCHA_SITE_KEY: ${{ secrets.RECAPTCHA_DEV }}
  run: npm test
```

### Playwright headless mode

Playwright headless mode is controlled by `PLAYWRIGHT_HEADLESS` in `playwright.config.js`.

- Local default (`.env`): `PLAYWRIGHT_HEADLESS=true`
- Hosted/CI setting (`.github/workflows/build.yml`): `PLAYWRIGHT_HEADLESS=true`

CI is intentionally always headless. Use local `.env` values when you want headed debugging.

### Optional: local-only BrowserStack cross-browser runs

You can run the same Playwright smoke spec on BrowserStack for obscure browser/OS combinations without touching the GitHub Actions workflow.

1. Add BrowserStack credentials to your local `.env`:

```bash
BROWSERSTACK_USERNAME=<your BrowserStack username>
BROWSERSTACK_ACCESS_KEY=<your BrowserStack access key>
```

2. Run BrowserStack smoke tests locally (single default lane: Edge on Windows 11):

```bash
npm run test:browserstack
```

3. Optional: run the full BrowserStack matrix (Edge + Chrome + WebKit):

```bash
BROWSERSTACK_MATRIX=all npm run test:browserstack
```

Notes:

- BrowserStack runs are configured in `playwright.browserstack.config.js`.
- By default `BROWSERSTACK_MATRIX=single` (implicit) runs only `edge-win11` to keep feedback cycles fast.
- The BrowserStack config throws an error when `GITHUB_ACTIONS=true`, so these runs stay local/dev-only by design.
- Existing CI keeps using `npm test` with `playwright.config.js` only.

## JavaScript (`src/js/feedback.js`)

The script is wrapped in an IIFE and has no external dependencies beyond the Google reCAPTCHA v3 API. It reads page metadata directly from `document` and `window` when building the submission payload. The reCAPTCHA script is lazy-loaded the first time the user interacts with a Yes/No radio button, avoiding an unnecessary network request on pages where the form is never used. The comment label is static in HTML (`Tell us why (optional)`), while JS reveals the details section after a Yes/No selection. On submit the script validates the form natively via `checkValidity()`, disables the submit button to prevent double-submission, then calls `grecaptcha.execute()` to obtain a token. The token is sent both in payload (`data[g-recaptcha-response]`) and as a query parameter for server compatibility. Success requires both a `2xx` response and JSON body `{ success: "true" }`; on errors, the form remains visible, submit is re-enabled, and the error message is shown so users can retry. The `process.env.RECAPTCHA` and `process.env.BUILD_ENV` references are replaced with literal values at build time by esbuild, so no environment variables are present in the deployed output.

## Payload shape

```
data[page-title]=...
data[page-url]=...
data[page-referer]=...
data[franchise]=...
data[captchaCatch]=dev|prod
data[captcha]=
data[g-recaptcha-response]=<token>
data[feedback-satisfaction]=Satisfied (4)|Dissatisfied (2)
data[comments]=...
data[feedback-captcha]=
```

### Compatibility fields

Some payload keys are still sent for server-side compatibility even though there is no corresponding visible field in the shipped HTML:

- `data[captcha]` is deliberately sent as an empty string because the current FreeMarker spam logic still checks that legacy key.
- `data[g-recaptcha-response]` carries the real Google reCAPTCHA token in a legacy-compatible location.
- FreeMarker is the source of truth for template keys. In this repository's template example, keys are read from flattened `data.*` and `metadata.*` paths.
- `feedback-captcha` is sent under `data[feedback-captcha]` only.
- `data[feedback-a]`, `data[feedback-b]`, `data[feedback-c]`, `data[feedback-d]`, and `data[dataset-owner]` remain in the payload as compatibility placeholders and default to empty strings unless another surface injects them.

## Email routing logic

Email routing is managed via FreeMarker templates on the server and is not documented in this repository.
For routing rules, franchise mappings, and URL patterns, refer to the internal Confluence page.

## GitHub Actions

A single workflow (`build.yml`) handles all environments. It derives the build target and release branch automatically from the triggering branch.

| Trigger                      | Branch | Build command        | Publishes to         |
| ---------------------------- | ------ | -------------------- | -------------------- |
| Pull request → `development` | any    | `npm run build:dev`  | `release-dev`        |
| Pull request → `uat`         | any    | `npm run build:dev`  | `release-uat`        |
| Pull request → `main`        | any    | `npm run build:prod` | `release-production` |

The workflow only runs when `src/`, `build.mjs`, `package.json`, or `package-lock.json` change.

Each run:

1. Checks out source on `ubuntu-latest` with Node 24
2. Runs `npm install`
3. Builds using the appropriate reCAPTCHA key from repository secrets (`RECAPTCHA_DEV` or `RECAPTCHA_PROD`)
4. Injects endpoint path vars (`FSH_PROJECT`, `FSH_ENDPOINT`) from repository variables
5. Runs Playwright smoke tests against the source HTML fragment in `src/html/index.html` with the built `dist/feedback.min.js`, including a live success path and a forced failure-path assertion
6. Pushes only the `dist/` folder to the target release branch via a git worktree (skips the commit if nothing changed)

### Required repository secrets

| Secret           | Used by            |
| ---------------- | ------------------ |
| `RECAPTCHA_DEV`  | dev and UAT builds |
| `RECAPTCHA_PROD` | production build   |

Set these under **Settings → Secrets and variables → Actions** in the GitHub repository.

### Repository variables

| Variable       | Default       | Used by                         |
| -------------- | ------------- | ------------------------------- |
| `FSH_PROJECT`  | `feedback`    | final submission path segment 1 |
| `FSH_ENDPOINT` | `feedback-v4` | final submission path segment 2 |

These are read in GitHub Actions and written into `.env` before build, producing:
`/services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT}`

## Usage

Run the appropriate build command above (or rely on the GitHub Actions workflow). Copy `dist/feedback.min.js` and `dist/feedback.min.html` into your CMS. Set the `data[franchise]` hidden field value to match your site's franchise key before deploying.

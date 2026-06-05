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

## Build

| Command | Description |
|---|---|
| `npm run build:dev` | Builds against `test.smartservice.qld.gov.au` using `RECAPTCHA_DEV` |
| `npm run build:prod` | Builds against `www.smartservice.qld.gov.au` using `RECAPTCHA_PROD` |

Both commands output minified files to `dist/`:
- `dist/feedback.min.js`
- `dist/feedback.min.html`

Copy these two files into your CMS.

## How it works

1. On page load the JS populates hidden fields with `document.title`, `window.location.href`, and `document.referrer`
2. The user selects Yes or No, optionally enters a comment, and submits
3. The JS wraps all fields under a `data[...]` parent and posts to the Smart Service submissions endpoint as `application/json`
4. The FreeMarker template on the server reads the submitted fields, checks for spam, and routes the email to the appropriate team based on URL, referrer, or franchise

## Smoke Tests

It covers:
1. Hidden-field population on load
2. Yes/No label and details toggling
3. Hidden success and error states before submission
4. A live success submission with payload checks for page metadata, franchise, browser name, OS, captcha environment, and the feedback prefix
5. A forced 500 response that verifies the error banner text is shown

The shared smoke helpers now live in `tests/utils/common.js` so the spec itself stays focused on the assertions.

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
    SMOKE_USE_REAL_RECAPTCHA: "true"
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

The script is wrapped in an IIFE and has no external dependencies beyond the Google reCAPTCHA v3 API. On load it writes `document.title`, `window.location.href`, and `document.referrer` into the form's hidden fields. The reCAPTCHA script is lazy-loaded the first time the user interacts with a Yes/No radio button, avoiding an unnecessary network request on pages where the form is never used. When a radio is selected the comment section is revealed and the comment label updates dynamically to match the chosen sentiment ("What worked well for you" vs "What didn't work for you"). On submit the script validates the form natively via `checkValidity()`, disables the submit button to prevent double-submission, then calls `grecaptcha.execute()` to obtain a token. That token is appended to a `FormData` object and the whole payload is sent via `fetch`. A successful `2xx` response hides the form and shows the success message; any network or HTTP error re-enables the submit button and reveals the error message. The `process.env.RECAPTCHA` and `process.env.BUILD_ENV` references are replaced with literal values at build time by esbuild, so no environment variables are present in the deployed output.

## Payload shape

```
data[page-title]=...
data[page-url]=...
data[page-referer]=...
data[franchise]=...
data[captchaCatch]=dev|prod
data[captcha]=
data[feedback-satisfaction]=Satisfied (4)|Dissatisfied (2)
data[comments]=...
feedback-captcha=
```

## Email routing logic

Email routing is managed via FreeMarker templates on the server and is not documented in this repository.
For routing rules, franchise mappings, and URL patterns, refer to the internal Confluence page.

## GitHub Actions

A single workflow (`build.yml`) handles all environments. It derives the build target and release branch automatically from the triggering branch.

| Trigger | Branch | Build command | Publishes to |
|---|---|---|---|
| Push | `feature-test` | `npm run build:dev` | `release-dev` |
| Pull request → `development` | any | `npm run build:dev` | `release-dev` |
| Pull request → `uat` | any | `npm run build:dev` | `release-uat` |
| Pull request → `main` | any | `npm run build:prod` | `release-production` |

The workflow only runs when `src/`, `build.mjs`, `package.json`, or `package-lock.json` change.

Each run:
1. Checks out source on `ubuntu-latest` with Node 24
2. Runs `npm install`
3. Builds using the appropriate reCAPTCHA key from repository secrets (`RECAPTCHA_DEV` or `RECAPTCHA_PROD`)
4. Injects endpoint path vars (`FSH_PROJECT`, `FSH_ENDPOINT`) from repository variables
5. Runs Playwright smoke tests against the source HTML fragment in `src/html/index.html` with the built `dist/feedback.min.js`, including a live success path and a forced failure-path assertion
6. Pushes only the `dist/` folder to the target release branch via a git worktree (skips the commit if nothing changed)

### Triggering a dev rebuild without a pull request

Push any relevant change to the `feature-test` branch. This triggers the workflow immediately and publishes to `release-dev` — no PR required. Use this for iterating on the widget during development before the work is ready to propose against `development`.

```bash
git push origin feature-test
```

### Required repository secrets

| Secret | Used by |
|---|---|
| `RECAPTCHA_DEV` | dev and UAT builds |
| `RECAPTCHA_PROD` | production build |

Set these under **Settings → Secrets and variables → Actions** in the GitHub repository.

### Repository variables

| Variable | Default | Used by |
|---|---|---|
| `FSH_PROJECT` | `feedback` | final submission path segment 1 |
| `FSH_ENDPOINT` | `feedback-v4` | final submission path segment 2 |

These are read in GitHub Actions and written into `.env` before build, producing:
`/services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT}`

## Usage

Run the appropriate build command above (or rely on the GitHub Actions workflow). Copy `dist/feedback.min.js` and `dist/feedback.min.html` into your CMS. Set the `data[franchise]` hidden field value to match your site's franchise key before deploying.

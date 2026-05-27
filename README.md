# Footer Feedback Widget

A lightweight page feedback component for Queensland Government websites. Collects a yes/no helpfulness response and optional comments, then submits to the Smart Service QLD feedback endpoint.

## Structure

```
src/
  html/     — Form markup (example.html)
  js/       — Form behaviour and submission logic (feedback.js)
dist/       — Build output (feedback.min.html, feedback.min.js) — not committed
tests/      — (empty — coming soon)
```

## Setup

### Prerequisites

- Node.js (any current LTS)
- A `.env` file at the project root (copy from `.env.sample`)

### Environment variables

```
# .env
RECAPTCHA_DEV=<your reCAPTCHA v3 dev site key>
RECAPTCHA_PROD=<your reCAPTCHA v3 prod site key>
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

## JavaScript (`src/js/example.js`)

The script is wrapped in an IIFE and has no external dependencies beyond the Google reCAPTCHA v3 API. On load it writes `document.title`, `window.location.href`, and `document.referrer` into the form's hidden fields. The reCAPTCHA script is lazy-loaded the first time the user interacts with a Yes/No radio button, avoiding an unnecessary network request on pages where the form is never used. When a radio is selected the comment section is revealed and the comment label updates dynamically to match the chosen sentiment ("What worked well for you" vs "What didn't work for you"). On submit the script validates the form natively via `checkValidity()`, disables the submit button to prevent double-submission, then calls `grecaptcha.execute()` to obtain a token. That token is appended to a `FormData` object and the whole payload is sent via `fetch`. A successful `2xx` response hides the form and shows the success message; any network or HTTP error re-enables the submit button and reveals the error message. The `process.env.RECAPTCHA` and `process.env.BUILD_ENV` references are replaced with literal values at build time by esbuild, so no environment variables are present in the deployed output.

## Payload shape

```
data[page-title]=...
data[page-url]=...
data[page-referer]=...
data[franchise]=...
data[captchaCatch]=dev|prod
data[captcha]=
data[useful]=yes|no
data[comments]=...
feedback-captcha=
```

## Email routing logic

Email routing is managed via FreeMarker templates on the server and is not documented in this repository.

For routing rules, franchise mappings, and URL patterns, refer to the internal Confluence page:
**[placeholderlink]**

## GitHub Actions

Two workflows automate the build and publish the `dist/` output to dedicated release branches. No manual build step is needed for normal deployments.

| Workflow | Trigger | Build command | Publishes to branch |
|---|---|---|---|
| `dev-build.yml` | Push to `development` | `npm run build:dev` | `release-staging` |
| `prod-build.yml` | Push to `main` | `npm run build:prod` | `release` |

Each workflow:
1. Checks out source on `ubuntu-latest` with Node 20
2. Runs `npm install`
3. Builds using the appropriate reCAPTCHA key from repository secrets (`RECAPTCHA_DEV` or `RECAPTCHA_PROD`)
4. Force-pushes only the `dist/` folder to the target release branch as an orphan commit

### Required repository secrets

| Secret | Used by |
|---|---|
| `RECAPTCHA_DEV` | `dev-build.yml` |
| `RECAPTCHA_PROD` | `prod-build.yml` |

Set these under **Settings → Secrets and variables → Actions** in the GitHub repository.

## Usage

Run the appropriate build command above (or rely on the GitHub Actions workflow). Copy `dist/feedback.min.js` and `dist/feedback.min.html` into your CMS. Set the `data[franchise]` hidden field value to match your site's franchise key before deploying.

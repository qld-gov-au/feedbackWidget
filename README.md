# Feedback widget (qld.gov.au)

> [!WARNING]
> This is a prototype and is not production ready at this time.
> Please contact the Smart Service QLD web team if you are interested in reusing this feature.

A lightweight page feedback component for Queensland Government websites. Collects a yes/no helpfulness response and optional comments, then submits to the Smart Service QLD feedback endpoint.

## How it works

1. On page load the widget is ready to collect page metadata directly from `document` and `window`.
2. The user selects Yes or No, optionally enters a comment, and submits.
3. The JS wraps all fields under a `data.` parent and posts to the Smart Service submissions endpoint as URL-encoded form data.
4. The server reads the submitted fields, checks for spam, and routes the email to the appropriate team based on URL, referrer, or franchise.

## Structure

```
src/
  html/                                — Form markup (`index.html`)
  js/                                  — Widget logic (`feedback.js`)
docs/                                  — Project documentation pages
  utils/
    sync-docs-nav.mjs                  — Injects consistent docs navigation links
tests/
  smoke.spec.js                        — Playwright smoke tests
  widget.a11y.js                       — Axe + Playwright accessibility checks
  utils/common.js                      — Shared smoke/a11y test harness
dist/                                  — Build output (`feedback.min.html`, `feedback.min.js`) (not committed)
playwright.config.js                   — Default Playwright config (smoke)
playwright.a11y.config.js              — Playwright config for accessibility suite
playwright.browserstack.config.js      — Local-only BrowserStack config
build.mjs                              — Build pipeline for dist assets
package.json                           — Scripts and dependencies
```

## Documentation

- [Setup](docs/setup.md)
  - [Prerequisites](docs/setup.md#prerequisites)
  - [Environment variables](docs/setup.md#environment-variables)
  - [Install dependencies](docs/setup.md#install-dependencies)
- [Code formatting (Prettier)](docs/formatting.md)
  - [Commands](docs/formatting.md#commands)
  - [Pre-commit hook](docs/formatting.md#pre-commit-hook)
- [Build](docs/build.md)
- [Smoke tests](docs/testing.md#smoke-tests)
- [Accessibility checks](docs/testing.md#accessibility-checks)
- [JavaScript (`src/js/feedback.js`)](docs/javascript.md)
- [Email routing logic](docs/email-routing.md)
- [GitHub Actions](docs/github-actions.md)
  - [Required repository secrets](docs/github-actions.md#required-repository-secrets)
  - [Repository variables](docs/github-actions.md#repository-variables)
- [Usage](docs/usage.md)

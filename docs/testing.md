<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# Testing

This file is the source of truth for test behavior and commands.

## Smoke tests

Source: `tests/smoke.spec.js`

The smoke suite currently verifies:

1. Page title and URL are available on load.
2. Feedback details are hidden before any Yes/No selection.
3. Selecting Yes or No reveals details with the static label `Tell us why (optional)`.
4. Success and error banners are hidden on initial load.
5. Failed submission path (forced `500`) keeps the form visible, shows the error banner, resets submit button state, and includes a `g-recaptcha-response` query param.
6. Malformed JSON success response shows the error banner.
7. HTML error page response shows the error banner.
8. HTML success page response shows the success banner.
9. JSON success response validates key outbound payload fields and shows success.
10. Injected hidden franchise value is preserved in the outbound payload.
11. Hostname franchise overrides are used when hidden franchise is empty.
12. Delayed reCAPTCHA load still submits successfully (race-condition regression guard).
13. Widget-owned reCAPTCHA badge is visible after initialization.

Smoke tests use mocked `grecaptcha` and deterministic `test-token` values for stability.

Example GitHub Actions step:

```yaml
- name: Run smoke tests
  run: npm test
```

## Accessibility checks

Run automated WCAG checks with Axe + Playwright:

```bash
npm run test:a11y
```

Optional: generate a JSON report for logs/artifacts:

```bash
npm run test:a11y:report
```

The a11y suite fails on Axe violations with impact `serious` or `critical`.

## Run

- `npm test`
- `npm run test:a11y`
- `npm run test:a11y:report` (optional JSON report)

## BrowserStack (local-only)

- `npm run test:browserstack` runs BrowserStack smoke tests using the single default lane (`edge-win11`).
- `BROWSERSTACK_MATRIX=all npm run test:browserstack` runs the full matrix from `playwright.browserstack.config.js`.
- Requires local `.env` values for `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`.
- BrowserStack does not run on GitHub Actions.

## Notes

- Headless mode is controlled by `PLAYWRIGHT_HEADLESS`.
- Smoke assertions validate outbound request payload and selected UI states.
- Accessibility checks use Axe (`@axe-core/playwright`) and fail on `serious`/`critical` impacts.

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

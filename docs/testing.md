# Testing

This file is the source of truth for test behavior and commands.

## Smoke tests

Source: `tests/smoke.spec.js`

The smoke suite currently verifies:

1. Page title and URL are available on load.
2. Feedback details are hidden before any Yes/No selection.
3. The comment label is static (`Tell us why (optional)`) and does not change across Yes/No interactions.
4. Success and error banners are hidden on initial load.
5. Failed submission path (forced `500`) keeps the form visible, shows the error banner, resets submit button state, and includes a `g-recaptcha-response` query param.
6. Success submission path requires a `2xx` response with body `{ success: "true" }`, validates key payload fields, and shows success.
7. Injected hidden franchise value is preserved in the outbound payload.
8. Hostname franchise overrides are used when hidden franchise is empty.
9. Delayed reCAPTCHA load still submits successfully (race-condition regression guard).

## Run

- `npm test`

## BrowserStack (local-only)

- `npm run test:browserstack` runs BrowserStack smoke tests using the single default lane (`edge-win11`).
- `BROWSERSTACK_MATRIX=all npm run test:browserstack` runs the full matrix from `playwright.browserstack.config.js`.
- Requires local `.env` values for `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`.
- BrowserStack config is blocked in GitHub Actions (`GITHUB_ACTIONS=true`).

## Notes

- Headless mode is controlled by `PLAYWRIGHT_HEADLESS`.
- Real reCAPTCHA mode is controlled by `SMOKE_USE_REAL_RECAPTCHA`.
- Smoke assertions validate outbound request payload and selected UI states.

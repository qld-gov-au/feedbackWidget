# Testing

## Smoke tests
Source: tests/smoke.spec.js

1. Hidden fields are populated on load (`page-title`, `page-url`).
2. Feedback details are hidden before any Yes/No selection.
3. Selecting Yes reveals details and uses the positive label.
4. Selecting No reveals details and uses the negative label.
5. Success and error banners are hidden on initial load.
6. Failed submission path shows error banner (forced `500` response).
7. Success submission path sends payload and shows success banner.
8. Delayed reCAPTCHA load still submits successfully (race-condition regression test).

## Run
`npm test`

## BrowserStack (local-only)
- `npm run test:browserstack` runs BrowserStack smoke tests using a single default lane (`edge-win11`).
- `BROWSERSTACK_MATRIX=all npm run test:browserstack` runs the full matrix from `playwright.browserstack.config.js`.
- Requires local `.env` values for `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`.
- The BrowserStack config is blocked in GitHub Actions (`GITHUB_ACTIONS=true`).

## Notes
- Headless mode is controlled by `PLAYWRIGHT_HEADLESS`.
- Real reCAPTCHA mode is controlled by `SMOKE_USE_REAL_RECAPTCHA`.
- Payload is validated from captured outbound POST requests in smoke tests.
- The `data.page-referer` hidden field is checked in the success-path payload assertion.
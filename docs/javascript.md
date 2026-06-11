<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# JavaScript (`src/js/feedback.js`)

The script is wrapped in an IIFE and has no external dependencies beyond the Google reCAPTCHA v3 API.

It reads page metadata directly from `document` and `window` when building the submission payload.

The reCAPTCHA script is lazy-loaded the first time the user interacts with a Yes/No radio button, avoiding an unnecessary network request on pages where the form is never used.

The comment label is static in HTML (`Tell us why (optional)`), while JS reveals the details section after a Yes/No selection.

On submit the script validates the form natively via `checkValidity()`, disables the submit button to prevent double-submission, then calls `grecaptcha.execute()` to obtain a token.

The token is sent both in payload (`data.g-recaptcha-response`) and as a query parameter for server compatibility.

Success requires a `2xx` response and either JSON body `{ success: "true" }` or a non-error HTML response; on errors, the form remains visible, submit is re-enabled, and the error message is shown so users can retry.

The `process.env.RECAPTCHA` and `process.env.BUILD_ENV` references are replaced with literal values at build time by esbuild, so no environment variables are present in the deployed output.

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# Setup

## Prerequisites

- Node.js 24 or later
- A `.env` file at the project root (copy from `.env.sample`)

If you use `nvm`, run:

```bash
nvm use
```

This project pins Node via `.nvmrc`.

## Environment variables

```bash
# .env
RECAPTCHA_DEV=<your reCAPTCHA v3 dev site key>
RECAPTCHA_PROD=<your reCAPTCHA v3 prod site key>
# optional submission path suffix: /services/submissions/email/{FSH_PROJECT}/{FSH_ENDPOINT}
FSH_PROJECT=feedback
FSH_ENDPOINT=feedback-v3-*
PLAYWRIGHT_HEADLESS=true
```

> The `.env.sample` file lists all required keys. Never commit real keys.

## Install dependencies

```bash
npm install
```

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

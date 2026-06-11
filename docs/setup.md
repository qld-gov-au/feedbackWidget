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
# submission path: /services/submissions/email/{FSH_PROJECT}/{selected endpoint}
FSH_PROJECT=feedback
FSH_ENDPOINT_DEV=<dev endpoint>
FSH_ENDPOINT_UAT=<uat endpoint>
FSH_ENDPOINT_PROD=<prod endpoint>
PLAYWRIGHT_HEADLESS=true
```

Build mode selects endpoint automatically:

- `npm run build:dev` uses `FSH_ENDPOINT_DEV`
- `npm run build:uat` uses `FSH_ENDPOINT_UAT`
- `npm run build:prod` uses `FSH_ENDPOINT_PROD`

> The `.env.sample` file lists all required keys. Never commit real keys.

## Install dependencies

```bash
npm install
```

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

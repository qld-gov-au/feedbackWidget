<!-- DOCS_NAV_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_END -->

# Build

| Command              | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `npm run build:dev`  | Builds against `test.smartservice.qld.gov.au` using `RECAPTCHA_DEV` |
| `npm run build:prod` | Builds against `www.smartservice.qld.gov.au` using `RECAPTCHA_PROD` |

Both commands output minified files to `dist/`:

- `dist/feedback.min.js`
- `dist/feedback.min.html`

Copy these two files into your CMS.

<!-- DOCS_NAV_FOOTER_START -->

[<- Back to Docs Index](../README.md)

<!-- DOCS_NAV_FOOTER_END -->

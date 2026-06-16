import * as esbuild from 'esbuild';
function minifyHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // remove comments
    .replace(/^\s+|\s+$/gm, '') // trim each line
    .replace(/>\s+</g, '><') // collapse whitespace between tags
    .replace(/\s{2,}/g, ' ') // collapse remaining runs of whitespace
    .trim();
}
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const env = process.argv[2] || process.env.BUILD_ENV || 'dev';
if (env !== 'dev' && env !== 'uat' && env !== 'prod') {
  console.error('Error: BUILD_ENV must be "dev", "uat", or "prod".');
  process.exit(1);
}

const recaptchaKey = env === 'prod' ? process.env.RECAPTCHA_PROD : process.env.RECAPTCHA_DEV;
if (!recaptchaKey) {
  const keyName = env === 'prod' ? 'RECAPTCHA_PROD' : 'RECAPTCHA_DEV';
  console.error(`Error: ${keyName} is not set in your .env file.`);
  process.exit(1);
}

const smartserviceHost =
  env === 'prod' ? 'www.smartservice.qld.gov.au' : 'test.smartservice.qld.gov.au';

const fshProject = process.env.FSH_PROJECT || 'feedback';
const endpointByBuildEnv = {
  dev: process.env.FSH_ENDPOINT_DEV,
  uat: process.env.FSH_ENDPOINT_UAT,
  prod: process.env.FSH_ENDPOINT_PROD,
};
const fshEndpoint = endpointByBuildEnv[env];
const widgetBuildEnv = env === 'prod' ? 'prod' : 'dev';

if (!fshEndpoint) {
  console.error(
    `Error: endpoint for BUILD_ENV="${env}" is not set. ` +
      'Expected FSH_ENDPOINT_DEV, FSH_ENDPOINT_UAT, and FSH_ENDPOINT_PROD in .env.'
  );
  process.exit(1);
}

console.log(`Building for environment: ${env}`);

mkdirSync('dist', { recursive: true });

// --- JS: bundle + minify, replace process.env.RECAPTCHA with the literal key ---
await esbuild.build({
  entryPoints: ['src/js/feedback.js'],
  outfile: `dist/feedback.${env}.min.js`,
  bundle: false,
  minify: true,
  sourcemap: true,
  define: {
    'process.env.RECAPTCHA': JSON.stringify(recaptchaKey),
    'process.env.BUILD_ENV': JSON.stringify(widgetBuildEnv),
  },
  target: ['es2017'],
});

console.log(`Built: dist/feedback.${env}.min.js`);

// --- HTML: minify + inject host and endpoint placeholders ---
const rawHtml = readFileSync('src/html/index.html', 'utf8')
  .replace('__SMARTSERVICE_HOST__', smartserviceHost)
  .replace('__FSH_PROJECT__', fshProject)
  .replace('__FSH_ENDPOINT__', fshEndpoint);
const minifiedHtml = minifyHtml(rawHtml);
writeFileSync(`dist/feedback.${env}.min.html`, minifiedHtml);
console.log(`Built: dist/feedback.${env}.min.html`);
console.log(`\nDone. Copy dist/feedback.${env}.min.js and dist/feedback.${env}.min.html into your CMS.`);

import * as esbuild from 'esbuild';
function minifyHtml(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')           // remove comments
        .replace(/^\s+|\s+$/gm, '')                // trim each line
        .replace(/>\s+</g, '><')                   // collapse whitespace between tags
        .replace(/\s{2,}/g, ' ')                   // collapse remaining runs of whitespace
        .trim();
}
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const env = process.env.BUILD_ENV || 'dev';
if (env !== 'dev' && env !== 'prod') {
    console.error('Error: BUILD_ENV must be "dev" or "prod".');
    process.exit(1);
}

const recaptchaKey = env === 'prod' ? process.env.RECAPTCHA_PROD : process.env.RECAPTCHA_DEV;
if (!recaptchaKey) {
    console.error(`Error: RECAPTCHA_${env.toUpperCase()} is not set in your .env file.`);
    process.exit(1);
}

const smartserviceHost = env === 'prod'
    ? 'www.smartservice.qld.gov.au'
    : 'test.smartservice.qld.gov.au';

console.log(`Building for environment: ${env}`);

mkdirSync('dist', { recursive: true });

// --- JS: bundle + minify, replace process.env.RECAPTCHA with the literal key ---
await esbuild.build({
    entryPoints: ['src/js/feedback.js'],
    outfile: 'dist/feedback.min.js',
    bundle: false,
    minify: true,
    define: {
        'process.env.RECAPTCHA': JSON.stringify(recaptchaKey),
        'process.env.BUILD_ENV': JSON.stringify(env),
    },
    target: ['es2017'],
});

console.log('Built: dist/feedback.min.js');

// --- HTML: minify + inject BUILD_ENV into captchaCatch ---
const rawHtml = readFileSync('src/html/example.html', 'utf8')
    .replace('__BUILD_ENV__', env)
    .replace('__SMARTSERVICE_HOST__', smartserviceHost);
const minifiedHtml = minifyHtml(rawHtml);
writeFileSync('dist/feedback.min.html', minifiedHtml);
console.log('Built: dist/feedback.min.html');
console.log('\nDone. Copy dist/feedback.min.js and dist/feedback.min.html into your CMS.');

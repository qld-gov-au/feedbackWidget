import { readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, 'docs');

const NAV_START = '<!-- DOCS_NAV_START -->';
const NAV_END = '<!-- DOCS_NAV_END -->';
const FOOTER_START = '<!-- DOCS_NAV_FOOTER_START -->';
const FOOTER_END = '<!-- DOCS_NAV_FOOTER_END -->';

const topNav = [NAV_START, '[<- Back to Docs Index](../README.md)', '', NAV_END, ''].join('\n');

const bottomNav = ['', FOOTER_START, '[<- Back to Docs Index](../README.md)', FOOTER_END, ''].join(
  '\n'
);

function replaceOrInsert(content, startMarker, endMarker, block, insertAtTop) {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.slice(0, startIndex);
    const after = content.slice(endIndex + endMarker.length);
    return before + block + after.replace(/^\n+/, '\n');
  }

  if (insertAtTop) {
    return block + content;
  }

  return content.replace(/\s*$/, '') + bottomNav;
}

const files = readdirSync(docsDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => path.join(docsDir, name));

for (const filePath of files) {
  const original = readFileSync(filePath, 'utf8');
  let updated = original;

  updated = replaceOrInsert(updated, NAV_START, NAV_END, topNav, true);
  updated = replaceOrInsert(updated, FOOTER_START, FOOTER_END, bottomNav, false);

  if (updated !== original) {
    writeFileSync(filePath, updated);
    console.log('updated:', path.relative(repoRoot, filePath));
  }
}

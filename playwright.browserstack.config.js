const { defineConfig } = require('@playwright/test');
const playwrightVersion = require('@playwright/test/package.json').version;

if (process.env.GITHUB_ACTIONS === 'true') {
  throw new Error('BrowserStack config is local-only and must not run in GitHub Actions.');
}

const username = process.env.BROWSERSTACK_USERNAME;
const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
const matrixMode = (process.env.BROWSERSTACK_MATRIX || 'single').toLowerCase();

if (!username || !accessKey) {
  throw new Error('BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are required for BrowserStack runs.');
}

const buildName = ('footer-feedback-local-' + new Date().toISOString().slice(0, 19));
const projectName = 'footer-feedback local-only';

function makeWsEndpoint(caps) {
  return 'wss://cdp.browserstack.com/playwright?caps=' + encodeURIComponent(JSON.stringify(caps));
}

function makeProject(name, browser, browserVersion, os, osVersion) {
  const caps = {
    browser: browser,
    browser_version: browserVersion,
    os: os,
    os_version: osVersion,
    name: name,
    build: buildName,
    project: projectName,
    'browserstack.username': username,
    'browserstack.accessKey': accessKey,
    'browserstack.local': 'false',
    'browserstack.debug': 'true',
    'browserstack.networkLogs': 'true',
    'client.playwrightVersion': playwrightVersion
  };

  return {
    name: name,
    use: {
      connectOptions: {
        wsEndpoint: makeWsEndpoint(caps)
      }
    }
  };
}

const allProjects = [
  makeProject('edge-win11', 'edge', 'latest', 'Windows', '11'),
  makeProject('chrome-win10', 'chrome', 'latest', 'Windows', '10'),
  makeProject('webkit-osx-sonoma', 'playwright-webkit', 'latest', 'OS X', 'Sonoma')
];

const selectedProjects = matrixMode === 'all'
  ? allProjects
  : [allProjects[0]];

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  projects: selectedProjects
});

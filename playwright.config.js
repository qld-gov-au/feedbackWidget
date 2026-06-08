const { defineConfig } = require('@playwright/test');

const headlessEnv = (process.env.PLAYWRIGHT_HEADLESS || 'true').toLowerCase();
const isHeadless = headlessEnv === 'true';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: {
    headless: isHeadless,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

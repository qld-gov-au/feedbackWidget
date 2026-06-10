const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { loadWidget, smokeData } = require('./utils/common');

const sourceHtml = fs.readFileSync(path.resolve(__dirname, '../src/html/index.html'), 'utf8');
const builtScriptPath = path.resolve(__dirname, '../dist/feedback.min.js');

const widgetOptions = {
  builtScriptPath,
  smokeData,
  sourceHtml,
};

function seriousOrCritical(violations) {
  return violations.filter(function (violation) {
    return violation.impact === 'serious' || violation.impact === 'critical';
  });
}

test('widget has no serious or critical accessibility violations', async ({ page }) => {
  await loadWidget(page, widgetOptions);

  const results = await new AxeBuilder({ page }).analyze();
  const relevant = seriousOrCritical(results.violations);

  expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
});

test('expanded widget details have no serious or critical accessibility violations', async ({
  page,
}) => {
  await loadWidget(page, widgetOptions);
  await page.click('#feedback-useful-yes');

  const results = await new AxeBuilder({ page }).analyze();
  const relevant = seriousOrCritical(results.violations);

  expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
});

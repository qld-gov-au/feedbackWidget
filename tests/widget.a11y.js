const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { loadWidget, smokeData } = require('./utils/common');

const sourceHtml = fs.readFileSync(path.resolve(__dirname, '../src/html/index.html'), 'utf8');
const builtScriptPath = path.resolve(__dirname, '../dist/feedback.dev.min.js');

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

test('widget renders expected accessible controls and hidden states', async ({ page }) => {
  await loadWidget(page, widgetOptions);

  await expect(page.getByRole('group', { name: 'Was this page helpful?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'No' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit' })).toBeHidden();
  await expect(page.locator('#page-feedback-details')).toBeHidden();
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});

test('keyboard-only interaction reveals details and reaches the submit button', async ({
  page,
}) => {
  await loadWidget(page, widgetOptions);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeFocused();

  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeChecked();
  await expect(page.locator('#page-feedback-details')).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'contact us' })).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator('#pageFeedbackComment')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();
});

test('pressing Enter on the first radio reveals the details and submit button', async ({
  page,
}) => {
  await loadWidget(page, widgetOptions);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Yes' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackComment')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();
});

test('expanded widget exposes comment label and hint text', async ({ page }) => {
  await loadWidget(page, widgetOptions);
  await page.click('#feedback-useful-yes');

  const comment = page.getByLabel('Tell us why (optional)');
  await expect(comment).toBeVisible();
  await expect(comment).toHaveAttribute('aria-describedby', 'pageFeedbackComment-hint');
  await expect(page.locator('#pageFeedbackComment-hint')).toContainText(
    'Do not include any personal information.'
  );
});

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

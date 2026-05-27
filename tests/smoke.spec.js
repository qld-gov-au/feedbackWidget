const { test, expect } = require('@playwright/test');
const path = require('path');

const fixture = `file://${path.resolve(__dirname, 'fixture.html')}`;

test('page title and URL are injected into hidden fields on load', async ({ page }) => {
  await page.goto(fixture);
  const title = await page.inputValue('#data-page-title');
  const url = await page.inputValue('#data-page-url');
  expect(title).toBe('Feedback Widget Test');
  expect(url).toBeTruthy();
});

test('details section is hidden before any radio is selected', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#page-feedback-details')).toBeHidden();
});

test('selecting Yes reveals details with correct label', async ({ page }) => {
  await page.goto(fixture);
  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What worked well for you');
});

test('selecting No reveals details with correct label', async ({ page }) => {
  await page.goto(fixture);
  await page.click('#feedback-useful-no');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What didn');
});

test('success and error banners are hidden on initial load', async ({ page }) => {
  await page.goto(fixture);
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});

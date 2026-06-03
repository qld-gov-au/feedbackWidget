// ----------------------------------------------------------------------------------------------------------
// Smoke test summary:
// 1. Load the real widget markup inside a controlled page shell.
// 2. Verify the UI state transitions and hidden fields.
// 3. Submit a live payload and assert the important response fields.
// ----------------------------------------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { smokeData, getRunnerIp, getSubmissionFeedback, getExpectedOS, logPayload, loadWidget } = require('./utils/common');

const sourceHtml = fs.readFileSync(path.resolve(__dirname, '../src/html/index.html'), 'utf8');
const builtScriptPath = path.resolve(__dirname, '../dist/feedback.min.js');
const useRealRecaptcha = process.env.SMOKE_USE_REAL_RECAPTCHA === 'true';
const realRecaptchaSiteKey = process.env.SMOKE_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_DEV || '';
const widgetOptions = {
  builtScriptPath,
  realRecaptchaSiteKey,
  smokeData,
  sourceHtml,
  useRealRecaptcha,
};

test('page title and URL are injected into hidden fields on load', async ({ page }) => {
  // Smoke check: the widget should write page metadata into its hidden fields.
  await loadWidget(page, widgetOptions);
  const title = await page.inputValue('#data-page-title');
  const url = await page.inputValue('#data-page-url');
  expect(title).toBe(smokeData.pageTitle);
  expect(url).toBe(smokeData.pageUrl);
});

test('details section is hidden before any radio is selected', async ({ page }) => {
  // Default state: the comment area should stay hidden until the user chooses yes/no.
  await loadWidget(page, widgetOptions);
  await expect(page.locator('#page-feedback-details')).toBeHidden();
});

test('selecting Yes reveals details with correct label', async ({ page }) => {
  // Choice handling: yes should reveal the details area and keep the positive label.
  await loadWidget(page, widgetOptions);
  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What worked well for you');
});

test('selecting No reveals details with correct label', async ({ page }) => {
  // Choice handling: no should reveal the details area and switch to the negative label.
  await loadWidget(page, widgetOptions);
  await page.click('#feedback-useful-no');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What didn');
});

test('success and error banners are hidden on initial load', async ({ page }) => {
  // Status banners must stay hidden until a submission outcome is known.
  await loadWidget(page, widgetOptions);
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});

test('failed feedback submission shows the error banner', async ({ page }) => {
  // Failure-path smoke check: mock the submit endpoint to return an error and
  // confirm the widget hides the form and surfaces the error state.
  await loadWidget(page, widgetOptions);
  await page.route('**/services/submissions/email/feedback/feedback-v4', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'forced test failure' })
    });
  });

  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();

  const runnerIp = await getRunnerIp();
  const feedback = getSubmissionFeedback(runnerIp);
  await page.fill('#pageFeedbackComment', feedback);

  // Capture the exact outbound payload so assertions validate transport data,
  // not only on-screen state changes.
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes('/services/submissions/email/feedback/feedback-v4') && request.method() === 'POST';
  });

  await page.click('#page-feedback-submit');
  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  logPayload('failed submission', payload);

  await expect(page.locator('#page-feedback-form')).toBeHidden();
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toHaveText('Sorry, your feedback could not be submitted right now.');
});

test('submits feedback to the test endpoint and shows success', async ({ page }) => {
  // End-to-end smoke check: submit a real payload, capture the request body,
  // and verify the important fields plus the success UI state.
  await loadWidget(page, widgetOptions);
  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  const runnerIp = await getRunnerIp();
  const feedback = getSubmissionFeedback(runnerIp);
  await page.fill('#pageFeedbackComment', feedback);
  // Wait for the submission request and assert against JSON body content.
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes('/services/submissions/email/feedback/feedback-v4') && request.method() === 'POST';
  });
  await page.click('#page-feedback-submit');

  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  logPayload('successful submission', payload);

  expect(payload.data['page-title']).toBe(smokeData.pageTitle);
  expect(payload.data['page-url']).toBe(smokeData.pageUrl);
  expect(payload.data['page-referer']).toBe(smokeData.referrer);
  expect(payload.data['franchise']).toBe(smokeData.franchise);
  expect(payload.data.useful).toBe(smokeData.useful);
  expect(payload.data.browserName.name).toBe('Chrome');
  expect(payload.data.OS).toBe(getExpectedOS());
  expect(payload.data.comments).toContain(smokeData.feedbackPrefix);
  expect(payload.data.captchaCatch).toBe('dev');

  await expect(page.locator('#page-feedback-form')).toBeHidden();
  await expect(page.locator('#page-feedback-success')).toHaveText('Thank you for your feedback.');
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});

test('submit waits for delayed reCAPTCHA load before posting', async ({ page }) => {
  test.skip(useRealRecaptcha, 'Delayed reCAPTCHA simulation applies to mocked mode only.');

  // Regression guard for the grecaptcha undefined race:
  // submit should wait for the script-load promise before execute.
  await loadWidget(page, {
    ...widgetOptions,
    simulateDelayedRecaptchaLoad: true,
  });
  await page.route('**/services/submissions/email/feedback/feedback-v4', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  await page.click('#feedback-useful-yes');

  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes('/services/submissions/email/feedback/feedback-v4') && request.method() === 'POST';
  });

  await page.click('#page-feedback-submit');
  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  logPayload('delayed recaptcha submission', payload);

  expect(payload.data.captcha.token).toBe('delayed-test-token');
  await expect(page.locator('#page-feedback-success')).toHaveText('Thank you for your feedback.');
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});
// ----------------------------------------------------------------------------------------------------------
// Smoke test summary:
// 1. Load the real widget markup inside a controlled page shell.
// 2. Verify the UI state transitions and hidden fields.
// 3. Submit a live payload and assert the important response fields.
// ----------------------------------------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { smokeData, getRunnerIp, getSubmissionFeedback } = require('./.smoke-meta');

const sourceHtml = fs.readFileSync(path.resolve(__dirname, '../src/html/index.html'), 'utf8');
const builtScriptPath = path.resolve(__dirname, '../dist/feedback.min.js');

function renderTestDocument() {
  // Render the source fragment inside a minimal document so the widget runs
  // with the same markup as production, but with controlled test values.
  const html = sourceHtml
    .replace('__BUILD_ENV__', 'dev')
    .replace('__SMARTSERVICE_HOST__', 'test.smartservice.qld.gov.au')
    .replace('name="data.franchise" value=""', `name="data.franchise" value="${smokeData.franchise}"`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${smokeData.pageTitle}</title>
</head>
<body>
${html}
</body>
</html>`;
}

async function loadWidget(page) {
  // Navigate to the GitHub URL we want to simulate, then inject the built JS
  // bundle so the page behaves like a real hosted widget.
  await page.route(smokeData.pageUrl, async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: renderTestDocument()
    });
  });

  await page.goto(smokeData.pageUrl, {
    waitUntil: 'domcontentloaded',
    referer: smokeData.referrer
  });
  await page.evaluate(() => {
    window.grecaptcha = {
      ready(cb) {
        cb();
      },
      execute() {
        return Promise.resolve('test-token');
      }
    };
  });
  await page.addScriptTag({ path: builtScriptPath });
}

test('page title and URL are injected into hidden fields on load', async ({ page }) => {
  // Smoke check: the widget should write page metadata into its hidden fields.
  await loadWidget(page);
  const title = await page.inputValue('#data-page-title');
  const url = await page.inputValue('#data-page-url');
  expect(title).toBe(smokeData.pageTitle);
  expect(url).toBe(smokeData.pageUrl);
});

test('details section is hidden before any radio is selected', async ({ page }) => {
  // Default state: the comment area should stay hidden until the user chooses yes/no.
  await loadWidget(page);
  await expect(page.locator('#page-feedback-details')).toBeHidden();
});

test('selecting Yes reveals details with correct label', async ({ page }) => {
  // Choice handling: yes should reveal the details area and keep the positive label.
  await loadWidget(page);
  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What worked well for you');
});

test('selecting No reveals details with correct label', async ({ page }) => {
  // Choice handling: no should reveal the details area and switch to the negative label.
  await loadWidget(page);
  await page.click('#feedback-useful-no');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  await expect(page.locator('#pageFeedbackCommentLabel')).toContainText('What didn');
});

test('success and error banners are hidden on initial load', async ({ page }) => {
  // Status banners must stay hidden until a submission outcome is known.
  await loadWidget(page);
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});

test('failed feedback submission shows the error banner', async ({ page }) => {
  // Failure-path smoke check: mock the submit endpoint to return an error and
  // confirm the widget hides the form and surfaces the error state.
  await loadWidget(page);
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

  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes('/services/submissions/email/feedback/feedback-v4') && request.method() === 'POST';
  });

  await page.click('#page-feedback-submit');
  await requestPromise;

  await expect(page.locator('#page-feedback-form')).toBeHidden();
  await expect(page.locator('#page-feedback-success')).toBeHidden();
  await expect(page.locator('#page-feedback-error')).toHaveText('Sorry, your feedback could not be submitted right now.');
});

test('submits feedback to the test endpoint and shows success', async ({ page }) => {
  // End-to-end smoke check: submit a real payload, capture the request body,
  // and verify the important fields plus the success UI state.
  await loadWidget(page);
  await page.click('#feedback-useful-yes');
  await expect(page.locator('#page-feedback-details')).toBeVisible();
  const runnerIp = await getRunnerIp();
  const feedback = getSubmissionFeedback(runnerIp);
  await page.fill('#pageFeedbackComment', feedback);
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes('/services/submissions/email/feedback/feedback-v4') && request.method() === 'POST';
  });
  await page.click('#page-feedback-submit');

  const request = await requestPromise;
  const payload = JSON.parse(request.postData());

  expect(payload.data['page-title']).toBe(smokeData.pageTitle);
  expect(payload.data['page-url']).toBe(smokeData.pageUrl);
  expect(payload.data['page-referer']).toBe(smokeData.referrer);
  expect(payload.data['franchise']).toBe(smokeData.franchise);
  expect(payload.data.useful).toBe(smokeData.useful);
  expect(payload.data.browserName.name).toBe('Chrome');
  expect(payload.data.OS).toBe('Mac OS');
  expect(payload.data.comments).toContain(smokeData.feedbackPrefix);
  expect(payload.data.captchaCatch).toBe('dev');

  await expect(page.locator('#page-feedback-form')).toBeHidden();
  await expect(page.locator('#page-feedback-success')).toHaveText('Thank you for your feedback.');
  await expect(page.locator('#page-feedback-error')).toBeHidden();
});
// ----------------------------------------------------------------------------------------------------------
// Smoke test summary:
// 1. Load the real widget markup inside a controlled page shell.
// 2. Verify the UI state transitions and hidden fields.
// 3. Submit a live payload and assert the important response fields.
// ----------------------------------------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  smokeData,
  getRunnerIp,
  getSubmissionFeedback,
  getExpectedBrowserName,
  getExpectedOSForProject,
  logSmokeInfo,
  logSmokePass,
  logSmokeFail,
  loadWidget,
} = require("./utils/common");

const sourceHtml = fs.readFileSync(path.resolve(__dirname, "../src/html/index.html"), "utf8");
const builtScriptPath = path.resolve(__dirname, "../dist/feedback.min.js");
const useRealRecaptcha = process.env.SMOKE_USE_REAL_RECAPTCHA === "true";
const realRecaptchaSiteKey =
  process.env.SMOKE_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_DEV || "";
const fshProject = process.env.FSH_PROJECT;
const fshEndpoint = process.env.FSH_ENDPOINT;
const submitPathFragment = "/services/submissions/email/" + fshProject + "/" + fshEndpoint;
const submitPathRoutePattern = "**" + submitPathFragment + "**";

const widgetOptions = {
  builtScriptPath,
  realRecaptchaSiteKey,
  smokeData,
  sourceHtml,
  useRealRecaptcha,
};

test.afterEach(async ({}, testInfo) => {
  const browser = testInfo.project.name;
  const check = testInfo.title;

  if (testInfo.status === testInfo.expectedStatus) {
    logSmokePass(`Passed | Browser: ${browser} | Check: ${check}`);
    return;
  }

  const firstError =
    testInfo.errors && testInfo.errors.length > 0 && testInfo.errors[0].message
      ? testInfo.errors[0].message.split("\n")[0]
      : "no error message captured";
  logSmokeFail(`Failed | Browser: ${browser} | Check: ${check} | Reason: ${firstError}`);
});

test("page title and URL are available on load", async ({ page }) => {
  // Smoke check: fixture wiring sets expected document title and location.
  await loadWidget(page, widgetOptions);
  const title = await page.title();
  const url = page.url();
  expect(title).toBe(smokeData.pageTitle);
  expect(url).toBe(smokeData.pageUrl);
});

test("details section is hidden before any radio is selected", async ({ page }) => {
  // Default state: the comment area should stay hidden until the user chooses yes/no.
  await loadWidget(page, widgetOptions);
  await expect(page.locator("#page-feedback-details")).toBeHidden();
});

test("selecting Yes or No reveals details with static label", async ({ page }) => {
  // Label text is static in HTML and should not change across yes/no interactions.
  await loadWidget(page, widgetOptions);

  await expect(page.locator("#pageFeedbackCommentLabel")).toContainText("Tell us why (optional)");

  await page.click("#feedback-useful-yes");
  await expect(page.locator("#page-feedback-details")).toBeVisible();
  await expect(page.locator("#pageFeedbackCommentLabel")).toContainText("Tell us why (optional)");

  await page.click("#feedback-useful-no");
  await expect(page.locator("#pageFeedbackCommentLabel")).toContainText("Tell us why (optional)");
});

test("success and error banners are hidden on initial load", async ({ page }) => {
  // Status banners must stay hidden until a submission outcome is known.
  await loadWidget(page, widgetOptions);
  await expect(page.locator("#page-feedback-success")).toBeHidden();
  await expect(page.locator("#page-feedback-error")).toBeHidden();
});

test("failed feedback submission shows the error banner", async ({ page }) => {
  // Failure-path smoke check: mock the submit endpoint to return an error and
  // confirm the widget hides the form and surfaces the error state.
  await loadWidget(page, widgetOptions);
  await page.route(submitPathRoutePattern, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "forced test failure" }),
    });
  });

  await page.click("#feedback-useful-yes");
  await expect(page.locator("#page-feedback-details")).toBeVisible();

  const runnerIp = await getRunnerIp();
  const feedback = getSubmissionFeedback(runnerIp);
  await page.fill("#pageFeedbackComment", feedback);

  // Capture the exact outbound payload so assertions validate transport data,
  // not only on-screen state changes.
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes(submitPathFragment) && request.method() === "POST";
  });

  await page.click("#page-feedback-submit");
  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  const requestUrl = new URL(request.url());

  expect(requestUrl.searchParams.get("g-recaptcha-response")).toBeTruthy();

  await expect(page.locator("#page-feedback-form")).toBeVisible();
  await expect(page.locator("#page-feedback-success")).toBeHidden();
  await expect(page.locator("#page-feedback-error")).toHaveText(
    "Sorry, your feedback could not be submitted right now."
  );
  await expect(page.locator("#page-feedback-submit")).toHaveText("Submit");
  await expect(page.locator("#page-feedback-submit")).toBeEnabled();
});

test("submits feedback to the test endpoint and shows success", async ({ page }, testInfo) => {
  // End-to-end smoke check: submit a real payload, capture the request body,
  // and verify the important fields plus the success UI state.
  await loadWidget(page, widgetOptions);
  await page.route(submitPathRoutePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" }),
    });
  });
  await page.click("#feedback-useful-yes");
  await expect(page.locator("#page-feedback-details")).toBeVisible();
  const runnerIp = await getRunnerIp();
  const feedback = getSubmissionFeedback(runnerIp);
  await page.fill("#pageFeedbackComment", feedback);
  // Wait for the submission request and assert against JSON body content.
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes(submitPathFragment) && request.method() === "POST";
  });
  await page.click("#page-feedback-submit");

  const request = await requestPromise;
  const payload = JSON.parse(request.postData());

  expect(payload.data["page-title"]).toBe(smokeData.pageTitle);
  expect(payload.data["page-url"]).toBe(smokeData.pageUrl);
  expect(payload.data["page-referer"]).toBe(smokeData.referrer);
  expect(payload.data["franchise"]).toBe("qld-gov-au");
  expect(payload.data["feedback-satisfaction"]).toBe(smokeData.feedbackSatisfaction);
  expect(payload.data.browserName.name).toBe(getExpectedBrowserName(testInfo.project.name));
  expect(payload.data.OS).toBe(getExpectedOSForProject(testInfo.project.name));
  expect(payload.data.comments).toContain(smokeData.feedbackPrefix);
  expect(payload.data.captchaCatch).toBe("dev");
  expect(payload.data["feedback-captcha"]).toBe("");
  expect(payload.data["g-recaptcha-response"]).toBeTruthy();

  await expect(page.locator("#page-feedback-form")).toBeHidden();
  await expect(page.locator("#page-feedback-success")).toHaveText("Thank you for your feedback.");
  await expect(page.locator("#page-feedback-error")).toBeHidden();
});

test("uses injected hidden franchise field when present", async ({ page }) => {
  const injectedFranchise = "Injected Franchise Value";
  const franchiseSmokeData = {
    ...smokeData,
    pageUrl: "https://example.qld.gov.au/custom-franchise-page",
    referrer: "https://example.qld.gov.au",
    franchise: injectedFranchise,
  };

  await loadWidget(page, {
    ...widgetOptions,
    smokeData: franchiseSmokeData,
  });
  await page.route(submitPathRoutePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" }),
    });
  });

  await page.click("#feedback-useful-yes");
  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes(submitPathFragment) && request.method() === "POST";
  });
  await page.click("#page-feedback-submit");

  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  logSmokeInfo(
    `Franchise check (injected field): expected "${injectedFranchise}", got "${payload.data.franchise}"`
  );
  expect(payload.data.franchise).toBe(injectedFranchise);
});

test("uses hostname overrides when franchise field is empty", async ({ page }) => {
  const franchiseOverrideCases = [
    {
      pageUrl: "https://www.forgov.qld.gov.au/policies/leave",
      expected: "Government employees",
    },
    {
      pageUrl: "https://www.business.qld.gov.au/grants",
      expected: "Business Queensland",
    },
  ];

  for (const franchiseCase of franchiseOverrideCases) {
    const caseSmokeData = {
      ...smokeData,
      pageUrl: franchiseCase.pageUrl,
      referrer: franchiseCase.pageUrl,
      franchise: "",
    };

    await loadWidget(page, {
      ...widgetOptions,
      smokeData: caseSmokeData,
    });
    await page.route(submitPathRoutePattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: "true" }),
      });
    });

    await page.click("#feedback-useful-yes");
    const requestPromise = page.waitForRequest(function (request) {
      return request.url().includes(submitPathFragment) && request.method() === "POST";
    });
    await page.click("#page-feedback-submit");

    const request = await requestPromise;
    const payload = JSON.parse(request.postData());
    logSmokeInfo(
      `Franchise check (hostname override: ${new URL(franchiseCase.pageUrl).hostname}): expected "${franchiseCase.expected}", got "${payload.data.franchise}"`
    );
    expect(payload.data.franchise).toBe(franchiseCase.expected);

    await page.unroute(submitPathRoutePattern);
  }
});

test("submit waits for delayed reCAPTCHA load before posting", async ({ page }) => {
  test.skip(useRealRecaptcha, "Delayed reCAPTCHA simulation applies to mocked mode only.");

  // Regression guard for the grecaptcha undefined race:
  // submit should wait for the script-load promise before execute.
  await loadWidget(page, {
    ...widgetOptions,
    simulateDelayedRecaptchaLoad: true,
  });
  await page.route(submitPathRoutePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: "true" }),
    });
  });

  await page.click("#feedback-useful-yes");

  const requestPromise = page.waitForRequest(function (request) {
    return request.url().includes(submitPathFragment) && request.method() === "POST";
  });

  await page.click("#page-feedback-submit");
  const request = await requestPromise;
  const payload = JSON.parse(request.postData());
  const requestUrl = new URL(request.url());

  expect(payload.data["g-recaptcha-response"]).toBe("delayed-test-token");
  expect(requestUrl.searchParams.get("g-recaptcha-response")).toBe("delayed-test-token");
  await expect(page.locator("#page-feedback-success")).toHaveText("Thank you for your feedback.");
  await expect(page.locator("#page-feedback-error")).toBeHidden();
});

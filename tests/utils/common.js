// Shared smoke-test inputs, payload helpers, observability helpers, and widget bootstrapping.
// Keeping them together makes the test harness easier to reuse from future specs.
const makeText = parts => parts.join('');

const smokeData = {
  pageTitle: makeText(['Feedback', ' widget', ' tests']),
  pageUrl: makeText(['https://github.com/', 'qld-gov-au/', 'feedbackWidget']),
  referrer: makeText(['https://github.com/', 'qld-gov-au']),
  franchise: makeText(['QGDS', ' Developers']),
  useful: 'yes',
  feedbackPrefix: makeText(['Feedback: ', 'Play', 'wright', ' smoke', ' submission ;)'])
};

function getBuildSource() {
  return process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local';
}

function getBuildMetaParts(runnerIp) {
  const parts = ['\n\nsource=', getBuildSource()];
  if (process.env.GITHUB_RUN_ID) {
    parts.push('\nrun-id=', process.env.GITHUB_RUN_ID);
  }
  parts.push('\nrunner-ip=', runnerIp);
  return parts;
}

function getSubmissionFeedback(runnerIp) {
  return makeText([smokeData.feedbackPrefix, ...getBuildMetaParts(runnerIp)]);
}

async function getRunnerIp() {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  return data.ip;
}

function logPayload(label, payload) {
  console.log(`\n[smoke] ${label} payload:`);
  console.log(JSON.stringify(payload, null, 2));
}

function getExpectedOS() {
  return process.env.GITHUB_ACTIONS === 'true' ? 'Linux' : 'Mac OS';
}

function renderTestDocument(sourceHtml, smokeData) {
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
        <link rel="stylesheet" href="https://static.qgov.net.au/qgds-bootstrap5/v2/v2.x.x-latest/assets/css/qld.bootstrap.css"/>
      </head>
      <body>
        ${html}
      </body>
    </html>`;
}

async function loadWidget(page, options = {}) {
  const {
    builtScriptPath,
    realRecaptchaSiteKey,
    simulateDelayedRecaptchaLoad,
    smokeData,
    sourceHtml,
    useRealRecaptcha,
  } = options;

  await page.route(smokeData.pageUrl, async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: renderTestDocument(sourceHtml, smokeData)
    });
  });

  await page.goto(smokeData.pageUrl, {
    waitUntil: 'domcontentloaded',
    referer: smokeData.referrer
  });

  // Mode A: use real Google reCAPTCHA
  if (useRealRecaptcha) {
    if (!realRecaptchaSiteKey) {
      throw new Error('SMOKE_RECAPTCHA_SITE_KEY is required when SMOKE_USE_REAL_RECAPTCHA=true');
    }

    await page.addScriptTag({
      url: 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(realRecaptchaSiteKey)
    });
    await page.waitForFunction(() => {
      return Boolean(window.grecaptcha)
        && typeof window.grecaptcha.ready === 'function'
        && typeof window.grecaptcha.execute === 'function';
    });
  } else if (simulateDelayedRecaptchaLoad) {
    // Mode B: emulate slow third-party script availability to regression-test
    // the submit flow's wait-for-load behavior.
    await page.evaluate(() => {
      const originalAppendChild = document.head.appendChild.bind(document.head);
      document.head.appendChild = function (node) {
        if (node && node.tagName === 'SCRIPT' && /google\.com\/recaptcha\/api\.js/.test(node.src || '')) {
          // Delay script readiness and manually fire onload the way the browser would.
          setTimeout(function () {
            window.grecaptcha = {
              ready(cb) {
                cb();
              },
              execute() {
                return Promise.resolve('delayed-test-token');
              }
            };

            if (typeof node.onload === 'function') {
              node.onload();
            }
          }, 120);
          return node;
        }
        return originalAppendChild(node);
      };
    });
  } else {
    // Mode C (default): deterministic local smoke mode with mocked token.
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
  }

  await page.addScriptTag({ path: builtScriptPath });
}

module.exports = {
  smokeData,
  getRunnerIp,
  getSubmissionFeedback,
  logPayload,
  getExpectedOS,
  renderTestDocument,
  loadWidget,
};
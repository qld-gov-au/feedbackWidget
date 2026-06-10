// Shared smoke-test inputs, payload helpers, observability helpers, and widget bootstrapping.
// Keeping them together makes the test harness easier to reuse from future specs.
const makeText = (parts) => parts.join('');

const smokeData = {
  pageTitle: makeText(['Feedback', ' widget', ' tests']),
  pageUrl: makeText(['https://github.com/', 'qld-gov-au/', 'feedbackWidget']),
  referrer: makeText(['https://github.com/', 'qld-gov-au']),
  franchise: '',
  feedbackSatisfaction: 'Satisfied (4)',
  feedbackPrefix: makeText(['Play', 'wright', ' smoke', ' submission ;)']),
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

function isGithubActions() {
  return process.env.GITHUB_ACTIONS === 'true';
}

function formatSmokeLog(level, message) {
  return `Smoke Check | ${level} | ${message}`;
}

function logSmokeInfo(message) {
  const line = formatSmokeLog('INFO', message);
  console.log(line);
  if (isGithubActions()) {
    console.log(`::notice title=Smoke Check::${line}`);
  }
}

function logSmokePass(message) {
  const line = formatSmokeLog('PASS', message);
  console.log(line);
  if (isGithubActions()) {
    console.log(`::notice title=Smoke Check::${line}`);
  }
}

function logSmokeFail(message) {
  const line = formatSmokeLog('FAIL', message);
  console.log(line);
  if (isGithubActions()) {
    console.log(`::error title=Smoke Check::${line}`);
  }
}

function getExpectedOS() {
  if (process.env.GITHUB_ACTIONS === 'true') return 'Linux';
  if (process.platform === 'win32') return 'Windows';
  return 'Mac OS';
}

function getExpectedBrowserName(projectName) {
  if (/edge/i.test(projectName)) {
    return 'Edge';
  }
  if (/webkit|safari/i.test(projectName)) {
    return 'Safari';
  }
  return 'Chrome';
}

function getExpectedOSForProject(projectName) {
  if (/win/i.test(projectName)) {
    return 'Windows';
  }
  if (/osx|mac|webkit|safari/i.test(projectName)) {
    return 'Mac OS';
  }
  return getExpectedOS();
}

function renderTestDocument(sourceHtml, smokeData) {
  const fshProject = process.env.FSH_PROJECT;
  const fshEndpoint = process.env.FSH_ENDPOINT;

  // Render the source fragment inside a minimal document so the widget runs
  // with the same markup as production, but with controlled test values.
  const html = sourceHtml
    .replace('__SMARTSERVICE_HOST__', 'test.smartservice.qld.gov.au')
    .replace('__FSH_PROJECT__', fshProject)
    .replace('__FSH_ENDPOINT__', fshEndpoint);
  const renderedFormHtml = smokeData.franchise
    ? html.replace(/(<input[^>]*name="franchise"[^>]*\bvalue=")[^"]*(")/, function (_, start, end) {
        return start + smokeData.franchise + end;
      })
    : html;

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${smokeData.pageTitle}</title>
        <link rel="stylesheet" href="https://static.qgov.net.au/qgds-bootstrap5/v2/v2.x.x-latest/assets/css/qld.bootstrap.css"/>
      </head>
      <body>
        ${renderedFormHtml}
      </body>
    </html>`;
}

async function loadWidget(page, options = {}) {
  const { builtScriptPath, simulateDelayedRecaptchaLoad, smokeData, sourceHtml } = options;

  await page.route(smokeData.pageUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: renderTestDocument(sourceHtml, smokeData),
    });
  });

  await page.goto(smokeData.pageUrl, {
    waitUntil: 'domcontentloaded',
    referer: smokeData.referrer,
  });

  if (simulateDelayedRecaptchaLoad) {
    // Mode A: emulate slow third-party script availability to regression-test
    // the submit flow's wait-for-load behavior.
    await page.evaluate(() => {
      const originalAppendChild = document.head.appendChild.bind(document.head);
      document.head.appendChild = function (node) {
        if (
          node &&
          node.tagName === 'SCRIPT' &&
          /google\.com\/recaptcha\/api\.js/.test(node.src || '')
        ) {
          // Delay script readiness and manually fire onload the way the browser would.
          setTimeout(function () {
            // Simulate Google's floating badge so visibility behavior can be smoke-tested.
            if (!document.querySelector('.grecaptcha-badge')) {
              const badge = document.createElement('div');
              badge.className = 'grecaptcha-badge';
              badge.style.position = 'fixed';
              badge.style.right = '0';
              badge.style.bottom = '0';
              badge.style.width = '256px';
              badge.style.height = '60px';
              badge.style.visibility = 'visible';
              badge.style.opacity = '1';
              badge.style.pointerEvents = 'auto';
              document.body.appendChild(badge);
            }

            window.grecaptcha = {
              ready(cb) {
                cb();
              },
              execute() {
                return Promise.resolve('delayed-test-token');
              },
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
    // Mode B (default): deterministic local smoke mode with mocked token.
    await page.evaluate(() => {
      window.grecaptcha = {
        ready(cb) {
          cb();
        },
        execute() {
          return Promise.resolve('test-token');
        },
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
  logSmokeInfo,
  logSmokePass,
  logSmokeFail,
  getExpectedOS,
  getExpectedBrowserName,
  getExpectedOSForProject,
  renderTestDocument,
  loadWidget,
};

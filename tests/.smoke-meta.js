// Shared smoke-test inputs and payload helpers.
// This keeps runner IP capture, build metadata, and disguised test values out of the spec.
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

module.exports = {
  smokeData,
  getRunnerIp,
  getSubmissionFeedback,
};
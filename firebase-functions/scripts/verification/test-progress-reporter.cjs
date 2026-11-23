const path = require("node:path");

/** Makes long transactional suites observable even when Jest suppresses passing output. */
module.exports = class TestProgressReporter {
  onTestStart(test) {
    process.stdout.write(`Starting ${path.relative(process.cwd(), test.path)}\n`);
  }
};

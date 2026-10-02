// Retained diagnostic reporter: prints synthetic case names and timing only.
const fs = require('node:fs');
const path = require('node:path');
const destination = process.env.AUTH_DIAGNOSTIC_LOG || path.resolve(__dirname, '../case-progress.jsonl');
class CaseProgress {
  record(event, test, details) {
    const row = {time: new Date().toISOString(), event, suite: path.basename(test.path), ...details};
    fs.appendFileSync(destination, JSON.stringify(row) + '\n');
    process.stderr.write('[AUTH-DIAGNOSTIC] ' + JSON.stringify(row) + '\n');
  }
  onTestCaseStart(test, info) { this.record('start', test, {name: info.fullName}); }
  onTestCaseResult(test, result) { this.record('result', test, {name: result.fullName, status: result.status, durationMs: result.duration}); }
}
module.exports = CaseProgress;

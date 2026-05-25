const {spawnSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const threshold = 90;
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const run = spawnSync(
  pnpmCommand,
  [
    "exec",
    "jest",
    "--coverage",
    "--no-cache",
    "--watchAll=false",
    "--runInBand",
    "--coverageReporters=text",
    "--coverageReporters=json-summary",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (run.error) {
  console.error("Failed to execute coverage run:", run.error.message);
  process.exit(1);
}

if (run.status !== 0) {
  process.exit(run.status ?? 1);
}

if (!fs.existsSync(summaryPath)) {
  console.error("Coverage summary was not generated.");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const totalStatements = summary.total?.statements?.pct ?? 0;
const totalLines = summary.total?.lines?.pct ?? 0;

if (totalStatements <= threshold || totalLines <= threshold) {
  console.error(`Project coverage check failed. Required > ${threshold}% total statements and lines.`);
  console.error(`statements: ${totalStatements}%`);
  console.error(`lines: ${totalLines}%`);
  process.exit(1);
}

console.log(`Project coverage check passed. Total statements and lines are > ${threshold}%.`);

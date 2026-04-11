const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const threshold = 90;
const gameDirToken = `${path.sep}src${path.sep}components${path.sep}game${path.sep}`;
const coverageSummaryPath = path.join(root, "coverage", "coverage-summary.json");

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const jestArgs = [
  "exec",
  "jest",
  "src/components/game",
  "--coverage",
  "--watchAll=false",
  "--runInBand",
  "--collectCoverageFrom=src/components/game/**/*.{ts,tsx}",
  "--coverageReporters=json-summary",
  "--coverageReporters=text",
];

const testRun = spawnSync(pnpmCommand, jestArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (testRun.error) {
  console.error("Failed to run coverage command:", testRun.error.message);
  process.exit(1);
}

if (testRun.status !== 0) {
  process.exit(testRun.status ?? 1);
}

if (!fs.existsSync(coverageSummaryPath)) {
  console.error("Coverage summary was not generated.");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
const gameFileEntries = Object.entries(summary).filter(([filePath]) => {
  if (filePath === "total") {
    return false;
  }
  return filePath.includes(gameDirToken) && !filePath.includes(`${path.sep}__tests__${path.sep}`);
});

if (gameFileEntries.length === 0) {
  console.error("No game files were found in coverage summary.");
  process.exit(1);
}

const failures = [];
for (const [filePath, metrics] of gameFileEntries) {
  const statementsPct = metrics?.statements?.pct ?? 0;
  const linesPct = metrics?.lines?.pct ?? 0;
  if (statementsPct < threshold || linesPct < threshold) {
    failures.push({
      filePath,
      statementsPct,
      linesPct,
    });
  }
}

if (failures.length > 0) {
  console.error(`Game coverage check failed. Required >= ${threshold}% statements and lines per file.`);
  failures.forEach((failure) => {
    console.error(
      `${failure.filePath}\n  statements: ${failure.statementsPct}%\n  lines: ${failure.linesPct}%`
    );
  });
  process.exit(1);
}

console.log(`Game coverage check passed. All files are >= ${threshold}% for statements and lines.`);

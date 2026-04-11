const { spawnSync } = require("child_process");
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
    "--watchAll=false",
    "--runInBand",
    "--coverageReporters=text",
    "--coverageReporters=json-summary",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
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
const srcToken = `${path.sep}src${path.sep}`;
const testsToken = `${path.sep}__tests__${path.sep}`;

const files = Object.entries(summary).filter(([filePath]) => {
  if (filePath === "total") return false;
  if (!filePath.includes(srcToken)) return false;
  if (filePath.includes(testsToken)) return false;
  if (filePath.endsWith(".d.ts")) return false;
  return true;
});

const failures = files
  .map(([filePath, metrics]) => {
    const statements = metrics?.statements?.pct ?? 0;
    const lines = metrics?.lines?.pct ?? 0;
    return { filePath, statements, lines };
  })
  .filter((entry) => entry.statements < threshold || entry.lines < threshold)
  .sort((a, b) => a.statements - b.statements || a.lines - b.lines);

if (failures.length > 0) {
  console.error(
    `Project coverage check failed. Required >= ${threshold}% statements and lines per source file.`
  );
  failures.forEach((failure) => {
    console.error(
      `${failure.filePath}\n  statements: ${failure.statements}%\n  lines: ${failure.lines}%`
    );
  });
  process.exit(1);
}

console.log(
  `Project coverage check passed. All source files are >= ${threshold}% statements and lines.`
);

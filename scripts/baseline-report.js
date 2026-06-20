const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const reportPath = path.join(root, "docs", "memory-bank", "rn-0.85-baseline.md");

function safeExec(cmd) {
  try {
    return execSync(cmd, {cwd: root, stdio: ["ignore", "pipe", "ignore"]})
      .toString()
      .split(/\r?\n/)
      .filter((line) => !line.includes("Unsupported engine"))
      .join("\n")
      .trim();
  } catch {
    return "unavailable";
  }
}

function readExistingSection(content, heading, fallbackLines) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);

  if (start === -1) return fallbackLines;

  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const sectionLines = lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  return sectionLines.length > 0 ? sectionLines : fallbackLines;
}

function hasMeasuredValues(lines) {
  return lines.some((line) => line.startsWith("- ") && !/\bpending\b/i.test(line));
}

const existingReport = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";
const now = new Date().toISOString();
const lastMeasuredMatch = existingReport.match(/^Last measured:\s*(.+)$/m);
const measuredBaseline = readExistingSection(existingReport, "Measured Baseline", [
  "- Android cold launch `adb am start -W` wait time: pending",
  "- Android warm launch `adb am start -W` wait time: pending",
  "- Android Hermes bundle size: pending",
  "- Expo export elapsed time for the bundle smoke: pending",
  "- Bundle smoke gate threshold: pending",
  "- Live memory snapshot: pending",
  "- Live frame snapshot: pending",
]);
const stillPending = readExistingSection(existingReport, "Still Pending", [
  "- Memory snapshot around scene preload and modal-heavy flows",
  "- Render jank on hot game and modal transition paths",
  "- JS frame rate on gameplay screen",
  "- iOS launch and profiling parity",
  "- Crash-free sessions after rollout",
]);
const notes = readExistingSection(existingReport, "Notes", [
  "- Fill this file with measured values from CI/device profiling runs as new data lands.",
]);

const report = [
  "# RN 0.85 Baseline",
  "",
  `Generated: ${now}`,
  ...(lastMeasuredMatch || hasMeasuredValues(measuredBaseline)
    ? [`Last measured: ${lastMeasuredMatch?.[1] || now.slice(0, 10)}`]
    : []),
  "",
  "## Environment",
  `- Node: ${safeExec("node -v")}`,
  `- PNPM: ${safeExec("pnpm -v")}`,
  `- Expo CLI: ${safeExec("pnpm exec expo --version")}`,
  `- Git commit: ${safeExec("git rev-parse --short HEAD")}`,
  "",
  "## Runtime Versions",
  `- react-native: ${packageJson.dependencies["react-native"]}`,
  `- react: ${packageJson.dependencies["react"]}`,
  `- expo: ${packageJson.dependencies["expo"]}`,
  `- reanimated: ${packageJson.dependencies["react-native-reanimated"]}`,
  "",
  "## Measured Baseline",
  "",
  ...measuredBaseline,
  "",
  "## Still Pending",
  "",
  ...stillPending,
  "",
  "## Notes",
  ...notes,
  "",
].join("\n");

fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(reportPath, report, "utf8");
console.log(`Wrote baseline report to ${reportPath}`);

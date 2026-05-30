const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function safeExec(cmd) {
  try {
    return execSync(cmd, {cwd: root, stdio: ["ignore", "pipe", "ignore"]})
      .toString()
      .trim();
  } catch {
    return "unavailable";
  }
}

const reportPath = path.join(root, "docs", "memory-bank", "rn-0.85-baseline.md");
const now = new Date().toISOString();

const report = [
  "# RN 0.85 Baseline",
  "",
  `Generated: ${now}`,
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
  "## Manual Benchmarks To Capture",
  "- Cold start time (Android/iOS)",
  "- JS frame rate on gameplay screen",
  "- Animation frame rate during modal transitions",
  "- Bundle size (dev/prod)",
  "- Crash-free sessions after rollout",
  "",
  "## Notes",
  "- Fill this file with measured values from CI/device profiling runs.",
  "",
].join("\n");

fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(reportPath, report, "utf8");
console.log(`Wrote baseline report template to ${reportPath}`);

import {spawnSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";

const localEnvironmentPath = ".env.jest-upload.local";
const legacyEnvironmentPath = ".env";
const environmentPath = [localEnvironmentPath, legacyEnvironmentPath].find(existsSync);
if (environmentPath) process.loadEnvFile(environmentPath);

if (!process.env.JEST_GAME_UPLOAD_TOKEN) {
  throw new Error(
    `JEST_GAME_UPLOAD_TOKEN is required; set it in packages/portal/${localEnvironmentPath} or packages/portal/${legacyEnvironmentPath}`,
  );
}
if (!process.env.JEST_NOTIFICATION_EMAIL) {
  throw new Error(
    `JEST_NOTIFICATION_EMAIL is required; set it in packages/portal/${localEnvironmentPath} or packages/portal/${legacyEnvironmentPath}`,
  );
}

const now = new Date();
const stamp = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, "0"),
  String(now.getUTCDate()).padStart(2, "0"),
  String(now.getUTCHours()).padStart(2, "0"),
  String(now.getUTCMinutes()).padStart(2, "0"),
  String(now.getUTCSeconds()).padStart(2, "0"),
].join("");
const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const buildVersion = `${packageVersion}-dev.${stamp}`;
const sentryRelease = `riddle-quest@${buildVersion}`;
const environment = {
  ...process.env,
  JEST_BUILD_VERSION: buildVersion,
  SENTRY_RELEASE: sentryRelease,
  VITE_SENTRY_RELEASE: sentryRelease,
};
const activationRequested = environment.JEST_UPLOAD_IS_ACTIVE === "true";
const gameId = environment.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
if (activationRequested && environment.JEST_CONFIRM_ACTIVATION !== gameId) {
  throw new Error(`Set JEST_CONFIRM_ACTIVATION=${gameId} to confirm activation before building`);
}

console.log(
  `Creating Jest build ${buildVersion} as ${activationRequested ? "an explicit activation request" : "an inactive draft"}`,
);

for (const command of [["build:jest"], ["upload:jest"]]) {
  const result = spawnSync("pnpm", command, {env: environment, stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(
  `Jest build ${buildVersion} uploaded successfully as ${activationRequested ? "an activation request" : "an inactive draft"}.`,
);

import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";

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
const buildVersion = `1.0.0-dev.${stamp}`;
const environment = {...process.env, JEST_BUILD_VERSION: buildVersion, JEST_UPLOAD_IS_ACTIVE: "true"};

console.log(`Creating Jest build ${buildVersion} and requesting activation after processing`);

for (const command of [["build:jest"], ["upload:jest"]]) {
  const result = spawnSync("pnpm", command, {env: environment, stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Jest build ${buildVersion} uploaded successfully; Jest will activate it after processing.`);

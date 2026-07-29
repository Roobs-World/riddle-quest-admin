import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const localEnvironmentPath = ".env.jest-upload.local";
const legacyEnvironmentPath = ".env";
const environmentPath = [localEnvironmentPath, legacyEnvironmentPath].find(existsSync);
if (environmentPath) process.loadEnvFile(environmentPath);

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const buildDirectory = "dist-jest";
const archive = "build.zip";
const uploadToken = process.env.JEST_GAME_UPLOAD_TOKEN;
const buildVersion = process.env.JEST_BUILD_VERSION || "1.0.0";
const notificationEmail = process.env.JEST_NOTIFICATION_EMAIL;
const isActive = process.env.JEST_UPLOAD_IS_ACTIVE === "true";

if (!uploadToken) {
  throw new Error("JEST_GAME_UPLOAD_TOKEN is required");
}

if (!notificationEmail) {
  throw new Error("JEST_NOTIFICATION_EMAIL is required");
}

for (const [name, value] of Object.entries({gameId, buildVersion, notificationEmail, uploadToken})) {
  if (/[\r\n]/.test(value)) throw new Error(`${name} must not contain newlines`);
}

if (!existsSync(buildDirectory)) {
  throw new Error(`Missing ${buildDirectory}; run pnpm build:jest first`);
}

rmSync(archive, { force: true });
const zipped = spawnSync("zip", ["-qr", `../${archive}`, "."], {
  cwd: buildDirectory,
  stdio: "inherit",
});
if (zipped.error) throw zipped.error;
if (zipped.status !== 0) process.exit(zipped.status ?? 1);

const uploaded = spawnSync(
  "curl",
  [
    "--fail-with-body",
    "--show-error",
    "--request",
    "POST",
    `https://jest.com/api/management/games/${gameId}/upload-build`,
    "--header",
    `x-build-version: ${buildVersion}`,
    "--header",
    `x-game-upload-token: ${uploadToken}`,
    "--form",
    `file=@${archive}`,
    "--form",
    `isActive=${isActive}`,
    "--form",
    `notificationEmail=${notificationEmail}`,
  ],
  { stdio: "inherit" },
);

if (uploaded.error) throw uploaded.error;
if (uploaded.status !== 0) process.exit(uploaded.status ?? 1);

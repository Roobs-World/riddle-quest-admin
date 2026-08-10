import {createHash} from "node:crypto";
import {existsSync, readFileSync, rmSync, statSync} from "node:fs";
import {spawnSync} from "node:child_process";

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
const dryRun = process.env.JEST_UPLOAD_DRY_RUN === "true";
const isActive = !dryRun && process.env.JEST_UPLOAD_IS_ACTIVE === "true";

if (!dryRun && !uploadToken) {
  throw new Error("JEST_GAME_UPLOAD_TOKEN is required");
}

if (!dryRun && !notificationEmail) {
  throw new Error("JEST_NOTIFICATION_EMAIL is required");
}

for (const [name, value] of Object.entries({gameId, buildVersion, notificationEmail, uploadToken})) {
  if (value === undefined) continue;
  if (/[\r\n]/.test(value)) throw new Error(`${name} must not contain newlines`);
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) {
  throw new Error("JEST_GAME_ID must be a UUID");
}
if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(buildVersion)) {
  throw new Error("JEST_BUILD_VERSION must be 1-64 URL-safe characters");
}
if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
  throw new Error("JEST_NOTIFICATION_EMAIL must be a valid email address");
}
if (isActive && process.env.JEST_CONFIRM_ACTIVATION !== gameId) {
  throw new Error(`Set JEST_CONFIRM_ACTIVATION=${gameId} to confirm activation of this game`);
}

if (!existsSync(buildDirectory)) {
  throw new Error(`Missing ${buildDirectory}; run pnpm build:jest first`);
}

for (const [script, args] of [
  ["scripts/audit-jest-artifact.mjs", [buildDirectory]],
  ["scripts/validate-w3c.mjs", [`${buildDirectory}/index.html`]],
]) {
  const validation = spawnSync(process.execPath, [script, ...args], {stdio: "inherit"});
  if (validation.error) throw validation.error;
  if (validation.status !== 0) process.exit(validation.status ?? 1);
}

rmSync(archive, {force: true});
const zipped = spawnSync("zip", ["-qrX", `../${archive}`, "."], {
  cwd: buildDirectory,
  stdio: "inherit",
});
if (zipped.error) throw zipped.error;
if (zipped.status !== 0) process.exit(zipped.status ?? 1);

const archiveEntries = spawnSync("unzip", ["-Z1", archive], {encoding: "utf8"});
if (archiveEntries.error) throw archiveEntries.error;
if (archiveEntries.status !== 0) process.exit(archiveEntries.status ?? 1);
const entries = archiveEntries.stdout.trim().split("\n").filter(Boolean);
if (!entries.includes("index.html") || entries.some((entry) => entry.startsWith("/") || entry.includes("../"))) {
  throw new Error("Jest archive must contain a safe root index.html");
}
const archiveBytes = statSync(archive).size;
const checksum = createHash("sha256").update(readFileSync(archive)).digest("hex");
console.log(
  `Prepared ${archive} (${(archiveBytes / 1024 / 1024).toFixed(2)} MB, ${entries.length} entries, sha256 ${checksum})`,
);

if (dryRun) {
  console.log("Jest upload preflight passed; dry run stopped before network transmission.");
  process.exit(0);
}

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
console.log(`Uploaded Jest build ${buildVersion} as ${isActive ? "an activation request" : "an inactive draft"}.`);

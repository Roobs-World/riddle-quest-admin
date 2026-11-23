import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

import {
  createAcceptedUploadAttemptReceipt,
  createAmbiguousUploadReceipt,
  createGatedArtifactRecord,
  createPendingUploadReceipt,
  createTransmittingUploadReceipt,
  createUploadAttemptBarrier,
  getUploadAttemptReceiptPath,
  loadAndVerifyGatedArtifact,
  parseAcceptedUploadResponse,
  removeOwnedUploadAttemptBarrier,
  resolveAbsolutePathOverride,
  sha256,
  transitionUploadAttemptBarrier,
  writePrivateJson,
} from "./jest-upload-artifact.mjs";
import {
  getUnresolvedUploadBarrierPath,
  resolveRiddleQuestJestGameId,
} from "./jest-release-safety.mjs";

const defaultPackageDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const packageDirectory = resolveAbsolutePathOverride({
  fallback: defaultPackageDirectory,
  name: "JEST_PACKAGE_DIRECTORY",
  value: process.env.JEST_PACKAGE_DIRECTORY,
});
const defaultRepositoryDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const gitExecutable = "/usr/bin/git";
const dryRun = process.env.JEST_UPLOAD_DRY_RUN === "true";

const gameId = resolveRiddleQuestJestGameId(process.env.JEST_GAME_ID);
const repositoryDirectory = resolveAbsolutePathOverride({
  fallback: defaultRepositoryDirectory,
  name: "JEST_SOURCE_REPOSITORY_DIRECTORY",
  value: process.env.JEST_SOURCE_REPOSITORY_DIRECTORY,
});
const receiptDirectory = resolveAbsolutePathOverride({
  fallback: join(packageDirectory, ".jest-upload-receipts"),
  name: "JEST_RECEIPT_DIRECTORY",
  value: process.env.JEST_RECEIPT_DIRECTORY,
});
const buildDirectory = resolveAbsolutePathOverride({
  fallback: join(packageDirectory, "builds/jest"),
  name: "JEST_BUILD_DIRECTORY",
  value: process.env.JEST_BUILD_DIRECTORY,
});
const archivePath = resolveAbsolutePathOverride({
  fallback: join(packageDirectory, "build.zip"),
  name: "JEST_ARCHIVE_PATH",
  value: process.env.JEST_ARCHIVE_PATH,
});
const gateReceiptPath = resolveAbsolutePathOverride({
  fallback: join(receiptDirectory, "gated-artifact.json"),
  name: "JEST_GATE_RECEIPT_PATH",
  value: process.env.JEST_GATE_RECEIPT_PATH,
});
const artifactAuditScript = resolveAbsolutePathOverride({
  fallback: fileURLToPath(new URL("./audit-jest-artifact.mjs", import.meta.url)),
  name: "JEST_ARTIFACT_AUDIT_SCRIPT",
  value: process.env.JEST_ARTIFACT_AUDIT_SCRIPT,
});
const w3cValidatorScript = resolveAbsolutePathOverride({
  fallback: join(packageDirectory, "scripts", "web", "validate-w3c.mjs"),
  name: "JEST_W3C_VALIDATOR_SCRIPT",
  value: process.env.JEST_W3C_VALIDATOR_SCRIPT,
});
const buildVersion = process.env.JEST_BUILD_VERSION || "1.0.0";
const notificationEmail = process.env.JEST_NOTIFICATION_EMAIL;
const activationRequested = process.env.JEST_UPLOAD_IS_ACTIVE === "true";

// A live uploader must never receive its token in the exec-time environment:
// on Linux those original bytes can remain readable to descendants through
// /proc even after unsetenv. The sandboxed release parent supplies one framed
// value through stdin. Reading the pipe to EOF consumes the framed value and
// the parent closes its write end. Do not explicitly close fd 0: Node owns
// that descriptor and may assert while cleaning it up after a manual close.
const ambientUploadToken = process.env.JEST_GAME_UPLOAD_TOKEN;
const readsUploadTokenFromStdin = process.env.JEST_UPLOAD_TOKEN_STDIN === "1";
delete process.env.JEST_GAME_UPLOAD_TOKEN;
delete process.env.JEST_UPLOAD_TOKEN_STDIN;
delete process.env.JEST_NOTIFICATION_EMAIL;
delete process.env.SENTRY_AUTH_TOKEN;
if (ambientUploadToken !== undefined) {
  throw new Error("JEST_GAME_UPLOAD_TOKEN must be delivered through the sandboxed release pipe, not the environment");
}
if (!dryRun && !readsUploadTokenFromStdin) {
  throw new Error("Live Jest uploads are available only through the sandboxed timestamped release command");
}
const uploadToken = dryRun ? undefined : (() => {
  const input = readFileSync(0, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("The sandboxed release pipe did not contain valid upload credentials");
  }
  if (
    typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 || typeof parsed.uploadToken !== "string" || !parsed.uploadToken
  ) {
    throw new Error("The sandboxed release pipe did not contain one upload token");
  }
  return parsed.uploadToken;
})();

// Git provenance checks must not execute repository- or environment-supplied
// helpers after this process has received an upload token. In particular, a
// core.fsmonitor hook could otherwise rewrite the archive and gate receipt
// immediately before they are loaded and verified.
const gitEnvironment = {
  GIT_ATTR_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "0",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
  HOME: tmpdir(),
  LANG: process.env.LANG ?? "C",
  PATH: "/usr/bin:/bin",
  XDG_CONFIG_HOME: tmpdir(),
};
const readGit = (args) => {
  const result = spawnSync(gitExecutable, [
    "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null",
    ...args,
  ], {
    cwd: repositoryDirectory,
    encoding: "utf8",
    env: gitEnvironment,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Unable to resolve source provenance for the Jest artifact");
  return result.stdout.trim();
};
const sourceCommit = readGit(["rev-parse", "HEAD"]);
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Git HEAD is not a full commit identifier");
const sourceDirty = readGit(["status", "--porcelain=v1", "--untracked-files=all"]).length > 0;
if (process.env.JEST_BUILD_COMMIT && process.env.JEST_BUILD_COMMIT !== sourceCommit) {
  throw new Error("JEST_BUILD_COMMIT does not match the current Git commit");
}

if (!dryRun && !notificationEmail) {
  throw new Error("JEST_NOTIFICATION_EMAIL is required in the uploader process environment");
}

for (const [name, value] of Object.entries({gameId, buildVersion, notificationEmail, uploadToken})) {
  if (value === undefined) continue;
  if (/[\r\n]/.test(value)) throw new Error(`${name} must not contain newlines`);
}
if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(buildVersion)) {
  throw new Error("JEST_BUILD_VERSION must be 1-64 URL-safe characters");
}
if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
  throw new Error("JEST_NOTIFICATION_EMAIL must be a valid email address");
}
if (activationRequested && process.env.JEST_CONFIRM_ACTIVATION?.toLowerCase() !== gameId) {
  throw new Error(`Set JEST_CONFIRM_ACTIVATION=${gameId} to confirm activation of this game`);
}

const inspectArchiveEntries = (archiveContents) => {
  const inspectionDirectory = mkdtempSync(join(tmpdir(), "riddle-quest-jest-archive-"));
  const inspectionPath = join(inspectionDirectory, "verified-build.zip");
  try {
    writeFileSync(inspectionPath, archiveContents, {flag: "wx", mode: 0o600});
    const archiveEntries = spawnSync("/usr/bin/unzip", ["-Z1", inspectionPath], {encoding: "utf8"});
    if (archiveEntries.error) throw archiveEntries.error;
    if (archiveEntries.status !== 0) {
      throw new Error("Unable to inspect the verified Jest archive bytes");
    }
    const entries = archiveEntries.stdout.trim().split("\n").filter(Boolean);
    const hasUnsafeEntry = entries.some((entry) =>
      entry.startsWith("/") ||
      entry.startsWith("\\") ||
      /^[a-z]:/i.test(entry) ||
      entry.split(/[\\/]/).includes(".."));
    if (!entries.includes("index.html") || hasUnsafeEntry) {
      throw new Error("Jest archive must contain a safe root index.html");
    }
    return entries;
  } finally {
    rmSync(inspectionDirectory, {force: true, recursive: true});
  }
};

if (dryRun) {
  if (!existsSync(buildDirectory)) {
    throw new Error(`Missing ${buildDirectory}; run pnpm build:jest first`);
  }

  for (const [script, args] of [
    [artifactAuditScript, [buildDirectory]],
    [w3cValidatorScript, [join(buildDirectory, "index.html")]],
  ]) {
    const validation = spawnSync(process.execPath, [script, ...args], {
      cwd: packageDirectory,
      env: process.env,
      stdio: "inherit",
    });
    if (validation.error) throw validation.error;
    if (validation.status !== 0) process.exit(validation.status ?? 1);
  }

  rmSync(archivePath, {force: true});
  const zipped = spawnSync("/usr/bin/zip", ["-qrX", archivePath, "."], {
    cwd: buildDirectory,
    stdio: "inherit",
  });
  if (zipped.error) throw zipped.error;
  if (zipped.status !== 0) process.exit(zipped.status ?? 1);

  const archiveContents = readFileSync(archivePath);
  const entries = inspectArchiveEntries(archiveContents);
  const archiveBytes = archiveContents.byteLength;
  const archiveSha256 = sha256(archiveContents);
  const gatedArtifact = createGatedArtifactRecord({
    activationRequested,
    archiveBytes,
    archiveEntries: entries.length,
    archivePath,
    archiveSha256,
    buildVersion,
    gameId,
    sourceCommit,
    sourceDirty,
  });
  await writePrivateJson(gateReceiptPath, gatedArtifact);
  console.log(
    `Gated build.zip (${(archiveBytes / 1024 / 1024).toFixed(2)} MB, ${entries.length} entries, sha256 ${archiveSha256})`,
  );
  console.log(`Source: ${sourceCommit}${sourceDirty ? " (dirty; upload blocked)" : " (clean)"}`);
  console.log(`Gate receipt: ${gateReceiptPath}`);
  console.log("Jest upload preflight passed; dry run stopped before network transmission.");
  process.exit(0);
}

const {contents: gatedArchive, record: gatedArtifact} = await loadAndVerifyGatedArtifact({
  activationRequested,
  archivePath,
  buildVersion,
  gameId,
  gateReceiptPath,
  sourceCommit,
  sourceDirty,
});
const expectedArchiveSha256 = process.env.JEST_EXPECTED_ARCHIVE_SHA256;
const expectedArchiveBytes = Number(process.env.JEST_EXPECTED_ARCHIVE_BYTES);
if (
  !/^[0-9a-f]{64}$/.test(expectedArchiveSha256 ?? "") ||
  !Number.isSafeInteger(expectedArchiveBytes) ||
  expectedArchiveBytes <= 0 ||
  gatedArtifact.archive.sha256 !== expectedArchiveSha256 ||
  gatedArchive.byteLength !== expectedArchiveBytes
) {
  throw new Error("The trusted release parent did not authorize these exact Jest archive bytes");
}
if (sourceDirty) {
  throw new Error("Refusing to upload a Jest artifact from a dirty worktree; commit the gated source and rerun preflight");
}
const entries = inspectArchiveEntries(gatedArchive);
if (entries.length !== gatedArtifact.archive.entries) {
  throw new Error("The Jest archive entry list changed after its gate passed; rerun the upload preflight");
}

const form = new FormData();
form.append("file", new Blob([gatedArchive], {type: "application/zip"}), "build.zip");
form.append("isActive", String(activationRequested));
form.append("notificationEmail", notificationEmail);

const attemptReceiptPath = getUploadAttemptReceiptPath({buildVersion, gameId, receiptDirectory});
const unresolvedReceiptPath = getUnresolvedUploadBarrierPath({gameId, receiptDirectory, sourceCommit});
const transmittingReceipt = createTransmittingUploadReceipt({
  activationRequested,
  artifact: gatedArtifact,
  buildVersion,
  gameId,
  sourceCommit,
});
await createUploadAttemptBarrier({receipt: transmittingReceipt, receiptPath: attemptReceiptPath});
try {
  await createUploadAttemptBarrier({receipt: transmittingReceipt, receiptPath: unresolvedReceiptPath});
} catch (error) {
  try {
    await removeOwnedUploadAttemptBarrier({
      expectedState: "transmitting",
      receipt: transmittingReceipt,
      receiptPath: attemptReceiptPath,
    });
  } catch (cleanupError) {
    console.error(
      `No upload was sent, but its build-specific barrier could not be removed: ${attemptReceiptPath}`,
      cleanupError,
    );
  }
  throw new Error(
    `A prior upload of source ${sourceCommit} for game ${gameId} is unresolved. ` +
    `Reconcile ${unresolvedReceiptPath} in the Jest Developer Console or build-completion email before a new upload.`,
    {cause: error},
  );
}

let accepted;
let unknownReason = "request-failed-before-authoritative-response";
try {
  const response = await fetch(`https://jest.com/api/management/games/${gameId}/upload-build`, {
    body: form,
    headers: {
      "x-build-version": buildVersion,
      "x-game-upload-token": uploadToken,
    },
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  unknownReason = "response-body-unreadable";
  const responseText = await response.text();
  unknownReason = "response-not-authoritative";
  try {
    accepted = parseAcceptedUploadResponse(response.status, responseText);
  } catch (error) {
    const safeBody = responseText
      .replaceAll(uploadToken, "[redacted-token]")
      .replaceAll(notificationEmail, "[redacted-email]")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 1_000);
    if (safeBody) console.error(`Jest response: ${safeBody}`);
    throw error;
  }
} catch (error) {
  const ambiguousReceipt = createAmbiguousUploadReceipt({
    attempt: transmittingReceipt,
    reason: unknownReason,
  });
  for (const receiptPath of [attemptReceiptPath, unresolvedReceiptPath]) {
    try {
      await transitionUploadAttemptBarrier({
        expectedState: "transmitting",
        receipt: ambiguousReceipt,
        receiptPath,
      });
    } catch (barrierError) {
      console.error(
        `Unable to mark the Jest upload attempt ambiguous; its transmitting barrier remains at ${receiptPath}`,
        barrierError,
      );
    }
  }
  throw new Error(
    `The Jest upload outcome is unknown and retries across build versions are blocked by ${unresolvedReceiptPath}. ` +
    "Reconcile the build in the Jest Developer Console or build-completion email before removing the barrier.",
    {cause: error},
  );
}

const acceptedAt = new Date();
const acceptedAttemptReceipt = createAcceptedUploadAttemptReceipt({
  acceptedAt,
  attempt: transmittingReceipt,
  buildStatus: accepted.buildStatus,
  versionId: accepted.versionId,
});
try {
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: acceptedAttemptReceipt,
    receiptPath: attemptReceiptPath,
  });
} catch (error) {
  throw new Error(
    `Jest accepted version ${accepted.versionId}, but its local attempt receipt could not be finalized. ` +
    `Do not retry; reconcile the transmitting barrier at ${attemptReceiptPath}.`,
    {cause: error},
  );
}

try {
  await transitionUploadAttemptBarrier({
    expectedState: "transmitting",
    receipt: acceptedAttemptReceipt,
    receiptPath: unresolvedReceiptPath,
  });
} catch (error) {
  throw new Error(
    `Jest accepted version ${accepted.versionId}, but its cross-version source barrier could not be finalized. ` +
    `Do not retry; reconcile the transmitting barrier at ${unresolvedReceiptPath}.`,
    {cause: error},
  );
}

const pendingReceipt = createPendingUploadReceipt({
  acceptedAt,
  activationRequested,
  artifact: gatedArtifact,
  buildStatus: accepted.buildStatus,
  buildVersion,
  gameId,
  sourceCommit,
  versionId: accepted.versionId,
});
const pendingReceiptPath = join(receiptDirectory, `${buildVersion}.${accepted.versionId}.pending.json`);
try {
  await writePrivateJson(pendingReceiptPath, pendingReceipt);
} catch (error) {
  throw new Error(
    `Jest accepted version ${accepted.versionId}; its authoritative local barrier is ${attemptReceiptPath}, ` +
    "but the secondary pending receipt could not be written. Do not retry the upload.",
    {cause: error},
  );
}

console.log(`Jest accepted build ${buildVersion} as version ${accepted.versionId}; processing is pending.`);
console.log(`Accepted attempt receipt: ${attemptReceiptPath}`);
console.log(`Accepted source barrier: ${unresolvedReceiptPath}`);
console.log(`Pending receipt: ${pendingReceiptPath}`);
if (activationRequested) {
  console.log(
    "HTTP 202 means the automatic activation request was accepted, not that the build is active yet. " +
    "Jest will activate this exact version after processing succeeds. Verify authoritative completion in the " +
    `Developer Console or build-completion email before removing ${unresolvedReceiptPath} or treating it as live.`,
  );
} else {
  console.log(
    "HTTP 202 does not mean the build is ready or active. Verify completion in the Jest Developer Console or " +
    `build-completion email before manually removing ${unresolvedReceiptPath}, previewing, or activating it.`,
  );
}

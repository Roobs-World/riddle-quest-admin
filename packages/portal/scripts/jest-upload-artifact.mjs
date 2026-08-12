import {createHash, randomUUID} from "node:crypto";
import {chmod, mkdir, open, readFile, rename, unlink, writeFile} from "node:fs/promises";
import {basename, dirname, isAbsolute, join} from "node:path";

const artifactSchemaVersion = 2;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const gitCommitPattern = /^[0-9a-f]{40}$/;
const buildVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/;
const uploadAttemptStates = new Set(["transmitting", "ambiguous", "accepted"]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const canonicalUuid = (value) => typeof value === "string" ? value.toLowerCase() : value;

export const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

const ensurePrivateDirectory = async (filePath) => {
  const directory = dirname(filePath);
  await mkdir(directory, {mode: 0o700, recursive: true});
  await chmod(directory, 0o700);
};

export const writePrivateJson = async (filePath, value) => {
  await ensurePrivateDirectory(filePath);

  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
};

export const resolveAbsolutePathOverride = ({fallback, name, value}) => {
  if (value === undefined) return fallback;
  if (!value.trim() || !isAbsolute(value)) {
    throw new Error(`${name} must be a nonempty absolute path when provided`);
  }
  return value;
};

export const getUploadAttemptReceiptPath = ({buildVersion, gameId, receiptDirectory}) => {
  if (!isAbsolute(receiptDirectory)) throw new Error("JEST_RECEIPT_DIRECTORY must be an absolute path");
  if (!uuidPattern.test(gameId)) throw new Error("Cannot create a Jest upload barrier for an invalid game ID");
  if (!buildVersionPattern.test(buildVersion)) {
    throw new Error("Cannot create a Jest upload barrier for an invalid build version");
  }
  return join(receiptDirectory, `${gameId.toLowerCase()}.${buildVersion}.upload-attempt.json`);
};

const uploadArchiveReference = (artifact) => ({
  file: artifact.archive.file,
  bytes: artifact.archive.bytes,
  sha256: artifact.archive.sha256,
  entries: artifact.archive.entries,
});

export const createTransmittingUploadReceipt = ({
  activationRequested,
  artifact,
  attemptedAt = new Date(),
  attemptId = randomUUID(),
  buildVersion,
  gameId,
  sourceCommit,
}) => ({
  schemaVersion: artifactSchemaVersion,
  kind: "jest-upload-attempt",
  state: "transmitting",
  attemptId: canonicalUuid(attemptId),
  attemptedAt: attemptedAt.toISOString(),
  updatedAt: attemptedAt.toISOString(),
  gameId: canonicalUuid(gameId),
  buildVersion,
  activationRequested,
  readiness: "unknown",
  source: {
    commit: sourceCommit,
    dirty: false,
  },
  archive: uploadArchiveReference(artifact),
});

export const createAmbiguousUploadReceipt = ({
  ambiguousAt = new Date(),
  attempt,
  reason,
}) => ({
  ...attempt,
  state: "ambiguous",
  updatedAt: ambiguousAt.toISOString(),
  readiness: "unknown",
  ambiguity: {
    at: ambiguousAt.toISOString(),
    reason,
  },
});

export const createAcceptedUploadAttemptReceipt = ({
  acceptedAt = new Date(),
  attempt,
  buildStatus,
  versionId,
}) => ({
  ...attempt,
  state: "accepted",
  updatedAt: acceptedAt.toISOString(),
  acceptedAt: acceptedAt.toISOString(),
  versionId: canonicalUuid(versionId),
  buildStatus,
  readiness: "pending",
  verification: {
    automatedPolling: false,
    authoritativeChannels: ["Jest Developer Console build status", "Jest build-completion email"],
  },
});

const assertUploadAttemptReceipt = (record) => {
  if (!isRecord(record) || record.schemaVersion !== artifactSchemaVersion || record.kind !== "jest-upload-attempt") {
    throw new Error("The Jest upload attempt receipt has an unsupported format; do not retry the upload");
  }
  if (!uploadAttemptStates.has(record.state) || typeof record.attemptId !== "string" ||
      !uuidPattern.test(record.attemptId) || record.attemptId !== canonicalUuid(record.attemptId)) {
    throw new Error("The Jest upload attempt receipt has an invalid state; do not retry the upload");
  }
  if (!uuidPattern.test(record.gameId) || record.gameId !== canonicalUuid(record.gameId) ||
      !buildVersionPattern.test(record.buildVersion) ||
      typeof record.activationRequested !== "boolean") {
    throw new Error("The Jest upload attempt receipt has invalid release identity; do not retry the upload");
  }
  if (!isRecord(record.source) || !gitCommitPattern.test(record.source.commit) || record.source.dirty !== false ||
      !isRecord(record.archive) || typeof record.archive.file !== "string" || !record.archive.file ||
      !Number.isSafeInteger(record.archive.bytes) || record.archive.bytes <= 0 ||
      !sha256Pattern.test(record.archive.sha256) || !Number.isSafeInteger(record.archive.entries) ||
      record.archive.entries <= 0) {
    throw new Error("The Jest upload attempt receipt has invalid provenance; do not retry the upload");
  }
  if (!Number.isFinite(Date.parse(record.attemptedAt)) || !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new Error("The Jest upload attempt receipt has invalid timestamps; do not retry the upload");
  }
  if (record.state === "ambiguous" && (!isRecord(record.ambiguity) ||
      !Number.isFinite(Date.parse(record.ambiguity.at)) || typeof record.ambiguity.reason !== "string" ||
      !record.ambiguity.reason)) {
    throw new Error("The ambiguous Jest upload attempt receipt is invalid; do not retry the upload");
  }
  if (record.state === "accepted" && (!uuidPattern.test(record.versionId) ||
      record.versionId !== canonicalUuid(record.versionId) ||
      record.buildStatus !== "processing" || record.readiness !== "pending" ||
      !Number.isFinite(Date.parse(record.acceptedAt)))) {
    throw new Error("The accepted Jest upload attempt receipt is invalid; do not retry the upload");
  }
};

const sameUploadAttempt = (left, right) =>
  left.attemptId === right.attemptId &&
  left.gameId === right.gameId &&
  left.buildVersion === right.buildVersion &&
  left.activationRequested === right.activationRequested &&
  left.source.commit === right.source.commit &&
  left.archive.file === right.archive.file &&
  left.archive.bytes === right.archive.bytes &&
  left.archive.sha256 === right.archive.sha256 &&
  left.archive.entries === right.archive.entries;

export const createUploadAttemptBarrier = async ({receipt, receiptPath}) => {
  assertUploadAttemptReceipt(receipt);
  if (receipt.state !== "transmitting") {
    throw new Error("A new Jest upload attempt barrier must begin in transmitting state");
  }
  await ensurePrivateDirectory(receiptPath);

  let barrier;
  try {
    barrier = await open(receiptPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `Unsafe Jest upload retry blocked by existing attempt receipt: ${receiptPath}. ` +
        "Reconcile it in the Jest Developer Console or build-completion email before removing the barrier.",
        {cause: error},
      );
    }
    throw error;
  }
  await barrier.close();

  // The exclusive empty file is already a fail-closed barrier. Replace it with
  // complete JSON atomically; if this write fails, the empty barrier remains.
  await writePrivateJson(receiptPath, receipt);
  return receipt;
};

export const transitionUploadAttemptBarrier = async ({
  expectedState,
  receipt,
  receiptPath,
}) => {
  assertUploadAttemptReceipt(receipt);
  let current;
  try {
    current = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    throw new Error("The Jest upload attempt barrier is missing or unreadable; do not retry the upload", {cause: error});
  }
  assertUploadAttemptReceipt(current);
  if (current.state !== expectedState || !sameUploadAttempt(current, receipt)) {
    throw new Error("The Jest upload attempt barrier changed unexpectedly; do not retry the upload");
  }
  if (expectedState !== "transmitting" || !new Set(["ambiguous", "accepted"]).has(receipt.state)) {
    throw new Error(`Unsupported Jest upload attempt transition: ${expectedState} -> ${receipt.state}`);
  }
  await writePrivateJson(receiptPath, receipt);
  return receipt;
};

export const removeOwnedUploadAttemptBarrier = async ({
  expectedState,
  receipt,
  receiptPath,
}) => {
  assertUploadAttemptReceipt(receipt);
  if (receipt.state !== expectedState) {
    throw new Error("The Jest upload attempt receipt does not match the removable barrier state");
  }
  let current;
  try {
    current = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    throw new Error("The Jest upload attempt barrier is missing or unreadable; do not retry the upload", {cause: error});
  }
  assertUploadAttemptReceipt(current);
  if (current.state !== expectedState || !sameUploadAttempt(current, receipt)) {
    throw new Error("The Jest upload attempt barrier changed unexpectedly; do not retry the upload");
  }
  await unlink(receiptPath);
};

export const createGatedArtifactRecord = ({
  activationRequested,
  archiveBytes,
  archiveEntries,
  archivePath,
  archiveSha256,
  buildVersion,
  gameId,
  sourceCommit,
  sourceDirty,
  gatedAt = new Date(),
}) => ({
  schemaVersion: artifactSchemaVersion,
  kind: "jest-gated-artifact",
  gatedAt: gatedAt.toISOString(),
  gameId: canonicalUuid(gameId),
  buildVersion,
  activationRequested,
  source: {
    commit: sourceCommit,
    dirty: sourceDirty,
  },
  archive: {
    file: basename(archivePath),
    bytes: archiveBytes,
    sha256: archiveSha256,
    entries: archiveEntries,
  },
});

const assertGatedArtifactRecord = (record, expected) => {
  if (!isRecord(record) || record.schemaVersion !== artifactSchemaVersion || record.kind !== "jest-gated-artifact") {
    throw new Error("The Jest artifact gate receipt has an unsupported format; rerun the upload preflight");
  }
  if (record.gameId !== canonicalUuid(expected.gameId)) {
    throw new Error("The gated Jest artifact belongs to a different game; rerun the upload preflight");
  }
  if (record.buildVersion !== expected.buildVersion) {
    throw new Error("The gated Jest artifact has a different build version; rerun the upload preflight");
  }
  if (record.activationRequested !== expected.activationRequested) {
    throw new Error("The gated Jest artifact has a different activation intent; rerun the upload preflight");
  }
  if (!isRecord(record.source) || typeof record.source.commit !== "string" ||
      !gitCommitPattern.test(record.source.commit) || typeof record.source.dirty !== "boolean") {
    throw new Error("The Jest artifact gate receipt has invalid source provenance; rerun the upload preflight");
  }
  if (record.source.commit !== expected.sourceCommit || record.source.dirty !== expected.sourceDirty) {
    throw new Error("The source tree changed after the Jest artifact gate passed; rerun the upload preflight");
  }
  if (typeof record.gatedAt !== "string" || !Number.isFinite(Date.parse(record.gatedAt))) {
    throw new Error("The Jest artifact gate receipt has an invalid timestamp; rerun the upload preflight");
  }
  if (!isRecord(record.archive) || record.archive.file !== expected.archiveFile) {
    throw new Error("The Jest artifact gate receipt names an unexpected archive; rerun the upload preflight");
  }
  if (!Number.isSafeInteger(record.archive.bytes) || record.archive.bytes <= 0) {
    throw new Error("The Jest artifact gate receipt has an invalid archive size; rerun the upload preflight");
  }
  if (typeof record.archive.sha256 !== "string" || !sha256Pattern.test(record.archive.sha256)) {
    throw new Error("The Jest artifact gate receipt has an invalid checksum; rerun the upload preflight");
  }
  if (!Number.isSafeInteger(record.archive.entries) || record.archive.entries <= 0) {
    throw new Error("The Jest artifact gate receipt has an invalid entry count; rerun the upload preflight");
  }
};

export const loadAndVerifyGatedArtifact = async ({
  activationRequested,
  archivePath,
  buildVersion,
  gameId,
  gateReceiptPath,
  sourceCommit,
  sourceDirty,
}) => {
  let record;
  try {
    record = JSON.parse(await readFile(gateReceiptPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The Jest artifact gate receipt is not valid JSON; rerun the upload preflight", {cause: error});
    }
    throw new Error("Missing Jest artifact gate receipt; rerun the upload preflight before uploading", {cause: error});
  }

  assertGatedArtifactRecord(record, {
    activationRequested,
    archiveFile: basename(archivePath),
    buildVersion,
    gameId,
    sourceCommit,
    sourceDirty,
  });

  let contents;
  try {
    contents = await readFile(archivePath);
  } catch (error) {
    throw new Error("The exact gated Jest archive is missing; rerun the upload preflight", {cause: error});
  }

  const archiveSha256 = sha256(contents);
  if (contents.byteLength !== record.archive.bytes || archiveSha256 !== record.archive.sha256) {
    throw new Error("The Jest archive changed after its gate passed; rerun the upload preflight");
  }

  return {contents, record};
};

export const parseAcceptedUploadResponse = (status, responseText) => {
  if (status !== 202) {
    throw new Error(`Jest rejected the build upload with HTTP ${status}`);
  }

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch (error) {
    throw new Error("Jest accepted the upload with HTTP 202 but returned invalid JSON", {cause: error});
  }
  if (!isRecord(payload) || typeof payload.versionId !== "string" || !uuidPattern.test(payload.versionId)) {
    throw new Error("Jest accepted the upload with HTTP 202 but did not return a valid versionId");
  }
  if (payload.buildStatus !== "processing") {
    throw new Error("Jest accepted the upload with HTTP 202 but did not report buildStatus=processing");
  }

  return {buildStatus: payload.buildStatus, versionId: canonicalUuid(payload.versionId)};
};

export const createPendingUploadReceipt = ({
  acceptedAt = new Date(),
  activationRequested,
  artifact,
  buildStatus,
  buildVersion,
  gameId,
  sourceCommit,
  versionId,
}) => ({
  schemaVersion: artifactSchemaVersion,
  kind: "jest-upload-accepted",
  acceptedAt: acceptedAt.toISOString(),
  gameId: canonicalUuid(gameId),
  buildVersion,
  versionId: canonicalUuid(versionId),
  buildStatus,
  activationRequested,
  readiness: "pending",
  source: {
    commit: sourceCommit,
    dirty: false,
  },
  archive: {
    file: artifact.archive.file,
    bytes: artifact.archive.bytes,
    sha256: artifact.archive.sha256,
  },
  verification: {
    automatedPolling: false,
    authoritativeChannels: ["Jest Developer Console build status", "Jest build-completion email"],
  },
});

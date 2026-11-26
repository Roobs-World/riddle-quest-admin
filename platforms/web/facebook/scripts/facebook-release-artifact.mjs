import {createHash} from "node:crypto";
import {chmod, lstat, mkdir, open, readFile, rename, unlink, writeFile} from "node:fs/promises";
import path from "node:path";

export const facebookArtifactSha256 = (contents) => createHash("sha256").update(contents).digest("hex");

export const createFacebookArtifactRecord = ({
  archiveBytes,
  archiveEntries,
  archivePath,
  archiveSha256,
  sourceCommit,
  sourceDirty,
  gatedAt = new Date(),
}) => ({
  schemaVersion: 1,
  provider: "facebook",
  intent: "non-production-draft",
  source: {commit: sourceCommit, dirty: sourceDirty},
  archive: {path: path.resolve(archivePath), bytes: archiveBytes, entries: archiveEntries, sha256: archiveSha256},
  gatedAt: gatedAt.toISOString(),
});

export async function writePrivateFacebookJson(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true, mode: 0o700});
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600, flag: "wx"});
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

/** Writes final human evidence once; an existing receipt is never replaced. */
export async function writeExclusivePrivateFacebookJson(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true, mode: 0o700});
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
  } finally {
    await handle.close();
  }
  await chmod(filePath, 0o600);
}

export async function loadAndVerifyFacebookArtifact({
  archivePath,
  receiptPath,
  sourceCommit,
  sourceDirty,
}) {
  const [contents, rawRecord] = await Promise.all([readFile(archivePath), readFile(receiptPath, "utf8")]);
  const record = JSON.parse(rawRecord);
  if (
    record?.schemaVersion !== 1 ||
    record.provider !== "facebook" ||
    record.intent !== "non-production-draft" ||
    record.source?.commit !== sourceCommit ||
    record.source?.dirty !== sourceDirty
  ) throw new Error("Facebook artifact source changed after gating");
  if (
    record.archive?.path !== path.resolve(archivePath) ||
    record.archive.bytes !== contents.byteLength ||
    record.archive.sha256 !== facebookArtifactSha256(contents)
  ) throw new Error("Facebook archive changed after gating");
  if (sourceDirty) throw new Error("Facebook draft upload requires a clean source worktree");
  return {contents, record};
}

export const facebookUploadBarrierPath = (receiptDirectory, archiveSha256) =>
  path.join(receiptDirectory, `upload-${archiveSha256}.json`);

export const facebookHandoffArchivePath = (receiptDirectory, archiveSha256) =>
  path.join(receiptDirectory, `artifact-${archiveSha256}.zip`);

/** Snapshots the exact gated bytes once so a later preflight cannot replace the human upload source. */
export async function createFacebookHandoffArchive(receiptDirectory, archiveSha256, contents) {
  if (!/^[0-9a-f]{64}$/u.test(archiveSha256) || facebookArtifactSha256(contents) !== archiveSha256) {
    throw new Error("Invalid Facebook handoff archive");
  }
  await mkdir(receiptDirectory, {recursive: true, mode: 0o700});
  const archivePath = facebookHandoffArchivePath(receiptDirectory, archiveSha256);
  const handle = await open(archivePath, "wx", 0o400);
  try {
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
  await chmod(archivePath, 0o400);
  return archivePath;
}

/** Re-verifies the immutable handoff file before recording any upload outcome. */
export async function verifyFacebookHandoffArchive(receiptDirectory, archiveSha256) {
  if (!/^[0-9a-f]{64}$/u.test(archiveSha256)) throw new Error("Invalid Facebook archive hash");
  const archivePath = facebookHandoffArchivePath(receiptDirectory, archiveSha256);
  const metadata = await lstat(archivePath);
  if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o222) !== 0) {
    throw new Error("Facebook handoff archive is not a single read-only regular file");
  }
  const contents = await readFile(archivePath);
  if (facebookArtifactSha256(contents) !== archiveSha256) {
    throw new Error("Facebook handoff archive changed; do not upload, accept, or promote it");
  }
  return {archivePath, contents};
}

export async function createFacebookUploadBarrier(receiptDirectory, archiveSha256, attemptedAt = new Date()) {
  if (!/^[0-9a-f]{64}$/u.test(archiveSha256)) throw new Error("Invalid Facebook archive hash");
  await mkdir(receiptDirectory, {recursive: true, mode: 0o700});
  const barrierPath = facebookUploadBarrierPath(receiptDirectory, archiveSha256);
  const handle = await open(barrierPath, "wx", 0o600);
  const record = {schemaVersion: 1, provider: "facebook", archiveSha256, status: "transmitting", attemptedAt: attemptedAt.toISOString()};
  try {
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
  } finally {
    await handle.close();
  }
  return {barrierPath, record};
}

export async function transitionFacebookUploadBarrier(barrierPath, expectedStatus, status, evidence) {
  if (!(["ambiguous", "accepted"].includes(status))) throw new Error("Invalid Facebook upload barrier transition");
  const lockPath = `${barrierPath}.transition-lock`;
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("Facebook upload barrier transition already in progress");
    throw error;
  }
  try {
    const current = JSON.parse(await readFile(barrierPath, "utf8"));
    if (current.status !== expectedStatus) throw new Error("Facebook upload barrier state changed");
    if (status === "accepted") validateFacebookDraftAcceptance(evidence, current.archiveSha256);
    if (status === "ambiguous" && (typeof evidence !== "string" || evidence.length < 1 || evidence.length > 500)) {
      throw new Error("Invalid Facebook ambiguous-upload evidence");
    }
    const next = {...current, status, evidence, updatedAt: new Date().toISOString()};
    await writePrivateFacebookJson(barrierPath, next);
    return next;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

const validIsoTimestamp = (value) => typeof value === "string" &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** Validates human-captured Meta draft evidence against the exact gated archive. */
export function validateFacebookDraftAcceptance(evidence, archiveSha256) {
  if (
    evidence?.schemaVersion !== 1 ||
    evidence.provider !== "facebook" ||
    evidence.intent !== "non-production-draft" ||
    typeof evidence.draftId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,160}$/u.test(evidence.draftId) ||
    evidence.archiveSha256 !== archiveSha256 ||
    !/^[0-9a-f]{64}$/u.test(evidence.dashboardEvidenceSha256 ?? "") ||
    !validIsoTimestamp(evidence.acceptedAt)
  ) throw new Error("Invalid Facebook draft-acceptance evidence");
  return evidence;
}

/** Creates a promotion receipt only when draft, production, and local archive attestations are byte-identical. */
export function createFacebookPromotionRecord({
  acceptedBarrier,
  productionArchiveSha256,
  promotionEvidenceSha256,
  promotedAt = new Date(),
}) {
  if (acceptedBarrier?.status !== "accepted") throw new Error("Facebook draft is not accepted");
  const acceptance = validateFacebookDraftAcceptance(
    acceptedBarrier.evidence,
    acceptedBarrier.archiveSha256,
  );
  if (
    productionArchiveSha256 !== acceptedBarrier.archiveSha256 ||
    !/^[0-9a-f]{64}$/u.test(promotionEvidenceSha256 ?? "")
  ) throw new Error("Facebook production bytes do not match the accepted draft");
  if (!(promotedAt instanceof Date) || !Number.isFinite(promotedAt.getTime())) {
    throw new Error("Invalid Facebook promotion timestamp");
  }
  return {
    schemaVersion: 1,
    provider: "facebook",
    intent: "global-production-promotion",
    draftId: acceptance.draftId,
    archiveSha256: acceptedBarrier.archiveSha256,
    draftEvidenceSha256: acceptance.dashboardEvidenceSha256,
    promotionEvidenceSha256,
    promotedAt: promotedAt.toISOString(),
  };
}

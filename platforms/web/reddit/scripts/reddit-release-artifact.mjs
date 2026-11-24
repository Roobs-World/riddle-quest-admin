import {createHash} from "node:crypto";
import {chmod, lstat, mkdir, open, readFile, rename, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";

const HASH = /^[0-9a-f]{64}$/u;
const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const canonicalReceiptDirectory = path.join(packageDirectory, "build/.reddit-release-receipts");

/** Keeps old upload journals visible until the explicit build-output migration settles them. */
export function assertRedditBuildStateMigrated(directory) {
  if (path.resolve(directory) === canonicalReceiptDirectory && existsSync(path.join(packageDirectory, ".reddit-release-receipts"))) {
    throw new Error("Legacy Reddit release state remains; run node scripts/web/migrate-game-build-outputs.mjs from the repository root before opening another release");
  }
}
export const redditArtifactSha256 = (contents) => createHash("sha256").update(contents).digest("hex");

export const createRedditArtifactRecord = ({archivePath, archiveBytes, archiveEntries, archiveSha256, sourceCommit, sourceDirty, gatedAt = new Date()}) => ({
  schemaVersion: 1,
  provider: "reddit",
  intent: "unlisted-upload",
  source: {commit: sourceCommit, dirty: sourceDirty},
  archive: {path: path.resolve(archivePath), bytes: archiveBytes, entries: archiveEntries, sha256: archiveSha256},
  gatedAt: gatedAt.toISOString(),
});

export async function writePrivateRedditJson(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true, mode: 0o700});
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600, flag: "wx"});
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}

export async function verifyGatedRedditArtifact({archivePath, receiptPath, sourceCommit, sourceDirty}) {
  const [contents, receiptText] = await Promise.all([readFile(archivePath), readFile(receiptPath, "utf8")]);
  const receipt = JSON.parse(receiptText);
  if (receipt?.schemaVersion !== 1 || receipt.provider !== "reddit" || receipt.intent !== "unlisted-upload" ||
    receipt.source?.commit !== sourceCommit || receipt.source?.dirty !== sourceDirty) {
    throw new Error("Reddit artifact source changed after gating");
  }
  if (sourceDirty) throw new Error("Reddit upload requires a clean source worktree");
  if (receipt.archive?.path !== path.resolve(archivePath) || receipt.archive.bytes !== contents.byteLength ||
    receipt.archive.sha256 !== redditArtifactSha256(contents) || !Number.isSafeInteger(receipt.archive.entries) ||
    receipt.archive.entries < 1) throw new Error("Reddit archive changed after gating");
  return {contents, receipt};
}

export const redditHandoffPath = (directory, hash) => path.join(directory, `artifact-${hash}.zip`);
export const redditUploadBarrierPath = (directory, hash) => path.join(directory, `upload-${hash}.json`);

export async function createRedditHandoff(directory, hash, contents) {
  if (!HASH.test(hash) || redditArtifactSha256(contents) !== hash) throw new Error("Invalid Reddit handoff archive");
  await mkdir(directory, {recursive: true, mode: 0o700});
  const destination = redditHandoffPath(directory, hash);
  const handle = await open(destination, "wx", 0o400);
  try { await handle.writeFile(contents); } finally { await handle.close(); }
  await chmod(destination, 0o400);
  return destination;
}

export async function verifyRedditHandoff(directory, hash) {
  if (!HASH.test(hash)) throw new Error("Invalid Reddit archive hash");
  const archivePath = redditHandoffPath(directory, hash);
  const metadata = await lstat(archivePath);
  if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o222) !== 0) {
    throw new Error("Reddit handoff is not a single read-only regular file");
  }
  const contents = await readFile(archivePath);
  if (redditArtifactSha256(contents) !== hash) throw new Error("Reddit handoff changed; do not upload or retry");
  return {archivePath, contents};
}

export async function createRedditUploadBarrier(directory, hash, attemptedAt = new Date()) {
  if (!HASH.test(hash)) throw new Error("Invalid Reddit archive hash");
  await mkdir(directory, {recursive: true, mode: 0o700});
  const barrierPath = redditUploadBarrierPath(directory, hash);
  const record = {schemaVersion: 1, provider: "reddit", archiveSha256: hash, status: "transmitting", attemptedAt: attemptedAt.toISOString()};
  const handle = await open(barrierPath, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`); } finally { await handle.close(); }
  return {barrierPath, record};
}

export async function transitionRedditUploadBarrier(barrierPath, expectedStatus, status, evidence) {
  if (!new Set(["ambiguous", "accepted"]).has(status)) throw new Error("Invalid Reddit upload transition");
  if (typeof evidence !== "string" || evidence.length < 1 || evidence.length > 500) throw new Error("Invalid Reddit upload evidence");
  const lockPath = `${barrierPath}.transition-lock`;
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); } catch (error) {
    if (error?.code === "EEXIST") throw new Error("Reddit upload transition already in progress");
    throw error;
  }
  try {
    const current = JSON.parse(await readFile(barrierPath, "utf8"));
    if (current.provider !== "reddit" || current.status !== expectedStatus || !HASH.test(current.archiveSha256 ?? "")) {
      throw new Error("Reddit upload barrier state changed");
    }
    const next = {...current, status, evidence, updatedAt: new Date().toISOString()};
    await writePrivateRedditJson(barrierPath, next);
    return next;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

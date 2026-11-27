import {mkdir, open, readdir, readFile, unlink} from "node:fs/promises";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {
  facebookUploadBarrierPath,
  validateFacebookDraftAcceptance,
  verifyFacebookHandoffArchive,
} from "./facebook-release-artifact.mjs";

const repositoryDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const canonicalReceiptDirectory = path.join(repositoryDirectory, "platforms/web/facebook/build/.facebook-upload-receipts");

function assertFacebookBuildStateMigrated(receiptDirectory) {
  if (path.resolve(receiptDirectory) === canonicalReceiptDirectory &&
      [".facebook-upload-receipts", "platforms/web/facebook/.facebook-upload-receipts"].some(relative => existsSync(path.join(repositoryDirectory, relative)))) {
    throw new Error("Legacy Facebook upload state remains; run node scripts/web/migrate-game-build-outputs.mjs before preparing or recording another handoff");
  }
}

/** Serializes local preparation and handoff state across every Facebook archive hash. */
export async function withFacebookReleaseLock(receiptDirectory, action) {
  assertFacebookBuildStateMigrated(receiptDirectory);
  await mkdir(receiptDirectory, {recursive: true, mode: 0o700});
  const lockPath = path.join(receiptDirectory, "release.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("Facebook release is locked; inspect the existing process/handoff before recovering a stale lock");
    }
    throw error;
  }
  try {
    await lock.writeFile(`${JSON.stringify({pid: process.pid, openedAt: new Date().toISOString()})}\n`);
    return await action();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

/** Rejects malformed or cross-artifact local state before trusting an outcome. */
function validateBarrier(record, archiveSha256) {
  if (record?.schemaVersion !== 1 || record.provider !== "facebook" ||
    record.archiveSha256 !== archiveSha256 || !["transmitting", "ambiguous", "accepted", "reconciled-absent"].includes(record.status) ||
    typeof record.attemptedAt !== "string" || !Number.isFinite(Date.parse(record.attemptedAt))) {
    throw new Error("Invalid Facebook handoff barrier; reconcile retained evidence");
  }
  if (record.status === "accepted") validateFacebookDraftAcceptance(record.evidence, archiveSha256);
  if (record.status === "reconciled-absent") {
    const evidence = record.evidence;
    if (typeof evidence?.reason !== "string" || !evidence.reason.trim() ||
      !/^[0-9a-f]{64}$/u.test(evidence.dashboardEvidenceSha256 ?? "") ||
      !Array.isArray(evidence.observedVersions) || evidence.observedVersions.length === 0 ||
      evidence.observedVersions.some(version => typeof version !== "string" || !/^\d+$/u.test(version)) ||
      new Set(evidence.observedVersions).size !== evidence.observedVersions.length ||
      typeof evidence.reconciledAt !== "string" || !Number.isFinite(Date.parse(evidence.reconciledAt)) ||
      Date.parse(evidence.reconciledAt) < Date.parse(record.attemptedAt)) {
      throw new Error("Invalid Facebook absence reconciliation; reconcile retained evidence");
    }
  }
  return record;
}

/** Prevents preparation/begin across unresolved legacy and current hash-scoped attempts. */
export async function assertFacebookHandoffsSettled(receiptDirectory, {recoverHash} = {}) {
  if (recoverHash !== undefined && !/^[0-9a-f]{64}$/u.test(recoverHash)) {
    throw new Error("Invalid Facebook recovery hash");
  }
  const files = await readdir(receiptDirectory);
  const archives = new Set();
  const barriers = new Map();
  for (const name of files) {
    if (name.startsWith("artifact-") && name.endsWith(".zip")) {
      const match = /^artifact-([0-9a-f]{64})\.zip$/u.exec(name);
      if (!match) throw new Error("Invalid Facebook archive state; reconcile retained evidence");
      archives.add(match[1]);
    }
    if (name.startsWith("upload-") && name.endsWith(".json")) {
      const match = /^upload-([0-9a-f]{64})\.json$/u.exec(name);
      if (!match) throw new Error("Invalid Facebook barrier state; reconcile retained evidence");
      const record = validateBarrier(JSON.parse(await readFile(path.join(receiptDirectory, name), "utf8")), match[1]);
      barriers.set(match[1], record);
    }
    if (name.endsWith(".transition-lock")) throw new Error("Facebook transition remains locked; reconcile retained evidence");
  }
  for (const [hash, barrier] of barriers) {
    if (!archives.has(hash)) throw new Error("Facebook barrier has no immutable archive; reconcile retained evidence");
    if (barrier.status !== "accepted" && barrier.status !== "reconciled-absent") {
      throw new Error(`Facebook ${barrier.status} handoff ${hash} must be reconciled before preparing another artifact`);
    }
  }
  for (const hash of archives) {
    if (!barriers.has(hash) && hash !== recoverHash) {
      throw new Error(`Facebook interrupted handoff ${hash} requires explicit recovery before another artifact`);
    }
  }
}

/** Selects retained exact bytes independently of the latest build or current Git HEAD. */
export async function loadFacebookHandoff(receiptDirectory, archiveSha256) {
  const archive = await verifyFacebookHandoffArchive(receiptDirectory, archiveSha256);
  const barrierPath = facebookUploadBarrierPath(receiptDirectory, archiveSha256);
  const barrier = validateBarrier(JSON.parse(await readFile(barrierPath, "utf8")), archiveSha256);
  return {...archive, barrier, barrierPath};
}

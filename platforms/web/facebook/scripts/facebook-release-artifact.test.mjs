import assert from "node:assert/strict";
import {chmod, mkdtemp, readFile, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createFacebookArtifactRecord,
  createFacebookHandoffArchive,
  createFacebookPromotionRecord,
  createFacebookUploadBarrier,
  facebookArtifactSha256,
  loadAndVerifyFacebookArtifact,
  transitionFacebookUploadBarrier,
  verifyFacebookHandoffArchive,
  writeExclusivePrivateFacebookJson,
  writePrivateFacebookJson,
} from "./facebook-release-artifact.mjs";

test("Facebook draft preparation runs the source secret audit before inspecting artifact bytes", async () => {
  const source = await readFile(new URL("./prepare-facebook-draft.mjs", import.meta.url), "utf8");
  const secretAudit = source.indexOf('"platforms/web/facebook/scripts/audit-facebook-secret-boundary.mjs"');
  const artifactAudit = source.indexOf('"scripts/audit-facebook-artifact.mjs"');
  assert.ok(secretAudit >= 0, "draft preparation must invoke the source secret audit");
  assert.ok(artifactAudit > secretAudit, "source secret audit must precede artifact inspection");
});

test("Facebook handoff snapshots exact bytes once and detects later mutation", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-handoff-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const contents = Buffer.from("immutable Facebook upload bytes");
  const archiveSha256 = facebookArtifactSha256(contents);
  const archivePath = await createFacebookHandoffArchive(directory, archiveSha256, contents);

  assert.deepEqual((await verifyFacebookHandoffArchive(directory, archiveSha256)).contents, contents);
  assert.equal((await stat(archivePath)).mode & 0o777, 0o400);
  await assert.rejects(createFacebookHandoffArchive(directory, archiveSha256, contents), {code: "EEXIST"});
  await assert.rejects(
    createFacebookHandoffArchive(directory, archiveSha256, Buffer.from("wrong bytes")),
    /Invalid Facebook handoff archive/u,
  );

  await chmod(archivePath, 0o600);
  await assert.rejects(
    verifyFacebookHandoffArchive(directory, archiveSha256),
    /single read-only regular file/u,
  );
  await writeFile(archivePath, "mutated");
  await chmod(archivePath, 0o400);
  await assert.rejects(
    verifyFacebookHandoffArchive(directory, archiveSha256),
    /handoff archive changed/u,
  );
});

test("Facebook gate binds exact bytes and clean source provenance", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-gate-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const archivePath = path.join(directory, "build-facebook.zip");
  const receiptPath = path.join(directory, "receipts", "gated-artifact.json");
  const contents = Buffer.from("facebook root zip fixture");
  const sourceCommit = "a".repeat(40);
  await writeFile(archivePath, contents);
  await writePrivateFacebookJson(receiptPath, createFacebookArtifactRecord({
    archiveBytes: contents.byteLength,
    archiveEntries: 2,
    archivePath,
    archiveSha256: facebookArtifactSha256(contents),
    sourceCommit,
    sourceDirty: false,
  }));
  assert.deepEqual((await loadAndVerifyFacebookArtifact({archivePath, receiptPath, sourceCommit, sourceDirty: false})).contents, contents);
  await writeFile(archivePath, "changed bytes");
  await assert.rejects(loadAndVerifyFacebookArtifact({archivePath, receiptPath, sourceCommit, sourceDirty: false}), /changed after gating/u);
});

test("Facebook gate refuses dirty provenance even when bytes still match", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-dirty-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const archivePath = path.join(directory, "build-facebook.zip");
  const receiptPath = path.join(directory, "receipt.json");
  const contents = Buffer.from("dirty fixture");
  const sourceCommit = "b".repeat(40);
  await writeFile(archivePath, contents);
  await writePrivateFacebookJson(receiptPath, createFacebookArtifactRecord({
    archiveBytes: contents.byteLength,
    archiveEntries: 1,
    archivePath,
    archiveSha256: facebookArtifactSha256(contents),
    sourceCommit,
    sourceDirty: true,
  }));
  await assert.rejects(loadAndVerifyFacebookArtifact({archivePath, receiptPath, sourceCommit, sourceDirty: true}), /clean source worktree/u);
});

test("Facebook upload barriers are exclusive and retain ambiguous attempts", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-barrier-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const hash = "c".repeat(64);
  const {barrierPath} = await createFacebookUploadBarrier(directory, hash, new Date("2026-08-19T10:00:00.000Z"));
  await assert.rejects(createFacebookUploadBarrier(directory, hash), {code: "EEXIST"});
  const ambiguous = await transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous", "network outcome unknown");
  assert.equal(ambiguous.status, "ambiguous");
  assert.match(await readFile(barrierPath, "utf8"), /network outcome unknown/u);
  await assert.rejects(transitionFacebookUploadBarrier(barrierPath, "transmitting", "accepted", "draft id"), /state changed/u);
});

test("Facebook barrier transitions serialize and final promotion evidence is write-once", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-transition-lock-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const hash = "9".repeat(64);
  const {barrierPath} = await createFacebookUploadBarrier(directory, hash);
  const transitions = await Promise.allSettled([
    transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous", "first uncertain result"),
    transitionFacebookUploadBarrier(barrierPath, "transmitting", "ambiguous", "second uncertain result"),
  ]);
  assert.equal(transitions.filter(({status}) => status === "fulfilled").length, 1);
  assert.equal(transitions.filter(({status}) => status === "rejected").length, 1);
  assert.equal(JSON.parse(await readFile(barrierPath, "utf8")).status, "ambiguous");

  const promotionPath = path.join(directory, "production-promotion.json");
  await writeExclusivePrivateFacebookJson(promotionPath, {archiveSha256: hash});
  await assert.rejects(
    writeExclusivePrivateFacebookJson(promotionPath, {archiveSha256: "0".repeat(64)}),
    {code: "EEXIST"},
  );
  assert.deepEqual(JSON.parse(await readFile(promotionPath, "utf8")), {archiveSha256: hash});
});

test("Facebook draft acceptance and global promotion remain bound to the exact ZIP hash", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-acceptance-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const archiveSha256 = "d".repeat(64);
  const {barrierPath} = await createFacebookUploadBarrier(directory, archiveSha256);
  const evidence = {
    schemaVersion: 1,
    provider: "facebook",
    intent: "non-production-draft",
    draftId: "meta-draft-123",
    archiveSha256,
    dashboardEvidenceSha256: "e".repeat(64),
    acceptedAt: "2026-08-19T16:00:00.000Z",
  };
  const accepted = await transitionFacebookUploadBarrier(barrierPath, "transmitting", "accepted", evidence);
  assert.equal(accepted.status, "accepted");
  assert.deepEqual(createFacebookPromotionRecord({
    acceptedBarrier: accepted,
    productionArchiveSha256: archiveSha256,
    promotionEvidenceSha256: "f".repeat(64),
    promotedAt: new Date("2026-08-19T17:00:00.000Z"),
  }), {
    schemaVersion: 1,
    provider: "facebook",
    intent: "global-production-promotion",
    draftId: "meta-draft-123",
    archiveSha256,
    draftEvidenceSha256: "e".repeat(64),
    promotionEvidenceSha256: "f".repeat(64),
    promotedAt: "2026-08-19T17:00:00.000Z",
  });
  assert.throws(() => createFacebookPromotionRecord({
    acceptedBarrier: accepted,
    productionArchiveSha256: "0".repeat(64),
    promotionEvidenceSha256: "f".repeat(64),
  }), /production bytes do not match/u);
});

test("Facebook acceptance rejects malformed or cross-artifact dashboard evidence", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-facebook-cross-artifact-"));
  context.after(async () => (await import("node:fs/promises")).rm(directory, {recursive: true, force: true}));
  const archiveSha256 = "a".repeat(64);
  const {barrierPath} = await createFacebookUploadBarrier(directory, archiveSha256);
  await assert.rejects(transitionFacebookUploadBarrier(barrierPath, "transmitting", "accepted", {
    schemaVersion: 1,
    provider: "facebook",
    intent: "non-production-draft",
    draftId: "meta-draft-123",
    archiveSha256: "b".repeat(64),
    dashboardEvidenceSha256: "c".repeat(64),
    acceptedAt: "2026-08-19T16:00:00.000Z",
  }), /draft-acceptance evidence/u);
});

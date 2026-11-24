import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createFacebookArtifactRecord, createFacebookHandoffArchive, createFacebookUploadBarrier,
  facebookArtifactSha256, transitionFacebookUploadBarrier, writePrivateFacebookJson,
} from "./facebook-release-artifact.mjs";
import {assertFacebookHandoffsSettled, loadFacebookHandoff, withFacebookReleaseLock} from "./facebook-release-state.mjs";

const run = promisify(execFile);

/** Isolated operator sandbox; no real repository receipts or provider calls are touched. */
async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), "rq-facebook-release-state-"));
  context.after(() => rm(root, {recursive: true, force: true}));
  const scripts = path.join(root, "platforms", "web", "facebook", "scripts");
  const receipts = path.join(root, "platforms/web/facebook/build/.facebook-upload-receipts");
  await mkdir(scripts, {recursive: true});
  await mkdir(receipts, {recursive: true});
  for (const name of ["facebook-draft-evidence.mjs", "facebook-release-artifact.mjs", "facebook-release-state.mjs", "facebook-remote-upload.mjs", "prepare-facebook-draft.mjs"]) {
    await copyFile(new URL(name, import.meta.url), path.join(scripts, name));
  }
  await writeFile(path.join(root, ".gitignore"), "/platforms/web/facebook/build/\n");
  await run("/usr/bin/git", ["init", "--quiet"], {cwd: root});
  await run("/usr/bin/git", ["add", "."], {cwd: root});
  await run("/usr/bin/git", ["-c", "user.name=Local Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "isolated fixture"], {cwd: root});
  const {stdout} = await run("/usr/bin/git", ["rev-parse", "HEAD"], {cwd: root});
  const bytes = Buffer.from("exact Facebook archive fixture");
  const hash = facebookArtifactSha256(bytes);
  const archivePath = path.join(root, "platforms/web/facebook/build/build-facebook.zip");
  await writeFile(archivePath, bytes);
  await writePrivateFacebookJson(path.join(receipts, "gated-artifact.json"), createFacebookArtifactRecord({
    archiveBytes: bytes.length, archiveEntries: 1, archivePath, archiveSha256: hash,
    sourceCommit: stdout.trim(), sourceDirty: false,
  }));
  return {root, receipts, archivePath, bytes, hash,
    command: (...args) => run(process.execPath, [path.join(scripts, "facebook-draft-evidence.mjs"), ...args]),
    prepare: () => run(process.execPath, [path.join(scripts, "prepare-facebook-draft.mjs")]),
  };
}

function acceptance(hash) {
  return {schemaVersion: 1, provider: "facebook", intent: "non-production-draft", draftId: "meta-test",
    archiveSha256: hash, dashboardEvidenceSha256: "a".repeat(64), acceptedAt: "2026-10-01T00:00:00.000Z"};
}

test("one global lock prevents concurrent commands and releases on ordinary failure", async context => {
  const f = await fixture(context);
  await withFacebookReleaseLock(f.receipts, async () => {
    await assert.rejects(f.command("begin"), /Facebook release is locked/u);
    await assert.rejects(f.prepare(), /Facebook release is locked/u);
    assert.deepEqual(await readFile(f.archivePath), f.bytes);
  });
  await assert.rejects(withFacebookReleaseLock(f.receipts, async () => {throw new Error("local failure");}), /local failure/u);
  await withFacebookReleaseLock(f.receipts, async () => {});
});

test("different hashes and preflight cannot replace an unresolved handoff", async context => {
  const f = await fixture(context);
  await f.command("begin");
  const other = Buffer.from("later gated build");
  const otherHash = facebookArtifactSha256(other);
  await writeFile(f.archivePath, other);
  await assert.rejects(f.command("begin"), /transmitting handoff/u);
  await assert.rejects(f.prepare(), /transmitting handoff/u);
  assert.deepEqual(await readFile(f.archivePath), other);
  await assert.rejects(readFile(path.join(f.receipts, `artifact-${otherHash}.zip`)), {code: "ENOENT"});
  assert.deepEqual((await loadFacebookHandoff(f.receipts, f.hash)).contents, f.bytes);
});

test("orphan exact bytes recover only as ambiguous, never as permission to retransmit", async context => {
  const f = await fixture(context);
  await createFacebookHandoffArchive(f.receipts, f.hash, f.bytes);
  await assert.rejects(f.command("begin"), /interrupted handoff/u);
  const result = await f.command("recover", "--archive-hash", f.hash);
  assert.match(result.stdout, /recovered as ambiguous/u);
  assert.match(result.stdout, /Do not upload or retransmit/u);
  assert.equal((await loadFacebookHandoff(f.receipts, f.hash)).barrier.status, "ambiguous");
  await assert.rejects(f.command("recover", "--archive-hash", f.hash), /ambiguous handoff/u);
  await assert.rejects(f.prepare(), /ambiguous handoff/u);
});

test("outcomes select immutable hashes after HEAD and the latest gate change", async context => {
  const f = await fixture(context);
  await f.command("begin");
  await writeFile(path.join(f.root, "later-source.txt"), "HEAD changed");
  await run("/usr/bin/git", ["add", "."], {cwd: f.root});
  await run("/usr/bin/git", ["-c", "user.name=Local Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "later source"], {cwd: f.root});
  await writeFile(f.archivePath, "latest build changed");
  await writeFile(path.join(f.receipts, "gated-artifact.json"), "invalid later singleton");
  await f.command("ambiguous", "--archive-hash", f.hash, "--reason", "unknown provider outcome");
  const evidence = path.join(f.root, "redacted-provider-evidence.txt");
  await writeFile(evidence, "synthetic dashboard evidence");
  await f.command("accept", "--archive-hash", f.hash, "--draft-id", "meta-test", "--evidence", evidence);
  await f.command("promote", "--archive-hash", f.hash, "--production-hash", f.hash, "--evidence", evidence);
  assert.equal((await loadFacebookHandoff(f.receipts, f.hash)).barrier.status, "accepted");
  assert.equal(JSON.parse(await readFile(path.join(f.receipts, `promotion-${f.hash}.json`), "utf8")).archiveSha256, f.hash);
  await assert.rejects(f.command("promote", "--archive-hash", f.hash, "--production-hash", f.hash, "--evidence", evidence), /EEXIST/u);
  await assert.rejects(f.command("ambiguous", "--reason", "no explicit hash"), /requires --archive-hash/u);
});

test("malformed, missing and cross-artifact barriers fail closed", async context => {
  const f = await fixture(context);
  await createFacebookHandoffArchive(f.receipts, f.hash, f.bytes);
  await assert.rejects(loadFacebookHandoff(f.receipts, f.hash), {code: "ENOENT"});
  const {barrierPath} = await createFacebookUploadBarrier(f.receipts, f.hash);
  await writePrivateFacebookJson(barrierPath, {schemaVersion: 1, provider: "facebook", archiveSha256: "b".repeat(64),
    status: "accepted", attemptedAt: "2026-10-01T00:00:00.000Z", evidence: acceptance(f.hash)});
  await assert.rejects(loadFacebookHandoff(f.receipts, f.hash), /Invalid Facebook handoff barrier/u);
  await assert.rejects(assertFacebookHandoffsSettled(f.receipts), /Invalid Facebook handoff barrier/u);
  await writeFile(barrierPath, "{interrupted json");
  await assert.rejects(f.prepare(), /SyntaxError/u);
});

test("accepted evidence permits a later handoff while any older unresolved receipt blocks it", async context => {
  const f = await fixture(context);
  await createFacebookHandoffArchive(f.receipts, f.hash, f.bytes);
  const {barrierPath} = await createFacebookUploadBarrier(f.receipts, f.hash);
  await transitionFacebookUploadBarrier(barrierPath, "transmitting", "accepted", acceptance(f.hash));
  await assertFacebookHandoffsSettled(f.receipts);
  const older = Buffer.from("legacy unresolved bytes");
  const olderHash = facebookArtifactSha256(older);
  await createFacebookHandoffArchive(f.receipts, olderHash, older);
  await createFacebookUploadBarrier(f.receipts, olderHash);
  await assert.rejects(assertFacebookHandoffsSettled(f.receipts), /transmitting handoff/u);
});

test("an interrupted process lock is retained for explicit operator investigation", async context => {
  const f = await fixture(context);
  const lockPath = path.join(f.receipts, "release.lock");
  await writeFile(lockPath, '{"pid":1,"openedAt":"2026-10-01T00:00:00.000Z"}');
  await assert.rejects(f.command("begin"), /inspect the existing process/u);
  assert.match(await readFile(lockPath, "utf8"), /"pid":1/u);
  assert.deepEqual(await readFile(f.archivePath), f.bytes);
});

test("a retained operator absence reconciliation settles the legacy attempt without permitting retransmission", async context => {
  const f = await fixture(context);
  await createFacebookHandoffArchive(f.receipts, f.hash, f.bytes);
  const {barrierPath} = await createFacebookUploadBarrier(f.receipts, f.hash);
  const original = JSON.parse(await readFile(barrierPath, "utf8"));
  const reconciled = {...original, status: "reconciled-absent", evidence: {
    reason: "The complete dashboard version list contains no matching historical bundle.",
    dashboardEvidenceSha256: "a".repeat(64), observedVersions: ["1", "2", "3"],
    reconciledAt: new Date(Date.now() + 1000).toISOString(),
  }};
  await writePrivateFacebookJson(barrierPath, reconciled);
  await assertFacebookHandoffsSettled(f.receipts);
  await assert.rejects(f.command("begin"), /EEXIST/u);
  for (const invalid of [
    {reason: ""}, {dashboardEvidenceSha256: "unverified"}, {observedVersions: []},
    {observedVersions: ["1", "1"]}, {observedVersions: [1]}, {reconciledAt: "invalid"},
    {reconciledAt: "2020-01-01T00:00:00.000Z"},
  ]) {
    await writePrivateFacebookJson(barrierPath, {...reconciled, evidence: {...reconciled.evidence, ...invalid}});
    await assert.rejects(assertFacebookHandoffsSettled(f.receipts), /Invalid Facebook absence reconciliation/u);
  }
});

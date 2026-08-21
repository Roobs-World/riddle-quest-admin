import assert from "node:assert/strict";
import {chmod, mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createRedditArtifactRecord, createRedditHandoff, createRedditUploadBarrier, redditArtifactSha256,
  transitionRedditUploadBarrier, verifyGatedRedditArtifact, verifyRedditHandoff, writePrivateRedditJson,
} from "./reddit-release-artifact.mjs";

const fixture = async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-reddit-release-"));
  context.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
};

test("gate binds clean source provenance and exact package bytes", async (context) => {
  const directory = await fixture(context);
  const archivePath = path.join(directory, "reddit.zip");
  const receiptPath = path.join(directory, "receipt.json");
  const contents = Buffer.from("exact Devvit package bytes");
  await writeFile(archivePath, contents);
  await writePrivateRedditJson(receiptPath, createRedditArtifactRecord({
    archivePath, archiveBytes: contents.length, archiveEntries: 4,
    archiveSha256: redditArtifactSha256(contents), sourceCommit: "a".repeat(40), sourceDirty: false,
  }));
  await assert.doesNotReject(verifyGatedRedditArtifact({archivePath, receiptPath, sourceCommit: "a".repeat(40), sourceDirty: false}));
  await writeFile(archivePath, "mutated");
  await assert.rejects(verifyGatedRedditArtifact({archivePath, receiptPath, sourceCommit: "a".repeat(40), sourceDirty: false}), /changed after gating/u);
  await assert.rejects(verifyGatedRedditArtifact({archivePath, receiptPath, sourceCommit: "a".repeat(40), sourceDirty: true}), /source changed|clean source/u);
});

test("release preparation checks clean source before building and requires both entrypoints", async () => {
  const source = await readFile(new URL("./prepare-reddit-release.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("if (sourceDirty)") < source.indexOf('["build:package"]'));
  for (const required of ["devvit.json", "dist/server/index.cjs", "dist/client/splash.html", "dist/client/game.html"]) {
    assert.match(source, new RegExp(required.replaceAll(".", "\\."), "u"));
  }
});

test("handoff is immutable, single-link, and hash verified", async (context) => {
  const directory = await fixture(context);
  const contents = Buffer.from("immutable Reddit handoff");
  const hash = redditArtifactSha256(contents);
  const archivePath = await createRedditHandoff(directory, hash, contents);
  assert.deepEqual((await verifyRedditHandoff(directory, hash)).contents, contents);
  assert.equal((await stat(archivePath)).mode & 0o777, 0o400);
  await assert.rejects(createRedditHandoff(directory, hash, contents), {code: "EEXIST"});
  await chmod(archivePath, 0o600);
  await assert.rejects(verifyRedditHandoff(directory, hash), /read-only/u);
});

test("exclusive retry barrier preserves ambiguous outcomes", async (context) => {
  const directory = await fixture(context);
  const hash = "c".repeat(64);
  const {barrierPath} = await createRedditUploadBarrier(directory, hash, new Date("2026-08-20T12:00:00.000Z"));
  await assert.rejects(createRedditUploadBarrier(directory, hash), {code: "EEXIST"});
  const ambiguous = await transitionRedditUploadBarrier(barrierPath, "transmitting", "ambiguous", "network outcome unknown");
  assert.equal(ambiguous.status, "ambiguous");
  assert.match(await readFile(barrierPath, "utf8"), /network outcome unknown/u);
  await assert.rejects(transitionRedditUploadBarrier(barrierPath, "transmitting", "accepted", "version 1.0.0"), /state changed/u);
});

test("concurrent barrier transitions serialize", async (context) => {
  const directory = await fixture(context);
  const {barrierPath} = await createRedditUploadBarrier(directory, "d".repeat(64));
  const results = await Promise.allSettled([
    transitionRedditUploadBarrier(barrierPath, "transmitting", "accepted", "version 1.0.0"),
    transitionRedditUploadBarrier(barrierPath, "transmitting", "ambiguous", "timeout"),
  ]);
  assert.equal(results.filter(({status}) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({status}) => status === "rejected").length, 1);
});

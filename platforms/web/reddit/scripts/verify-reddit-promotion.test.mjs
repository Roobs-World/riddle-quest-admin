import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createRedditArtifactRecord,
  createRedditHandoff,
  redditArtifactSha256,
  writePrivateRedditJson,
} from "./reddit-release-artifact.mjs";
import {verifyRedditPromotion} from "./verify-reddit-promotion.mjs";

const when = "2026-08-20T20:00:00.000Z";
const roles = ["developer", "moderator", "regular", "anonymous"];
const journeys = ["inline-expanded", "login-reload", "visibility", "payments", "deletion", "recovery"];

function hostedEvidence(sha256, sourceCommit) {
  return {
    schemaVersion: 1,
    artifact: {sha256, sourceCommit, version: "1.2.3-rc.1", receipt: "evidence/artifact.json"},
    deployment: {
      project: "riddle-quest-ec2b2",
      verifiedAt: when,
      receipt: "evidence/firebase.json",
      functions: ["exchangeRedditIdentity", "deleteRedditAccount", "redditStorage", "redditGameplay", "redditProfileRetentionScheduler"],
      rules: ["firestore", "firestore-indexes", "realtime-database", "storage"],
    },
    clients: ["web", "ios", "android"].map((client) => ({
      client,
      physical: client !== "web",
      status: "pass",
      testedAt: when,
      roles,
      journeys,
      evidence: [`evidence/${client}.json`],
    })),
    approvals: ["fetch", "payments", "policy", "security"].map((approval) => ({
      approval,
      status: "approved",
      reviewedAt: when,
      evidence: `evidence/${approval}.json`,
    })),
  };
}

test("promotion evidence is bound to the retained read-only candidate", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "rq-reddit-promotion-"));
  context.after(() => rm(directory, {recursive: true, force: true}));
  const contents = Buffer.from("reviewed Reddit candidate");
  const sha256 = redditArtifactSha256(contents);
  const sourceCommit = "a".repeat(40);
  const archivePath = path.join(directory, "build-reddit.zip");
  const receiptPath = path.join(directory, "gated-artifact.json");
  const evidencePath = path.join(directory, "hosted-evidence.json");
  await mkdir(directory, {recursive: true});
  await writeFile(archivePath, contents);
  await createRedditHandoff(directory, sha256, contents);
  await writePrivateRedditJson(receiptPath, createRedditArtifactRecord({
    archivePath,
    archiveBytes: contents.byteLength,
    archiveEntries: 1,
    archiveSha256: sha256,
    sourceCommit,
    sourceDirty: false,
  }));
  await writeFile(evidencePath, `${JSON.stringify(hostedEvidence(sha256, sourceCommit))}\n`);
  await assert.doesNotReject(verifyRedditPromotion({evidencePath, receiptPath, receiptsDirectory: directory}));

  const mismatched = hostedEvidence("b".repeat(64), sourceCommit);
  await writeFile(evidencePath, `${JSON.stringify(mismatched)}\n`);
  await assert.rejects(
    verifyRedditPromotion({evidencePath, receiptPath, receiptsDirectory: directory}),
    /does not match the gated candidate receipt/u,
  );
});

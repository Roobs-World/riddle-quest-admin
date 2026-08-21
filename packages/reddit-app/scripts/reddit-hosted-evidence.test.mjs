import assert from "node:assert/strict";
import test from "node:test";
import {REDDIT_HOSTED_EVIDENCE_REQUIREMENTS as required, validateRedditHostedEvidence} from "./reddit-hosted-evidence.mjs";

const when = "2026-08-20T20:00:00.000Z";
const valid = () => ({schemaVersion: 1,
  artifact: {sha256: "a".repeat(64), sourceCommit: "b".repeat(40), version: "1.2.3-rc.1", receipt: "evidence/artifact.json"},
  deployment: {project: "riddle-quest-ec2b2", verifiedAt: when, receipt: "evidence/firebase.json",
    functions: [...required.FUNCTIONS], rules: [...required.RULES]},
  clients: required.CLIENTS.map((client) => ({client, physical: client !== "web", status: "pass", testedAt: when,
    roles: [...required.ROLES], journeys: [...required.JOURNEYS], evidence: [`evidence/${client}.json`]})),
  approvals: required.APPROVALS.map((approval) => ({approval, status: "approved", reviewedAt: when,
    evidence: `evidence/${approval}.json`})),
});

test("accepts only complete hosted deployment, immutable artifact, approval and device evidence", () => {
  assert.equal(validateRedditHostedEvidence(valid()).schemaVersion, 1);
  for (const mutate of [
    (value) => { value.artifact.sha256 = "bad"; },
    (value) => { value.deployment.functions.pop(); },
    (value) => { value.clients.find(({client}) => client === "ios").physical = false; },
    (value) => { value.clients[0].roles.pop(); },
    (value) => { value.clients[0].journeys.pop(); },
    (value) => { value.approvals[0].status = "pending"; },
    (value) => { value.approvals[0].evidence = "../secret"; },
  ]) {
    const value = valid(); mutate(value); assert.throws(() => validateRedditHostedEvidence(value));
  }
});

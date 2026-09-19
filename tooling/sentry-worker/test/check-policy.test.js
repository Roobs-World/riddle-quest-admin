import assert from "node:assert/strict";
import test from "node:test";
import {evaluateWorkflowRuns} from "../worker/check-policy.mjs";

const sha = "abc123";
const run = (overrides = {}) => ({id: 42, head_sha: sha, event: "pull_request", status: "completed", conclusion: "success", ...overrides});

test("the exact commit's production readiness workflow must succeed", () => {
  assert.deepEqual(evaluateWorkflowRuns([run()], sha), {state: "passed", runId: 42});
  assert.deepEqual(evaluateWorkflowRuns([run({status: "in_progress", conclusion: null})], sha), {state: "pending"});
  assert.deepEqual(evaluateWorkflowRuns([run({head_sha: "other"})], sha), {state: "pending"});
  assert.deepEqual(evaluateWorkflowRuns([run({conclusion: "failure"})], sha), {state: "failed", runId: 42, conclusion: "failure"});
});

import assert from "node:assert/strict";
import test from "node:test";
import {displayDate, releaseStateTone, summarizeActions} from "./release-ui.js";

test("a passed build with a blocked release remains critical", () => {
  assert.equal(releaseStateTone("Build passed; release gate blocked on contract fixtures"), "critical");
  assert.equal(releaseStateTone("Older version in Testing; new upload blocked"), "critical");
});

test("negated and pending verification never appear successful", () => {
  for (const state of ["Not deployed", "Not verified", "Unverified", "Not uploaded", "Accepted; activation pending", "To verify", "On hold"]) {
    assert.equal(releaseStateTone(state), "attention", state);
  }
  assert.equal(releaseStateTone("Integrated"), "positive");
  assert.equal(releaseStateTone("Passed"), "positive");
});

test("provider policy exclusions are neutral rather than release failures", () => {
  assert.equal(releaseStateTone("Prohibited"), "neutral");
  assert.equal(releaseStateTone("Disabled"), "neutral");
  assert.equal(releaseStateTone(undefined), "neutral");
});

test("action totals distinguish completion, blockers and holds", () => {
  const result = summarizeActions([
    {status: "Complete", priority: "Now"},
    {status: "To do", priority: "Now"},
    {status: "Blocked", priority: "Now"},
    {status: "On hold", priority: "Later"},
    {status: "Submitted", priority: "Awaiting provider"},
    {status: "Unverified", priority: "After evidence"},
    {status: "Not complete", priority: "Later"},
  ]);
  assert.equal(result.complete, 1);
  assert.equal(result.remaining, 6);
  assert.equal(result.blocked, 1);
  assert.equal(result.held, 1);
  assert.equal(result.now, 2);
  assert.ok(Math.abs(result.progress - 100 / 7) < 1e-10);
});

test("filtered empty and complete queues have finite progress", () => {
  assert.deepEqual(summarizeActions([]), {complete: 0, blocked: 0, held: 0, remaining: 0, now: 0, progress: 0});
  assert.equal(summarizeActions([{status: "Complete", priority: "Now"}]).progress, 100);
  assert.equal(summarizeActions([{status: "Complete", priority: "Now"}]).now, 0);
});

test("receipt timestamps use UTC even near a local date boundary", () => {
  assert.equal(displayDate("2026-09-29T23:30:00Z"), "29 Sept 2026, 23:30");
  assert.equal(displayDate("Not run"), "Not run");
  assert.equal(displayDate(null), "Unavailable");
});

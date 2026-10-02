import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {validateProgressTracker} from "./validate-facebook-progress.mjs";

const tracker = readFileSync(new URL("../docs/facebook-instant-games-progress.html", import.meta.url), "utf8");

test("accepts the evidence-backed 53-task tracker", () => {
  const {updatedAt, ...counts} = validateProgressTracker(tracker);
  assert.deepEqual(counts, {total: 53, complete: 20});
  assert.match(updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
  assert.ok(Number.isFinite(Date.parse(updatedAt)), "tracker timestamp must identify a valid instant");
});

test("final gate rejects incomplete external work", () => {
  assert.throws(() => validateProgressTracker(tracker, {requireComplete: true}), /every task to be Complete/);
});

test("rejects a falsely completed task without executed evidence", () => {
  const forged = tracker.replace(
    '"approval email and redacted dashboard capture", "Deferred until implementation is otherwise complete.")',
    '"Expected: approval email and redacted dashboard capture", "", "Complete")',
  );
  assert.notEqual(forged, tracker, "forgery fixture must mutate the tracker");
  assert.throws(() => validateProgressTracker(forged), /complete task still has expected evidence/);
});

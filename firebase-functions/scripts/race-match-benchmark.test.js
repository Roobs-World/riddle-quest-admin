"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {validateOptions, distribution} = require("./race-match-benchmark");
const safe = {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099", GCLOUD_PROJECT: "demo-riddle-quest-match-benchmark"};
test("fixture writes reject production, remote endpoints and wrong demo projects", () => {
  for (const env of [{}, {...safe, FIRESTORE_EMULATOR_HOST: "example.com:8099"}, {...safe, GCLOUD_PROJECT: "production"},
    {...safe, GCLOUD_PROJECT: "demo-other"}]) assert.throws(() => validateOptions([], env));
  assert.equal(validateOptions([], safe).iterations, 5);
});
test("bounds iterations and scenario selection before backend loading", () => {
  for (const args of [["--iterations", "0"], ["--iterations", "21"], ["--iterations", "1.5"], ["--scenario", "unknown"], ["--project", "production"],
    ["--iterations"], ["--iterations", "1", "--iterations", "2"]]) assert.throws(() => validateOptions(args, safe));
  assert.deepEqual(validateOptions(["--iterations", "3", "--scenario", "sparse"], safe), {iterations: 3, scenarios: ["sparse"]});
});
test("reports nearest-rank quantiles with explicit empty samples", () => {
  assert.deepEqual(distribution([100, 1, 2, 3]), {count: 4, p50: 2, p95: 100, max: 100});
  assert.deepEqual(distribution([]), {count: 0, p50: null, p95: null, max: null});
});

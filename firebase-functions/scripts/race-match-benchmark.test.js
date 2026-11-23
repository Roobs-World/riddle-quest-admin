"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {validateOptions, distribution, validMatchedResult} = require("./races/race-match-benchmark");
const safe = {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099", GCLOUD_PROJECT: "demo-riddle-quest-match"};
test("fixture writes reject production, remote endpoints and wrong demo projects", () => {
  for (const env of [{}, {...safe, FIRESTORE_EMULATOR_HOST: "example.com:8099"}, {...safe, GCLOUD_PROJECT: "production"},
    {...safe, GCLOUD_PROJECT: "demo-other"}]) assert.throws(() => validateOptions([], env));
  assert.equal(validateOptions([], safe).iterations, 5);
});
test("demo namespace fits Firebase project ID constraints and rejects the retired namespace", () => {
  assert.ok(safe.GCLOUD_PROJECT.length <= 30);
  assert.match(safe.GCLOUD_PROJECT, /^demo-[a-z0-9-]+$/);
  assert.throws(() => validateOptions([], {...safe, GCLOUD_PROJECT: "demo-riddle-quest-match-benchmark"}));
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

test("checks selected fixture, freshness winner and exact replay rather than status alone", () => {
  const records = ["recording-0", "healthy"].map(challengeId => ({challengeId, locale: "en", categoryId: "history"}));
  const response = {status: "matched", offerId: "a".repeat(64), challenge: {...records[0]}};
  assert.equal(validMatchedResult(response, records, "dense"), true);
  assert.equal(validMatchedResult(response, records, "freshness"), false);
  assert.equal(validMatchedResult(response, records, "exclusions"), false);
  assert.equal(validMatchedResult({...response, challenge: records[1]}, records, "freshness"), true);
  assert.equal(validMatchedResult({...response, challenge: {...records[0], challengeId: "missing"}}, records, "dense"), false);
  assert.equal(validMatchedResult({...response, challenge: {...records[0], locale: "tr"}}, records, "dense"), false);
  assert.equal(validMatchedResult({...response, offerId: undefined}, records, "dense"), false);
  assert.equal(validMatchedResult(response, records, "dense", structuredClone(response)), true);
  assert.equal(validMatchedResult({...response, offerId: "b".repeat(64)}, records, "dense", response), false);
});

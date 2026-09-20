import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {mergeMeasurements, validateMeasurement} from "./import-deployment-metrics.mjs";
import {coverage, measurement, ratio} from "../../docs/reports/platform-release-readiness/src/content/dashboard/deployment-metrics.js";

const now = Date.parse("2026-09-20T18:00:00Z");
const snapshot = JSON.parse(await readFile(new URL("../../docs/reports/platform-release-readiness/src/data.json", import.meta.url), "utf8"));
const row = {...snapshot.queries.deployment_metrics.rows.find((item) => item.platform === "Reddit"),
  date: "2026-09-19", collectedAt: "2026-09-20T12:00:00Z", source: "Synthetic test fixture only",
  activePlayers: 8, sessions: 10, gamesStarted: 20, gamesCompleted: 15, engagedSeconds: 600,
  loadSamples: 10, loadP95Ms: 200, errorSessions: 1, observedSessions: 10};

test("all targets retain explicit missing coverage until provider evidence arrives", () => {
  assert.deepEqual(new Set(snapshot.queries.deployment_metrics.rows.map((r) => r.platform)), new Set(["Jest", "Facebook", "Reddit", "YouTube", "Netflix", "Yahoo"]));
  assert.equal(coverage({}), "Missing");
  assert.equal(measurement(null), "Unavailable");
  assert.equal(measurement(0), "0");
  assert.equal(ratio(null, 10), null);
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(0, 10), 0);
  assert.equal(ratio(row.gamesCompleted, row.gamesStarted), 0.75);
});

test("imports replace matching coverage rows idempotently and retain deployment history", () => {
  const result = mergeMeasurements(snapshot, [row], now);
  assert.equal(result.queries.deployment_metrics.rows.length, 6);
  assert.deepEqual(mergeMeasurements(result, [row], now), result);
  const next = mergeMeasurements(result, [{...row, deployment: "next-private-version"}], now);
  assert.equal(next.queries.deployment_metrics.rows.length, 7);
  assert.deepEqual(result.queries.platform_status, snapshot.queries.platform_status);
  assert.equal(result.id, snapshot.id);
});

test("invalid metrics, dates, denominators and duplicates cannot enter the dashboard", () => {
  for (const patch of [{sessions: -1}, {sessions: "10"}, {sessions: 1.5}, {gamesCompleted: 21}, {activePlayers: 11},
    {errorSessions: 11}, {loadSamples: 0}, {loadP95Ms: Infinity}, {date: "2026-02-30"},
    {date: "2026-09-20"}, {collectedAt: "2026-09-19T12:00:00Z"}, {collectedAt: "2027-01-01T00:00:00Z"},
    {source: ""}, {platform: "Other"}, {playerId: "private"}]) {
    assert.throws(() => validateMeasurement({...row, ...patch}, now), JSON.stringify(patch));
  }
  assert.throws(() => mergeMeasurements(snapshot, [row, row], now), /Duplicate/);
  assert.throws(() => mergeMeasurements(mergeMeasurements(snapshot, [row], now), [{...row, collectedAt: "2026-09-20T01:00:00Z"}], now), /newer/);
});

test("coverage reports partial and stale evidence without treating collection time as reporting freshness", () => {
  assert.equal(coverage(row, now), "Complete");
  assert.equal(coverage({...row, sessions: null}, now), "Partial");
  assert.equal(coverage({...row, date: "2026-09-15"}, now), "Stale · Complete");
});

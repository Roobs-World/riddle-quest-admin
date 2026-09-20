import assert from "node:assert/strict";
import test from "node:test";
import {publishDeploymentReport} from "./publish-deployment-metrics.mjs";

const now = Date.parse("2026-09-20T18:00:00Z");
const report = {platform: "Jest", deployment: "test-release", environment: "test", date: "2026-09-19",
  collectedAt: "2026-09-20T17:00:00Z", source: "Synthetic test fixture", activePlayers: 2, sessions: 3};
const snapshot = {id: "fixture", queries: {deployment_metrics: {rows: [], source: {filters: []}},
  backend_deployment_metrics: {rows: [{requests: 9}]}, provider_daily_activity: {rows: [{dailyActiveUsers: 4}]}}};

test("publishes validated reports against the exact current generation and preserves other collectors", async () => {
  let written;
  const store = {read: async () => ({data: snapshot, generation: "123"}), write: async (...args) => {written = args;}};
  assert.equal(await publishDeploymentReport([report], {store, now}), 1);
  assert.equal(written[0], "snapshot.json");
  assert.equal(written[2], "123");
  assert.deepEqual(written[1].queries.backend_deployment_metrics, snapshot.queries.backend_deployment_metrics);
  assert.deepEqual(written[1].queries.provider_daily_activity, snapshot.queries.provider_daily_activity);
  assert.equal(written[1].queries.deployment_metrics.rows[0].sessions, 3);
});

test("missing snapshots, invalid reports and concurrent writes cannot silently replace cloud data", async () => {
  await assert.rejects(publishDeploymentReport([report], {store: {read: async () => null}, now}), /Run the cloud collector/);
  let writes = 0;
  const store = {read: async () => ({data: snapshot, generation: "123"}), write: async () => {writes++; throw new Error("Precondition failed");}};
  await assert.rejects(publishDeploymentReport([{...report, sessions: -1}], {store, now}), /Invalid sessions/);
  assert.equal(writes, 0);
  await assert.rejects(publishDeploymentReport([report], {store, now}), /Precondition failed/);
  assert.equal(writes, 1);
});

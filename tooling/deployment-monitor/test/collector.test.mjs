import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import test from "node:test";
import {aggregateBackendRequests, collectBackendSnapshot} from "../collector.mjs";
import {googleClient, snapshotStore} from "../google.mjs";
import {monitoringHandler} from "../server.mjs";

const now = new Date("2026-09-20T18:00:00Z");
const window = {start: "2026-09-19T18:00:00Z", end: now.toISOString()};
const seed = {id: "test-dashboard", queries: {deployment_metrics: {rows: [{platform: "YouTube", sessions: null}]}}};
const entry = (id, latency = "0.2s", status = 200) => ({insertId: id, timestamp: "2026-09-20T12:00:00Z",
  httpRequest: {latency, status, requestUrl: "https://private.invalid/?token=never-retain"},
  resource: {labels: {service_name: "exchangejestidentity", revision_name: "exchangejestidentity-00002"}}});
const services = [{name: "projects/p/locations/l/services/exchangejestidentity", latestReadyRevision: "exchangejestidentity-00003"}];

test("keeps revisions separate, deduplicates logs and computes exact latency without retaining private data", () => {
  const rows = aggregateBackendRequests([entry("a"), entry("a"), entry("b", "2s", 500), entry("c", undefined, 401)], services, window);
  assert.equal(rows.length, 2);
  const older = rows.find((row) => row.deployment.endsWith("00002"));
  assert.equal(older.requests, 3);
  assert.equal(older.successfulRequests, 1);
  assert.equal(older.serverErrors, 1);
  assert.equal(older.clientErrors, 1);
  assert.equal(older.latencyP95Ms, 2000);
  assert.equal(rows.find((row) => row.deployment.endsWith("00003")).requests, 0);
  assert.equal(rows.find((row) => row.deployment.endsWith("00003")).latencyP95Ms, null);
  assert.doesNotMatch(JSON.stringify(rows), /never-retain|requestUrl|insertId/);
});

test("follows empty pages and publishes only complete retrievals without changing player metrics", async () => {
  const calls = [];
  const request = async (path, body) => {
    calls.push(body);
    if (path.includes("run.googleapis.com")) return {services};
    return body.pageToken ? {entries: [entry("one")]} : {entries: [], nextPageToken: "page2"};
  };
  const snapshot = await collectBackendSnapshot(seed, {request, project: "p", now});
  assert.equal(snapshot.queries.backend_deployment_metrics.rows.length, 2);
  assert.deepEqual(snapshot.queries.deployment_metrics, seed.queries.deployment_metrics);
  assert.equal(snapshot.generatedAt, now.toISOString());
  assert.equal(calls.filter((call) => call.pageToken === "page2").length, 1);
  await assert.rejects(collectBackendSnapshot(seed, {request: async () => ({nextPageToken: "loop"}), project: "p", now}), /repeated a cursor/);
  await assert.rejects(collectBackendSnapshot(seed, {request: async () => {throw new Error("provider failed");}, project: "p", now}), /provider failed/);
});

test("Google storage uses immutable reads and generation preconditions, and credentials never follow redirects", async () => {
  const calls = [];
  const request = googleClient({accessToken: "test-only", fetcher: async (url, options) => {
    calls.push({url: String(url), options});
    return new Response(JSON.stringify({generation: "17", test: true}), {status: 200});
  }});
  const store = snapshotStore(request, "test-bucket");
  assert.equal((await store.read("snapshot.json")).generation, "17");
  await store.write("snapshot.json", seed, "17");
  assert.match(calls[1].url, /generation=17/);
  assert.match(calls[2].url, /ifGenerationMatch=17/);
  assert.ok(calls.every(({options}) => options.redirect === "error"));
  await assert.rejects(request("https://unexpected.example/"), /Unexpected cloud API host/);
});

test("HTTP collector durably refreshes the dashboard and keeps the last good data after provider failure", async (t) => {
  const records = new Map();
  const store = {
    read: async (name) => records.get(name) ?? null,
    write: async (name, data) => records.set(name, {data, generation: "1"}),
  };
  let fail = false;
  const server = createServer(monitoringHandler({store, seed, html: "<html><head></head></html>", project: "p", now: () => now,
    request: async (path) => {if (fail) throw new Error("secret must not leak"); return path.includes("run.googleapis.com") ? {services} : {entries: [entry("one")]};},
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${origin}/api/collect`, {method: "POST"})).status, 200);
  const response = await (await fetch(`${origin}/api/snapshot`)).json();
  assert.equal(response.monitoringStatus.status, "Succeeded");
  assert.equal(response.queries.backend_deployment_metrics.rows.length, 2);
  assert.match(await (await fetch(origin)).text(), /data-app-monitoring/);
  fail = true;
  const failure = await fetch(`${origin}/api/collect`, {method: "POST"});
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /secret/);
  const retained = await (await fetch(`${origin}/api/snapshot`)).json();
  assert.equal(retained.monitoringStatus.status, "Failed");
  assert.deepEqual(retained.queries, response.queries);
  assert.equal((await fetch(`${origin}/api/collect`)).status, 404);
});

test("retired revisions keep their last observed window without presenting historical traffic as current", async () => {
  const first = await collectBackendSnapshot(seed, {project: "p", now,
    request: async (path) => path.includes("run.googleapis.com") ? {services} : {entries: [entry("one")]}});
  const tomorrow = new Date(now.getTime() + 86400000);
  const next = await collectBackendSnapshot(first, {project: "p", now: tomorrow,
    request: async (path) => path.includes("run.googleapis.com") ? {services} : {entries: []}});
  const retired = next.queries.backend_deployment_metrics.rows.find((row) => row.deployment.endsWith("00002"));
  assert.equal(retired.reportStatus, "Historical");
  assert.equal(retired.requests, 1);
  assert.equal(retired.windowEnd, now.toISOString());
  const active = next.queries.backend_deployment_metrics.rows.find((row) => row.deployment.endsWith("00003"));
  assert.equal(active.reportStatus, "Current window");
  assert.equal(active.requests, 0);
  assert.equal(active.windowEnd, tomorrow.toISOString());
});

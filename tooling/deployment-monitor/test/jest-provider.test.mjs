import assert from "node:assert/strict";
import test from "node:test";
import {collectJestSnapshot, dailyActivity, readJestAnalytics, jestGame} from "../jest-provider.mjs";

const now = new Date("2026-09-20T18:00:00Z");
const report = {chart: "dau_summary", data: {date: ["2026-09-19", "2026-09-20"], dau: [0, 7], registeredDau: [0, 2]}};
function provider() {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (url.endsWith("/token")) return Response.json({access_token: "new-test-access", refresh_token: "new-test-refresh", expires_in: 3600});
    const body = JSON.parse(options.body);
    if (body.method === "initialize") return Response.json({jsonrpc: "2.0", id: 1, result: {protocolVersion: "2025-03-26"}}, {headers: {"mcp-session-id": "test-session"}});
    if (body.method === "notifications/initialized") return new Response(null, {status: 202});
    assert.equal(body.params.name, "get_game_analytics");
    assert.deepEqual(body.params.arguments, {...jestGame, chart: "dau_summary"});
    return new Response(`event: message\ndata: ${JSON.stringify({jsonrpc: "2.0", id: 2, result: {content: [{type: "text", text: JSON.stringify(report)}]}})}\n\n`, {headers: {"Content-Type": "text/event-stream"}});
  };
  return {fetcher, calls};
}

test("daily activity excludes unfinished days, keeps measured zero and rejects malformed counts", () => {
  assert.deepEqual(dailyActivity(report, now), [{date: "2026-09-19", platform: "Jest", dailyActiveUsers: 0, registeredDailyActiveUsers: 0}]);
  for (const data of [{date: ["2026-02-30"], dau: [0]}, {date: ["2026-09-19"], dau: [-1]},
    {date: ["2026-09-19"], dau: []}, {date: ["2026-09-19"], dau: [1], registeredDau: [-1]},
    {date: ["2026-09-19"], dau: [1], registeredDau: [1.5]}]) {
    assert.throws(() => dailyActivity({chart: "dau_summary", data}, now));
  }
});

test("daily activity preserves the separate counters returned by the live provider", () => {
  const observed = {chart: "dau_summary", data: {
    date: ["2026-10-02", "2026-10-03", "2026-10-10", "2026-10-13"],
    dau: [2, 1, 0, 0], registeredDau: [3, 2, 1, 0],
  }};
  assert.deepEqual(dailyActivity(observed, new Date("2026-10-13T06:00:00Z")), [
    {date: "2026-10-02", platform: "Jest", dailyActiveUsers: 2, registeredDailyActiveUsers: 3},
    {date: "2026-10-03", platform: "Jest", dailyActiveUsers: 1, registeredDailyActiveUsers: 2},
    {date: "2026-10-10", platform: "Jest", dailyActiveUsers: 0, registeredDailyActiveUsers: 1},
  ]);
});

test("authenticated MCP initialization retains the session and only calls the chosen read tool", async () => {
  const {fetcher, calls} = provider();
  assert.deepEqual(await readJestAnalytics("test-access", {fetcher}), report);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.headers["Mcp-Session-Id"], "test-session");
  assert.ok(calls.every(({url, options}) => url === "https://jest.com/mcp" && options.redirect === "error"));
});

test("rotated offline credentials are stored before analytics and never reach the snapshot", async () => {
  const {fetcher, calls} = provider();
  let saved;
  const store = {read: async () => ({generation: "9", data: {clientId: "client", refreshToken: "old-test-refresh", expiresAt: 0}}),
    write: async (name, value, generation) => {
      assert.equal(calls.length, 1);
      assert.equal(name, "jest-oauth.json");
      assert.equal(generation, "9");
      saved = value;
    }};
  const seed = {id: "same-app", queries: {deployment_metrics: {rows: [{sessions: null}]}}};
  const result = await collectJestSnapshot(seed, {store, now, fetcher});
  assert.equal(saved.refreshToken, "new-test-refresh");
  assert.equal(result.status, "Succeeded");
  assert.equal(result.snapshot.id, seed.id);
  assert.deepEqual(result.snapshot.queries.deployment_metrics, seed.queries.deployment_metrics);
  assert.doesNotMatch(JSON.stringify(result.snapshot), /test-access|test-refresh/);
  assert.equal(result.snapshot.queries.provider_daily_activity.rows.length, 1);
});

test("missing connection is explicit and provider failures cannot replace reviewed data", async () => {
  const seed = {queries: {provider_daily_activity: {rows: [{dailyActiveUsers: 2}]}}};
  assert.deepEqual(await collectJestSnapshot(seed, {store: {read: async () => null}, now}), {snapshot: seed, status: "Connection required"});
  await assert.rejects(collectJestSnapshot(seed, {store: {read: async () => ({data: {expiresAt: 0, refreshToken: "test", clientId: "test"}})}, now,
    fetcher: async () => new Response("private error", {status: 401})}), /Jest token refresh returned 401/);
  assert.equal(seed.queries.provider_daily_activity.rows[0].dailyActiveUsers, 2);
});

 test("analytics is bound to the production game documented for uploads", () => {
  assert.deepEqual(jestGame, {teamId: "019faa67-d2a6-7169-aa29-a4411a3a3c3d", gameId: "019faa68-f3ec-755d-9ab5-c887fb426801"});
});

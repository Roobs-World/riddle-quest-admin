import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import test from "node:test";
import handler, {issueIdentity, launchFirstUnclaimed, reconcileRepair, reserveBranch, reserveHourlyBudget, verifySignature} from "../api/sentry-webhook.js";
import {repairBranch, signTicket} from "../worker/deployment-gate.mjs";

async function request(method, headers = {}) {
  const response = {headers: {}, setHeader(name, value) {this.headers[name] = value;}, end(body) {this.body = body;}};
  await handler({method, headers}, response);
  return response;
}
test("health reports actual configuration presence without exposing credentials", async () => {
  const result = await request("GET");
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Cache-Control"], "no-store");
  const body = JSON.parse(result.body);
  assert.equal(body.service, "riddle-quest-sentry-worker");
  assert.equal(body.status, "not_configured");
  assert.equal(body.workerEnabled, false);
  assert.deepEqual(body.authorityConfigured, {jestProduction: "public-live-iframe", jestPreviews: false, functions: false});
});
test("CLI deployments report their source when Vercel supplies an empty git revision", async () => {
  const previousGit = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousSource = process.env.SENTRY_WORKER_SOURCE_SHA;
  try {
    process.env.VERCEL_GIT_COMMIT_SHA = "";
    process.env.SENTRY_WORKER_SOURCE_SHA = "cc1a5c3bd";
    const result = await request("GET");
    assert.equal(JSON.parse(result.body).revision, "cc1a5c3bd");
  } finally {
    if (previousGit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousGit;
    if (previousSource === undefined) delete process.env.SENTRY_WORKER_SOURCE_SHA;
    else process.env.SENTRY_WORKER_SOURCE_SHA = previousSource;
  }
});
test("HEAD is reachable without a response body", async () => {
  const result = await request("HEAD");
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, undefined);
});
test("signature verification uses the exact request bytes", () => {
  const body = Buffer.from('{"data":{"issue":{"id":"123"}}}');
  const signature = createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(verifySignature(body, signature, "secret"), true);
  assert.equal(verifySignature(Buffer.from("{}"), signature, "secret"), false);
  assert.equal(verifySignature(body, "not-a-signature", "secret"), false);
});
test("only the configured Sentry project produces an issue identity", () => {
  assert.equal(issueIdentity({data: {issue: {id: "123"}, project: {id: "4511885926006864"}}}), "123");
  assert.equal(issueIdentity({data: {issue: {id: "123"}, project: {slug: "another-project"}}}), null);
  assert.equal(issueIdentity({data: {issue: {id: "not-numeric"}, project: {slug: "riddle-quest"}}}), null);
});
test("other methods are rejected", async () => {
  const result = await request("PUT");
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, "GET, HEAD, POST");
});
test("cron selection skips claimed issues and launches the next candidate", async () => {
  const seen = [];
  const started = await launchFirstUnclaimed([{id: "newest"}, {id: "next"}, {id: "oldest"}], async (issue) => {
    seen.push(issue.id);
    return issue.id === "next" ? {duplicate: false, sandboxId: "sandbox"} : {blocked: true, reason: "stale_release"};
  });
  assert.deepEqual(seen, ["newest", "next"]);
  assert.deepEqual(started, {issue: {id: "next"}, result: {duplicate: false, sandboxId: "sandbox"}});
});
test("an abandoned branch without a pull request is reclaimed after the sandbox timeout", async (context) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const replies = [
    {object: {sha: "base-sha"}},
    {workflow_runs: []},
    {status: 422, body: {message: "Reference already exists"}},
    [],
    {commit: {commit: {committer: {date: "2026-09-20T00:00:00Z"}}}},
    {status: 204, body: null},
    {ref: "refs/heads/codex/sentry-123"},
    {tree: {sha: "tree-sha"}},
    {sha: "claim-sha"},
    {ref: "refs/heads/codex/sentry-123", object: {sha: "claim-sha"}},
  ];
  context.after(() => {globalThis.fetch = originalFetch;});
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url: String(url), method: options.method ?? "GET", body: options.body});
    const next = replies.shift();
    const status = next?.status ?? 200;
    const body = next && Object.hasOwn(next, "body") ? next.body : next;
    return new Response(body === null ? null : JSON.stringify(body), {status});
  };

  const event = {timestamp: "2026-09-20T05:00:00Z"};
  const fingerprint = "a".repeat(64);
  assert.deepEqual(await reserveBranch("123", "token", {event, fingerprint}, Date.parse(event.timestamp)), {
    base: "jest",
    branch: repairBranch("123", fingerprint, event.timestamp),
    baseSha: "base-sha",
    claimSha: "claim-sha",
  });
  assert.equal(requests.filter((request) => request.method === "DELETE").length, 1);
  assert.equal(requests.filter((request) => request.url.endsWith("/git/refs")).length, 2);
  assert.match(requests.at(-2).body, /\[sentry-worker\] Claim issue 123/u);
});
test("a later cron merges a repaired pull request after its exact checks pass", async (context) => {
  const previousAutoMerge = process.env.SENTRY_WORKER_AUTO_MERGE;
  process.env.SENTRY_WORKER_AUTO_MERGE = "1";
  context.after(() => {if (previousAutoMerge === undefined) delete process.env.SENTRY_WORKER_AUTO_MERGE; else process.env.SENTRY_WORKER_AUTO_MERGE = previousAutoMerge;});
  const originalFetch = globalThis.fetch;
  const requests = [];
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";
  context.after(() => {if (previousSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousSecret;});
  const event = {timestamp: new Date().toISOString()};
  const fingerprint = "a".repeat(64);
  const branch = repairBranch("148177327", fingerprint, event.timestamp);
  const ticket = signTicket({issueId: "148177327", event, fingerprint, branch, base: "jest", baseSha: "b".repeat(40), claimSha: "c".repeat(40)}, "test-secret");
  const replies = [
    [{number: 4, title: "Fix issue", body: `<!-- sentry-worker-ticket:${ticket} -->`, base: {ref: "jest"}, head: {sha: "repair-sha"}}],
    {workflow_runs: [{id: 99, head_sha: "repair-sha", event: "pull_request", status: "completed", conclusion: "success"}]},
    {object: {sha: "b".repeat(40)}},
    {merged: true},
  ];
  context.after(() => {globalThis.fetch = originalFetch;});
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url: String(url), method: options.method ?? "GET", body: options.body});
    const body = replies.shift();
    return new Response(body === null ? null : JSON.stringify(body), {status: body === null ? 204 : 200});
  };

  assert.deepEqual(await reconcileRepair("148177327", "token", branch, async () => ({allowed: true, fingerprint})), {
    status: "merged",
    pullRequest: 4,
  });
  assert.equal(requests[3].method, "PUT");
  assert.match(requests[3].url, /\/pulls\/4\/merge$/u);
  assert.equal(requests.length, 4);
});
test("the default service leaves a checked repair for review and reports release work pending", async (context) => {
  const originalFetch = globalThis.fetch;
  const previousSecret = process.env.CRON_SECRET;
  const previousAutoMerge = process.env.SENTRY_WORKER_AUTO_MERGE;
  process.env.CRON_SECRET = "test-secret";
  delete process.env.SENTRY_WORKER_AUTO_MERGE;
  context.after(() => {globalThis.fetch = originalFetch; for (const [key, value] of [["CRON_SECRET", previousSecret], ["SENTRY_WORKER_AUTO_MERGE", previousAutoMerge]]) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}});
  const event = {timestamp: new Date().toISOString()};
  const fingerprint = "a".repeat(64);
  const branch = repairBranch("123", fingerprint, event.timestamp);
  const ticket = signTicket({issueId: "123", event, fingerprint, branch, base: "jest", baseSha: "b".repeat(40), claimSha: "c".repeat(40)}, "test-secret");
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.method ?? "GET", "GET");
    return Response.json(String(url).includes("/pulls?") ? [{number: 4, base: {ref: "jest"}, head: {sha: "repair-sha"}, body: `<!-- sentry-worker-ticket:${ticket} -->`}] : String(url).includes("/actions/") ? {workflow_runs: [{head_sha: "repair-sha", event: "pull_request", status: "completed", conclusion: "success"}]} : {object: {sha: "b".repeat(40)}});
  };
  assert.deepEqual(await reconcileRepair("123", "test", branch, async () => ({allowed: true, fingerprint})), {status: "ready_for_review", pullRequest: 4, releaseWorkPending: true});
});

test("a successful CI run cannot merge after the deployed version or base branch changes", async (context) => {
  const originalFetch = globalThis.fetch;
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";
  context.after(() => {globalThis.fetch = originalFetch; if (previousSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previousSecret;});
  const event = {timestamp: new Date().toISOString()};
  const fingerprint = "a".repeat(64);
  const branch = repairBranch("123", fingerprint, event.timestamp);
  const ticket = signTicket({issueId: "123", event, fingerprint, branch, base: "jest", baseSha: "b".repeat(40), claimSha: "c".repeat(40)}, "test-secret");
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url: String(url), method: options.method ?? "GET"});
    assert.equal(options.method ?? "GET", "GET");
    return Response.json(String(url).includes("/pulls?") ? [{number: 4, base: {ref: "jest"}, head: {sha: "repair-sha"}, body: `<!-- sentry-worker-ticket:${ticket} -->`}] : String(url).includes("/actions/") ? {workflow_runs: [{head_sha: "repair-sha", event: "pull_request", status: "completed", conclusion: "success"}]} : {object: {sha: "c".repeat(40)}});
  };
  assert.equal((await reconcileRepair("123", "token", branch, async () => ({allowed: true, fingerprint: "d".repeat(64)}))).reason, "deployment_changed");
  assert.equal((await reconcileRepair("123", "token", branch, async () => ({allowed: true, fingerprint}))).reason, "base_branch_changed");
  assert.ok(requests.every((item) => item.method === "GET"));
});

test("overlapping cron attempts share one atomic UTC-hour paid repair budget", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {globalThis.fetch = originalFetch;});
  const claims = new Set();
  globalThis.fetch = async (_url, options) => {
    const {ref} = JSON.parse(options.body);
    if (claims.has(ref)) return Response.json({}, {status: 422});
    claims.add(ref);
    return Response.json({}, {status: 201});
  };
  const now = new Date("2026-11-22T23:55:00Z");
  const attempts = await Promise.all([reserveHourlyBudget("test", "base", now), reserveHourlyBudget("test", "base", now)]);
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.deepEqual([...claims], ["refs/heads/codex/sentry-budget-20261122-23"]);
  assert.equal(await reserveHourlyBudget("test", "base", new Date("2026-11-23T00:01:00Z")), true);
});
test("an exhausted global budget stops selection without claiming other issues", async () => {
  const seen = [];
  const result = await launchFirstUnclaimed([{id: "first"}, {id: "second"}], async (issue) => {seen.push(issue.id); return {blocked: true, stop: true, reason: "hourly_repair_budget_consumed"};});
  assert.equal(result, null);
  assert.deepEqual(seen, ["first"]);
});

test("signed webhook reports unavailable authority and never creates a repair branch", async (context) => {
  const originalFetch = globalThis.fetch;
  const keys = ["SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_SECRET", "SENTRY_WORKER_GITHUB_TOKEN", "OPENAI_API_KEY", "CRON_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => {process.env[key] = "test";});
  context.after(() => {globalThis.fetch = originalFetch; for (const key of keys) {if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];}});
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url: String(url), method: options.method ?? "GET"});
    if (String(url) === "https://jest.com/g/riddle-q") return new Response(null, {status: 503});
    assert.match(String(url), /^https:\/\/sentry.io\//u);
    return Response.json(String(url).includes("/events/latest/") ? {eventID: "event", dateCreated: new Date().toISOString(), release: {version: "riddle-quest@test"}, tags: [{key: "runtime", value: "jest-html5"}, {key: "environment", value: "production"}]} : [{id: "123", title: "issue"}]);
  };
  const body = Buffer.from('{ "data": { "project": { "slug": "riddle-quest" }, "issue": { "id": "123" } } }');
  const signature = createHmac("sha256", "test").update(body).digest("hex");
  const response = {setHeader() {}, end(value) {this.body = value;}};
  await handler({method: "POST", headers: {"sentry-hook-signature": signature}, body}, response);
  assert.equal(response.statusCode, 202);
  assert.equal(JSON.parse(response.body).reason, "deployment_authority_unavailable");
  assert.equal(requests.length, 3);
  assert.ok(requests.every((item) => item.method === "GET"));
});

test("parsed JSON cannot substitute for signed raw webhook bytes", async (context) => {
  const keys = ["SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_SECRET", "SENTRY_WORKER_GITHUB_TOKEN", "OPENAI_API_KEY", "CRON_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => {process.env[key] = "test";});
  context.after(() => {for (const key of keys) {if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];}});
  const response = {setHeader() {}, end(value) {this.body = value;}};
  await handler({method: "POST", headers: {"sentry-hook-signature": "signature"}, body: {data: {issue: {id: "123"}}}}, response);
  assert.equal(response.statusCode, 502);
  assert.equal(JSON.parse(response.body).error, "launch_failed");
});

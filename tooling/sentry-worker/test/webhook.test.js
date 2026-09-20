import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import test from "node:test";
import handler, {issueIdentity, launchFirstUnclaimed, reconcileRepair, verifySignature} from "../api/sentry-webhook.js";

async function request(method, headers = {}) {
  const response = {headers: {}, setHeader(name, value) {this.headers[name] = value;}, end(body) {this.body = body;}};
  await handler({method, headers}, response);
  return response;
}
test("health reports the worker active without exposing configuration", async () => {
  const result = await request("GET");
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(JSON.parse(result.body), {service: "riddle-quest-sentry-worker", status: "active", workerEnabled: true});
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
    return issue.id === "next" ? {duplicate: false, sandboxId: "sandbox"} : {duplicate: true};
  });
  assert.deepEqual(seen, ["newest", "next"]);
  assert.deepEqual(started, {issue: {id: "next"}, result: {duplicate: false, sandboxId: "sandbox"}});
});
test("a later cron merges a repaired pull request after its exact checks pass", async (context) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const replies = [
    [{number: 4, title: "Fix issue", head: {sha: "repair-sha"}}],
    {workflow_runs: [{id: 99, head_sha: "repair-sha", event: "pull_request", status: "completed", conclusion: "success"}]},
    {merged: true},
    null,
  ];
  context.after(() => {globalThis.fetch = originalFetch;});
  globalThis.fetch = async (url, options = {}) => {
    requests.push({url: String(url), method: options.method ?? "GET", body: options.body});
    const body = replies.shift();
    return new Response(body === null ? null : JSON.stringify(body), {status: body === null ? 204 : 200});
  };

  assert.deepEqual(await reconcileRepair("148177327", "token"), {
    status: "merged_and_deploy_dispatched",
    pullRequest: 4,
  });
  assert.equal(requests[2].method, "PUT");
  assert.match(requests[2].url, /\/pulls\/4\/merge$/u);
  assert.equal(requests[3].method, "POST");
  assert.match(requests[3].url, /\/actions\/workflows\/deploy-jest\.yml\/dispatches$/u);
});

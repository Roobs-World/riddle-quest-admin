import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import test from "node:test";
import {currentFunctions, currentJestProduction, currentJestVersions, evaluateDeployment, readTicket, repairBranch, sanitizeEvent, signTicket, verifyDeployment} from "../worker/deployment-gate.mjs";

const timestamp = "2026-11-22T23:20:00Z";
const event = {eventId: "event", runtime: "jest-html5", environment: "production", release: "riddle-quest@preview-1", timestamp};
const versions = [{id: "live", version: "october", isActive: true, buildStatus: "ready"}, {id: "preview", version: "preview-1", isActive: false, buildStatus: "ready"}];
const functions = [{name: "projects/riddle-quest-ec2b2/locations/us-central1/functions/dailyChallengeScheduler", state: "ACTIVE", serviceConfig: {revision: "dailychallengescheduler-00056-kax", allTrafficOnLatestRevision: true}, buildConfig: {sourceProvenance: {resolvedStorageSource: {generation: "123"}}}}];
const backendEvent = {...event, runtime: "firebase-functions", release: "dailychallengescheduler-00056-kax"};

test("Jest requires the exact active release or an explicitly authorized READY preview", () => {
  assert.equal(evaluateDeployment(event, versions, {}).reason, "jest_release_not_current_or_authorized_preview");
  const allowed = evaluateDeployment(event, versions, {SENTRY_WORKER_JEST_PREVIEW_IDS: "preview"});
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.deployment.active, false);
  assert.equal(allowed.deployment.activeVersion, "october");
  assert.equal(evaluateDeployment({...event, release: "riddle-quest@october"}, versions, {}).allowed, true);
  assert.equal(evaluateDeployment(event, versions.map((version) => version.id === "preview" ? {...version, buildStatus: "processing"} : version), {SENTRY_WORKER_JEST_PREVIEW_IDS: "preview"}).allowed, false);
  assert.notEqual(allowed.fingerprint, evaluateDeployment(event, versions.map((version) => ({...version, isActive: !version.isActive})), {SENTRY_WORKER_JEST_PREVIEW_IDS: "preview"}).fingerprint);
});

test("Functions uses current runtime revision and fully serving state, never a Git SHA fallback", () => {
  assert.equal(evaluateDeployment(backendEvent, functions, {}).allowed, true);
  assert.equal(evaluateDeployment({...backendEvent, release: "dailychallengescheduler-00054-fix"}, functions, {}).reason, "functions_revision_not_current");
  assert.equal(evaluateDeployment({...backendEvent, release: "a".repeat(40)}, functions, {}).reason, "functions_runtime_revision_missing");
  assert.equal(evaluateDeployment(backendEvent, [{...functions[0], serviceConfig: {...functions[0].serviceConfig, allTrafficOnLatestRevision: false}}], {}).allowed, false);
  assert.equal(evaluateDeployment({...backendEvent, environment: "staging"}, functions, {}).allowed, false);
});

test("absent or failed authoritative credentials block mutations without exposing upstream payloads", async () => {
  const noNetwork = () => {throw new Error("unexpected network request");};
  assert.deepEqual(await verifyDeployment(event, {}, noNetwork), {allowed: false, reason: "deployment_authority_unavailable", detail: "authority_request_failed"});
  assert.deepEqual(await verifyDeployment(backendEvent, {}, noNetwork), {allowed: false, reason: "deployment_authority_unavailable", detail: "functions_authority_not_configured"});
  assert.equal((await verifyDeployment(event, {JEST_MCP_ACCESS_TOKEN: "test"}, () => {throw new Error("secret unexpected private response");})).detail, "authority_request_failed");
});

const publicFrame = '<iframe src="https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com/019faa68-f3ec-755d-9ab5-c887fb426801/october/index.html?sid=private&amp;tce=1"></iframe>';
const htmlResponse = (body) => new Response(body, {headers: {"Content-Type": "text/html; charset=utf-8"}});
test("public Jest production authority checks the sole game iframe and its immutable index without retaining sessions", async () => {
  const requests = [];
  const inventory = await currentJestProduction(async (url) => {requests.push(String(url)); return htmlResponse(requests.length === 1 ? publicFrame : "<!doctype html><html></html>");});
  assert.equal(inventory[0].version, "october");
  assert.equal(inventory[0].isActive, true);
  assert.doesNotMatch(JSON.stringify(inventory), /sid|private/u);
  assert.equal(new URL(requests[1]).search, "");
});
test("ambiguous, foreign-host, unavailable and oversized public Jest authority fails closed", async () => {
  for (const body of [publicFrame + publicFrame, publicFrame.replace("builds.jest.com", "evil.example"), "<html></html>", "x".repeat(256_001)]) {
    await assert.rejects(currentJestProduction(async () => htmlResponse(body)));
  }
  await assert.rejects(currentJestProduction(async () => new Response(null, {status: 503})));
});
test("active Jest production works without OAuth while a noncurrent preview remains blocked", async () => {
  const fetcher = async (url) => htmlResponse(String(url) === "https://jest.com/g/riddle-q" ? publicFrame : "<html></html>");
  assert.equal((await verifyDeployment({...event, release: "riddle-quest@october"}, {}, fetcher)).allowed, true);
  assert.equal((await verifyDeployment(event, {}, fetcher)).reason, "jest_release_not_current_preview_authority_unavailable");
});

test("sanitized events include deployment and application frames while dropping player and request data", () => {
  const sanitized = sanitizeEvent({eventID: "id", dateCreated: timestamp, release: {version: event.release}, tags: [{key: "runtime", value: event.runtime}, {key: "environment", value: "production"}, {key: "email", value: "private"}], user: {email: "private"}, request: {url: "private"}, entries: [{type: "breadcrumbs", data: {values: ["private"]}}, {type: "exception", data: {values: [{type: "Error", value: "failure", stacktrace: {frames: [{inApp: true, filename: "app.js?token=private", function: "init", lineNo: 12, vars: {token: "private"}}, {filename: "third-party.js"}]}}]}}]});
  assert.equal(sanitized.release, event.release);
  assert.deepEqual(sanitized.frames, [{filename: "app.js", function: "init", line: 12}]);
  assert.doesNotMatch(JSON.stringify(sanitized), /private|breadcrumbs|user|request/u);
});

test("tickets reject tampering and expiry; claim identity changes across deployments and occurrence days", () => {
  const fingerprint = "a".repeat(64);
  const branch = repairBranch("123", fingerprint, timestamp);
  const context = {issueId: "123", event, fingerprint, base: "main", baseSha: "b".repeat(40), claimSha: "c".repeat(40), branch};
  const now = Date.parse(timestamp);
  const ticket = signTicket(context, "secret", now);
  assert.equal(readTicket(ticket, "secret", now).branch, branch);
  const legacyTicket = signTicket({...context, base: "jest"}, "secret", now);
  assert.equal(readTicket(legacyTicket, "secret", now), null);
  assert.equal(readTicket(legacyTicket, "secret", now, "reconcile"), null);
  assert.equal(readTicket(ticket, "wrong", now), null);
  assert.equal(readTicket(`${ticket}x`, "secret", now), null);
  assert.equal(readTicket(ticket, "secret", now + 4 * 60 * 60 * 1000), null);
  assert.equal(readTicket(ticket, "secret", now + 10 * 60 * 60 * 1000, "reconcile").branch, branch);
  assert.equal(readTicket(ticket, "secret", now + 12 * 60 * 60 * 1000, "reconcile"), null);
  assert.notEqual(branch, repairBranch("123", "c".repeat(64), timestamp));
  assert.notEqual(branch, repairBranch("123", fingerprint, "2026-11-23T00:01:00Z"));
});

test("Google authority requests only inventory metadata using a dedicated service account", async () => {
  const {privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
  const requests = [];
  const result = await currentFunctions({SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT: JSON.stringify({type: "service_account", client_email: "reader@example.test", private_key: privateKey.export({type: "pkcs8", format: "pem"})})}, async (url, options) => {
    requests.push({url: String(url), options});
    return Response.json(requests.length === 1 ? {access_token: "access"} : {functions});
  });
  assert.equal(result[0].serviceConfig.revision, backendEvent.release);
  const assertion = requests[0].options.body.get("assertion");
  assert.equal(JSON.parse(Buffer.from(assertion.split(".")[1], "base64url")).scope, "https://www.googleapis.com/auth/cloud-platform");
  assert.match(requests[1].url, /^https:\/\/cloudfunctions.googleapis.com\/v2\/projects\/riddle-quest-ec2b2\//u);
  assert.doesNotMatch(new URL(requests[1].url).searchParams.get("fields"), /environmentVariables|secret/u);
});

test("Jest authority uses only its documented read-only MCP tool and its own OAuth token", async () => {
  const requests = [];
  const inventory = await currentJestVersions({JEST_MCP_ACCESS_TOKEN: "dedicated-oauth"}, async (url, options) => {
    const request = JSON.parse(options.body);
    requests.push({url, request, headers: {...options.headers}});
    if (request.method === "initialize") return Response.json({jsonrpc: "2.0", id: 1, result: {protocolVersion: "2025-03-26"}}, {headers: {"mcp-session-id": "session"}});
    if (request.method === "notifications/initialized") return new Response(null, {status: 202});
    return Response.json({jsonrpc: "2.0", id: 2, result: {content: [{type: "text", text: JSON.stringify(versions)}]}});
  });
  assert.equal(inventory[0].isActive, true);
  assert.equal(requests[2].request.params.name, "list_game_versions");
  assert.equal(requests[2].headers["Mcp-Session-Id"], "session");
  assert.ok(requests.every((request) => request.url === "https://jest.com/mcp"));
});

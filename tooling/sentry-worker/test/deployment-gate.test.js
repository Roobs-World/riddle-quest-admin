import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import test from "node:test";
import {currentFunctions, evaluateDeployment, readTicket, repairBranch, sanitizeEvent, signTicket, verifyDeployment} from "../worker/deployment-gate.mjs";

const timestamp = "2026-11-22T23:20:00Z";
const event = {eventId: "event", runtime: "firebase-functions", environment: "production", release: "dailychallengescheduler-00056-kax", timestamp};
const functions = [{name: "projects/riddle-quest-ec2b2/locations/us-central1/functions/dailyChallengeScheduler", state: "ACTIVE", serviceConfig: {revision: "dailychallengescheduler-00056-kax", allTrafficOnLatestRevision: true}, buildConfig: {sourceProvenance: {resolvedStorageSource: {generation: "123"}}}}];
const backendEvent = {...event, runtime: "firebase-functions", release: "dailychallengescheduler-00056-kax"};

test("removed and unsupported browser runtimes fail closed without provider requests", async () => {
  const requests = [];
  for (const runtime of ["jest-html5", "facebook-instant", "unknown"]) {
    const removedEvent = {...event, runtime};
    assert.equal(evaluateDeployment(removedEvent, functions).reason, "runtime_out_of_scope");
    assert.deepEqual(await verifyDeployment(removedEvent, {
      JEST_MCP_ACCESS_TOKEN: "retired-credential", SENTRY_WORKER_JEST_PREVIEW_IDS: "preview",
    }, async (...args) => {requests.push(args); throw new Error("must not contact provider");}), {
      allowed: false, reason: "runtime_out_of_scope",
    });
  }
  assert.deepEqual(requests, []);
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
  assert.deepEqual(await verifyDeployment(backendEvent, {}, noNetwork), {allowed: false, reason: "deployment_authority_unavailable", detail: "functions_authority_not_configured"});
  const {privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
  const env = {SENTRY_WORKER_GOOGLE_SERVICE_ACCOUNT: JSON.stringify({type: "service_account", client_email: "reader@example.test", private_key: privateKey.export({type: "pkcs8", format: "pem"})})};
  const failed = await verifyDeployment(backendEvent, env, () => {throw new Error("secret unexpected private response");});
  assert.deepEqual(failed, {allowed: false, reason: "deployment_authority_unavailable", detail: "authority_request_failed"});
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

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {runInNewContext} = require("node:vm");
const test = require("node:test");

/** Runs the actual operator CLI with isolated SDK dependencies and no network. */
async function invoke(args, rows = [], outcome = "ready", queryFailure = false) {
  /** Captured provider interactions prove project/scope/mutation boundaries. */
  const calls = [];
  /** Captured aggregate-only output and fixed failures. */
  const stdout = [], stderr = [];
  /** Fake query records the SDK's real pagination shape. */
  const query = {
    orderBy: value => {calls.push(["orderBy", value]); return query;},
    limit: value => {calls.push(["limit", value]); return query;},
    startAfter: value => {calls.push(["after", value]); return query;},
    get: async () => {
      if (queryFailure) throw new Error("private-nonce-query-diagnostics");
      return {docs: rows.map(id => ({id})), size: rows.length};
    },
  };
  /** Scope and explicit project must be selected before any preparation. */
  const db = {collection: name => {calls.push(["collection", name]); return query;}};
  /** No global process or real credentials are used. */
  const processStub = {argv: ["node", "facebook-nonce-retention.js", ...args],
    stdout: {write: value => stdout.push(value)}, stderr: {write: value => stderr.push(value)}};
  runInNewContext(readFileSync(join(__dirname, "facebook-nonce-retention.js"), "utf8"), {
    process: processStub,
    require: function isolatedRequire(name) {
      if (name === "../../../../../firebase-functions/scripts/runtime/functions-dependencies.js") return isolatedRequire;
      if (name === "firebase-admin/app") return {initializeApp: config => {calls.push(["initialize", config.projectId]); return {};}};
      if (name === "firebase-admin/firestore") return {getFirestore: () => db, FieldPath: {documentId: () => "__name__"}};
      if (name === "../../../../../firebase-functions/lib/platforms/web/facebook/server/facebookIdentityNonce.js") return {prepareFacebookIdentityNonceRetention: async (_db, id, apply) => {
        calls.push(["prepare", id, apply]);
        if (outcome instanceof Error) throw outcome;
        return outcome;
      }};
      throw new Error("Unexpected dependency");
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return {calls, stdout, stderr, exitCode: processStub.exitCode};
}

test("nonce maintenance stays offline for missing/ambiguous/unknown operator options", async () => {
  for (const args of [[], ["--project"], ["--project", "demo-nonce", "--apply"],
    ["--project", "demo-nonce", "--apply", "--confirm-project", "other-project"],
    ["--project", "demo-nonce", "--project", "other-project"], ["--project", "demo-nonce", "--unknown"],
    ["--project", "demo-nonce", "--page-size", "0"], ["--project", "demo-nonce", "--page-size", "101"],
    ["--project", "demo-nonce", "--after", "private-player-id"], ["--project", "demo-nonce", "--now", "1"]]) {
    /** Invalid input must never initialize or query the Admin SDK. */
    const result = await invoke(args);
    assert.equal(result.exitCode, 1); assert.deepEqual(result.calls, []);
  }
});

test("defaults to dry-run and pages only the temporary Facebook nonce collection", async () => {
  /** One row plus one lookahead proves bounded continuation. */
  const cursor = "a".repeat(64), next = "b".repeat(64);
  /** Real CLI chooses the explicit project even with ambient credentials. */
  const result = await invoke(["--project", "demo-nonce", "--page-size", "1", "--after", cursor], [next, "c".repeat(64)]);
  assert.deepEqual(result.calls.slice(0, 5), [["initialize", "demo-nonce"], ["collection", "facebookIdentityNonces"],
    ["orderBy", "__name__"], ["limit", 2], ["after", cursor]]);
  assert.deepEqual(result.calls.filter(call => call[0] === "prepare"), [["prepare", next, false]]);
  assert.deepEqual(JSON.parse(result.stdout[0]), {mode: "dry-run", scanned: 1, ready: 1, alreadyReady: 0,
    missing: 0, invalid: 0, complete: false, nextNonceCursor: next});
});

test("applies only the confirmed project and accepts completed/missing/idempotent rows", async () => {
  for (const outcome of ["ready", "already-ready", "missing"]) {
    /** Original issue deadlines are prepared inside the library, never nominated by the CLI. */
    const result = await invoke(["--project", "demo-nonce", "--apply", "--confirm-project", "demo-nonce"], ["a".repeat(64)], outcome);
    assert.deepEqual(result.calls.filter(call => call[0] === "prepare"), [["prepare", "a".repeat(64), true]]);
    assert.equal(JSON.parse(result.stdout[0]).complete, true);
    assert.equal(result.exitCode, undefined);
  }
});

test("malformed rows or outcomes fail the page without exposing provider diagnostics", async () => {
  for (const outcome of [new Error("private-player-diagnostics"), "unexpected"]) {
    /** A failed page cannot be used as completion evidence. */
    const result = await invoke(["--project", "demo-nonce"], ["a".repeat(64)], outcome);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stdout[0]).complete, false);
    assert.equal(JSON.parse(result.stdout[0]).invalid, 1);
    assert(!result.stdout.join("").includes("private-player"));
  }
});

test("query errors return a fixed failure instead of false completion or private details", async () => {
  /** Transport failure occurs before any per-row mutation request. */
  const result = await invoke(["--project", "demo-nonce"], [], "ready", true);
  assert.equal(result.exitCode, 1); assert.deepEqual(result.stdout, []);
  assert(!result.stderr.join("").includes("private-nonce"));
  assert.equal(result.calls.filter(call => call[0] === "prepare").length, 0);
});

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {runInNewContext} = require("node:vm");
const test = require("node:test");

/** Executes the actual maintenance CLI against isolated SDK doubles. */
async function invoke(args, rows = [], outcome = {status: "ready", bindingUpdates: 1}) {
  /** Operational interactions under test, excluding any actual network. */
  const calls = [];
  /** Captured aggregate output. */
  const stdout = [];
  /** Captured bounded failure output. */
  const stderr = [];
  /** Records only SDK query shape, never executes a real query. */
  const query = {
    orderBy: value => {calls.push(["orderBy", value]); return query;},
    limit: value => {calls.push(["limit", value]); return query;},
    startAfter: value => {calls.push(["after", value]); return query;},
    get: async () => ({docs: rows.map(id => ({id})), size: rows.length}),
  };
  /** Isolated explicit project selection. */
  const db = {collection: name => {calls.push(["collection", name]); return query;}};
  /** Captured process status. */
  const processStub = {argv: ["node", "facebook-referral-retention.js", ...args], stdout: {write: value => stdout.push(value)},
    stderr: {write: value => stderr.push(value)}};
  runInNewContext(readFileSync(join(__dirname, "facebook-referral-retention.js"), "utf8"), {
    process: processStub,
    require: function isolatedRequire(name) {
      if (name === "../../../../../firebase-functions/scripts/runtime/functions-dependencies.js") return isolatedRequire;
      if (name === "firebase-admin/app") return {initializeApp: config => {calls.push(["initialize", config.projectId]); return {};}};
      if (name === "firebase-admin/firestore") return {getFirestore: () => db, FieldPath: {documentId: () => "__name__"}};
      if (name === "../../../../../firebase-functions/lib/platforms/web/facebook/server/facebookReferralRetention.js") return {prepareFacebookReferralTokenRetention: async (_db, id, apply) => {
        calls.push(["prepare", id, apply]); if (outcome instanceof Error) throw outcome; return outcome;
      }};
      throw new Error("Unexpected dependency");
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return {calls, stdout, stderr, exitCode: processStub.exitCode};
}

test("referral retention stays offline without an explicit project or exact apply confirmation", async () => {
  for (const args of [[], ["--project", "demo-retention", "--apply"], ["--project", "demo-retention", "--apply", "--confirm-project", "other-project"],
    ["--project", "demo-retention", "--page-size", "101"], ["--project", "demo-retention", "--after", "raw-player-id"]]) {
    /** SDK initialization must not occur on invalid operator input. */
    const result = await invoke(args);
    assert.equal(result.exitCode, 1); assert.deepEqual(result.calls, []);
  }
});
test("defaults to dry-run and pages exclusively by an opaque token hash", async () => {
  /** Two rows prove the one-row page is incomplete. */
  const result = await invoke(["--project", "demo-retention", "--page-size", "1"], ["a".repeat(64), "b".repeat(64)]);
  assert(result.calls.some(call => call[0] === "limit" && call[1] === 2));
  assert.deepEqual(result.calls.filter(call => call[0] === "prepare"), [["prepare", "a".repeat(64), false]]);
  assert.equal(JSON.parse(result.stdout[0]).complete, false);
  assert.equal(JSON.parse(result.stdout[0]).nextTokenCursor, "a".repeat(64));
});
test("writes only after matching project confirmation and reports failures without provider details", async () => {
  /** Explicitly confirmed project is passed to the real CLI's authority boundary. */
  const result = await invoke(["--project", "demo-retention", "--apply", "--confirm-project", "demo-retention"], ["a".repeat(64)]);
  assert.deepEqual(result.calls.filter(call => call[0] === "prepare"), [["prepare", "a".repeat(64), true]]);
  /** Simulated provider diagnostics must not enter maintenance output. */
  const failed = await invoke(["--project", "demo-retention"], ["a".repeat(64)], new Error("private-player-diagnostics"));
  assert.equal(failed.exitCode, 1); assert.equal(JSON.parse(failed.stdout[0]).complete, false);
  assert(!failed.stdout.join("").includes("private-player"));
});
test("does not claim completion for oversized token fan-out", async () => {
  /** Bounded migration requires explicit resolution of an oversized legacy token. */
  const result = await invoke(["--project", "demo-retention"], ["a".repeat(64)], {status: "too-many-bindings", bindingUpdates: 0});
  assert.equal(result.exitCode, 1); assert.equal(JSON.parse(result.stdout[0]).complete, false);
});

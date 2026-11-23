const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {runInNewContext} = require("node:vm");
const test = require("node:test");

/** Runs the actual CLI with isolated SDK/maintenance doubles, never a live database. */
async function invoke(args, outcome = {scanned: 0, invalid: 0, complete: true}) {
  /** Explicit authority calls recorded by this test. */
  const calls = [];
  /** Aggregate output only. */
  const stdout = [];
  /** Sanitized failure output. */
  const stderr = [];
  /** VM process has no real credentials or shell side effects. */
  const stub = {argv: ["node", "reddit-profile-retention.js", ...args], stdout: {write: x => stdout.push(x)}, stderr: {write: x => stderr.push(x)}};
  runInNewContext(readFileSync(join(__dirname, "reddit-profile-retention.js"), "utf8"), {
    process: stub, Date: {now: () => 1_700_000_000_000},
    require: function isolatedRequire(name) {
      if (name === "../../../../../firebase-functions/scripts/functions-dependencies.js") return isolatedRequire;
      if (name === "firebase-admin/app") return {initializeApp: options => {calls.push(["project", options.projectId]); return {};}};
      if (name === "firebase-admin/firestore") return {getFirestore: () => ({})};
      if (name === "../../../../../firebase-functions/lib/platforms/web/reddit/server/redditProfileRetention.js") return {purgeExpiredRedditProfilePage: async (_db, now, apply, limit) => {
        calls.push(["page", now, apply, limit]); if (outcome instanceof Error) throw outcome; return outcome;
      }};
      throw new Error("unexpected-dependency");
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return {calls, stdout, stderr, exitCode: stub.exitCode};
}

test("requires an explicit project and rejects malformed/unknown/duplicate flags offline", async () => {
  for (const args of [[], ["--project"], ["--project", "demo-profile", "--apply"],
    ["--project", "demo-profile", "--apply", "--confirm-project", "other"], ["--project", "demo-profile", "--limit", "51"],
    ["--project", "demo-profile", "--now-ms", "999999999999999"], ["--project", "demo-profile", "--project", "other"]]) {
    /** Invalid input cannot initialize the SDK or choose a deletion cutoff. */
    const result = await invoke(args);
    assert.equal(result.exitCode, 1); assert.deepEqual(result.calls, []);
  }
});

test("defaults to dry run using only the current server clock and fixed page limit", async () => {
  /** No writes are authorized by ambient credentials or the explicit project alone. */
  const result = await invoke(["--project", "demo-profile-retention"]);
  assert.deepEqual(result.calls, [["project", "demo-profile-retention"], ["page", 1_700_000_000_000, false, 50]]);
  assert.equal(JSON.parse(result.stdout[0]).mode, "dry-run");
});

test("applies only with matching confirmation and retains incomplete page evidence", async () => {
  /** Oversized/corrupt state must remain visible as aggregate failure. */
  const result = await invoke(["--project", "demo-profile", "--apply", "--confirm-project", "demo-profile", "--limit", "2"],
    {scanned: 2, invalid: 1, complete: false});
  assert.deepEqual(result.calls[1], ["page", 1_700_000_000_000, true, 2]);
  assert.equal(result.exitCode, 1); assert.equal(JSON.parse(result.stdout[0]).complete, false);
});

test("provider failures are sanitized without echoing profile/identity identifiers", async () => {
  /** Private storage diagnostics may never be printed by maintenance. */
  const result = await invoke(["--project", "demo-profile"], new Error("private-profile-and-member-id"));
  assert.equal(result.exitCode, 1); assert.equal(result.stdout.length, 0);
  assert(!result.stderr.join("").includes("private-profile"));
});

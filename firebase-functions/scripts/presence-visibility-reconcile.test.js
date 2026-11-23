/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {createHash} = require("node:crypto");
const {join} = require("node:path");
const {runInNewContext} = require("node:vm");
const test = require("node:test");

/** Synthetic inventory contains no provider identity supplied to the source authority. */
const inventory = [
  {viewerUserId: "viewer-1", targetUserId: "target-1"},
  {viewerUserId: "viewer-2", targetUserId: "target-2"},
];
/** Actual script input has a stable scope hash for the apply guard. */
const bytes = Buffer.from(JSON.stringify(inventory)),
  digest = createHash("sha256").update(bytes).digest("hex");
/** Explicit project and approved first-party database are independently required. */
const scope = [
  "--project",
  "riddle-quest-ec2b2",
  "--database-url",
  "https://riddle-quest-ec2b2-default-rtdb.europe-west1.firebasedatabase.app",
  "--input",
  "/private/inventory.json",
];

/** Runs the real parser and CLI with isolated storage doubles, never production SDKs. */
async function invoke(args, options = {}) {
  const calls = [],
    stdout = [],
    stderr = [];
  const stub = {
    argv: ["node", "presence-visibility-reconcile.js", ...args],
    env: options.env ?? {},
    stdout: {write: (value) => stdout.push(value)},
    stderr: {write: (value) => stderr.push(value)},
  };
  const input = options.bytes ?? bytes;
  runInNewContext(readFileSync(join(__dirname, "presence-visibility-reconcile.js"), "utf8"), {
    process: stub,
    URL,
    require: (name) => {
      if (name === "node:fs")
        return {statSync: () => ({isFile: () => true, size: input.length}), readFileSync: () => input};
      if (name === "node:crypto" || name === "node:path") return require(name);
      if (name === "firebase-admin/app")
        return {
          initializeApp: (config) => {
            calls.push(["init", config]);
            return {};
          },
          deleteApp: async () => {
            calls.push(["cleanup"]);
          },
        };
      if (name === "firebase-admin/firestore") return {getFirestore: () => ({})};
      if (name === "firebase-admin/database") return {getDatabase: () => ({})};
      if (name === "../lib/firebase-functions/src/presence/presenceVisibilityReconciliation.js")
        return {
          reconcilePresenceVisibilityPage: async (pairs, _db, _database, apply) => {
            calls.push(["page", JSON.parse(JSON.stringify(pairs)), apply]);
            if (options.failure) throw new Error("private-player-secret");
            return (
              options.result ?? {
                processed: pairs.length,
                legacy: pairs.length,
                versioned: 0,
                missing: 0,
                invalid: 0,
                refreshed: apply ? pairs.length : 0,
                deletedOwnerEdgesRemoved: 0,
                busy: false,
              }
            );
          },
        };
      throw new Error("unexpected-dependency");
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return {calls, stdout, stderr, exitCode: stub.exitCode};
}

test("invalid flags, input scopes and project/database mismatches fail before SDK initialization", async () => {
  for (const args of [
    [],
    scope.slice(0, 2),
    [...scope, "--limit", "21"],
    [...scope, "--offset", "3"],
    [...scope, "--offset", "-1"],
    [...scope, "--now-ms", "9999"],
    [...scope, "--project", "other-project"],
    scope.map((x) => (x.startsWith("https:") ? "https://another-project.firebaseio.com" : x)),
    scope.map((x) => (x.startsWith("https:") ? "https://riddle-quest-ec2b2.firebaseio.com/other" : x)),
    scope.map((x) => (x.startsWith("https:") ? "https://riddle-quest-ec2b2.firebaseio.com@evil.example/" : x)),
    scope.map((x) => (x === "/private/inventory.json" ? "relative.json" : x)),
    [...scope, "--apply"],
    [...scope, "--apply", "--confirm-project", "riddle-quest-ec2b2"],
    [...scope, "--apply", "--confirm-project", "wrong-project", "--expect-sha256", digest],
  ]) {
    const result = await invoke(args);
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("the full inventory is validated offline before even the first valid page can apply", async () => {
  for (const entries of [
    [...inventory, {...inventory[0], allowed: true}],
    [...inventory, {viewerUserId: "../escape", targetUserId: "target"}],
    [inventory[0], inventory[0]],
    [{viewerUserId: "same", targetUserId: "same"}],
    Array(5001).fill(inventory[0]),
  ]) {
    const result = await invoke(scope, {bytes: Buffer.from(JSON.stringify(entries))});
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("preview defaults to a bounded read-only page and reports scope without player IDs", async () => {
  const result = await invoke([...scope, "--limit", "1"]),
    summary = JSON.parse(result.stdout[0]);
  assert.equal(result.calls[1][2], false);
  assert.equal(result.calls[1][1].length, 1);
  assert.equal(summary.inputSha256, digest);
  assert.equal(summary.nextOffset, 1);
  assert.equal(summary.pageComplete, true);
  assert.equal(summary.reachedInventoryEnd, false);
  assert.equal(summary.globalCoverageVerified, false);
  assert(!result.stdout.join("").includes("viewer-1"));
  assert(!result.stdout.join("").includes("target-1"));
});

test("apply requires the exact reviewed inventory hash and resumes only its requested page", async () => {
  const result = await invoke([
    ...scope,
    "--apply",
    "--confirm-project",
    "riddle-quest-ec2b2",
    "--expect-sha256",
    digest,
    "--offset",
    "1",
  ]);
  assert.deepEqual(result.calls[1], ["page", [inventory[1]], true]);
  const summary = JSON.parse(result.stdout[0]);
  assert.equal(summary.nextOffset, 2);
  assert.equal(summary.reachedInventoryEnd, true);
  assert.equal(summary.globalCoverageVerified, false);
  const changed = await invoke(
    [...scope, "--apply", "--confirm-project", "riddle-quest-ec2b2", "--expect-sha256", digest],
    {bytes: Buffer.from("[]")},
  );
  assert.equal(changed.exitCode, 1);
  assert.deepEqual(changed.calls, []);
});

test("both private loopback demo services are required when either emulator is selected", async () => {
  for (const env of [
    {FIRESTORE_EMULATOR_HOST: "127.0.0.1:28399"},
    {FIRESTORE_EMULATOR_HOST: "remote:28399", FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:28300"},
    {FIRESTORE_EMULATOR_HOST: "127.0.0.1:28399", FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:28300"},
  ]) {
    const result = await invoke(scope, {env});
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.calls, []);
  }
  const demoScope = scope.map((value) => value.replaceAll("riddle-quest-ec2b2", "demo-presence-reconcile"));
  const result = await invoke(demoScope, {
    env: {FIRESTORE_EMULATOR_HOST: "127.0.0.1:28399", FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:28300"},
  });
  assert.equal(result.exitCode, undefined);
  assert.equal(result.calls[0][1].projectId, "demo-presence-reconcile");
});

test("a busy owner does not advance the unapplied cursor and failures expose no private diagnostics", async () => {
  const busy = await invoke(scope, {
    result: {
      processed: 0,
      legacy: 2,
      versioned: 0,
      missing: 0,
      invalid: 0,
      refreshed: 0,
      deletedOwnerEdgesRemoved: 0,
      busy: true,
    },
  });
  assert.equal(busy.exitCode, 1);
  assert.equal(JSON.parse(busy.stdout[0]).nextOffset, 0);
  const failed = await invoke(scope, {failure: true});
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.stdout.length, 0);
  assert(!failed.stderr.join("").includes("private-player"));
  assert.deepEqual(failed.calls.at(-1), ["cleanup"]);
});

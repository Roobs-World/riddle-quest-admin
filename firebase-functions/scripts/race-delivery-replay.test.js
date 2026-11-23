/* eslint-disable @typescript-eslint/no-require-imports -- Exercises the CommonJS operator command with isolated dependencies. */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "races/race-delivery-replay.js"), "utf8");

async function run(args, failure) {
  const calls = [];
  const stdout = [];
  const stderr = [];
  const database = {};
  const processStub = {argv: ["node", "race-delivery-replay.js", ...args], stdout: {write: text => stdout.push(text)}, stderr: {write: text => stderr.push(text)}};
  vm.runInNewContext(source, {
    process: processStub,
    require(name) {
      if (name === "firebase-admin/app") return {initializeApp: value => calls.push(["initialize", value])};
      if (name === "firebase-admin/firestore") return {getFirestore: () => database};
      if (name === "../../lib/firebase-functions/src/race/delivery/raceDeliveryRecovery") return {replayRaceDelivery: async (...values) => {
        calls.push(["replay", ...values]);
        if (failure) throw failure;
        return !values[4].dryRun;
      }};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return {calls, stdout, stderr, exitCode: processStub.exitCode};
}

const target = ["--project", "demo-riddle-quest-multiplayer", "--collection", "raceSettlementOutbox", "--event", "run-1"];

test("defaults to validation only and reports the exact target", async () => {
  const result = await run(target);
  assert.equal(result.exitCode, undefined);
  assert.equal(result.calls[1][5].dryRun, true);
  assert.deepEqual(JSON.parse(result.stdout[0]), {projectId: "demo-riddle-quest-multiplayer", collection: "raceSettlementOutbox",
    eventId: "run-1", dryRun: true, validated: true, delivered: false});
});

test("requires matching project confirmation before initializing Firebase", async () => {
  for (const extra of [["--apply"], ["--apply", "--confirm-project", "different-project"]]) {
    const result = await run([...target, ...extra]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.calls.length, 0);
    assert.match(result.stderr[0], /confirm-project/);
  }
});

test("allows explicit application to either supported queue", async () => {
  for (const collection of ["raceSettlementOutbox", "racePerformanceOutbox"]) {
    const result = await run(["--project", "demo-test", "--collection", collection, "--event", "run-1", "--apply", "--confirm-project", "demo-test"]);
    assert.equal(result.calls[1][5].dryRun, false);
    assert.equal(JSON.parse(result.stdout[0]).delivered, true);
  }
});

test("rejects missing targets and arbitrary collections without contacting Firebase", async () => {
  for (const args of [[], ["--project", "demo-test"], ["--project", "demo-test", "--collection", "users", "--event", "run-1"]]) {
    const result = await run(args);
    assert.equal(result.exitCode, 1);
    assert.equal(result.calls.length, 0);
  }
});

test("reports validation failure without success output or stack traces", async () => {
  const result = await run(target, new Error("Repaired race delivery does not match its canonical source."));
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout.length, 0);
  assert.deepEqual(result.stderr, ["Repaired race delivery does not match its canonical source.\n"]);
});

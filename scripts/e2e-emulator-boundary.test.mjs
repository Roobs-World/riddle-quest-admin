import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import vm from "node:vm";

/** Existing setup script whose environment boundary is exercised in isolation. */
const source = readFileSync(new URL("../firebase-functions/config/testing/emulator-environment.cjs", import.meta.url), "utf8");

/** Runs the real setup with a fake deployment dotenv loader, without credentials or network access. */
function runSetup(env) {
  /** Records actual dotenv invocations. */
  const calls = [];
  /** Provides the hermetic JavaScript environment for the setup. */
  const sandbox = {
    process: {env: {...env}},
    __dirname: "/test/functions",
    console: {log() {}, error() {}, warn() {}, info() {}},
    require(name) {
      assert.equal(name, "dotenv");
      return {config(options) {
        calls.push(options);
        sandbox.process.env.GCLOUD_PROJECT = "deployment-project";
      }};
    },
  };
  sandbox.global = sandbox;
  vm.runInNewContext(source, sandbox);
  return {env: sandbox.process.env, calls};
}

test("local demo emulator setup cannot be redirected by deployment dotenv", () => {
  /** Matches the canonical Firebase emulator command's real environment. */
  const result = runSetup({GCLOUD_PROJECT: "demo-riddle-quest-e2e", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"});
  assert.equal(result.env.GCLOUD_PROJECT, "demo-riddle-quest-e2e");
  assert.equal(result.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  assert.equal(result.calls.length, 0);
});

test("ordinary unit setup retains its existing dotenv behavior", () => {
  /** A unit test has no externally launched demo emulator. */
  const result = runSetup({});
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].override, true);
  assert.equal(result.env.GCLOUD_PROJECT, "deployment-project");
});

test("the demo shortcut requires an explicit local emulator endpoint", () => {
  /** A demo project name alone cannot bypass ordinary setup. */
  const result = runSetup({GCLOUD_PROJECT: "demo-riddle-quest-e2e", FIRESTORE_EMULATOR_HOST: "remote.example:8080"});
  assert.equal(result.calls.length, 1);
});

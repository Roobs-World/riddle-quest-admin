import assert from "node:assert/strict";
import test from "node:test";
import {uploadRedditPlaytest} from "./upload-reddit-playtest.mjs";

test("playtest uploads reject missing, stable, malformed, and extra version arguments before running commands", () => {
  for (const args of [[], ["0.0.2"], ["latest"], ["0.0.1.0"], ["0.0.1.01"], ["0.0.1.21", "--public"], ["0.0.1.9007199254740992"]]) {
    assert.throws(() => uploadRedditPlaytest(args, () => assert.fail("must not invoke Devvit")), /explicit prerelease version/u);
  }
});

test("a private upload uses the explicit version and stops after an ambiguous failure without retrying", () => {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, args]);
    return {status: calls.length === 1 ? 0 : 2};
  };
  assert.throws(() => uploadRedditPlaytest(["0.0.1.21"], run), /inspect.*before retrying/u);
  assert.deepEqual(calls, [
    ["pnpm", ["build:package"]],
    ["pnpm", ["exec", "devvit", "upload", "--version", "0.0.1.21"]],
  ]);
});

test("a failed package check prevents uploading", () => {
  let count = 0;
  assert.throws(() => uploadRedditPlaytest(["0.0.1.22"], () => {
    count += 1;
    return {status: 1};
  }), /package validation failed/u);
  assert.equal(count, 1);
});

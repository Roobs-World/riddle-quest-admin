import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import test from "node:test";
import {directRedditReleaseError} from "./direct-release-guard.mjs";

test("direct Devvit mutations fail closed in favor of the immutable release handoff", () => {
  assert.match(directRedditReleaseError("upload").message, /Direct Reddit upload is disabled/u);
  assert.match(directRedditReleaseError("publish").message, /Direct Reddit publish is disabled/u);
  assert.throws(() => directRedditReleaseError("deploy"), /Unknown direct Reddit release action/u);
});

test("the package release mutations exit non-zero without invoking Devvit", () => {
  const repository = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  for (const action of ["upload", "publish"]) {
    const result = spawnSync(
      "pnpm",
      ["--filter", "@qwordly/reddit-app", "run", `release:${action}`],
      {cwd: repository, encoding: "utf8"},
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm release:reddit/u);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(`devvit ${action}`, "u"));
  }
});

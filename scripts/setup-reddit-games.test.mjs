import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";

const path = new URL("./setup-reddit-games.sh", import.meta.url);

test("Reddit setup wizard covers every human gate without persisting secrets", async () => {
  const [source, metadata] = await Promise.all([readFile(path, "utf8"), stat(path)]);
  assert.match(source, /TOTAL_STAGES=8/u);
  assert.equal((source.match(/^stage "/gmu) ?? []).length, 8);
  assert.ok((metadata.mode & 0o111) !== 0, "wizard must be executable");
  for (const required of [
    "devvit whoami", "devvit login", "https://www.reddit.com/subreddits/create", "https://developers.reddit.com/",
    "functions:secrets:set REDDIT_GATEWAY_SECRET", "functions:secrets:get REDDIT_UID_SECRET",
    "settings set redditGatewaySecret", "settings set redditEnvironment", "build:package",
    "audit:performance", "playtest:upload", "preflight:reddit-backend",
    "deploy:reddit-backend", "capture:contract", "validate:contracts", "release:reddit", "release:promotion", "physical iOS and Android",
  ]) assert.ok(source.includes(required), `missing ${required}`);
  assert.doesNotMatch(source, /functions:secrets:set REDDIT_UID_SECRET/u);
  assert.doesNotMatch(source, /ask_secret REDDIT_UID_SECRET/u);
  assert.doesNotMatch(source, /write_env REDDIT_(?:GATEWAY|UID)_SECRET/u);
  assert.doesNotMatch(source, /set_secret REDDIT_(?:GATEWAY|UID)_SECRET/u);
  assert.match(source, /write_env REDDIT_COMMERCE_SANDBOX_ENABLED "1"/u);
  assert.ok(source.indexOf("preflight:reddit-backend") < source.indexOf("deploy:reddit-backend"));
  assert.ok(source.indexOf("playtest:upload") < source.indexOf("settings set redditGatewaySecret"));
  assert.match(source, /bootstrap playtest upload is non-promotable/u);
  assert.ok(source.indexOf("settings set redditGatewaySecret") < source.indexOf("deploy:reddit-backend"));
  assert.ok((source.match(/git status --porcelain/gmu) ?? []).length >= 2);
  assert.match(source, /immutable production candidate requires one reviewed commit/u);
  assert.match(source, /env -u DEBUG -u FIREBASE_DEBUG_MODE/u);
  assert.match(source, /settings set redditGatewaySecret >\/dev\/null 2>&1/u);
  assert.match(source, /git status --porcelain/u);
  assert.match(source, /exact-byte Devvit adapter/u);
  assert.match(source, /without claiming upload or publication/u);
});

async function secretStage(context, mode) {
  const directory = await mkdtemp(join(tmpdir(), "rq-reddit-secret-stage-"));
  context.after(() => rm(directory, {recursive: true, force: true}));
  const callsPath = join(directory, "calls.txt");
  await writeFile(callsPath, "");
  await writeFile(join(directory, "pnpm"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$RQ_TEST_CALLS"
if [[ "$*" == *"functions:secrets:get REDDIT_UID_SECRET"* && "$RQ_TEST_MODE" == "metadata-failure" ]]; then
  printf 'private-provider-diagnostic' >&2
  exit 1
fi
if [[ "$*" == *"functions:secrets:set"* || "$*" == *"settings set"* ]]; then cat >/dev/null; fi
`, {mode: 0o700});
  const source = await readFile(path, "utf8");
  const section = source.split("# BEGIN guarded Reddit secrets\n")[1]?.split("# END guarded Reddit secrets")[0];
  assert.ok(section, "must run the actual guarded secret stage");
  const goodSecret = Buffer.alloc(32, 73).toString("base64");
  const script = `set -euo pipefail
say() { printf '%s\\n' "$1"; }
warn() { printf '%s\\n' "$1"; }
step() { :; }
open_url() { :; }
confirm() { [[ "$RQ_TEST_MODE" != "confirmation-denied" ]]; }
ask_secret() { printf 'secret-input-requested\\n'; printf -v "$1" '%s' "$RQ_TEST_SECRET"; }
${section}`;
  const result = spawnSync("bash", ["-c", script], {encoding: "utf8", timeout: 5000,
    env: {...process.env, PATH: `${directory}:${process.env.PATH}`, RQ_TEST_CALLS: callsPath,
      RQ_TEST_MODE: mode, RQ_TEST_SECRET: mode === "invalid-gateway" ? "short" : goodSecret}});
  assert.equal(result.error, undefined);
  assert.doesNotMatch(result.stdout + result.stderr, /private-provider-diagnostic/);
  assert.ok(!(result.stdout + result.stderr).includes(goodSecret), "secret must remain hidden");
  return {result, calls: (await readFile(callsPath, "utf8")).trim().split("\n").filter(Boolean)};
}

test("the real secret stage preserves the UID key and writes only coordinated gateway/settings", async context => {
  const {result, calls} = await secretStage(context, "success");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 4);
  assert.match(calls[0], /functions:secrets:get REDDIT_UID_SECRET --project riddle-quest-ec2b2/);
  assert.match(calls[1], /functions:secrets:set REDDIT_GATEWAY_SECRET --project riddle-quest-ec2b2 --data-file=-/);
  assert.match(calls[2], /settings set redditGatewaySecret/);
  assert.match(calls[3], /settings set redditEnvironment/);
  assert.ok(calls.every(call => !call.includes("functions:secrets:set REDDIT_UID_SECRET")));
});

test("unavailable UID metadata or unconfirmed existing key stops before secret entry or mutation", async context => {
  for (const mode of ["metadata-failure", "confirmation-denied"]) {
    const {result, calls} = await secretStage(context, mode);
    assert.equal(result.status, 1);
    assert.equal(calls.length, 1);
    assert.ok(!result.stdout.includes("secret-input-requested"));
  }
});

test("an invalid gateway secret cannot mutate Firebase or Devvit settings", async context => {
  const {result, calls} = await secretStage(context, "invalid-gateway");
  assert.equal(result.status, 1);
  assert.equal(calls.length, 1);
});

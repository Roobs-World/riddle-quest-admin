import assert from "node:assert/strict";
import {readFile, stat} from "node:fs/promises";
import test from "node:test";

const path = new URL("./setup-reddit-games.sh", import.meta.url);

test("Reddit setup wizard covers every human gate without persisting secrets", async () => {
  const [source, metadata] = await Promise.all([readFile(path, "utf8"), stat(path)]);
  assert.match(source, /TOTAL_STAGES=8/u);
  assert.equal((source.match(/^stage "/gmu) ?? []).length, 8);
  assert.ok((metadata.mode & 0o111) !== 0, "wizard must be executable");
  for (const required of [
    "devvit whoami", "devvit login", "https://www.reddit.com/subreddits/create", "https://developers.reddit.com/",
    "functions:secrets:set REDDIT_GATEWAY_SECRET", "functions:secrets:set REDDIT_UID_SECRET",
    "settings set redditGatewaySecret", "settings set redditEnvironment", "build:package",
    "audit:performance", "playtest:upload", "preflight:reddit-backend",
    "deploy:reddit-backend", "capture:contract", "validate:contracts", "release:reddit", "release:promotion", "physical iOS and Android",
  ]) assert.ok(source.includes(required), `missing ${required}`);
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

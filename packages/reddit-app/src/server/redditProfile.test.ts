import assert from "node:assert/strict";
import test from "node:test";
import {normalizeRedditAvatar} from "./redditProfile.ts";

test("accepts only HTTPS Reddit-owned avatar delivery hosts", () => {
  assert.equal(
    normalizeRedditAvatar("https://www.redditstatic.com/avatar.png"),
    "https://www.redditstatic.com/avatar.png",
  );
  assert.equal(
    normalizeRedditAvatar("https://styles.redditmedia.com/t5_avatar.png"),
    "https://styles.redditmedia.com/t5_avatar.png",
  );
  for (const value of [
    "http://www.redditstatic.com/avatar.png",
    "https://redditstatic.com.attacker.invalid/avatar.png",
    "https://user:pass@www.redditstatic.com/avatar.png",
    "not a URL",
    "x".repeat(2_049),
    null,
  ])
    assert.equal(normalizeRedditAvatar(value), null);
});

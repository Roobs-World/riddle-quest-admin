import assert from "node:assert/strict";
import test from "node:test";
import {redditCommerceRecoveryKey} from "./redditCommerceRecovery.ts";

test("derives stable isolated opaque recovery keys", () => {
  const secret = "s".repeat(32);
  const key = redditCommerceRecoveryKey("riddle-quest", "t2_User1", secret);
  assert.match(key, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(key, redditCommerceRecoveryKey("riddle-quest", "t2_User1", secret));
  assert.notEqual(key, redditCommerceRecoveryKey("riddle-quest", "t2_User2", secret));
  assert.ok(!key.includes("User1"));
});

test("rejects malformed scope and weak secrets", () => {
  assert.throws(() => redditCommerceRecoveryKey("bad app", "t2_User1", "s".repeat(32)));
  assert.throws(() => redditCommerceRecoveryKey("riddle-quest", "forged", "s".repeat(32)));
  assert.throws(() => redditCommerceRecoveryKey("riddle-quest", "t2_User1", "weak"));
});

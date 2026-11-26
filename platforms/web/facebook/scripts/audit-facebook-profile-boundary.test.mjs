import assert from "node:assert/strict";
import test from "node:test";
import {auditFacebookProfileBoundary} from "./audit-facebook-profile-boundary.mjs";

test("accepts backend source without Meta profile reads", () => {
  assert.deepEqual(auditFacebookProfileBoundary({sources: [{name: "record.ts", source: "const playerId = input.playerId;"}]}), []);
});

test("rejects direct profile reads and persisted Meta profile fields", () => {
  const failures = auditFacebookProfileBoundary({
    sources: [
      {name: "reader.ts", source: "sdk.player.getPhoto()"},
      {name: "record.ts", source: "const facebookPlayerName = input.value"},
    ],
  });
  assert.equal(failures.length, 2);
});

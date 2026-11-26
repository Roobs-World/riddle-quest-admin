import assert from "node:assert/strict";
import test from "node:test";
import {auditFacebookProfileBoundary} from "./audit-facebook-profile-boundary.mjs";

const adapter = "createProfilePictureOverlayViewAsync createProfileNameOverlayViewAsync";

test("accepts provider-owned overlay calls without profile reads", () => {
  assert.deepEqual(auditFacebookProfileBoundary({sources: [], adapterSource: adapter}), []);
});

test("rejects direct profile reads and persisted Meta profile fields", () => {
  const failures = auditFacebookProfileBoundary({
    sources: [
      {name: "reader.ts", source: "sdk.player.getPhoto()"},
      {name: "record.ts", source: "const facebookPlayerName = input.value"},
    ],
    adapterSource: adapter,
  });
  assert.equal(failures.length, 2);
});

test("rejects an adapter that reads profile data or omits an overlay API", () => {
  const failures = auditFacebookProfileBoundary({sources: [], adapterSource: "player.getName()"});
  assert.equal(failures.length, 3);
});

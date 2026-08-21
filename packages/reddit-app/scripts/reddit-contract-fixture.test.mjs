import assert from "node:assert/strict";
import test from "node:test";
import {createRedditContractFixture, sourceDigest, validateRedditContractFixture} from "./reddit-contract-fixture.mjs";

const capturedAt = "2026-08-20T20:00:00.000Z";
const sourceSha256 = "a".repeat(64);

test("redacts credentials, provider IDs, profiles and URL query data", () => {
  const fixture = createRedditContractFixture({type: "payment", capturedAt, sourceSha256, payload: {
    orderId: "order-secret", userId: "t2_abcdef", username: "real_user",
    authorization: "Bearer raw-secret", callback: "https://example.test/hook?token=raw#fragment",
    productId: "riddle_quest_coins_250", status: "PAID", nested: [{postId: "t3_abcdef"}],
  }});
  const serialized = JSON.stringify(fixture);
  for (const forbidden of ["order-secret", "t2_abcdef", "real_user", "raw-secret", "t3_abcdef", "?token", "#fragment"]) {
    assert.equal(serialized.includes(forbidden), false, `fixture retained ${forbidden}`);
  }
  assert.match(serialized, /riddle_quest_coins_250/u);
  assert.equal(validateRedditContractFixture(fixture), fixture);
});

test("rejects unknown types, invalid provenance, residual sensitive values and oversized input", () => {
  assert.throws(() => createRedditContractFixture({type: "chat", capturedAt, sourceSha256, payload: {ok: true}}));
  assert.throws(() => createRedditContractFixture({type: "auth", capturedAt: "today", sourceSha256, payload: {ok: true}}));
  assert.throws(() => validateRedditContractFixture({schemaVersion: 1, platform: "reddit", type: "auth",
    capturedAt, sourceSha256, sanitized: true, payload: {value: "Bearer still-secret"}}), /unsafe/u);
  assert.throws(() => createRedditContractFixture({type: "auth", capturedAt, sourceSha256,
    payload: {value: "x".repeat(300_000)}}), /unsafe/u);
});

test("source digests are stable and byte-sensitive", () => {
  assert.equal(sourceDigest(Buffer.from("fixture")), sourceDigest(Buffer.from("fixture")));
  assert.notEqual(sourceDigest(Buffer.from("fixture")), sourceDigest(Buffer.from("Fixture")));
});

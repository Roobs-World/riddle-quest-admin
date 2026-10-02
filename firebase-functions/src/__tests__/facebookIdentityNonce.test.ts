import {Timestamp} from "firebase-admin/firestore";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createFacebookIdentityNonceRecord, readFacebookIdentityNonceRecord,
  FACEBOOK_NONCE_TTL_MS, FACEBOOK_NONCE_TIMESTAMP_MAX_MS} from "../facebook/facebookIdentityNonce";

/** Canonical server issue time, independent of wall-clock date. */
const NOW = Date.UTC(2026, 9, 1);

/** Minimal deployment field projection used to select the nonce policy. */
type FieldPolicy = {
  /** Exact collection targeted by this field policy. */
  collectionGroup: string;
};

it("issues one fixed logical/physical deadline without a player or raw nonce", () => {
  /** Actual issue helper is also used by the HTTP endpoint. */
  const record = createFacebookIdentityNonceRecord(NOW);
  expect(record).toEqual({createdAtMs: NOW, expiresAtMs: NOW + FACEBOOK_NONCE_TTL_MS,
    expiresAt: Timestamp.fromMillis(NOW + FACEBOOK_NONCE_TTL_MS), consumedAtMs: null});
  expect(readFacebookIdentityNonceRecord(record)).toBe(record);
  expect(createFacebookIdentityNonceRecord(FACEBOOK_NONCE_TIMESTAMP_MAX_MS - FACEBOOK_NONCE_TTL_MS).expiresAt?.toMillis())
    .toBe(FACEBOOK_NONCE_TIMESTAMP_MAX_MS);
});

it.each([-1, NaN, Infinity, NOW + 0.5, Number.MAX_SAFE_INTEGER,
  FACEBOOK_NONCE_TIMESTAMP_MAX_MS - FACEBOOK_NONCE_TTL_MS + 1])("rejects an unsafe issue clock %s", clock => {
  expect(() => createFacebookIdentityNonceRecord(clock)).toThrow("invalid-facebook-nonce-clock");
});

it("retains valid legacy unused and consumed records during TTL rollout", () => {
  /** Old rows have the same numeric deadline and no timestamp. */
  const legacy = {createdAtMs: NOW, expiresAtMs: NOW + FACEBOOK_NONCE_TTL_MS, consumedAtMs: null};
  expect(readFacebookIdentityNonceRecord(legacy)).toBe(legacy);
  /** Receipt data stays bound to the original lifetime. */
  const consumed = {...legacy, consumedAtMs: NOW + 1000, playerIdHash: "a".repeat(64)};
  expect(readFacebookIdentityNonceRecord(consumed)).toBe(consumed);
});

it("rejects contradictory TTL, unsafe windows and corrupt consumed state", () => {
  /** Every malformed state must stay unauthenticatable and out of an automatic backfill. */
  const good = createFacebookIdentityNonceRecord(NOW);
  for (const value of [null, [], {...good, rawPlayerId: "private"}, {...good, expiresAtMs: NOW + 1},
    {...good, expiresAt: null}, {...good, expiresAt: NOW + FACEBOOK_NONCE_TTL_MS},
    {...good, expiresAt: Timestamp.fromMillis(NOW + FACEBOOK_NONCE_TTL_MS + 1)},
    {...good, expiresAt: new Timestamp(Math.floor((NOW + FACEBOOK_NONCE_TTL_MS) / 1000), 1)},
    {...good, consumedAtMs: NOW - 1, playerIdHash: "a".repeat(64)},
    {...good, consumedAtMs: NOW + FACEBOOK_NONCE_TTL_MS, playerIdHash: "a".repeat(64)},
    {...good, consumedAtMs: NOW + 1}, {...good, playerIdHash: "a".repeat(64)},
    {...good, createdAtMs: NaN}]) {
    expect(() => readFacebookIdentityNonceRecord(value)).toThrow("invalid-facebook-nonce-record");
  }
});

it("commits one unindexed TTL policy exclusively for Facebook nonce expiry", () => {
  /** Actual deployment configuration, not an in-test policy replica. */
  const config = JSON.parse(readFileSync(join(__dirname, "../../firestore.indexes.json"), "utf8"));
  expect(config.fieldOverrides.filter((field: FieldPolicy) => field.collectionGroup === "facebookIdentityNonces"))
    .toEqual([{collectionGroup: "facebookIdentityNonces", fieldPath: "expiresAt", ttl: true, indexes: []}]);
});

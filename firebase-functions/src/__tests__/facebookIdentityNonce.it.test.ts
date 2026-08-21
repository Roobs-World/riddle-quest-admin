import {createHash, createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {consumeFacebookIdentityNonce, consumeFacebookRequestQuota} from "../facebook/facebookEndpoints";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const NOW = Date.UTC(2026, 7, 19);
const noncePath = (nonce: string) =>
  `facebookIdentityNonces/${createHash("sha256").update(nonce).digest("hex")}`;
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all([
    db.recursiveDelete(db.collection("facebookIdentityNonces")),
    db.recursiveDelete(db.collection("facebookIdentityRateLimits")),
  ]);
});

afterAll(async () => Promise.all([
  db.recursiveDelete(db.collection("facebookIdentityNonces")),
  db.recursiveDelete(db.collection("facebookIdentityRateLimits")),
]));

it("enforces the 20-request identity quota transactionally across concurrent instances", async () => {
  const secret = "distributed-rate-limit-secret-at-least-32-characters";
  const results = await Promise.all(Array.from({length: 32}, () =>
    consumeFacebookRequestQuota("198.51.100.7", secret, db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(20);
  expect(results.filter((value) => !value)).toHaveLength(12);
  await expect(consumeFacebookRequestQuota("198.51.100.8", secret, db, NOW)).resolves.toBe(true);
  await expect(consumeFacebookRequestQuota("198.51.100.7", secret, db, NOW + 60_000)).resolves.toBe(true);

  const records = await db.collection("facebookIdentityRateLimits").get();
  expect(records.size).toBe(2);
  expect(JSON.stringify(records.docs.map((record) => ({id: record.id, ...record.data()}))))
    .not.toContain("198.51.100");
});

it("rejects a reused distributed quota record whose TTL binding is missing or corrupt", async () => {
  const secret = "distributed-rate-limit-ttl-secret-at-least-32-characters";
  const key = "198.51.100.44";
  const id = createHmac("sha256", secret)
    .update("riddle-quest-facebook-identity-rate-v1\0", "utf8")
    .update(key, "utf8")
    .digest("hex");
  const ref = db.collection("facebookIdentityRateLimits").doc(id);
  await ref.set({count: 1, resetAtMs: NOW + 60_000});
  await expect(consumeFacebookRequestQuota(key, secret, db, NOW))
    .rejects.toThrow("invalid-facebook-rate-limit-record");
  await ref.update({expiresAt: new Date(NOW + 60_000 + 24 * 60 * 60 * 1_000 + 1)});
  await expect(consumeFacebookRequestQuota(key, secret, db, NOW))
    .rejects.toThrow("invalid-facebook-rate-limit-record");
  expect((await ref.get()).data()).toMatchObject({count: 1, resetAtMs: NOW + 60_000});
});

it("atomically consumes one exact nonce once under concurrent replay", async () => {
  const nonce = "concurrent-identity-nonce";
  const playerId = "meta-player-1";
  const ref = db.doc(noncePath(nonce));
  await ref.set({createdAtMs: NOW - 1_000, expiresAtMs: NOW + 299_000, consumedAtMs: null});

  const results = await Promise.all(Array.from({length: 8}, () =>
    consumeFacebookIdentityNonce(nonce, playerId, Math.floor(NOW / 1_000), db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((value) => !value)).toHaveLength(7);
  expect(await consumeFacebookIdentityNonce(nonce, playerId, Math.floor(NOW / 1_000), db, NOW)).toBe(false);

  const stored = (await ref.get()).data();
  expect(stored).toMatchObject({
    consumedAtMs: NOW,
    playerIdHash: createHash("sha256").update(playerId).digest("hex"),
  });
  expect(JSON.stringify(stored)).not.toContain(playerId);
});

it("rejects expired and assertion-time-mismatched nonce records without mutation", async () => {
  const fixtures = [
    {nonce: "expired", createdAtMs: NOW - 300_000, expiresAtMs: NOW},
    {nonce: "issued-before-window", createdAtMs: NOW, expiresAtMs: NOW + 300_000},
    {nonce: "malformed-time", createdAtMs: Number.NaN, expiresAtMs: NOW + 300_000},
  ];
  await Promise.all(fixtures.map((fixture) => db.doc(noncePath(fixture.nonce)).set({
    createdAtMs: fixture.createdAtMs,
    expiresAtMs: fixture.expiresAtMs,
    consumedAtMs: null,
  })));
  await expect(consumeFacebookIdentityNonce(
    "expired", "meta-player-1", Math.floor(NOW / 1_000), db, NOW,
  )).resolves.toBe(false);
  await expect(consumeFacebookIdentityNonce(
    "issued-before-window", "meta-player-1", Math.floor((NOW - 61_000) / 1_000), db, NOW,
  )).resolves.toBe(false);
  await expect(consumeFacebookIdentityNonce(
    "malformed-time", "meta-player-1", Math.floor(NOW / 1_000), db, NOW,
  )).resolves.toBe(false);
  await expect(Promise.all(fixtures.map(async ({nonce}) =>
    (await db.doc(noncePath(nonce)).get()).data()?.consumedAtMs))).resolves.toEqual([null, null, null]);
});

it("rejects malformed and overflow-prone verifier inputs before creating or reading nonce state", async () => {
  const inputs = [
    {nonce: "", playerId: "meta-player-1", issuedAt: Math.floor(NOW / 1_000), now: NOW},
    {nonce: "x".repeat(257), playerId: "meta-player-1", issuedAt: Math.floor(NOW / 1_000), now: NOW},
    {nonce: "bad-player", playerId: "meta player", issuedAt: Math.floor(NOW / 1_000), now: NOW},
    {nonce: "unsafe-issued", playerId: "meta-player-1", issuedAt: Number.MAX_SAFE_INTEGER, now: NOW},
    {
      nonce: "unsafe-now",
      playerId: "meta-player-1",
      issuedAt: Math.floor(NOW / 1_000),
      now: Number.MAX_SAFE_INTEGER,
    },
  ];
  await expect(Promise.all(inputs.map((input) => consumeFacebookIdentityNonce(
    input.nonce, input.playerId, input.issuedAt, db, input.now,
  )))).resolves.toEqual(inputs.map(() => false));
  await expect(Promise.all(inputs.filter(({nonce}) => nonce).map(async ({nonce}) =>
    (await db.doc(noncePath(nonce)).get()).exists))).resolves.toEqual(inputs.filter(({nonce}) => nonce).map(() => false));
});

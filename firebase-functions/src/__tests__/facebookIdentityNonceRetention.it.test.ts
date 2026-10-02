import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {consumeFacebookIdentityNonce} from "../facebook/facebookEndpoints";
import {createFacebookIdentityNonceRecord, prepareFacebookIdentityNonceRetention} from "../facebook/facebookIdentityNonce";

/** Destructive test setup is confined to an explicit demo project in the local emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-riddle-facebook-nonce";
/** Actual Admin SDK database used for transactional behavior. */
let db: FirebaseFirestore.Firestore;
/** Canonical issue/consume clock, independent of asynchronous emulator scheduling. */
const NOW = Date.UTC(2026, 9, 1);
/** Opaque document identity matches the real HTTP nonce issuer. */
const hash = (nonce: string) => createHash("sha256").update(nonce).digest("hex");
/** Legacy schema deliberately omits only physical TTL. */
const legacy = () => ({createdAtMs: NOW - 1000, expiresAtMs: NOW + 299000, consumedAtMs: null});

beforeAll(async () => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("facebook-nonce-tests-require-local-demo-emulator");
  }
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
  await db.recursiveDelete(db.collection("facebookIdentityNonces"));
});
afterAll(async () => {if (db) await db.recursiveDelete(db.collection("facebookIdentityNonces"));});

it("keeps a dry run read-only, then applies the original deadline idempotently", async () => {
  /** No stale scan may nominate another document's expiry. */
  const ref = db.collection("facebookIdentityNonces").doc(hash("migration-unused"));
  await ref.set(legacy());
  await expect(prepareFacebookIdentityNonceRetention(db, ref.id)).resolves.toBe("ready");
  expect((await ref.get()).data()).toEqual(legacy());
  await expect(prepareFacebookIdentityNonceRetention(db, ref.id, true)).resolves.toBe("ready");
  expect((await ref.get()).data()).toEqual({...legacy(), expiresAt: Timestamp.fromMillis(NOW + 299000)});
  await expect(prepareFacebookIdentityNonceRetention(db, ref.id, true)).resolves.toBe("already-ready");
});

it("consumes a new TTL-bearing nonce once across concurrent replay and rejects physical deletion", async () => {
  /** New HTTP issuance uses exactly this record helper. */
  const nonce = "ttl-concurrent-consumption";
  /** Real stored challenge with matching physical/numeric expiry. */
  const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
  await ref.set(createFacebookIdentityNonceRecord(NOW - 1000));
  /** Every contender uses the same signed assertion issue time. */
  const results = await Promise.all(Array.from({length: 8}, () => consumeFacebookIdentityNonce(
    nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await ref.get()).data()).toMatchObject({expiresAtMs: NOW + 299000,
    expiresAt: Timestamp.fromMillis(NOW + 299000), consumedAtMs: NOW,
    playerIdHash: hash("meta-player-nonce-test")});
  await ref.delete();
  await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)).resolves.toBe(false);
  await expect(prepareFacebookIdentityNonceRetention(db, ref.id, true)).resolves.toBe("missing");
  expect((await ref.get()).exists).toBe(false);
});

it("races legacy backfill with nonce consumption without extending or losing its one-use receipt", async () => {
  /** Real transaction contention replaces mocked order assumptions. */
  const nonce = "legacy-backfill-consumption";
  /** Exactly one server-owned document receives both operations. */
  const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
  await ref.set(legacy());
  await expect(Promise.all([prepareFacebookIdentityNonceRetention(db, ref.id, true),
    consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)])).resolves.toEqual(["ready", true]);
  expect((await ref.get()).data()).toEqual({...legacy(), expiresAt: Timestamp.fromMillis(NOW + 299000),
    consumedAtMs: NOW, playerIdHash: hash("meta-player-nonce-test")});
  await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)).resolves.toBe(false);
});

it("prepares an expired consumed legacy row without restoring its authentication window", async () => {
  /** Physical cleanup must not renew a challenge or strip its prior consumption marker. */
  const nonce = "expired-consumed-backfill";
  /** Valid old receipt from a completed five-minute window. */
  const row = {...legacy(), createdAtMs: NOW - 301000, expiresAtMs: NOW - 1000,
    consumedAtMs: NOW - 200000, playerIdHash: hash("meta-player-nonce-test")};
  /** SDK transaction reads actual legacy data. */
  const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
  await ref.set(row);
  await expect(prepareFacebookIdentityNonceRetention(db, ref.id, true)).resolves.toBe("ready");
  expect((await ref.get()).data()).toEqual({...row, expiresAt: Timestamp.fromMillis(NOW - 1000)});
  await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)).resolves.toBe(false);
});

it("rejects corrupt TTL, clock rollback and malformed backfill state without mutation", async () => {
  for (const [index, patch] of [{expiresAt: Timestamp.fromMillis(NOW + 299001)}, {expiresAt: null},
    {expiresAtMs: NOW + 300000}, {consumedAtMs: NOW, playerIdHash: "private-player-id"}, {rawIdentity: "private"}].entries()) {
    /** Distinct malformed documents cannot contaminate another nonce's lifetime. */
    const nonce = `malformed-${index}`;
    /** Captured exact original state must remain unchanged. */
    const row = {...legacy(), ...patch};
    /** Scope is always a nonce hash, never a player. */
    const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
    await ref.set(row);
    await expect(prepareFacebookIdentityNonceRetention(db, ref.id, true)).rejects.toThrow("invalid-facebook-nonce-record");
    await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW)).resolves.toBe(false);
    expect((await ref.get()).data()).toEqual(row);
  }
  /** A safe numeric but earlier server clock cannot consume a future-issued challenge. */
  const ref = db.collection("facebookIdentityNonces").doc(hash("rollback"));
  await ref.set(createFacebookIdentityNonceRecord(NOW + 1000));
  await expect(consumeFacebookIdentityNonce("rollback", "meta-player-nonce-test", NOW / 1000, db, NOW)).resolves.toBe(false);
  expect((await ref.get()).data()?.consumedAtMs).toBeNull();
  await expect(prepareFacebookIdentityNonceRetention(db, "raw-player-id", true)).rejects.toThrow("invalid-facebook-nonce-hash");
});

it("rechecks expiry after storage reads and commits instead of reusing request-start time", async () => {
  for (const expiredAfterCommit of [false, true]) {
    /** The clock crosses the exact deadline while the real SDK read or commit is awaited. */
    const nonce = `delayed-expiry-${expiredAfterCommit}`;
    /** Real nonce state keeps its original deadline regardless of request duration. */
    const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
    await ref.set(legacy());
    /** Deterministic server-clock observations model latency without sleeping in the test. */
    let reads = 0;
    await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db,
      () => ++reads >= (expiredAfterCommit ? 3 : 2) ? NOW + 299000 : NOW)).resolves.toBe(false);
    expect((await ref.get()).data()?.consumedAtMs).toBe(expiredAfterCommit ? NOW : null);
    /** A spent/expired challenge cannot authenticate on a retry; the caller must issue a fresh one. */
    await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db, NOW + 299000)).resolves.toBe(false);
  }
});

it("contains throwing, unsafe and backward clocks after the read without consumption", async () => {
  for (const later of [() => {throw new Error("private-clock-diagnostics");}, () => Infinity, () => NOW - 1]) {
    /** Each clock failure runs against the same unconsumed authority-owned document. */
    const nonce = "post-read-clock-failure";
    /** No unstable clock may spend or renew this nonce. */
    const ref = db.collection("facebookIdentityNonces").doc(hash(nonce));
    await ref.set(legacy());
    /** The initial request clock is valid; the later authoritative boundary is not. */
    let reads = 0;
    await expect(consumeFacebookIdentityNonce(nonce, "meta-player-nonce-test", NOW / 1000, db,
      () => ++reads === 1 ? NOW : later())).resolves.toBe(false);
    expect((await ref.get()).data()).toEqual(legacy());
  }
});

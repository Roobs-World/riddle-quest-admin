import {createHash, createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {consumeFacebookIdentityNonce, consumeFacebookRequestQuota} from "../facebookEndpoints";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-riddle-facebook-nonce";
/** Renders the now interface. */
const NOW = Date.UTC(2026, 7, 19);
/** Provides nonce path behavior. */
const noncePath = (nonce: string) => `facebookIdentityNonces/${createHash("sha256").update(nonce).digest("hex")}`;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Retries only confirmed aborted fixture transactions once after the original batch settles. */
const resolveConcurrentQuotaAttempts = async (operations: Array<() => Promise<boolean>>): Promise<boolean[]> => {
  /** Retains all original outcomes before any caller retry begins. */
  const settled = await Promise.allSettled(operations.map((operation) => operation()));
  /** Selects only confirmed numeric ABORTED failures for one retry. */
  const abortedIndexes = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    /** Preserves the provider failure for strict classification and propagation. */
    const reason: unknown = result.reason;
    if (typeof reason !== "object" || reason === null || !("code" in reason) || reason.code !== 10) throw reason;
    return [index];
  });
  if (abortedIndexes.length > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    /** Collects the single retry outcome for each aborted operation. */
    const retried = await Promise.allSettled(abortedIndexes.map((index) => operations[index]()));
    retried.forEach((result, index) => {settled[abortedIndexes[index]] = result;});
  }
  return settled.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
};

beforeAll(async () => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("facebook-nonce-tests-require-local-demo-emulator");
  }
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all([
    db.recursiveDelete(db.collection("facebookIdentityNonces")),
    db.recursiveDelete(db.collection("facebookIdentityRateLimits")),
  ]);
});

afterAll(async () =>
  Promise.all([
    db.recursiveDelete(db.collection("facebookIdentityNonces")),
    db.recursiveDelete(db.collection("facebookIdentityRateLimits")),
  ]),
);

it("settles every concurrent quota attempt before retrying a confirmed abort", async () => {
  jest.useFakeTimers();
  try {
    /** Models a retryable Firestore transaction abort. */
    const aborted = Object.assign(new Error("injected transaction abort"), {code: 10});
    /** Releases the pending peer only when the test permits retry. */
    let finishPeer!: (result: boolean) => void;
    /** Detects retry before the concurrent peer has settled. */
    let peerPending = true;
    /** Aborts once and verifies that retry waits for the peer. */
    const retry = jest.fn<Promise<boolean>, []>()
      .mockRejectedValueOnce(aborted)
      .mockImplementationOnce(async () => {
        expect(peerPending).toBe(false);
        return true;
      });
    /** Keeps an original attempt pending while the abort is observed. */
    const peer = jest.fn(() => new Promise<boolean>((resolve) => {finishPeer = resolve;}));
    /** Represents a valid quota denial that must not be retried. */
    const denied = jest.fn(async () => false);
    /** Observes either outcome immediately without an unhandled rejection. */
    const collected = resolveConcurrentQuotaAttempts([retry, peer, denied]).then(
      (value) => ({status: "fulfilled", value}),
      (reason: unknown) => ({status: "rejected", reason}),
    );
    await jest.advanceTimersByTimeAsync(100);
    expect(retry).toHaveBeenCalledTimes(1);
    peerPending = false;
    finishPeer(true);
    await jest.advanceTimersByTimeAsync(50);
    await expect(collected).resolves.toEqual({status: "fulfilled", value: [true, true, false]});
    expect(retry).toHaveBeenCalledTimes(2);
    expect(peer).toHaveBeenCalledTimes(1);
    expect(denied).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it.each([
  ["plain error", new Error("storage unavailable")],
  ["unavailable code", Object.assign(new Error("not aborted"), {code: 14})],
  ["string abort code", Object.assign(new Error("invalid abort code"), {code: "10"})],
])(
  "propagates a non-ABORTED quota failure without retry: %s", async (_label, failure) => {
    /** Proves a non-ABORTED provider failure is propagated without retry. */
    const operation = jest.fn<Promise<boolean>, []>().mockRejectedValue(failure);
    await expect(resolveConcurrentQuotaAttempts([operation])).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  },
);

it("fails quota recovery when its single confirmed-abort retry is exhausted", async () => {
  /** Models repeated aborts that exhaust the bounded caller retry. */
  const aborted = Object.assign(new Error("persistent transaction abort"), {code: 10});
  /** Always aborts so the second failure must propagate. */
  const operation = jest.fn<Promise<boolean>, []>().mockRejectedValue(aborted);
  await expect(resolveConcurrentQuotaAttempts([operation])).rejects.toBe(aborted);
  expect(operation).toHaveBeenCalledTimes(2);
});

it("enforces the 20-request identity quota transactionally across concurrent instances", async () => {
  /** Provides secret behavior. */
  const secret = "distributed-rate-limit-secret-at-least-32-characters";
  /** All 32 first attempts still compete concurrently for the same authoritative quota row. */
  const results = await resolveConcurrentQuotaAttempts(
    Array.from({length: 32}, () => () => consumeFacebookRequestQuota("198.51.100.7", secret, db, NOW)),
  );
  expect(results.filter(Boolean)).toHaveLength(20);
  expect(results.filter((value) => !value)).toHaveLength(12);
  /** Identifies the authoritative quota row for the persisted-count assertion. */
  const quotaId = createHmac("sha256", secret)
    .update("riddle-quest-facebook-identity-rate-v1\0", "utf8")
    .update("198.51.100.7", "utf8")
    .digest("hex");
  expect((await db.collection("facebookIdentityRateLimits").doc(quotaId).get()).data()).toMatchObject({
    count: 20, resetAtMs: NOW + 60_000,
  });
  await expect(consumeFacebookRequestQuota("198.51.100.8", secret, db, NOW)).resolves.toBe(true);
  await expect(consumeFacebookRequestQuota("198.51.100.7", secret, db, NOW + 60_000)).resolves.toBe(true);

  /** Records s. */
  const records = await db.collection("facebookIdentityRateLimits").get();
  expect(records.size).toBe(2);
  expect(JSON.stringify(records.docs.map((record) => ({id: record.id, ...record.data()})))).not.toContain("198.51.100");
});

it("rejects a reused distributed quota record whose TTL binding is missing or corrupt", async () => {
  /** Provides secret behavior. */
  const secret = "distributed-rate-limit-ttl-secret-at-least-32-characters";
  /** Provides key behavior. */
  const key = "198.51.100.44";
  /** Provides id behavior. */
  const id = createHmac("sha256", secret)
    .update("riddle-quest-facebook-identity-rate-v1\0", "utf8")
    .update(key, "utf8")
    .digest("hex");
  /** Provides ref behavior. */
  const ref = db.collection("facebookIdentityRateLimits").doc(id);
  await ref.set({count: 1, resetAtMs: NOW + 60_000});
  await expect(consumeFacebookRequestQuota(key, secret, db, NOW)).rejects.toThrow("invalid-facebook-rate-limit-record");
  await ref.update({expiresAt: new Date(NOW + 60_000 + 24 * 60 * 60 * 1_000 + 1)});
  await expect(consumeFacebookRequestQuota(key, secret, db, NOW)).rejects.toThrow("invalid-facebook-rate-limit-record");
  expect((await ref.get()).data()).toMatchObject({count: 1, resetAtMs: NOW + 60_000});
});

it("atomically consumes one exact nonce once under concurrent replay", async () => {
  /** Provides nonce behavior. */
  const nonce = "concurrent-identity-nonce";
  /** Provides player id behavior. */
  const playerId = "meta-player-1";
  /** Provides ref behavior. */
  const ref = db.doc(noncePath(nonce));
  await ref.set({createdAtMs: NOW - 1_000, expiresAtMs: NOW + 299_000, consumedAtMs: null});

  /** Provides results behavior. */
  const results = await Promise.all(
    Array.from({length: 8}, () => consumeFacebookIdentityNonce(nonce, playerId, Math.floor(NOW / 1_000), db, NOW)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((value) => !value)).toHaveLength(7);
  expect(await consumeFacebookIdentityNonce(nonce, playerId, Math.floor(NOW / 1_000), db, NOW)).toBe(false);

  /** Stores d. */
  const stored = (await ref.get()).data();
  expect(stored).toMatchObject({
    consumedAtMs: NOW,
    playerIdHash: createHash("sha256").update(playerId).digest("hex"),
  });
  expect(JSON.stringify(stored)).not.toContain(playerId);
});

it("rejects expired and assertion-time-mismatched nonce records without mutation", async () => {
  /** Provides fixtures behavior. */
  const fixtures = [
    {nonce: "expired", createdAtMs: NOW - 300_000, expiresAtMs: NOW},
    {nonce: "issued-before-window", createdAtMs: NOW, expiresAtMs: NOW + 300_000},
    {nonce: "malformed-time", createdAtMs: Number.NaN, expiresAtMs: NOW + 300_000},
  ];
  await Promise.all(
    fixtures.map((fixture) =>
      db.doc(noncePath(fixture.nonce)).set({
        createdAtMs: fixture.createdAtMs,
        expiresAtMs: fixture.expiresAtMs,
        consumedAtMs: null,
      }),
    ),
  );
  await expect(
    consumeFacebookIdentityNonce("expired", "meta-player-1", Math.floor(NOW / 1_000), db, NOW),
  ).resolves.toBe(false);
  await expect(
    consumeFacebookIdentityNonce("issued-before-window", "meta-player-1", Math.floor((NOW - 61_000) / 1_000), db, NOW),
  ).resolves.toBe(false);
  await expect(
    consumeFacebookIdentityNonce("malformed-time", "meta-player-1", Math.floor(NOW / 1_000), db, NOW),
  ).resolves.toBe(false);
  await expect(
    Promise.all(fixtures.map(async ({nonce}) => (await db.doc(noncePath(nonce)).get()).data()?.consumedAtMs)),
  ).resolves.toEqual([null, null, null]);
});

it("rejects malformed and overflow-prone verifier inputs before creating or reading nonce state", async () => {
  /** Provides inputs behavior. */
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
  await expect(
    Promise.all(
      inputs.map((input) => consumeFacebookIdentityNonce(input.nonce, input.playerId, input.issuedAt, db, input.now)),
    ),
  ).resolves.toEqual(inputs.map(() => false));
  await expect(
    Promise.all(
      inputs.filter(({nonce}) => nonce).map(async ({nonce}) => (await db.doc(noncePath(nonce)).get()).exists),
    ),
  ).resolves.toEqual(inputs.filter(({nonce}) => nonce).map(() => false));
});

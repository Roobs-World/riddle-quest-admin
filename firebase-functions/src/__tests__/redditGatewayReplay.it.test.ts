import {setEmulatorSystemTime} from "./helpers/emulatorClock";
import {createHash, createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {consumeRedditGatewayNonce, consumeRedditRequestQuota, redditProviderIdentityId} from "../reddit/redditEndpoints";
import {redditGameplay} from "../reddit/redditGameplayEndpoint";
import {redditFirebaseUid} from "../reddit/redditSecurity";
import {canonicalRedditGatewayAssertion, hashRedditGatewayPayload, verifyRedditGatewayAssertion} from "../reddit/redditSecurity";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-riddle-reddit-gateway";
/** Renders the now interface. */
const NOW = Date.UTC(2026, 7, 21);
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("reddit-gateway-tests-require-local-demo-emulator");
  }
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all([
    db.recursiveDelete(db.collection("redditGatewayNonces")),
    db.recursiveDelete(db.collection("redditGatewayRateLimits")),
  ]);
});

afterAll(async () => {
  if (db) await Promise.all([
    db.recursiveDelete(db.collection("redditGatewayNonces")),
    db.recursiveDelete(db.collection("redditGatewayRateLimits")),
  ]);
});
afterEach(() => {jest.restoreAllMocks(); jest.useRealTimers();});
beforeEach(async () => {
  await Promise.all([db.recursiveDelete(db.collection("redditGatewayNonces")),
    db.recursiveDelete(db.collection("redditGatewayRateLimits"))]);
});

it.each(["guess", "hint", "skip", "leave"])("reaches live authority for %s after exhausting background polls", async action => {
  /** Only local fixture secrets are used; original deployment environment is restored. */
  const original = {gateway: process.env.REDDIT_GATEWAY_SECRET, uid: process.env.REDDIT_UID_SECRET,
    disabled: process.env.REDDIT_DISABLED_FEATURES};
  /** Signed fixture identity remains private to the loopback demo emulator. */
  const secret = "reddit-live-action-quota-secret-at-least-32-characters", userId = `t2_live_${action}`;
  /** Independent provider UID secret is a local fixture. */
  const uidSecret = Buffer.alloc(32, 27).toString("base64");
  /** The production key namespace represents a fully consumed polling minute. */
  const key = `riddle-quest\0${userId}\0gameplay.race.live.update`;
  /** Persist the existing aggregate budget at its exact limit. */
  const id = createHmac("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(key).digest("hex");
  /** Provider row resolves the signed person to its exact generation. */
  const provider = db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", userId)}`);
  /** Signed command is schema-valid but its absent seat must fail at live authority, not polling quota. */
  const payload = {ticketId: "f".repeat(64), action, requestId: `quota-action-${action}`,
    ...(action === "guess" ? {riddleId: "riddle-quota", guess: "answer"} :
      action === "hint" || action === "skip" ? {riddleId: "riddle-quota"} : {})};
  /** Nonce and signature bind the complete player action, not a caller-selected budget. */
  const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test",
    subredditId: "t5_test", postId: "t3_test", userId, operation: "gameplay.race.live.update", issuedAtMs: NOW,
    nonce: `quota_action_${action}_${"n".repeat(32)}`, payloadHash: hashRedditGatewayPayload(payload)};
  /** The real gateway verifier consumes the production canonical signature. */
  const signature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
    .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
  /** Minimal HTTP response records safe endpoint output. */
  let status = 200, body: unknown;
  /** Fluent Express response seam leaves real signature, quota and command handling intact. */
  const response = {set: () => response, status: (value: number) => {status = value; return response;},
    json: (value: unknown) => {body = value; return response;}};
  try {
    process.env.REDDIT_GATEWAY_SECRET = secret; process.env.REDDIT_UID_SECRET = uidSecret;
    process.env.REDDIT_DISABLED_FEATURES = "commerce,notifications";
    setEmulatorSystemTime(NOW);
    await db.doc(`redditGatewayRateLimits/${id}`).set({count: 120, resetAtMs: NOW + 60_000,
      expiresAt: new Date(NOW + 60_000 + 24 * 60 * 60 * 1000)});
    await provider.set({provider: "reddit", appName: "riddle-quest", providerUserId: userId,
      accountGeneration: 1, status: "active", uid: redditFirebaseUid(userId, uidSecret, 1)});
    await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100, allowlistHashes: []});
    await redditGameplay({method: "POST", body: {assertion, payload}, get: () => signature} as never, response as never);
    expect(status).toBe(404);
    expect(body).toMatchObject({error: "live-race-request-failed", code: "not-found"});
    /** The polling row stays exhausted while the separate command row accounts for this request. */
    const commandId = createHmac("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(`${key}.command`).digest("hex");
    expect((await db.doc(`redditGatewayRateLimits/${id}`).get()).data()?.count).toBe(120);
    expect((await db.doc(`redditGatewayRateLimits/${commandId}`).get()).data()?.count).toBe(1);
    /** Validly signed malformed inputs retain the exhausted default quota instead of claiming command capacity. */
    const malformed = {...payload, quota: "command"};
    /** A new one-use assertion binds the invalid extra field exactly. */
    const invalidAssertion = {...assertion, nonce: `quota_invalid_${action}_${"n".repeat(32)}`,
      payloadHash: hashRedditGatewayPayload(malformed)};
    /** Signature validation is real even for a schema-rejected command. */
    const invalidSignature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(invalidAssertion)).digest("base64url");
    await redditGameplay({method: "POST", body: {assertion: invalidAssertion, payload: malformed},
      get: () => invalidSignature} as never, response as never);
    expect(status).toBe(429);
    expect((await db.doc(`redditGatewayRateLimits/${commandId}`).get()).data()?.count).toBe(1);
    /** Replaying a spent signed player action cannot consume another quota or reach authority. */
    await redditGameplay({method: "POST", body: {assertion, payload}, get: () => signature} as never, response as never);
    expect(status).toBe(401);
    expect((await db.doc(`redditGatewayRateLimits/${commandId}`).get()).data()?.count).toBe(1);
    /** A fresh signed assertion cannot be reassigned from a command to polling by changing its payload. */
    const tamperedAssertion = {...assertion, nonce: `quota_tampered_${action}_${"n".repeat(32)}`};
    /** The signed original hash must reject the changed action before quota writes. */
    const tamperedSignature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(tamperedAssertion)).digest("base64url");
    await redditGameplay({method: "POST", body: {assertion: tamperedAssertion, payload: {...payload, action: "poll"}},
      get: () => tamperedSignature} as never, response as never);
    expect(status).toBe(401);
    expect((await db.doc(`redditGatewayRateLimits/${commandId}`).get()).data()?.count).toBe(1);
    /** Actual signed polling still refuses the already-full original bucket. */
    const pollPayload = {ticketId: payload.ticketId, action: "poll", requestId: `quota-poll-${action}`};
    /** Read requests have their own fresh signed payload and nonce. */
    const pollAssertion = {...assertion, nonce: `quota_poll_${action}_${"n".repeat(32)}`, payloadHash: hashRedditGatewayPayload(pollPayload)};
    /** Native Devvit signing remains unchanged at the proxy boundary. */
    const pollSignature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(pollAssertion)).digest("base64url");
    await redditGameplay({method: "POST", body: {assertion: pollAssertion, payload: pollPayload},
      get: () => pollSignature} as never, response as never);
    expect(status).toBe(429);
    expect(body).toEqual({error: "rate-limited"});
  } finally {
    await provider.delete();
    await db.doc("raceConfig/rollout").delete();
    for (const [key, value] of Object.entries({REDDIT_GATEWAY_SECRET: original.gateway,
      REDDIT_UID_SECRET: original.uid, REDDIT_DISABLED_FEATURES: original.disabled})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

it("keeps live polling and player command budgets bounded and independently reset", async () => {
  /** Only the local demo quota store is touched. */
  const secret = "reddit-separate-live-budget-secret-at-least-32-characters";
  for (const operation of ["gameplay.race.live.update", "gameplay.race.live.update.command"]) {
    /** Exact server-owned namespace retains the existing 120-request live limit. */
    const key = `riddle-quest\0t2_separate_budget\0${operation}`;
    for (let index = 0; index < 120; index++) await expect(consumeRedditRequestQuota(key, secret, db, NOW)).resolves.toBe(true);
    await expect(consumeRedditRequestQuota(key, secret, db, NOW)).resolves.toBe(false);
    await expect(consumeRedditRequestQuota(key, secret, db, NOW + 60_000)).resolves.toBe(true);
  }
  for (const suffix of [".command.extra", "\0command", ".poll", ".guess"]) {
    /** Lookalike operations cannot nominate a larger budget. */
    const key = `riddle-quest\0t2_separate_budget\0gameplay.race.live.update${suffix}`;
    for (let index = 0; index < 20; index++) await expect(consumeRedditRequestQuota(key, secret, db, NOW)).resolves.toBe(true);
    await expect(consumeRedditRequestQuota(key, secret, db, NOW)).resolves.toBe(false);
  }
});

it("atomically consumes one gateway nonce once under concurrent replay", async () => {
  /** Asserts ion. */
  const assertion = {nonce: "a".repeat(43), userId: "t2_reddit-user", issuedAtMs: NOW};
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 12}, () => consumeRedditGatewayNonce(assertion)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((value) => !value)).toHaveLength(11);

  /** Provides id behavior. */
  const id = createHash("sha256").update(assertion.nonce).digest("hex");
  /** Provides value behavior. */
  const value = (await db.collection("redditGatewayNonces").doc(id).get()).data();
  expect(value).toMatchObject({
    issuedAtMs: NOW,
    userIdHash: createHash("sha256").update(assertion.userId).digest("hex"),
  });
  expect(JSON.stringify(value)).not.toContain(assertion.userId);
});

it("enforces the 20-request quota transactionally without storing the raw key", async () => {
  /** Provides secret behavior. */
  const secret = "reddit-distributed-rate-secret-at-least-32-characters";
  /** Provides key behavior. */
  const key = "riddle-quest\0t2_reddit-user\0storage.read";
  /** Provides results behavior. */
  const results = await Promise.all(Array.from({length: 32}, () => consumeRedditRequestQuota(key, secret, db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(20);
  expect(results.filter((value) => !value)).toHaveLength(12);
  await expect(consumeRedditRequestQuota(key, secret, db, NOW + 60_000)).resolves.toBe(true);

  /** Records s. */
  const records = await db.collection("redditGatewayRateLimits").get();
  expect(records.size).toBe(1);
  expect(JSON.stringify(records.docs.map((record) => ({id: record.id, ...record.data()})))).not.toContain(
    "t2_reddit-user",
  );
});

it("rejects corrupt quota TTL binding without mutating the record", async () => {
  /** Provides secret behavior. */
  const secret = "reddit-corrupt-rate-secret-at-least-32-characters";
  /** Provides key behavior. */
  const key = "riddle-quest\0t2_other\0storage.write";
  /** Provides id behavior. */
  const id = createHmac("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(key).digest("hex");
  /** Provides ref behavior. */
  const ref = db.collection("redditGatewayRateLimits").doc(id);
  await ref.set({count: 1, resetAtMs: NOW + 60_000, expiresAt: new Date(NOW + 60_001)});
  await expect(consumeRedditRequestQuota(key, secret, db, NOW)).rejects.toThrow("invalid-reddit-rate-limit-record");
  expect((await ref.get()).data()).toMatchObject({count: 1, resetAtMs: NOW + 60_000});
  /** Concurrent failed turns must release the local serializer without mutating corrupt authority. */
  const failures = await Promise.allSettled([consumeRedditRequestQuota(key, secret, db, NOW),
    consumeRedditRequestQuota(key, secret, db, NOW)]);
  expect(failures.every(result => result.status === "rejected")).toBe(true);
  await ref.set({count: 1, resetAtMs: NOW + 60_000, expiresAt: new Date(NOW + 60_000 + 24 * 60 * 60 * 1000)});
  await expect(consumeRedditRequestQuota(key, secret, db, NOW)).resolves.toBe(true);
  expect((await ref.get()).data()?.count).toBe(2);
});

it("allows a full minute of signed two-second racing polls and immediate opt-out", async () => {
  /** A separate local secret keeps this window independent of other quota fixtures. */
  const secret = "reddit-presence-poll-secret-at-least-32-characters";
  for (let index = 0; index < 31; index++) {
    /** The last request revokes consent immediately after the scheduled race polls. */
    const payload = {enabled: index < 30, state: "racing", sessionId: "local-presence-session"};
    /** Each real verifier call consumes its own one-use emulator receipt. */
    const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test",
      subredditId: "t5_test", postId: "t3_test", userId: "t2_presence-poll", operation: "gameplay.presence.poll",
      issuedAtMs: NOW + Math.min(index * 2_000, 59_000),
      nonce: `presence_poll_${String(index).padStart(30, "0")}`, payloadHash: hashRedditGatewayPayload(payload)};
    /** Signature covers the exact operation and opt-out payload. */
    const signature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
    /** The quota key is derived from the verified assertion, as in the gameplay endpoint. */
    const verified = await verifyRedditGatewayAssertion(assertion, signature, {
      gatewaySecret: secret, expectedAppName: "riddle-quest", expectedOperation: "gameplay.presence.poll",
      expectedPayload: payload, nowMs: assertion.issuedAtMs, consumeNonce: consumeRedditGatewayNonce,
    });
    await expect(consumeRedditRequestQuota(`${verified.appName}\0${verified.userId}\0${verified.operation}`,
      secret, db, assertion.issuedAtMs)).resolves.toBe(true);
  }
});

it("bounds concurrent presence polling at 60 while other operations retain 20", async () => {
  /** Fixtures share a secret but operation-bound keys maintain independent budgets. */
  const secret = "reddit-presence-concurrency-secret-at-least-32-characters";
  /** Race polling receives room for transitions without an unbounded bypass. */
  const key = "riddle-quest\0t2_presence-concurrent\0gameplay.presence.poll";
  /** Real Firestore transactions must enforce the cap across competing workers. */
  const results = await Promise.all(Array.from({length: 64}, () => consumeRedditRequestQuota(key, secret, db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(60);
  expect(results.filter((value) => !value)).toHaveLength(4);
  await expect(consumeRedditRequestQuota(key, secret, db, NOW + 60_000)).resolves.toBe(true);

  for (const operation of ["gameplay.presence.disconnect", "storage.read", "gameplay.guess.submit",
    "gameplay.presence.poll.extra", "gameplay.presence.poll\0extra"]) {
    /** Existing twenty-request rows remain capped for every other operation. */
    const otherKey = `riddle-quest\0t2_presence-concurrent\0${operation}`;
    /** The same production HMAC namespace is used for migrated records. */
    const id = createHmac("sha256", secret).update("riddle-quest-reddit-rate-v1\0").update(otherKey).digest("hex");
    await db.collection("redditGatewayRateLimits").doc(id).set({count: 20, resetAtMs: NOW + 60_000,
      expiresAt: new Date(NOW + 60_000 + 24 * 60 * 60 * 1_000)});
    await expect(consumeRedditRequestQuota(otherKey, secret, db, NOW)).resolves.toBe(false);
  }
});

it("rejects expiry after a real nonce write and preserves the spent replay record", async () => {
  /** This signature is local test data and never reaches a hosted endpoint. */
  const secret = "reddit-delayed-gateway-secret-at-least-32-characters";
  /** Complete operation-bound assertion used by the actual gateway verifier. */
  const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test",
    subredditId: "t5_test", postId: "t3_test", userId: "t2_delayed-test", operation: "identity.exchange",
    issuedAtMs: NOW, nonce: "delay_0123456789abcdefghijklmnopq", payloadHash: hashRedditGatewayPayload({})};
  /** Byte-exact signature uses the production canonical representation. */
  const signature = createHmac("sha256", secret).update("riddle-quest-reddit-gateway-v1\0")
    .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
  /** Persistence crosses the deadline without introducing a timing-dependent sleep. */
  setEmulatorSystemTime(NOW);
  await expect(verifyRedditGatewayAssertion(assertion, signature, {
    gatewaySecret: secret, expectedAppName: assertion.appName, expectedOperation: assertion.operation,
    consumeNonce: async (value) => {
      /** This is an actual Admin SDK create in the local Firestore emulator. */
      const consumed = await consumeRedditGatewayNonce(value);
      jest.setSystemTime(NOW + 60_001);
      return consumed;
    },
  })).rejects.toThrow("stale-reddit-gateway-assertion");
  /** Rejection must not erase or renew the one-use assertion receipt. */
  const row = (await db.collection("redditGatewayNonces")
    .doc(createHash("sha256").update(assertion.nonce).digest("hex")).get()).data();
  expect(row).toMatchObject({issuedAtMs: NOW, userIdHash: createHash("sha256").update(assertion.userId).digest("hex")});
  expect(row?.expiresAt.toMillis()).toBe(NOW + 24 * 60 * 60 * 1000);
  await expect(verifyRedditGatewayAssertion(assertion, signature, {
    gatewaySecret: secret, expectedAppName: assertion.appName, expectedOperation: assertion.operation,
    nowMs: NOW, consumeNonce: consumeRedditGatewayNonce,
  })).rejects.toThrow("reddit-gateway-replay");
});

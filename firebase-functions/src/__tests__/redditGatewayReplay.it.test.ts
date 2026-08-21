import {createHash, createHmac} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {consumeRedditGatewayNonce, consumeRedditRequestQuota} from "../reddit/redditEndpoints";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const NOW = Date.UTC(2026, 7, 21);
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all([
    db.recursiveDelete(db.collection("redditGatewayNonces")),
    db.recursiveDelete(db.collection("redditGatewayRateLimits")),
  ]);
});

afterAll(async () => Promise.all([
  db.recursiveDelete(db.collection("redditGatewayNonces")),
  db.recursiveDelete(db.collection("redditGatewayRateLimits")),
]));

it("atomically consumes one gateway nonce once under concurrent replay", async () => {
  const assertion = {nonce: "a".repeat(43), userId: "t2_reddit-user", issuedAtMs: NOW};
  const results = await Promise.all(Array.from({length: 12}, () => consumeRedditGatewayNonce(assertion)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((value) => !value)).toHaveLength(11);

  const id = createHash("sha256").update(assertion.nonce).digest("hex");
  const value = (await db.collection("redditGatewayNonces").doc(id).get()).data();
  expect(value).toMatchObject({
    issuedAtMs: NOW,
    userIdHash: createHash("sha256").update(assertion.userId).digest("hex"),
  });
  expect(JSON.stringify(value)).not.toContain(assertion.userId);
});

it("enforces the 20-request quota transactionally without storing the raw key", async () => {
  const secret = "reddit-distributed-rate-secret-at-least-32-characters";
  const key = "riddle-quest\0t2_reddit-user\0storage.read";
  const results = await Promise.all(Array.from({length: 32}, () =>
    consumeRedditRequestQuota(key, secret, db, NOW)));
  expect(results.filter(Boolean)).toHaveLength(20);
  expect(results.filter((value) => !value)).toHaveLength(12);
  await expect(consumeRedditRequestQuota(key, secret, db, NOW + 60_000)).resolves.toBe(true);

  const records = await db.collection("redditGatewayRateLimits").get();
  expect(records.size).toBe(1);
  expect(JSON.stringify(records.docs.map((record) => ({id: record.id, ...record.data()}))))
    .not.toContain("t2_reddit-user");
});

it("rejects corrupt quota TTL binding without mutating the record", async () => {
  const secret = "reddit-corrupt-rate-secret-at-least-32-characters";
  const key = "riddle-quest\0t2_other\0storage.write";
  const id = createHmac("sha256", secret)
    .update("riddle-quest-reddit-rate-v1\0").update(key).digest("hex");
  const ref = db.collection("redditGatewayRateLimits").doc(id);
  await ref.set({count: 1, resetAtMs: NOW + 60_000, expiresAt: new Date(NOW + 60_001)});
  await expect(consumeRedditRequestQuota(key, secret, db, NOW))
    .rejects.toThrow("invalid-reddit-rate-limit-record");
  expect((await ref.get()).data()).toMatchObject({count: 1, resetAtMs: NOW + 60_000});
});

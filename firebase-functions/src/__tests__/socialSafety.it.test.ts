import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {blockKnownRival, reportKnownRival} from "../social/socialSafety";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const REPORTER = `facebook_${"c".repeat(40)}`;
const TARGET = `jest_${"d".repeat(40)}`;
const NOW = Date.parse("2026-08-19T12:00:00.000Z");
let db: FirebaseFirestore.Firestore;

const collections = ["users", "socialModerationQueue", "socialReportRateLimits"];

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name))));
  await db.doc(`users/${REPORTER}/knownRivals/${TARGET}`).set({
    targetUserId: TARGET,
    source: "completed_race",
    establishedAtMs: NOW - 1,
  });
});

afterAll(async () => Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name)))));

it("serializes report idempotency and the daily cap under concurrency", async () => {
  const replayed = await Promise.all(Array.from({length: 8}, () => reportKnownRival(REPORTER, {
    targetUserId: TARGET,
    category: "cheating",
    requestId: "same-request-0001",
  }, {db, nowMs: NOW})));
  expect(new Set(replayed.map(({reportId}) => reportId)).size).toBe(1);
  expect((await db.collection("socialModerationQueue").get()).size).toBe(1);

  const distinct = await Promise.allSettled(Array.from({length: 5}, (_, index) => reportKnownRival(REPORTER, {
    targetUserId: TARGET,
    category: "spam",
    requestId: `distinct-request-${index}`,
  }, {db, nowMs: NOW})));
  expect(distinct.filter(({status}) => status === "fulfilled")).toHaveLength(4);
  const rejected = distinct.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({code: "resource-exhausted"});
  expect((await db.collection("socialModerationQueue").get()).size).toBe(5);
  expect((await db.collection("socialReportRateLimits").limit(1).get()).docs[0].data().count).toBe(5);
});

it("writes an immediate block only for the established rival", async () => {
  await expect(blockKnownRival(REPORTER, TARGET, {db, nowMs: NOW})).resolves.toEqual({blocked: true});
  await expect(db.doc(`users/${REPORTER}/blockedRivals/${TARGET}`).get()).resolves.toMatchObject({exists: true});
  await expect(blockKnownRival(REPORTER, `facebook_${"e".repeat(40)}`, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "permission-denied"});
});

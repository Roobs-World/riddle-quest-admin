import {deleteApp, initializeApp, type App} from "firebase-admin/app";
import {getDatabase, type Database} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {blockKnownRival, reportKnownRival} from "../social/socialSafety";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const REPORTER = `facebook_${"c".repeat(40)}`;
const TARGET = `jest_${"d".repeat(40)}`;
const NOW = Date.parse("2026-08-19T12:00:00.000Z");
let db: FirebaseFirestore.Firestore;
let database: Database;
let app: App;

const collections = ["users", "socialModerationQueue", "socialReportRateLimits"];

beforeAll(async () => {
  app = initializeApp({
    projectId: PROJECT_ID,
    databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000"}?ns=${PROJECT_ID}`,
  }, "social-safety-integration");
  db = getFirestore(app);
  database = getDatabase(app);
  await Promise.all([
    ...collections.map((name) => db.recursiveDelete(db.collection(name))),
    database.ref(`presenceVisibility/${REPORTER}/${TARGET}`).remove(),
    database.ref(`presenceVisibility/${TARGET}/${REPORTER}`).remove(),
    database.ref(`presenceViewers/${REPORTER}/${TARGET}`).remove(),
    database.ref(`presenceViewers/${TARGET}/${REPORTER}`).remove(),
  ]);
  await db.doc(`users/${REPORTER}/knownRivals/${TARGET}`).set({
    targetUserId: TARGET,
    source: "completed_race",
    establishedAtMs: NOW - 1,
  });
});

afterAll(async () => {
  await Promise.all([
    ...collections.map((name) => db.recursiveDelete(db.collection(name))),
    database.ref(`presenceVisibility/${REPORTER}/${TARGET}`).remove(),
    database.ref(`presenceVisibility/${TARGET}/${REPORTER}`).remove(),
    database.ref(`presenceViewers/${REPORTER}/${TARGET}`).remove(),
    database.ref(`presenceViewers/${TARGET}/${REPORTER}`).remove(),
  ]);
  await deleteApp(app);
});

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
  await database.ref().update({
    [`presenceVisibility/${REPORTER}/${TARGET}`]: true,
    [`presenceVisibility/${TARGET}/${REPORTER}`]: true,
    [`presenceViewers/${REPORTER}/${TARGET}`]: true,
    [`presenceViewers/${TARGET}/${REPORTER}`]: true,
  });
  await expect(blockKnownRival(REPORTER, TARGET, {database, db, nowMs: NOW})).resolves.toEqual({blocked: true});
  await expect(db.doc(`users/${REPORTER}/blockedRivals/${TARGET}`).get()).resolves.toMatchObject({exists: true});
  const revokedPresence = await Promise.all([
    database.ref(`presenceVisibility/${REPORTER}/${TARGET}`).get(),
    database.ref(`presenceVisibility/${TARGET}/${REPORTER}`).get(),
    database.ref(`presenceViewers/${REPORTER}/${TARGET}`).get(),
    database.ref(`presenceViewers/${TARGET}/${REPORTER}`).get(),
  ]);
  expect(revokedPresence.every((snapshot) => !snapshot.exists())).toBe(true);
  await expect(blockKnownRival(REPORTER, `facebook_${"e".repeat(40)}`, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "permission-denied"});
});

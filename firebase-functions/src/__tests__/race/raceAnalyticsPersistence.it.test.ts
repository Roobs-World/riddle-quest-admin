import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {createHash} from "node:crypto";
import {recordRaceAnalyticsForUser} from "../../race/raceRollout";

/** Actual SDK checks run only against disposable emulator data. */
let db: FirebaseFirestore.Firestore;
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("analytics-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
  await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100, allowlistHashes: []});
});
it("concurrent deliveries persist one immutable allowlisted receipt", async () => {
  /** Unique fixture avoids interference with other emulator suites. */
  const userId = "analytics-atomic-player";
  /** Deterministic fixture receipt is removed only in this disposable emulator. */
  const eventId = "analytics-atomic-event";
  /** SDK create preconditions reject all but one concurrent write. */
  const ref = db.doc(`raceAnalytics/${createHash("sha256").update(`${userId}\u0000${eventId}`).digest("hex")}`);
  await ref.delete();
  /** Concurrent duplicate payloads must never overwrite the winning record. */
  const responses = await Promise.all(Array.from({length: 8}, () => recordRaceAnalyticsForUser(userId, {
    eventId, eventName: "race_category_selected", params: {categoryId: "history", secret: "discarded"},
  }, {db, nowMs: 1000})));
  expect(responses).toEqual(Array.from({length: 8}, () => ({accepted: true})));
  expect((await ref.get()).data()).toMatchObject({createdAtMs: 1000, params: {categoryId: "history"}});
  await recordRaceAnalyticsForUser(userId, {
    eventId, eventName: "race_category_selected", params: {categoryId: "science"},
  }, {db, nowMs: 2000});
  expect((await ref.get()).data()).toMatchObject({createdAtMs: 1000, params: {categoryId: "history"}});
});

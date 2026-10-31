import {afterAll, beforeAll, expect, it, jest} from "@jest/globals";
import {deleteApp, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

/** Signals that authoring has started before the competing publication. */
const authoring = Promise.withResolvers<void>();
/** Deferred author result released after a competing publication. */
const candidate = Promise.withResolvers<[string, string, "medium"]>();
/** Authoring fixture paused until the transaction scenario releases it. */
const mockGenerate = jest.fn(async () => {authoring.resolve(); return candidate.promise;});
jest.mock("../riddles/openaiService", () => ({generateUniqueRiddle: () => mockGenerate()}));

import {generateLocalizedDailyChallengeForDate} from "../daily/dailyRiddleGeneration";

/** One of the two explicitly supported disposable emulator projects. */
const projectId = process.env.GCLOUD_PROJECT === "demo-riddle-quest-e2e"
  ? "demo-riddle-quest-e2e" : "demo-riddle-sentry";
/** Exact loopback endpoint paired with the selected demo project. */
const emulatorHost = projectId === "demo-riddle-quest-e2e" ? "127.0.0.1:8099" : "127.0.0.1:18999";
/** Disposable Firebase Admin application bound to the demo project. */
const app = initializeApp({projectId});
/** Firestore client belonging to the disposable demo application. */
const db = getFirestore(app);
/** Future fixture date isolated from current Daily publications. */
const day = "2099-01-17";
/** Vietnamese Daily document owned by this emulator fixture. */
const ref = db.doc(`localizedRiddles/vi/riddles/daily-${day}`);

beforeAll(async () => {
  if (process.env.GCLOUD_PROJECT !== projectId || process.env.FIRESTORE_EMULATOR_HOST !== emulatorHost) {
    throw new Error("This proof requires its dedicated or canonical demo project and matching loopback Firestore emulator.");
  }
  expect(db.projectId).toBe(projectId);
  process.env.OPENAI_API_KEY = "fixture-only";
  await ref.delete();
});
afterAll(async () => {await db.terminate(); await deleteApp(app);});

it("keeps the exact first publication when a pending author finishes after another publisher", async () => {
  /** Generation request waiting for its author result. */
  const pending = generateLocalizedDailyChallengeForDate(day, false, ["vi"]);
  await authoring.promise;
  await ref.create({
    riddleId: `daily-${day}`, challengeKey: day, locale: "vi", category: "daily", dailyIndex: 47133,
    canonicalKey: "daily:2099-01-17:vi", text: "Where do you plant flowers beside a lawn?", answer: "garden",
    difficultyBand: "medium", timestamp: FieldValue.serverTimestamp(),
  });
  /** First committed publication and its exact Firestore version. */
  const published = await ref.get();
  candidate.resolve(["What has hands but cannot clap?", "clock", "medium"]);
  await pending;
  /** Publication read after the pending or forced writer completes. */
  const after = await ref.get();
  expect(after.data()).toEqual(published.data());
  expect(after.data()?.answer).toBe("garden");
  if (!published.updateTime || !after.updateTime) throw new Error("Committed documents must have revision timestamps.");
  expect(after.updateTime.isEqual(published.updateTime)).toBe(true);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});

it("still replaces a playable dated document when force is explicitly requested", async () => {
  await ref.set({challengeKey: day, locale: "vi", text: "Where do you plant flowers beside a lawn?", answer: "garden", timestamp: FieldValue.serverTimestamp()});
  mockGenerate.mockResolvedValueOnce(["What has hands but cannot clap?", "clock", "medium"]);
  await generateLocalizedDailyChallengeForDate(day, true, ["vi"]);
  /** Publication read after the pending or forced writer completes. */
  const after = await ref.get();
  expect(after.data()).toMatchObject({challengeKey: day, locale: "vi", text: "What has hands but cannot clap?", answer: "clock", difficultyBand: "medium"});
});

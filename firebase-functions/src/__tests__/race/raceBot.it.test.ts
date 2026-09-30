import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {findRecordedRaceMatch} from "../../race/raceMatchmaking";
import {startRaceRunForUser, readyRaceRunForUser, resumeRaceRunForUser, submitRaceGuessForUser,
  getRaceOutcomeForUser, publishRaceChallengeForUser} from "../../race/raceService";

/** Isolated provider owners used only in the local Firestore emulator. */
const PLAYER = `jest_${"1".repeat(40)}`, CREATOR = `jest_${"2".repeat(40)}`;
/** Stable authoritative clock makes deadline and offer expiry tests instant. */
const NOW = 1800000000000;
/** Emulator-only storage; never use production fixtures for destructive cleanup. */
let db: FirebaseFirestore.Firestore;
const collections = ["raceBotOffers", "raceMatchOffers", "raceMatchCandidates", "raceChallenges", "raceRuns", "raceDecks",
  "raceStartRequests", "raceAttempts", "racePerformanceOutbox", "raceSettlementOutbox", "users", "localizedRiddles/en/riddles"];

/** Clears emulator fixtures between independent full-service scenarios. */
async function clear() {
  for (const path of collections) {
    const snapshot = await db.collection(path).get();
    if (snapshot.empty) continue;
    const batch = db.batch(); snapshot.docs.forEach(document => batch.delete(document.ref)); await batch.commit();
  }
  for (const owner of [PLAYER, CREATOR]) await db.recursiveDelete(db.doc(`users/${owner}`));
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Emulator required");
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT ?? "demo-riddle-quest-bots"});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  batch.set(db.doc(`users/${PLAYER}`), {displayName: "Player", coins: 0});
  batch.set(db.doc(`users/${CREATOR}`), {displayName: "Creator", coins: 0});
  await batch.commit();
});
afterAll(async () => {await clear();});

/** Real empty lookup must supply an owner-bound fallback before any race can start. */
async function find(requestId = "empty-search-0001") {
  const response = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW});
  expect(response.status).toBe("empty");
  if (response.status !== "empty" || !response.fallback) throw new Error("Missing fallback offer");
  return response.fallback;
}

it("starts one rival under concurrent acceptance, resumes its countdown and completes a verified win", async () => {
  const offered = await find();
  expect(await find()).toEqual(offered);
  const input = {locale: "en" as const, categoryId: offered.categoryId, fallbackOfferId: offered.offerId, prepare: true, includeEvaluation: true};
  const [first, duplicate] = await Promise.all([
    startRaceRunForUser(PLAYER, {...input, requestId: "fallback-start-0001"}, {db, nowMs: NOW}),
    startRaceRunForUser(PLAYER, {...input, requestId: "fallback-start-0002"}, {db, nowMs: NOW}),
  ]);
  expect(duplicate.run.runId).toBe(first.run.runId);
  expect((await db.collection("raceRuns").get()).size).toBe(1);
  expect(first.run).toMatchObject({role: "challenger", status: "prepared", wallElapsedMs: 0});
  expect(first.run.opponent?.displayName).not.toBe("Riddle Quest player");
  expect(first.run.opponent).not.toHaveProperty("kind");
  expect(first.run.challengeId).toBeUndefined();
  const scheduled = await readyRaceRunForUser(PLAYER, {runId: first.run.runId, requestId: "fallback-ready-0001", includeEvaluation: true}, {db, nowMs: NOW + 500});
  expect(scheduled.run.startsAtMs).toBe(NOW + 3500);
  const resumed = await resumeRaceRunForUser(PLAYER, first.run.runId, {db, nowMs: NOW + 4000, includeEvaluation: true});
  expect(resumed.run.opponent).toEqual(first.run.opponent);
  expect(resumed.run.startsAtMs).toBe(scheduled.run.startsAtMs);
  let run = resumed.run;
  for (let index = 0; index < 10; index++) {
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(PLAYER, {runId: run.runId, riddleId: riddle.riddleId,
      guess: riddle.evaluation!.answer, requestId: `fallback-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + 4500 + index * 1000})).run;
  }
  expect(run.status).toBe("completed");
  const outcome = await getRaceOutcomeForUser(PLAYER, run.runId, {db, nowMs: NOW + 15000});
  expect(outcome).toMatchObject({result: "player_win", correctCount: 10, publishable: false});
  expect((await getRaceOutcomeForUser(PLAYER, run.runId, {db, nowMs: NOW + 16000})).adjustedFinishMs).toBe(outcome.adjustedFinishMs);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  await expect(publishRaceChallengeForUser(PLAYER, {runId: run.runId, requestId: "fallback-publish-0001"}, {db, nowMs: NOW + 17000})).rejects.toThrow();
});

it("rejects an unrelated owner, changed category and expired offer", async () => {
  const offered = await find();
  const input = {locale: "en" as const, categoryId: offered.categoryId, fallbackOfferId: offered.offerId, requestId: "fallback-unauthorized"};
  await expect(startRaceRunForUser(CREATOR, input, {db, nowMs: NOW})).rejects.toMatchObject({code: "permission-denied"});
  await expect(startRaceRunForUser(PLAYER, {...input, categoryId: "science"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "invalid-argument"});
  await expect(startRaceRunForUser(PLAYER, input, {db, nowMs: NOW + 60000})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("raceRuns").get()).empty).toBe(true);
});

it("settles an unattended fallback exactly at its immutable finish", async () => {
  const offered = await find();
  const first = await startRaceRunForUser(PLAYER, {locale: "en", categoryId: offered.categoryId,
    fallbackOfferId: offered.offerId, requestId: "fallback-loss-start"}, {db, nowMs: NOW});
  const finish = first.run.opponent!.adjustedFinishMs;
  const outcome = await getRaceOutcomeForUser(PLAYER, first.run.runId, {db, nowMs: NOW + finish + 1});
  expect(outcome).toMatchObject({result: "ghost_win", wallFinishMs: finish, opponentAdjustedFinishMs: finish});
  const resumed = await resumeRaceRunForUser(PLAYER, first.run.runId, {db, nowMs: NOW + finish + 1000});
  expect(resumed.run.status).toBe("completed");
  expect(resumed.run.opponent).toEqual(first.run.opponent);
});

it("prefers a published human recording and creates no fallback offer for that search", async () => {
  let run = (await startRaceRunForUser(CREATOR, {locale: "en", categoryId: "history", requestId: "human-create-0001", includeEvaluation: true}, {db, nowMs: NOW})).run;
  for (let index = 0; index < 10; index++) {
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(CREATOR, {runId: run.runId, riddleId: riddle.riddleId,
      guess: riddle.evaluation!.answer, requestId: `human-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + (index + 1) * 9000})).run;
  }
  const challenge = await publishRaceChallengeForUser(CREATOR, {runId: run.runId, requestId: "human-publish-0001"}, {db, nowMs: NOW + 100000});
  const response = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "human-match-0001"}, {db, nowMs: NOW + 110000});
  expect(response).toMatchObject({status: "matched", challenge: {challengeId: challenge.challengeId}});
  expect((await db.collection("raceBotOffers").get()).empty).toBe(true);
});

it("does not conceal corrupt matchmaking projections with a fallback", async () => {
  const logging = jest.spyOn(logger, "warn").mockImplementation(() => {});
  await db.doc("raceMatchCandidates/broken").set({provider: "jest", locale: "en", status: "active", rulesVersion: "race10_v1",
    performanceBucket: 11, selectionKey: "a".repeat(64), expiresAtMs: NOW + 100000});
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "corrupt-search-0001"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "unavailable"});
    expect((await db.collection("raceBotOffers").get()).empty).toBe(true);
  } finally {logging.mockRestore();}
});

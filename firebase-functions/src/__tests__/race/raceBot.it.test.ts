import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {offerRaceBot} from "../../race/raceBot";
import {emptyRaceMatchProfile} from "../../race/raceMatchPerformance";
import {DEFAULT_RACE_MATCH_CONTEXT} from "../../race/raceMatchPolicy";
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
/** Collections owned by the emulator fixtures. */
const collections = ["raceBotOffers", "raceMatchOffers", "raceMatchCandidates", "raceChallenges", "raceRuns", "raceDecks",
  "raceStartRequests", "raceAttempts", "racePerformanceOutbox", "raceSettlementOutbox", "users", "localizedRiddles/en/riddles"];

/** Clears emulator fixtures between independent full-service scenarios. */
async function clear() {
  for (const path of collections) {
    /** Current emulator documents to remove. */
    const snapshot = await db.collection(path).get();
    if (snapshot.empty) continue;
    /** Atomic emulator fixture write. */
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
  /** Atomic emulator fixture write. */
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
  /** Canonical matchmaking response under test. */
  const response = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW});
  expect(response.status).toBe("empty");
  if (response.status !== "empty" || !response.fallback) throw new Error("Missing fallback offer");
  return response.fallback;
}

it("starts one rival under concurrent acceptance, resumes its countdown and completes a verified win", async () => {
  /** Captured empty-pool query telemetry. */
  const lookup = jest.spyOn(logger, "info");
  /** Owner-bound fallback selected by the real service. */
  const offered = await find();
  expect(lookup).toHaveBeenCalledWith("Race matchmaking lookup", expect.objectContaining({disposition: "empty", candidateQueries: 1, candidateDocumentsRead: 0}));
  lookup.mockRestore();
  expect(await find()).toEqual(offered);
  /** Fallback preparation request shared by concurrent deliveries. */
  const input = {locale: "en" as const, categoryId: offered.categoryId, fallbackOfferId: offered.offerId, prepare: true, includeEvaluation: true};
  /** Concurrent starts must resolve the same canonical run. */
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
  /** Readiness fixes one immutable scored start. */
  const scheduled = await readyRaceRunForUser(PLAYER, {runId: first.run.runId, requestId: "fallback-ready-0001", includeEvaluation: true}, {db, nowMs: NOW + 500});
  expect(scheduled.run.startsAtMs).toBe(NOW + 3500);
  /** A fresh read retains the selected rival and countdown. */
  const resumed = await resumeRaceRunForUser(PLAYER, first.run.runId, {db, nowMs: NOW + 4000, includeEvaluation: true});
  expect(resumed.run.opponent).toEqual(first.run.opponent);
  expect(resumed.run.startsAtMs).toBe(scheduled.run.startsAtMs);
  /** Latest authoritative race snapshot. */
  let run = resumed.run;
  for (let index = 0; index < 10; index++) {
    /** Server-provided current question and evaluation. */
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(PLAYER, {runId: run.runId, riddleId: riddle.riddleId,
      guess: riddle.evaluation!.answer, requestId: `fallback-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + 4500 + index * 1000})).run;
  }
  expect(run.status).toBe("completed");
  /** Settled server result reused across retries. */
  const outcome = await getRaceOutcomeForUser(PLAYER, run.runId, {db, nowMs: NOW + 15000});
  expect(outcome).toMatchObject({result: "player_win", correctCount: 10, publishable: false});
  expect((await getRaceOutcomeForUser(PLAYER, run.runId, {db, nowMs: NOW + 16000})).adjustedFinishMs).toBe(outcome.adjustedFinishMs);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  await expect(publishRaceChallengeForUser(PLAYER, {runId: run.runId, requestId: "fallback-publish-0001"}, {db, nowMs: NOW + 17000})).rejects.toThrow();
});

it("rejects an unrelated owner, changed category and expired offer", async () => {
  /** Owner-bound fallback selected by the real service. */
  const offered = await find();
  /** Fallback preparation request shared by concurrent deliveries. */
  const input = {locale: "en" as const, categoryId: offered.categoryId, fallbackOfferId: offered.offerId, requestId: "fallback-unauthorized"};
  await expect(startRaceRunForUser(CREATOR, input, {db, nowMs: NOW})).rejects.toMatchObject({code: "permission-denied"});
  await expect(startRaceRunForUser(PLAYER, {...input, categoryId: "science"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "invalid-argument"});
  await expect(startRaceRunForUser(PLAYER, input, {db, nowMs: NOW + 60000})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("raceRuns").get()).empty).toBe(true);
});

it("settles an unattended fallback exactly at its immutable finish", async () => {
  /** Owner-bound fallback selected by the real service. */
  const offered = await find();
  /** Accepted fallback race. */
  const first = await startRaceRunForUser(PLAYER, {locale: "en", categoryId: offered.categoryId,
    fallbackOfferId: offered.offerId, requestId: "fallback-loss-start"}, {db, nowMs: NOW});
  /** Immutable finish attached to the selected opponent. */
  const finish = first.run.opponent!.adjustedFinishMs;
  /** Settled server result reused across retries. */
  const outcome = await getRaceOutcomeForUser(PLAYER, first.run.runId, {db, nowMs: NOW + finish + 1});
  expect(outcome).toMatchObject({result: "ghost_win", wallFinishMs: finish, opponentAdjustedFinishMs: finish});
  /** A fresh read retains the selected rival and countdown. */
  const resumed = await resumeRaceRunForUser(PLAYER, first.run.runId, {db, nowMs: NOW + finish + 1000});
  expect(resumed.run.status).toBe("completed");
  expect(resumed.run.opponent).toEqual(first.run.opponent);
});

it("prefers a published human recording and creates no fallback offer for that search", async () => {
  /** Latest authoritative race snapshot. */
  let run = (await startRaceRunForUser(CREATOR, {locale: "en", categoryId: "history", requestId: "human-create-0001", includeEvaluation: true}, {db, nowMs: NOW})).run;
  for (let index = 0; index < 10; index++) {
    /** Server-provided current question and evaluation. */
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(CREATOR, {runId: run.runId, riddleId: riddle.riddleId,
      guess: riddle.evaluation!.answer, requestId: `human-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + (index + 1) * 9000})).run;
  }
  /** Published human recording eligible for discovery. */
  const challenge = await publishRaceChallengeForUser(CREATOR, {runId: run.runId, requestId: "human-publish-0001"}, {db, nowMs: NOW + 100000});
  /** Canonical matchmaking response under test. */
  const response = await findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "human-match-0001"}, {db, nowMs: NOW + 110000});
  expect(response).toMatchObject({status: "matched", challenge: {challengeId: challenge.challengeId}});
  expect((await db.collection("raceBotOffers").get()).empty).toBe(true);
});

it("does not conceal corrupt matchmaking projections with a fallback", async () => {
  /** Captured expected corrupt-projection diagnostics. */
  const logging = jest.spyOn(logger, "warn").mockImplementation(() => {});
  await db.doc("raceMatchCandidates/broken").set({provider: "jest", locale: "en", status: "active", rulesVersion: "race10_v1",
    performanceBucket: 11, selectionKey: "a".repeat(64), expiresAtMs: NOW + 100000});
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "corrupt-search-0001"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "unavailable"});
    expect((await db.collection("raceBotOffers").get()).empty).toBe(true);
  } finally {logging.mockRestore();}
});

it.each(["foreign-request-0001", "        "])("rejects a fallback receipt whose request no longer matches its physical key: %s", async requestId => {
  /** A genuine empty lookup creates the canonical owner/request receipt. */
  const offered = await find("identity-search-0001");
  /** Shape-valid corruption must fail before another fallback is advertised. */
  const ref = db.doc(`raceBotOffers/${offered.offerId}`);
  await ref.update({requestId});
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "identity-search-0001"}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "data-loss"});
  expect((await ref.get()).data()?.requestId).toBe(requestId);
  expect((await db.collection("raceRuns").get()).empty).toBe(true);
});

it.each([false, true])("retains an issued fallback when a human becomes available, accepted=%s", async accepted => {
  /** The original empty pool fixes the fallback for this search identity. */
  const requestId = "cross-kind-search-0001", offered = await find(requestId);
  if (accepted) await startRaceRunForUser(PLAYER, {locale: "en", categoryId: offered.categoryId,
    fallbackOfferId: offered.offerId, requestId: "cross-kind-accept-0001", prepare: true}, {db, nowMs: NOW});
  /** A real creator recording arrives after the fallback was issued. */
  let run = (await startRaceRunForUser(CREATOR, {locale: "en", categoryId: "history", requestId: "cross-kind-create-0001", includeEvaluation: true}, {db, nowMs: NOW})).run;
  for (let index = 0; index < 10; index++) {
    /** Authority-provided current question for the recording. */
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(CREATOR, {runId: run.runId, riddleId: riddle.riddleId,
      guess: riddle.evaluation!.answer, requestId: `cross-kind-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + (index + 1) * 1000})).run;
  }
  await publishRaceChallengeForUser(CREATOR, {runId: run.runId, requestId: "cross-kind-publish-0001"}, {db, nowMs: NOW + 11000});
  if (accepted) await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW + 12000}))
    .rejects.toMatchObject({code: "already-exists", details: {matchmaking: {reason: "intent-consumed"}}});
  else await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW + 12000}))
    .resolves.toMatchObject({status: "empty", fallback: offered});
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
});

/** Publish a real completed recording to create a healthy human discovery pool. */
async function publishHuman(prefix: string) {
  /** Creator authority snapshot advances only through real server mutations. */
  let run = (await startRaceRunForUser(CREATOR, {locale: "en", categoryId: "history", requestId: `${prefix}-create`, includeEvaluation: true}, {db, nowMs: NOW})).run;
  for (let index = 0; index < 10; index++) {
    /** Server-selected question for this recording. */
    const riddle = run.currentRiddle!;
    run = (await submitRaceGuessForUser(CREATOR, {runId: run.runId, riddleId: riddle.riddleId, guess: riddle.evaluation!.answer,
      requestId: `${prefix}-answer-${index}`, includeEvaluation: true}, {db, nowMs: NOW + (index + 1) * 1000})).run;
  }
  return publishRaceChallengeForUser(CREATOR, {runId: run.runId, requestId: `${prefix}-publish`}, {db, nowMs: NOW + 11000});
}

it("replays a fallback that wins after recorded lookup's initial receipt read", async () => {
  /** Original fallback content is a valid receipt created by the real service. */
  const requestId = "concurrent-kind-search", offered = await find(requestId);
  /** Temporarily absent receipt models the stale ingress snapshot. */
  const ref = db.doc(`raceBotOffers/${offered.offerId}`), stored = (await ref.get()).data()!;
  await ref.delete();await publishHuman("concurrent-kind-human");
  /** Keep actual Firestore transactions while installing a concurrent fallback winner. */
  const original = db.runTransaction.bind(db);
  /** Inject exactly before canonical inspection begins. */
  let installed = false;
  /** Both commit paths see the canonical fallback winner. */
  const transactions = jest.spyOn(db, "runTransaction").mockImplementation(async (operation, options) => {
    if (!installed) {installed = true;await ref.set(stored);}
    return original(operation, options);
  });
  try {
    await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW + 12000}))
      .resolves.toMatchObject({status: "empty", fallback: offered});
    expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
    expect((await ref.get()).data()).toEqual(stored);
  } finally {transactions.mockRestore();}
});

it("does not issue a fallback over a recorded transaction winner", async () => {
  await publishHuman("recorded-kind-human");
  /** A recorded lookup commits the original search receipt. */
  const requestId = "recorded-kind-search", input = {locale: "en" as const, categoryId: "history" as const, requestId};
  expect((await findRecordedRaceMatch(PLAYER, input, {db, nowMs: NOW + 12000})).status).toBe("matched");
  await expect(offerRaceBot(db, PLAYER, input, requestId, NOW + 12000, emptyRaceMatchProfile(), DEFAULT_RACE_MATCH_CONTEXT))
    .rejects.toMatchObject({code: "aborted"});
  expect((await db.collection("raceBotOffers").get()).empty).toBe(true);
});

it("returns new-intent recovery for an expired fallback even when a human is now available", async () => {
  /** Expiry belongs to the original fallback, independent of changing discovery availability. */
  const requestId = "expired-kind-search";
  await find(requestId);await publishHuman("expired-kind-human");
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId}, {db, nowMs: NOW + 60000}))
    .rejects.toMatchObject({code: "failed-precondition", details: {matchmaking: {reason: "intent-expired", recovery: "new-intent"}}});
  expect((await db.collection("raceMatchOffers").get()).empty).toBe(true);
});

it("rejects fallback category corruption that contradicts its explicit search preference", async () => {
  /** Explicit category discovery must pin both the requested and selected category. */
  const requestId = "category-integrity-search";
  /** Canonical fallback created from an authenticated category search. */
  const response = await findRecordedRaceMatch(PLAYER, {locale: "en", categoryId: "history", requestId}, {db, nowMs: NOW});
  if (response.status !== "empty" || !response.fallback) throw new Error("Expected category fallback");
  /** Shape-valid category replacement contradicts the original search selection. */
  const ref = db.doc(`raceBotOffers/${response.fallback.offerId}`);
  await ref.update({categoryId: "science"});
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", categoryId: "history", requestId}, {db, nowMs: NOW}))
    .rejects.toMatchObject({code: "data-loss"});
  await expect(startRaceRunForUser(PLAYER, {locale: "en", categoryId: "science", fallbackOfferId: response.fallback.offerId,
    requestId: "category-corruption-accept"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.collection("raceRuns").get()).empty).toBe(true);
  expect((await ref.get()).data()).toMatchObject({categoryId: "science", requestedCategoryId: "history"});
});

import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {readyRaceRunForUser} from "../../race/raceService";
import {raceDeckContentVersion} from "../../race/raceDeckSnapshot";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Isolated Firestore authority for stale preparation and archive availability. */
let db: FirebaseFirestore.Firestore;
/** Valid historical attribution remains linked to its owned prepared run. */
const offerId = "a".repeat(64);
/** Preparation has not accepted a scored action or countdown. */
const fixture = (versioned: boolean): RaceRunRecord => ({runId: "expiry-run", userId: "expiry-player", role: "challenger",
  ...(versioned ? {recordVersion: 1 as const} : {}), status: "prepared", challengeId: "expiry-challenge",
  matchOfferId: offerId, categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "expiry-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 0, preparationExpiresAtMs: 2000,
  hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {displayName: "Creator", subjectUserId: "expiry-creator", adjustedFinishMs: 10000, events: []}});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("readiness-expiry-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "raceChallenges", "raceMatchOffers", "users", "jestAccountDeletionTombstones",
    "racePerformanceOutbox", "raceSettlementOutbox"].map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/expiry-player").set({displayName: "Player", coins: 0});
  await db.doc(`raceMatchOffers/${offerId}`).set({userId: "expiry-player", challengeId: "expiry-challenge",
    fingerprint: JSON.stringify({locale: "en", categoryId: "history"}), createdAtMs: 500, expiresAtMs: 10000,
    acceptedRunId: "expiry-run", acceptedAtMs: 1000, locale: "en", expectedPerformanceMs: 10000});
});

/** Archive variants must affect admission, but never prevent already-expired cleanup. */
async function seedArchive(state: string): Promise<void> {
  if (state === "missing") return;
  if (state === "malformed") {await db.doc("raceChallenges/expiry-challenge").set({status: "active"}); return;}
  /** Immutable recording content is complete even when publication is no longer eligible. */
  const riddles = fixture(false).riddles;
  await db.doc("raceChallenges/expiry-challenge").set({challengeId: "expiry-challenge", creatorId: "expiry-creator",
    creatorRunId: "expiry-recording", creatorSnapshot: {displayName: "Creator"}, categoryId: "history", locale: "en",
    deckId: "expiry-original-deck", canonicalRiddleIds: riddles.map(riddle => riddle.canonicalRiddleId), riddles,
    snapshotVersion: 1, targetCorrect: 10, creatorWallFinishMs: 10000, creatorHintPenaltyMs: 0,
    creatorSkipPenaltyMs: 0, creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 10000, ghostEvents: [], rules: RACE_RULES,
    contentVersion: raceDeckContentVersion(riddles), status: state === "revoked" ? "revoked" : "active",
    createdAtMs: 500, expiresAtMs: state === "expired" ? 1000 : 10000});
}

describe.each([false, true])("prepared archive cleanup, recordVersion1=%s", versioned => {
  it("still schedules an eligible archive before expiry", async () => {
    await db.doc("raceRuns/expiry-run").set(fixture(versioned));
    await seedArchive("active");
    /** An eligible source retains the full accepted countdown lead-in. */
    const response = await readyRaceRunForUser("expiry-player", {runId: "expiry-run", requestId: "expiry-ready"}, {db, nowMs: 1500});
    expect(response.run).toMatchObject({status: "scheduled", startsAtMs: 4500});
    expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toMatchObject({startsAtMs: 4500, readinessAcceptedAtMs: 1500});
  });

  it.each(["owner", "block", "presentation"])("expiry retains %s acceptance guard and rolls back attribution", async guard => {
    await db.doc("raceRuns/expiry-run").set({...fixture(versioned),
      ...(guard === "presentation" ? {opponent: {...fixture(versioned).opponent!, avatarUrl: "not-a-url"}} : {})});
    if (guard === "block") await db.doc("users/expiry-player/blockedRivals/expiry-creator").set({blockedAtMs: 1000});
    /** Expiry never grants access to a different owner or accepts an invalid public response. */
    const run = (await db.doc("raceRuns/expiry-run").get()).data();
    /** Rejected cleanup cannot mark downstream attribution terminal. */
    const offer = (await db.doc(`raceMatchOffers/${offerId}`).get()).data();
    await expect(readyRaceRunForUser(guard === "owner" ? "expiry-other" : "expiry-player",
      {runId: "expiry-run", requestId: "expiry-ready"}, {db, nowMs: 2000}))
      .rejects.toMatchObject({code: guard === "presentation" ? "data-loss" : "permission-denied"});
    expect((await db.doc("raceRuns/expiry-run").get()).data()).toEqual(run);
    expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toEqual(offer);
  });

  it.each(["missing", "malformed", "revoked", "expired"])("abandons at expiry despite %s archive, with concurrent replay", async state => {
    await db.doc("raceRuns/expiry-run").set(fixture(versioned));
    await seedArchive(state);
    /** Cleanup cannot create or repair the mutable publication source. */
    const archive = (await db.doc("raceChallenges/expiry-challenge").get()).data();
    /** Exact expiry is terminal; concurrent readiness must never schedule or grant. */
    const responses = await Promise.all([false, true].map(includeEvaluation => readyRaceRunForUser("expiry-player",
      {runId: "expiry-run", requestId: "expiry-ready", includeEvaluation}, {db, nowMs: 2000})));
    expect(responses.every(response => response.run.status === "abandoned" && response.run.correctCount === 0)).toBe(true);
    expect((await db.doc("raceRuns/expiry-run").get()).data()).toMatchObject({status: "abandoned", startedAtMs: 0,
      wallFinishMs: 0, finishedAtMs: 2000, result: null});
    expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toMatchObject({terminalStatus: "abandoned",
      terminalAtMs: 2000, finishedTen: false, actualPerformanceMs: null, correctCount: 0, adjustedFinishMs: 0});
    expect((await db.doc("users/expiry-player").get()).data()?.coins).toBe(0);
    expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
    expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
    expect((await db.doc("raceChallenges/expiry-challenge").get()).data()).toEqual(archive);
    /** Later replay retains the first cleanup clock and terminal attribution. */
    await readyRaceRunForUser("expiry-player", {runId: "expiry-run", requestId: "expiry-later"}, {db, nowMs: 3000});
    expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()?.terminalAtMs).toBe(2000);
  });

  it.each(["missing", "malformed", "revoked", "expired"])("still rejects %s archive before preparation expiry", async state => {
    await db.doc("raceRuns/expiry-run").set(fixture(versioned));
    await seedArchive(state);
    /** Admission rejects damaged or unavailable sources without consuming the attempt's clocks. */
    const run = (await db.doc("raceRuns/expiry-run").get()).data();
    /** Publication rejection retains the pending accepted offer. */
    const offer = (await db.doc(`raceMatchOffers/${offerId}`).get()).data();
    await expect(readyRaceRunForUser("expiry-player", {runId: "expiry-run", requestId: "expiry-ready"}, {db, nowMs: 1500}))
      .rejects.toMatchObject({code: state === "malformed" ? "internal" : "failed-precondition"});
    expect((await db.doc("raceRuns/expiry-run").get()).data()).toEqual(run);
    expect((await db.doc(`raceMatchOffers/${offerId}`).get()).data()).toEqual(offer);
  });
});

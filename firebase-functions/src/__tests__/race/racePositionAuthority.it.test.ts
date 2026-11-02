import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "@riddle-quest/core/race";
import {getRaceOutcomeForUser, resumeRaceRunForUser, publishRaceChallengeForUser} from "../../race/raceService";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Public-interface regressions run exclusively against the local demo emulator. */
let db: FirebaseFirestore.Firestore;
/** Complete deck cannot justify ten clears on its first owned question. */
const fixture = (creator = false): RaceRunRecord => ({runId: "position-run", userId: "position-player", role: creator ? "creator" : "challenger",
  status: "completed", result: creator ? "recorded" : "player_win", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version,
  deckId: "position-deck", riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 10, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [], wallFinishMs: 5000, finishedAtMs: 6000,
  ...(!creator ? {challengeId: "position-challenge", opponent: {subjectUserId: "position-creator", displayName: "Creator",
    adjustedFinishMs: 10000, events: []}} : {})});
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("position-authority-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "raceDecks", "raceChallenges", "raceMatchCandidates", "racePerformanceOutbox", "raceSettlementOutbox",
    "jestAccountDeletionTombstones"].map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/position-player").set({displayName: "Player", coins: 100});
  await db.doc("raceDecks/position-deck").set({deckId: "position-deck", categoryId: "history", locale: "en", contentVersion: "position-content",
    canonicalRiddleIds: fixture().riddles.map(riddle => riddle.canonicalRiddleId), rulesVersion: RACE_RULES.version, createdAtMs: 1000});
});

it.each([["resume", undefined], ["resume", 1], ["outcome", undefined], ["outcome", 1], ["publish", undefined], ["publish", 1]] as const)(
  "rejects an impossible ten-clear position through %s, version=%s", async (operation, recordVersion) => {
    /** Legacy gaps do not authorize a score beyond the furthest owned position reached. */
    const run = {...fixture(operation === "publish"), ...(recordVersion ? {recordVersion} : {})};
    await db.doc("raceRuns/position-run").set(run);
    /** Failed authority must not earn a clean win, expose a recording or consume a command receipt. */
    const error = await (operation === "resume" ? resumeRaceRunForUser("position-player", "position-run", {db, nowMs: 7000})
      : operation === "outcome" ? getRaceOutcomeForUser("position-player", "position-run", {db, nowMs: 7000})
        : publishRaceChallengeForUser("position-player", {runId: "position-run", requestId: "position-publish"}, {db, nowMs: 7000}))
      .then(() => null, failure => failure);
    expect((await db.doc("raceRuns/position-run").get()).data()).toEqual(run);
    expect((await db.doc("users/position-player").get()).data()).toEqual({displayName: "Player", coins: 100});
    expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
    expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
    expect((await db.collection("raceChallenges").get()).empty).toBe(true);
    expect((await db.collection("raceRuns/position-run/requests").get()).empty).toBe(true);
    expect(error).toMatchObject({code: "data-loss"});
    await db.doc("raceRuns/position-run").update({currentPosition: 9});
    /** Explicitly repaired progress supports the original command and its concurrent duplicate exactly once. */
    await Promise.all([0, 1].map(() => operation === "resume" ? resumeRaceRunForUser("position-player", "position-run", {db, nowMs: 7000})
      : operation === "outcome" ? getRaceOutcomeForUser("position-player", "position-run", {db, nowMs: 7000})
        : publishRaceChallengeForUser("position-player", {runId: "position-run", requestId: "position-publish"}, {db, nowMs: 7000})));
    expect((await db.doc("users/position-player").get()).data()?.coins).toBe(operation === "publish" ? 125 : 175);
    expect((await db.collection("raceChallenges").get()).size).toBe(operation === "publish" ? 1 : 0);
  });

it.each([undefined, 1] as const)("rejects impossible unfinished score even without retained events, version=%s", async recordVersion => {
  /** Removing terminal-only fields produces an otherwise valid active source. */
  const {result: _result, wallFinishMs: _wall, finishedAtMs: _finish, ...base} = fixture();
  /** Nine clears cannot still be waiting on the first owned question. */
  const run = {...base, ...(recordVersion ? {recordVersion} : {}), status: "active", correctCount: 9};
  await db.doc("raceRuns/position-run").set(run);
  await expect(resumeRaceRunForUser("position-player", "position-run", {db, nowMs: 2000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/position-run").get()).data()).toEqual(run);
  await db.doc("raceRuns/position-run").update({currentPosition: 9});
  expect((await resumeRaceRunForUser("position-player", "position-run", {db, nowMs: 2000})).run.currentRiddle?.position).toBe(9);
});

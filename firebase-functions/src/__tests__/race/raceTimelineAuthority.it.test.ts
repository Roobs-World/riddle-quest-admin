import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {submitRaceGuessForUser, resumeRaceRunForUser, getRaceOutcomeForUser} from "../../race/raceService";
import {raceOutcome, type RaceRunRecord} from "../../race/runs/raceEngine";
import {processRaceDeadline, replayRaceDeadline} from "../../race/recovery/raceDeadlineRecovery";

/** Demo-only authority for event history and reward rollback regressions. */
let db: FirebaseFirestore.Firestore;
/** A paid hint is retained in history but its aggregate charge has been corrupted away. */
const fixture = (): RaceRunRecord => ({runId: "timeline-run", userId: "timeline-player", role: "challenger", status: "active",
  categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "timeline-deck", challengeId: "timeline-challenge",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 9, correctCount: 9, guessesUsed: 0,
  hintUsed: true, revealedLetters: [{index: 0, letter: "t"}], startedAtMs: 1000, lastActionAtMs: 1500,
  hintPenaltyMs: 0, skipPenaltyMs: 0,
  events: [{sequence: 0, type: "hint", riddlePosition: 9, wallElapsedMs: 500, penaltyAddedMs: 15000,
    totalPenaltyMs: 15000, adjustedElapsedMs: 15500, correctCount: 9}],
  opponent: {displayName: "Rival", subjectUserId: "timeline-creator", adjustedFinishMs: 10000, events: []}});
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("timeline-authority-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/timeline-run"));
  await db.doc("racePerformanceOutbox/timeline-run").delete();
  await db.doc("raceSettlementOutbox/timeline-run").delete();
  await db.doc("raceDeadlineFailures/timeline-run").delete();
  await db.doc("users/timeline-player").set({displayName: "Player", coins: 0});
  await db.doc("raceRuns/timeline-run").set(fixture());
});

it("quarantines inconsistent known history, validates repair and settles the retained charge without a false reward", async () => {
  await db.doc("raceRuns/timeline-run").update({deadlineAtMs: 11000});
  await processRaceDeadline(db, db.doc("raceRuns/timeline-run"), 12000);
  expect((await db.doc("raceDeadlineFailures/timeline-run").get()).data()?.state).toBe("quarantined");
  expect((await db.doc("raceRuns/timeline-run").get()).data()?.deadlineAtMs).toBeUndefined();
  await expect(replayRaceDeadline(db, "timeline-run", 12001)).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("users/timeline-player").get()).data()?.coins).toBe(0);
  /** Explicit local repair restores the missing aggregate charge; automatic quarantine never rewrites scored history. */
  await db.doc("raceRuns/timeline-run").update({hintPenaltyMs: 15000});
  await replayRaceDeadline(db, "timeline-run", 12002);
  await processRaceDeadline(db, db.doc("raceRuns/timeline-run"), 12003);
  /** Settlement now follows the retained paid action and genuine terminal clamp. */
  const source = (await db.doc("raceRuns/timeline-run").get()).data()!;
  expect(source.settledOutcome).toMatchObject({result: "ghost_win", hintPenaltyMs: 15000, adjustedFinishMs: 15000});
  expect((await db.doc("users/timeline-player").get()).data()?.stats.multiplayerWins ?? 0).toBe(0);
  /** Successful repair remains idempotent when another outcome reader arrives. */
  const account = (await db.doc("users/timeline-player").get()).data();
  await getRaceOutcomeForUser("timeline-player", "timeline-run", {db, nowMs: 12004});
  expect((await db.doc("users/timeline-player").get()).data()).toEqual(account);
});

it("rejects a retained hint with a removed charge before a tenth answer can manufacture a clean win", async () => {
  /** Current account and authority cannot change on rejection. */
  const account = (await db.doc("users/timeline-player").get()).data();
  /** Full canonical state includes the corrupt but individually well-shaped event. */
  const before = (await db.doc("raceRuns/timeline-run").get()).data();
  await expect(submitRaceGuessForUser("timeline-player", {runId: "timeline-run", riddleId: "q-9", guess: "test", requestId: "timeline-final"},
    {db, nowMs: 2000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/timeline-run").get()).data()).toEqual(before);
  expect((await db.doc("users/timeline-player").get()).data()).toEqual(account);
  expect((await db.collection("raceRuns/timeline-run/requests").get()).empty).toBe(true);
  expect((await db.doc("racePerformanceOutbox/timeline-run").get()).exists).toBe(false);
  expect((await db.doc("raceSettlementOutbox/timeline-run").get()).exists).toBe(false);
});

it.each([false, true])("rejects the false winner on outcome and resume even with matching settlement metadata: %s", async settled => {
  /** Arithmetic-only terminal validation previously allowed this false result and clean-run achievement. */
  const run = {...fixture(), status: "completed" as const, result: "player_win" as const, correctCount: 10,
    wallFinishMs: 1000, finishedAtMs: 2000};
  await db.doc("raceRuns/timeline-run").set({...run,
    ...(settled ? {settledAtMs: 2000, settledOutcome: raceOutcome(run, 2000)} : {})});
  /** Complete account snapshot covers balance, stats and achievements. */
  const account = (await db.doc("users/timeline-player").get()).data();
  await expect(getRaceOutcomeForUser("timeline-player", "timeline-run", {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
  await expect(resumeRaceRunForUser("timeline-player", "timeline-run", {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("users/timeline-player").get()).data()).toEqual(account);
  expect((await db.doc("racePerformanceOutbox/timeline-run").get()).exists).toBe(false);
  expect((await db.doc("raceSettlementOutbox/timeline-run").get()).exists).toBe(false);
});

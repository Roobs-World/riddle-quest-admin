import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/core/race/index.js";
import {requestRaceHintForUser, skipRaceRiddleForUser, submitRaceGuessForUser, resumeRaceRunForUser, getRaceOutcomeForUser} from "../../race/raceService";
import {applyRaceHint, type RaceRunRecord} from "../../race/raceEngine";
import {requestDocumentId} from "../../race/raceSetupService";

/** Local-only storage for reordered command arrival and transaction retry regressions. */
let db: FirebaseFirestore.Firestore;
/** Shared epoch makes every command's sampled time and resulting duration explicit. */
const START = 1000000;
/** Canonical run whose final question can receive two independently issued commands. */
const fixture = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "ordering-run", userId: "ordering-player", role: "creator", status: "active", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "ordering-deck", riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`, text: "A clue", answer: "test", position,
  })), currentPosition: 9, correctCount: 9, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: START, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [], ...overrides,
});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("command-ordering-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/ordering-run"));
  await db.recursiveDelete(db.doc("users/ordering-player"));
  await db.doc("racePerformanceOutbox/ordering-run").delete();
  await db.doc("users/ordering-player").set({displayName: "Player", coins: 0});
  await db.doc("raceRuns/ordering-run").set(fixture());
});

it("does not backdate a tenth skip after a newer accepted hint or manufacture a win", async () => {
  await db.doc("raceRuns/ordering-run").set(fixture({role: "challenger",
    opponent: {displayName: "Rival", adjustedFinishMs: 60750, events: []}}));
  /** The newer sampled command commits first, as can happen during a transaction retry. */
  const hinted = await requestRaceHintForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", requestId: "ordering-hint-newer"},
    {db, nowMs: START + 1000});
  expect(hinted.run.wallElapsedMs).toBe(1000);
  /** The older request reaches its successful transaction attempt after that hint. */
  const skipped = await skipRaceRiddleForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", requestId: "ordering-skip-older"},
    {db, nowMs: START + 500});
  expect(skipped.run).toMatchObject({status: "completed", correctCount: 10, wallElapsedMs: 1000, adjustedElapsedMs: 61000});
  expect((await db.doc("raceRuns/ordering-run").get()).data()?.settledOutcome.result).toBe("ghost_win");
  expect((await db.doc("users/ordering-player").get()).data()?.stats.multiplayerWins ?? 0).toBe(0);
  expect(skipped.run.serverNowMs).toBe(START + 1000);
  /** Read recovery sampled earlier cannot backdate reward presentation or replay the grant. */
  const outcome = await getRaceOutcomeForUser("ordering-player", "ordering-run", {db, nowMs: START + 600});
  expect(outcome).toMatchObject({result: "ghost_win", adjustedFinishMs: 61000});
  expect((await db.doc("raceRuns/ordering-run").get()).data()).toMatchObject({
    lastActionAtMs: START + 1000, settledAtMs: START + 1000, achievementOutcomePresentedAtMs: START + 1000,
  });
});

it("retains the last accepted wrong-guess clock even without a scoring event", async () => {
  await submitRaceGuessForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", guess: "xxxx", requestId: "ordering-wrong-newer"},
    {db, nowMs: START + 1000});
  /** Wrong guesses do not append ghost events; their accepted clock still constrains later actions. */
  const hinted = await requestRaceHintForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", requestId: "ordering-hint-older"},
    {db, nowMs: START + 500});
  expect(hinted.run.wallElapsedMs).toBe(1000);
  /** Resume preserves the accepted live clock even if its own request was sampled earlier. */
  const resumed = await resumeRaceRunForUser("ordering-player", "ordering-run", {db, nowMs: START + 600});
  expect(resumed.run).toMatchObject({wallElapsedMs: 1000, serverNowMs: START + 1000});
});

it("uses a legacy scoring-event clock before the new action marker exists", async () => {
  /** Historical engine output has a scoring event but no command acceptance marker. */
  const legacy = applyRaceHint(fixture({role: "challenger", opponent: {displayName: "Rival", adjustedFinishMs: 60750, events: []}}),
    {riddleId: "q-9"}, START + 1000).run;
  expect(legacy.lastActionAtMs).toBeUndefined();
  await db.doc("raceRuns/ordering-run").set(legacy);
  /** The first post-upgrade action derives and then retains the historical clock floor. */
  const skipped = await skipRaceRiddleForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", requestId: "ordering-legacy-skip"},
    {db, nowMs: START + 500});
  expect(skipped.run.adjustedElapsedMs).toBe(61000);
  expect((await db.doc("raceRuns/ordering-run").get()).data()).toMatchObject({lastActionAtMs: START + 1000,
    settledOutcome: {result: "ghost_win"}});
});

it("serializes distinct simultaneous hints without regressing event clocks", async () => {
  /** Independent tabs have distinct IDs and both accepted hints must be represented once. */
  const responses = await Promise.all([1000, 500].map((elapsed, index) => requestRaceHintForUser("ordering-player",
    {runId: "ordering-run", riddleId: "q-9", requestId: `ordering-parallel-hint-${index}`}, {db, nowMs: START + elapsed})));
  expect(new Set(responses.map(response => response.index)).size).toBe(2);
  /** Transaction retries retain committed progress and two actual charges. */
  const stored = (await db.doc("raceRuns/ordering-run").get()).data()!;
  expect(stored).toMatchObject({lastActionAtMs: START + 1000, hintPenaltyMs: 30000, rateLimitActionCount: 2});
  expect(stored.events).toHaveLength(2);
  expect(stored.events[1].wallElapsedMs).toBeGreaterThanOrEqual(stored.events[0].wallElapsedMs);
});

it("replays simultaneous duplicate hints once without changing their original accepted clock", async () => {
  /** Every transport retry shares the command identity and receives its first committed response. */
  const input = {runId: "ordering-run", riddleId: "q-9", requestId: "ordering-duplicate-hint"};
  /** Parallel retries cannot mint additional hints or charges. */
  const responses = await Promise.all(Array.from({length: 4}, () => requestRaceHintForUser("ordering-player", input, {db, nowMs: START + 1000})));
  expect(responses.every(response => JSON.stringify(response) === JSON.stringify(responses[0]))).toBe(true);
  await submitRaceGuessForUser("ordering-player", {runId: "ordering-run", riddleId: "q-9", guess: "xxxx", requestId: "ordering-later-wrong"},
    {db, nowMs: START + 2000});
  /** An exact replay retains its original timestamp without advancing or charging again. */
  const before = (await db.doc("raceRuns/ordering-run").get()).data()!;
  expect(await requestRaceHintForUser("ordering-player", input, {db, nowMs: START + 3000})).toEqual(responses[0]);
  expect((await db.doc("raceRuns/ordering-run").get()).data()).toEqual(before);
  expect(before).toMatchObject({lastActionAtMs: START + 2000, hintPenaltyMs: 15000, rateLimitActionCount: 2});
  expect(before.events).toHaveLength(1);
  expect((await db.doc(`raceRuns/ordering-run/requests/${requestDocumentId("ordering-player", input.requestId)}`).get()).data()?.createdAtMs)
    .toBe(START + 1000);
});

it("still rejects scoring before a scheduled start without persisting a clock marker", async () => {
  await db.doc("raceRuns/ordering-run").set(fixture({status: "scheduled", startedAtMs: START + 3000, currentPosition: 0, correctCount: 0}));
  /** No prior accepted action exists, so the scheduled start is never used as an artificial floor. */
  const before = (await db.doc("raceRuns/ordering-run").get()).data();
  await expect(requestRaceHintForUser("ordering-player", {runId: "ordering-run", riddleId: "q-0", requestId: "ordering-early-hint"},
    {db, nowMs: START + 2999})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc("raceRuns/ordering-run").get()).data()).toEqual(before);
  expect((await db.collection("raceRuns/ordering-run/requests").get()).empty).toBe(true);
});

it("rejects a historical full-score win backdated behind its scoring history before rewards", async () => {
  /** The pre-fix ordering failure, retained without the new marker as a historical storage record. */
  const corrupt = fixture({role: "challenger", status: "completed", result: "player_win", correctCount: 10,
    hintPenaltyMs: 15000, skipPenaltyMs: 45000, wallFinishMs: 500, finishedAtMs: START + 500,
    opponent: {displayName: "Rival", adjustedFinishMs: 60750, events: []}, events: [
      {sequence: 0, type: "hint", riddlePosition: 9, wallElapsedMs: 1000, penaltyAddedMs: 15000,
        totalPenaltyMs: 15000, adjustedElapsedMs: 16000, correctCount: 9},
      {sequence: 1, type: "skip", riddlePosition: 9, wallElapsedMs: 500, penaltyAddedMs: 45000,
        totalPenaltyMs: 60000, adjustedElapsedMs: 60500, correctCount: 10},
    ]});
  await db.doc("raceRuns/ordering-run").set(corrupt);
  /** Both canonical state and the player's complete account remain unchanged after rejection. */
  const account = (await db.doc("users/ordering-player").get()).data();
  await expect(getRaceOutcomeForUser("ordering-player", "ordering-run", {db, nowMs: START + 2000})).rejects.toMatchObject({code: "data-loss"});
  await expect(resumeRaceRunForUser("ordering-player", "ordering-run", {db, nowMs: START + 2000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/ordering-run").get()).data()).toEqual(corrupt);
  expect((await db.doc("users/ordering-player").get()).data()).toEqual(account);
  expect((await db.doc("racePerformanceOutbox/ordering-run").get()).exists).toBe(false);
});

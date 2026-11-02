import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {RACE_RULES} from "@riddle-quest/core/race";
import {getRaceOutcomeForUser, resumeRaceRunForUser, requestRaceHintForUser} from "../../race/raceService";
import {raceOutcome, raceDeadlineAtMs, type RaceRunRecord} from "../../race/raceEngine";
import {processRaceDeadline, replayRaceDeadline} from "../../race/raceDeadlineRecovery";

/** Destructive fixtures use an isolated local demo emulator only. */
let db: FirebaseFirestore.Firestore;
/** Canonical clean win, with no settlement or achievement markers yet. */
const terminal = (): RaceRunRecord => ({runId: "authority-run", userId: "authority-player", role: "challenger", status: "completed",
  result: "player_win", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "authority-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 9, correctCount: 10, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  wallFinishMs: 5000, finishedAtMs: 6000, challengeId: "authority-challenge",
  opponent: {displayName: "Creator", subjectUserId: "authority-creator", adjustedFinishMs: 10000, events: []}});
/** Already settled canonical outcome is independent of one-time reward presentation. */
const settled = (): RaceRunRecord => ({...terminal(), settledAtMs: 7000, settledOutcome: raceOutcome(terminal(), 7000)});
/** Owned unfinished state predating modern settlement support. */
const active = (): RaceRunRecord => {
  /** Terminal-only clocks and result are absent on real historical active runs. */
  const {result: _result, wallFinishMs: _wall, finishedAtMs: _finish, ...run} = terminal();
  return {...run, status: "active", currentPosition: 0, correctCount: 0};
};
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("settlement-authority-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "racePerformanceOutbox", "raceSettlementOutbox", "raceDeadlineFailures", "jestAccountDeletionTombstones"]
    .map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/authority-player").set({displayName: "Player", coins: 100});
});

it.each([
  {...terminal(), achievementProgressRecordedAtMs: 2000},
  {...terminal(), achievementOutcomePresentedAtMs: 7000},
  {...terminal(), settlementAwards: {newlyUnlockedAchievementIds: ["race_first_win"], achievementCoinsAwarded: 25}},
  {...settled(), settlementAwards: {newlyUnlockedAchievementIds: ["race_first_win"], achievementCoinsAwarded: 25}},
  {...settled(), achievementProgressRecordedAtMs: 9000},
  {...settled(), achievementProgressRecordedAtMs: 5000},
  {...settled(), achievementProgressRecordedAtMs: 7000, achievementOutcomePresentedAtMs: 6500},
  {...settled(), settledOutcome: {...settled().settledOutcome!, newlyUnlockedAchievementIds: ["race_first_win"], achievementCoinsAwarded: 25}},
  {...settled(), settledOutcome: {...settled().settledOutcome!, newCoins: 100}},
  {...settled(), status: "completed", result: "ghost_win", correctCount: 0, currentPosition: 0, hintPenaltyMs: 15000,
    wallFinishMs: 0, finishedAtMs: 1000, lastActionAtMs: 10000,
    settledOutcome: {runId: "authority-run", challengeId: "authority-challenge", result: "ghost_win", correctCount: 0,
      wallFinishMs: 0, hintPenaltyMs: 15000, skipPenaltyMs: 0, totalPenaltyMs: 15000, adjustedFinishMs: 15000,
      opponentAdjustedFinishMs: 10000, publishable: false, rematchEligible: true, newlyUnlockedAchievementIds: [], achievementCoinsAwarded: 0}},
])("rejects contradictory grant/presentation history without rewards or acknowledgements: %#", async run => {
  await db.doc("raceRuns/authority-run").set({...run, expiresAt: Timestamp.fromMillis(100000)});
  /** Both complete authority snapshots must remain untouched after rejection. */
  const before = (await db.doc("raceRuns/authority-run").get()).data();
  /** Preserve statistics and all unrelated account fields, not only its balance. */
  const account = (await db.doc("users/authority-player").get()).data();
  /** Inspect committed state before asserting the bounded error. */
  const error = await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 10000}).then(() => null, failure => failure);
  expect((await db.doc("raceRuns/authority-run").get()).data()).toEqual(before);
  expect((await db.doc("users/authority-player").get()).data()).toEqual(account);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  expect(error).toMatchObject({code: "data-loss"});
});

it.each([[undefined, 2000], [1, 2000], [1, 12000]] as const)(
  "rejects a paid hint against an unfinished run carrying an invalid grant marker, version=%s grant=%s", async (recordVersion, grantAtMs) => {
  /** Both supported legacy and modern runs must reject a grant recorded before any possible outcome. */
  const run = {...active(), ...(recordVersion ? {recordVersion} : {}), achievementProgressRecordedAtMs: grantAtMs};
  await db.doc("raceRuns/authority-run").set(run);
  /** A hint would otherwise finish against the ghost and skip the owner's completion progress. */
  const error = await requestRaceHintForUser("authority-player", {runId: "authority-run", riddleId: "q-0", currentAttempt: [],
    requestId: "authority-hint"}, {db, nowMs: 3000}).then(() => null, failure => failure);
  expect((await db.doc("raceRuns/authority-run").get()).data()).toEqual(run);
  expect((await db.doc("users/authority-player").get()).data()).toEqual({displayName: "Player", coins: 100});
  expect((await db.collection("raceRuns/authority-run/requests").get()).empty).toBe(true);
  expect(error).toMatchObject({code: "data-loss"});
  await db.doc("raceRuns/authority-run").update({achievementProgressRecordedAtMs: FieldValue.delete()});
  /** Explicit repair lets the identical paid command settle once without retaining its rejected marker. */
  const repaired = await requestRaceHintForUser("authority-player", {runId: "authority-run", riddleId: "q-0", currentAttempt: [],
    requestId: "authority-hint"}, {db, nowMs: 3000});
  expect(repaired.run).toMatchObject({status: "completed", totalPenaltyMs: 15000});
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(125);
  await requestRaceHintForUser("authority-player", {runId: "authority-run", riddleId: "q-0", currentAttempt: [],
    requestId: "authority-hint"}, {db, nowMs: 3500});
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(125);
});

it("does not acknowledge an accepted reward before its grant when a read sampled an older clock", async () => {
  await db.doc("raceRuns/authority-run").set({...settled(), achievementProgressRecordedAtMs: 7000,
    settlementAwards: {newlyUnlockedAchievementIds: ["race_first_win"], achievementCoinsAwarded: 25}});
  /** The newer transaction already settled while this request was in flight. */
  const outcome = await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 6500});
  expect(outcome).toMatchObject({achievementCoinsAwarded: 25, newCoins: 100});
  expect((await db.doc("raceRuns/authority-run").get()).data()?.achievementOutcomePresentedAtMs).toBe(7000);
  expect((await resumeRaceRunForUser("authority-player", "authority-run", {db, nowMs: 6200})).run.serverNowMs).toBe(7000);
});

it("recovers a legitimate historical active ghost-loss grant without reopening play or paying twice", async () => {
  await db.doc("raceRuns/authority-run").set({...active(), achievementProgressRecordedAtMs: 12000});
  await db.doc("users/authority-player").update({stats: {multiplayerGamesPlayed: 1}, unlockedAchievements: ["race_debut"]});
  /** Older outcome code granted after expiry while retaining active storage and no settlement receipt. */
  const account = (await db.doc("users/authority-player").get()).data();
  /** A stale sampled clock must still recover the already accepted historical terminal occurrence. */
  const response = await resumeRaceRunForUser("authority-player", "authority-run", {db, nowMs: 5000});
  expect(response.run).toMatchObject({status: "completed", serverNowMs: 12000, wallElapsedMs: 10000});
  expect((await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 6000})).result).toBe("ghost_win");
  expect((await db.doc("users/authority-player").get()).data()).toEqual(account);
  expect((await db.collection("racePerformanceOutbox").get()).size).toBe(1);
  expect((await db.collection("raceSettlementOutbox").get()).size).toBe(1);
});

it("retains the first legacy ghost result even when recovery happens beyond the later maximum", async () => {
  await db.doc("raceRuns/authority-run").set({...active(), achievementProgressRecordedAtMs: 12000});
  /** Late wall-clock recovery must not replace a result already granted under the older implementation. */
  const response = await resumeRaceRunForUser("authority-player", "authority-run", {db, nowMs: RACE_RULES.maxAdjustedTimeMs + 2000});
  expect(response.run).toMatchObject({status: "completed", wallElapsedMs: 10000});
  expect((await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: RACE_RULES.maxAdjustedTimeMs + 3000})).result)
    .toBe("ghost_win");
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(100);
});

it("recovers an old creator maximum-time grant without changing modern untimed recording rules", async () => {
  /** Legacy creator outcome code used the same maximum as challengers, while current recordings are untimed. */
  const {challengeId: _challenge, opponent: _opponent, ...run} = active();
  /** The old grant time proves that this particular recording had already timed out under the earlier implementation. */
  const grantedAtMs = 1000 + RACE_RULES.maxAdjustedTimeMs + 1;
  await db.doc("raceRuns/authority-run").set({...run, role: "creator", achievementProgressRecordedAtMs: grantedAtMs});
  /** Stale sampled recovery preserves the already accepted timeout and existing account. */
  const response = await resumeRaceRunForUser("authority-player", "authority-run", {db, nowMs: 2000});
  expect(response.run).toMatchObject({status: "timed_out", serverNowMs: grantedAtMs, wallElapsedMs: RACE_RULES.maxAdjustedTimeMs});
  expect((await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 3000})).result).toBe("timed_out");
  expect((await db.doc("users/authority-player").get()).data()).toEqual({displayName: "Player", coins: 100});
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
  await db.doc("raceRuns/modern-recording").set({...run, runId: "modern-recording", role: "creator", recordVersion: 1});
  expect((await resumeRaceRunForUser("authority-player", "modern-recording", {db, nowMs: grantedAtMs + 1000})).run.status).toBe("active");
});

it("preserves a previously granted terminal legacy outcome without inventing a second award receipt", async () => {
  await db.doc("raceRuns/authority-run").set({...terminal(), achievementProgressRecordedAtMs: 7000});
  expect((await resumeRaceRunForUser("authority-player", "authority-run", {db, nowMs: 6500})).run.serverNowMs).toBe(7000);
  expect((await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 6800})).achievementCoinsAwarded).toBe(0);
  expect((await db.doc("raceRuns/authority-run").get()).data()?.settlementAwards).toBeUndefined();
  expect((await db.doc("users/authority-player").get()).data()).toEqual({displayName: "Player", coins: 100});
});

it("quarantines an invalid grant marker and settles repaired deadline history exactly once", async () => {
  /** The retained due index enables the actual unattended processing path. */
  const run = {...active(), achievementProgressRecordedAtMs: 2000};
  await db.doc("raceRuns/authority-run").set({...run, deadlineAtMs: raceDeadlineAtMs(run), expiresAt: Timestamp.fromMillis(100000)});
  await processRaceDeadline(db, db.doc("raceRuns/authority-run"), 12000);
  expect((await db.doc("raceDeadlineFailures/authority-run").get()).data()).toMatchObject({state: "quarantined", failureCode: "data-loss"});
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(100);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  await expect(replayRaceDeadline(db, "authority-run", 13000)).rejects.toMatchObject({code: "data-loss"});
  await db.doc("raceRuns/authority-run").update({achievementProgressRecordedAtMs: FieldValue.delete()});
  await replayRaceDeadline(db, "authority-run", 14000);
  expect((await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 15000})).result).toBe("ghost_win");
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(125);
  await getRaceOutcomeForUser("authority-player", "authority-run", {db, nowMs: 16000});
  expect((await db.doc("users/authority-player").get()).data()?.coins).toBe(125);
  expect((await db.collection("racePerformanceOutbox").get()).size).toBe(1);
});

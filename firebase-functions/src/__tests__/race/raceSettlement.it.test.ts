import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {raceDeadlineAtMs, applyRaceSkip, type RaceRunRecord} from "../../race/raceEngine";
import {getRaceOutcomeForUser} from "../../race/raceReadService";
import {resumeRaceRunForUser} from "../../race/raceService";
import {settleRaceRun} from "../../race/raceSettlement";
import {deliverRaceSettlement} from "../../race/raceSettlementDelivery";
import {processRaceSettlementJobs} from "../../race/raceSettlementJobs";

/** Independent demo-project database; these tests never contact production. */
let db: FirebaseFirestore.Firestore;
/** Canonical active challenger fixture with a ten-second recorded opponent. */
const fixture = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run-1", userId: "player-1", challengeId: "challenge-1", role: "challenger", status: "active",
  categoryId: "history", locale: "en", rulesVersion: "race10_v1", deckId: "deck-1",
  riddles: [{riddleId: "q-1", canonicalRiddleId: "q:1", text: "A test clue", answer: "test", position: 0}],
  currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: 1_000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {subjectUserId: "creator-1", displayName: "Creator", adjustedFinishMs: 10_000, events: []},
  ...overrides,
});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("settlement-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "raceSettlementOutbox", "jestAccountDeletionTombstones"].map(
    (name) => db.recursiveDelete(db.collection(name)),
  ));
  await db.doc("users/player-1").set({displayName: "Challenger", coins: 0});
  await db.doc("users/creator-1").set({displayName: "Creator", coins: 0});
  const run = fixture();
  await db.doc("raceRuns/run-1").set({...run, deadlineAtMs: raceDeadlineAtMs(run), expiresAt: Timestamp.fromMillis(1_000_000)});
});

it("settles an idle ghost loss as a creator win rather than a zero-delta tie", async () => {
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  expect(outcome.result).toBe("ghost_win");
  expect(await deliverRaceSettlement("run-1", db, 12_001)).toBe(true);
  const inbox = await db.collection("users/creator-1/raceInbox").get();
  expect(inbox.docs[0].data()).toMatchObject({result: "win", adjustedDeltaMs: 0});
  expect((await db.doc("raceRuns/run-1").get()).data()).toMatchObject({status: "completed", settledAtMs: 12_000});
});

it("settles via resume and repeated outcome reads without duplicate owner rewards", async () => {
  await resumeRaceRunForUser("player-1", "run-1", {db, nowMs: 12_000});
  const results = await Promise.all(Array.from({length: 6}, () => getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_001})));
  expect(results.every((outcome) => outcome.result === "ghost_win")).toBe(true);
  expect(results.filter((outcome) => outcome.achievementCoinsAwarded > 0)).toHaveLength(1);
  expect((await db.doc("users/player-1").get()).data()).toMatchObject({coins: 25, stats: {multiplayerGamesPlayed: 1}});
  expect((await db.collection("raceSettlementOutbox").get()).size).toBe(1);
});

it("delivers concurrent/replayed outbox events once, including creator currency grants", async () => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  const results = await Promise.all(Array.from({length: 8}, () => deliverRaceSettlement("run-1", db, 12_001)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await db.collection("users/creator-1/raceInbox").get()).size).toBe(1);
  expect((await db.doc("users/creator-1").get()).data()).toMatchObject({coins: 50, stats: {multiplayerGamesPlayed: 1, multiplayerWins: 1}});
});

it.each(["block", "creator-deletion", "challenger-deletion"])("suppresses delayed identity/reward delivery after %s", async (reason) => {
  await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 12_000});
  if (reason === "block") await db.doc("users/creator-1/blockedRivals/player-1").set({blocked: true});
  else await db.doc(`jestAccountDeletionTombstones/${reason === "creator-deletion" ? "creator-1" : "player-1"}`).set({deleted: true});
  expect(await deliverRaceSettlement("run-1", db, 12_001)).toBe(false);
  expect((await db.collection("users/creator-1/raceInbox").get()).empty).toBe(true);
  expect((await db.doc("users/creator-1").get()).data()?.coins).toBe(0);
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()).toMatchObject({delivered: true, suppressed: true});
});

it("settles unattended deadlines and retries missed event delivery with a bounded worker", async () => {
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("raceRuns/run-1").get()).data()?.settledOutcome.result).toBe("ghost_win");
  expect((await db.doc("raceSettlementOutbox/run-1").get()).data()?.delivered).toBe(true);
  await processRaceSettlementJobs(db, 12_100);
  expect((await db.doc("users/player-1").get()).data()?.stats.multiplayerGamesPlayed).toBe(1);
});

it("settles maximum-time expiry independently of ghost completion", async () => {
  await db.doc("raceRuns/run-1").update({opponent: FieldValue.delete()});
  const outcome = await getRaceOutcomeForUser("player-1", "run-1", {db, nowMs: 301_000});
  expect(outcome.result).toBe("timed_out");
});

it("derives a loss when the tenth clearing action pushes adjusted time past the ghost", async () => {
  const run = fixture({correctCount: 9});
  const completed = applyRaceSkip(run, {riddleId: "q-1"}, 2_000);
  expect(completed.result).toBe("ghost_win");
  await db.runTransaction(async (transaction) => {await settleRaceRun(transaction, db, completed, 2_000);});
  await deliverRaceSettlement("run-1", db, 2_001);
  expect((await db.collection("users/creator-1/raceInbox").get()).docs[0].data().result).toBe("win");
});

it("never recreates a deleted owner or grants its delayed reward", async () => {
  await db.doc("jestAccountDeletionTombstones/player-1").set({deleted: true});
  await db.doc("users/player-1").delete();
  await processRaceSettlementJobs(db, 12_000);
  expect((await db.doc("users/player-1").get()).exists).toBe(false);
  expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
});

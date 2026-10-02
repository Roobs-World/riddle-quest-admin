import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {RaceRunRecord} from "../../race/raceEngine";
import {RACE_RULES} from "@qwordly/core/race";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {recordFacebookTournamentRun} from "../../race/facebookTournament";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the start interface. */
const START = Date.UTC(2026, 7, 19);
/** Defines the user id value. */
const USER_ID = `facebook_${"e".repeat(40)}`;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Provides run behavior. */
const run = (id: string, wallFinishMs: number): RaceRunRecord => ({
  runId: id,
  userId: USER_ID,
  role: "creator",
  status: "completed",
  result: "recorded",
  categoryId: "history",
  locale: "fr",
  rulesVersion: "race10_v1",
  deckId: `deck-${id}`,
  riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `${id}-riddle-${position}`,
    canonicalRiddleId: `history:${position}`,
    text: `Indice ${position}`,
    answer: "réponse",
    position,
  })),
  currentPosition: 10,
  correctCount: 10,
  guessesUsed: 1,
  hintUsed: false,
  revealedLetters: [],
  startedAtMs: START + 1_000,
  finishedAtMs: START + 1_000 + wallFinishMs,
  wallFinishMs,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  events: [],
});

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Local Firestore emulator required");
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(
    ["raceRuns", "raceDecks", "facebookTournaments", "users", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles"].map((name) => db.recursiveDelete(db.collection(name))),
  );
});

afterAll(async () =>
  Promise.all(
    ["raceRuns", "raceDecks", "facebookTournaments", "users", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles"].map((name) => db.recursiveDelete(db.collection(name))),
  ),
);

it("converges concurrent official submissions on the fastest score without economy writes", async () => {
  /** Provides runs behavior. */
  const runs = [run("tournament-slow", 50_000), run("tournament-fast", 25_000), run("tournament-mid", 35_000)];
  await db.doc(`users/${USER_ID}`).set({coins: 300});
  await Promise.all(
    runs.flatMap((value) => [
      db.doc(`raceRuns/${value.runId}`).set(value),
      db.doc(`raceDecks/${value.deckId}`).set({
        deckId: value.deckId,
        locale: value.locale,
        categoryId: value.categoryId,
        rulesVersion: value.rulesVersion,
        canonicalRiddleIds: value.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
      }),
    ]),
  );

  await Promise.all(
    runs.map((value) =>
      recordFacebookTournamentRun(USER_ID, {runId: value.runId, locale: "fr"}, {db, nowMs: START + 60_000}),
    ),
  );

  /** Provides tournament id behavior. */
  const tournamentId = "facebook-race10-fr-2026-08-19";
  /** Provides tournament behavior. */
  const tournament = (await db.doc(`facebookTournaments/${tournamentId}`).get()).data();
  /** Provides entry behavior. */
  const entry = (await db.doc(`facebookTournaments/${tournamentId}/entries/${USER_ID}`).get()).data();
  expect(tournament).toMatchObject({locale: "fr", sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false});
  expect(entry).toMatchObject({runId: "tournament-fast", adjustedTimeMs: 25_000, userId: USER_ID});
  expect(Object.keys({...tournament, ...entry})).not.toEqual(expect.arrayContaining(["coins", "reward", "grant"]));
  expect((await db.doc(`users/${USER_ID}`).get()).data()).toEqual({coins: 300});
});

/** Uses the real live authority and transaction store, including the shared creator deck. */
const LIVE_A = `facebook_${"a".repeat(40)}`, LIVE_B = `facebook_${"b".repeat(40)}`;
/** Independent live matches keep real concurrent receipts separate. */
let liveSequence = 0;
async function livePair() {
  for (const collection of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "facebookTournaments"]) await db.recursiveDelete(db.collection(collection));
  const sequence = ++liveSequence;
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const user of [LIVE_A, LIVE_B]) batch.set(db.doc(`users/${user}`), {username: user === LIVE_A ? "Alice" : "Bob", coins: 100});
  await batch.commit();
  const a = await joinLiveRaceForUser(LIVE_A, {locale: "en", categoryId: "history", requestId: `tournament-live-a-${sequence}`}, {db, nowMs: START});
  const b = await joinLiveRaceForUser(LIVE_B, {locale: "en", categoryId: "history", requestId: `tournament-live-b-${sequence}`}, {db, nowMs: START + 1000});
  return {a: await updateLiveRaceForUser(LIVE_A, {ticketId: a.ticketId, action: "poll", requestId: `tournament-live-poll-${sequence}`}, {db, nowMs: START + 1000}), b};
}
async function liveSolve(userId: string, ticketId: string, nowMs: number, action: "guess" | "skip" | "hint" = "guess") {
  const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
  const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
  const seat = match.tickets.indexOf(ticketId), run = match.runs[seat] as RaceRunRecord;
  const riddle = run.riddles[run.currentPosition];
  return updateLiveRaceForUser(userId, {ticketId, action, requestId: `tournament-${action}-${nowMs}`, riddleId: riddle.riddleId,
    ...(action === "guess" ? {guess: riddle.answer} : {})}, {db, nowMs});
}
async function finishLive(userId: string, ticketId: string) {
  for (let i = 0; i < 10; i++) await liveSolve(userId, ticketId, START + 6000 + i * 1000);
}

it.each([0, 1])("records a real live winner in seat %i without another economy grant", async seat => {
  const {a, b} = await livePair(), winner = seat ? b : a, userId = seat ? LIVE_B : LIVE_A;
  await finishLive(userId, winner.ticketId);
  const before = (await db.doc(`users/${userId}`).get()).data();
  const submissions = await Promise.all(Array.from({length: 4}, () => recordFacebookTournamentRun(userId,
    {runId: winner.ticketId, locale: "en"}, {db, nowMs: START + 86400000 + 1000})));
  expect(submissions.filter(value => value.improved)).toHaveLength(1);
  expect(submissions[0].entry).toMatchObject({runId: winner.ticketId, adjustedTimeMs: 9000, tournamentId: "facebook-race10-en-2026-08-19"});
  expect((await db.doc(`users/${userId}`).get()).data()).toEqual(before);
  expect((await db.doc(`raceRuns/${winner.ticketId}`).get()).exists).toBe(false);
  await expect(recordFacebookTournamentRun(seat ? LIVE_A : LIVE_B,
    {runId: winner.ticketId, locale: "en"}, {db, nowMs: START + 16000})).rejects.toMatchObject({code: "permission-denied"});
  await expect(recordFacebookTournamentRun(userId, {runId: winner.ticketId, locale: "fr"},
    {db, nowMs: START + 16000})).rejects.toMatchObject({code: "failed-precondition"});
});

it("records ten completed riddles with hint and skip penalties only after the live winner settles", async () => {
  const {b} = await livePair();
  await liveSolve(LIVE_B, b.ticketId, START + 6000, "skip");
  const hintedAt = START + 6000 + RACE_RULES.skipPenaltyMs;
  await liveSolve(LIVE_B, b.ticketId, hintedAt, "hint");
  const solvedAt = hintedAt + RACE_RULES.hintPenaltyMs;
  for (let i = 0; i < 9; i++) await liveSolve(LIVE_B, b.ticketId, solvedAt + i * 1000);
  const adjustedTimeMs = 8000 + 2 * (RACE_RULES.skipPenaltyMs + RACE_RULES.hintPenaltyMs);
  await expect(recordFacebookTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: solvedAt + 8000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  await updateLiveRaceForUser(LIVE_B, {ticketId: b.ticketId, action: "poll", requestId: "tournament-penalty-settlement"},
    {db, nowMs: START + 6000 + adjustedTimeMs});
  const record = await recordFacebookTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: START + 6000 + adjustedTimeMs});
  expect(record.entry.adjustedTimeMs).toBe(adjustedTimeMs);
});

it("rejects unfinished players and forfeit victories without writing a board", async () => {
  const {a, b} = await livePair();
  await expect(recordFacebookTournamentRun(LIVE_A, {runId: a.ticketId, locale: "en"}, {db, nowMs: START + 7000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  await updateLiveRaceForUser(LIVE_B, {ticketId: b.ticketId, action: "leave", requestId: "tournament-forfeit"}, {db, nowMs: START + 7000});
  await expect(recordFacebookTournamentRun(LIVE_A, {runId: a.ticketId, locale: "en"}, {db, nowMs: START + 8000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc(`facebookTournaments/facebook-race10-en-2026-08-19/entries/${LIVE_A}`).get()).exists).toBe(false);
});

it.each(["deck", "match", "finish"])("rejects corrupted live %s bindings", async field => {
  const {a, b} = await livePair();
  await finishLive(LIVE_B, b.ticketId);
  if (field === "deck") {
    const ref = db.doc(`liveRaceTickets/${a.ticketId}`), value = (await ref.get()).data()!;
    value.run.riddles[0].answer = "different"; await ref.set(value);
  } else if (field === "match") await db.doc(`liveRaceTickets/${b.ticketId}`).update({matchId: "f".repeat(64)});
  else {
    const ref = db.doc(`liveRaceMatches/${a.ticketId}`), value = (await ref.get()).data()!;
    value.runs[1].finishedAtMs += 1; await ref.set(value);
  }
  await expect(recordFacebookTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: START + 16000}))
    .rejects.toMatchObject({code: "data-loss"});
});

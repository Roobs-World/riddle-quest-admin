import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {RaceRunRecord} from "../../race/raceEngine";
import {recordFacebookTournamentRun} from "../../race/facebookTournament";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const START = Date.UTC(2026, 7, 19);
const USER_ID = `facebook_${"e".repeat(40)}`;
let db: FirebaseFirestore.Firestore;

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
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(["raceRuns", "raceDecks", "facebookTournaments", "users"].map((name) =>
    db.recursiveDelete(db.collection(name))));
});

afterAll(async () => Promise.all(["raceRuns", "raceDecks", "facebookTournaments", "users"].map((name) =>
  db.recursiveDelete(db.collection(name)))));

it("converges concurrent official submissions on the fastest score without economy writes", async () => {
  const runs = [run("tournament-slow", 50_000), run("tournament-fast", 25_000), run("tournament-mid", 35_000)];
  await db.doc(`users/${USER_ID}`).set({coins: 300});
  await Promise.all(runs.flatMap((value) => [
    db.doc(`raceRuns/${value.runId}`).set(value),
    db.doc(`raceDecks/${value.deckId}`).set({
      deckId: value.deckId,
      locale: value.locale,
      categoryId: value.categoryId,
      rulesVersion: value.rulesVersion,
      canonicalRiddleIds: value.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
    }),
  ]));

  await Promise.all(runs.map((value) => recordFacebookTournamentRun(
    USER_ID,
    {runId: value.runId, locale: "fr"},
    {db, nowMs: START + 60_000},
  )));

  const tournamentId = "facebook-race10-fr-2026-08-19";
  const tournament = (await db.doc(`facebookTournaments/${tournamentId}`).get()).data();
  const entry = (await db.doc(`facebookTournaments/${tournamentId}/entries/${USER_ID}`).get()).data();
  expect(tournament).toMatchObject({locale: "fr", sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false});
  expect(entry).toMatchObject({runId: "tournament-fast", adjustedTimeMs: 25_000, userId: USER_ID});
  expect(Object.keys({...tournament, ...entry})).not.toEqual(expect.arrayContaining(["coins", "reward", "grant"]));
  expect((await db.doc(`users/${USER_ID}`).get()).data()).toEqual({coins: 300});
});

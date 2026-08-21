import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {FACEBOOK_CONTEXT_BOARD_DURATION_MS, facebookContextKey} from "../../race/facebookContextCompetition";
import {listFacebookContextBoard, recordFacebookContextBoardRun} from "../../race/facebookContextBoard";
import {joinFacebookContextCompetition, removeUserFromFacebookContextCompetitions} from "../../race/facebookContextService";
import type {RaceRunRecord} from "../../race/raceEngine";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const START = Date.UTC(2026, 7, 19);
const A = `facebook_${"7".repeat(40)}`;
const B = `facebook_${"8".repeat(40)}`;
const CONTEXT_ID = "board-group";
const CONTEXT_KEY = facebookContextKey(CONTEXT_ID);
let db: FirebaseFirestore.Firestore;

const run = (userId: string, id: string, wallFinishMs: number): RaceRunRecord => ({
  runId: id,
  userId,
  role: "creator",
  status: "completed",
  result: "recorded",
  categoryId: "science",
  locale: "de",
  rulesVersion: "race10_v1",
  deckId: `deck-${id}`,
  riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `${id}-riddle-${position}`,
    canonicalRiddleId: `science:${position}`,
    text: `Hinweis ${position}`,
    answer: "antwort",
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
  await Promise.all(["users", "raceRuns", "raceDecks", "facebookContextCompetitions"].map((name) =>
    db.recursiveDelete(db.collection(name))));
});

afterAll(async () => Promise.all([
  "users", "raceRuns", "raceDecks", "facebookContextCompetitions",
].map((name) => db.recursiveDelete(db.collection(name)))));

it("converges a group board on best authoritative scores and deletes every account entry", async () => {
  await Promise.all([
    db.doc(`users/${A}`).set({coins: 300}),
    db.doc(`users/${B}`).set({coins: 300}),
    joinFacebookContextCompetition({
      userId: A, contextId: CONTEXT_ID, contextType: "GROUP", locale: "de", nowMs: START,
    }, db),
  ]);
  await joinFacebookContextCompetition({
    userId: B, contextId: CONTEXT_ID, contextType: "GROUP", locale: "de", nowMs: START + 1,
  }, db);

  const runs = [run(A, "a-slow", 50_000), run(A, "a-fast", 25_000), run(B, "b-mid", 35_000)];
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
  await Promise.all(runs.map((value) => recordFacebookContextBoardRun(
    value.userId,
    {contextId: CONTEXT_ID, locale: "de", runId: value.runId},
    {db, nowMs: START + 60_000},
  )));

  const board = await listFacebookContextBoard(A, {contextId: CONTEXT_ID, locale: "de"}, {
    db, nowMs: START + 60_000,
  });
  expect(board.standings).toEqual([
    {rank: 1, adjustedTimeMs: 25_000, isCurrentPlayer: true},
    {rank: 2, adjustedTimeMs: 35_000, isCurrentPlayer: false},
  ]);
  expect(board.rewardsEnabled).toBe(false);
  expect(JSON.stringify(board)).not.toMatch(/facebook_|userId|runId|coins|rewardAmount/);
  expect((await db.doc(`users/${A}`).get()).data()).toEqual({coins: 300});
  expect((await db.doc(`users/${B}`).get()).data()).toEqual({coins: 300});

  await removeUserFromFacebookContextCompetitions(A, db);
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${A}`).get())
    .resolves.toMatchObject({exists: false});
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${B}`).get())
    .resolves.toMatchObject({exists: true});
  await removeUserFromFacebookContextCompetitions(B, db);
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}`).get())
    .resolves.toMatchObject({exists: false});
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${B}`).get())
    .resolves.toMatchObject({exists: false});
});

it("rolls an expired context transactionally and archives identity-free metadata", async () => {
  const contextId = "rolling-thread";
  const key = facebookContextKey(contextId);
  await joinFacebookContextCompetition({
    userId: A, contextId, contextType: "GROUP", locale: "de", nowMs: START,
  }, db);
  await db.doc(`facebookContextCompetitions/${key}/entries/${A}`).set({
    contextKey: key,
    locale: "de",
    userId: A,
    adjustedTimeMs: 10_000,
  });
  const nowMs = START + FACEBOOK_CONTEXT_BOARD_DURATION_MS;
  const rolled = await joinFacebookContextCompetition({
    userId: B, contextId, contextType: "THREAD", locale: "ja", nowMs,
  }, db);
  expect(rolled).toMatchObject({contextType: "THREAD", locale: "ja", hostUserId: B});
  await expect(db.doc(`facebookContextCompetitions/${key}/entries/${A}`).get())
    .resolves.toMatchObject({exists: false});
  const history = (await db.doc(`facebookContextCompetitionHistory/${key}_${START}`).get()).data();
  expect(history).toMatchObject({locale: "de", participantCount: 1, rewardsEnabled: false});
  expect(JSON.stringify(history)).not.toMatch(/facebook_|userId|memberIds/);
});

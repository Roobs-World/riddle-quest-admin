import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {FACEBOOK_CONTEXT_BOARD_DURATION_MS, facebookContextKey} from "../../race/facebookContextCompetition";
import {listFacebookContextBoard, recordFacebookContextBoardRun} from "../../race/facebookContextBoard";
import {
  joinFacebookContextCompetition,
  removeUserFromFacebookContextCompetitions,
} from "../../race/facebookContextService";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/raceEngine";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../../../../../firebase-functions/src/race/raceLiveService";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the start interface. */
const START = Date.UTC(2026, 7, 19);
/** Renders the a interface. */
const A = `facebook_${"7".repeat(40)}`;
/** Renders the b interface. */
const B = `facebook_${"8".repeat(40)}`;
/** Defines the context id value. */
const CONTEXT_ID = "board-group";
/** Defines the context key value. */
const CONTEXT_KEY = facebookContextKey(CONTEXT_ID);
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Provides run behavior. */
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
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Isolated loopback demo emulator required");
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(
    ["users", "raceRuns", "raceDecks", "facebookContextCompetitions", "liveRaceTickets", "liveRaceMatches", "liveRacePlayers", "liveRaceQueues", "racePerformanceOutbox", "localizedRiddles"].map((name) =>
      db.recursiveDelete(db.collection(name)),
    ),
  );
});

/** Creates real settled Facebook Live PvP authority independently of recorded runs. */
async function settledLivePair(seat: number) {
  for (const name of ["liveRaceTickets", "liveRaceMatches", "liveRacePlayers", "liveRaceQueues", "racePerformanceOutbox"])
    await db.recursiveDelete(db.collection(name));
  /** Distinct canonical identities keep the older recorded-board fixtures untouched. */
  const players = [`facebook_${"a".repeat(40)}`, `facebook_${"b".repeat(40)}`];
  /** Real catalog and account inputs precede authoritative matching. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const userId of players) batch.set(db.doc(`users/${userId}`), {username: "Live player", coins: 100});
  await batch.commit();
  /** Context membership is established before the live score finishes. */
  const contextId = `live-board-${seat}`;
  await db.recursiveDelete(db.doc(`facebookContextCompetitions/${facebookContextKey(contextId)}`));
  for (const userId of players) await joinFacebookContextCompetition({userId, contextId, contextType: "GROUP", locale: "en", nowMs: START}, db);
  /** Both players share the independently frozen creator deck. */
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `context-a-${seat}`}, {db, nowMs: START});
  /** The joining seat must never use its earlier search deck as scoring authority. */
  const b = await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `context-b-${seat}`}, {db, nowMs: START + 1000});
  /** Actual owned winning seat supplies ten real engine commands. */
  const ticketId = [a, b][seat].ticketId, userId = players[seat];
  for (let i = 0; i < 10; i++) {
    /** Read private synthetic fixture answers rather than trusting public result projections. */
    const match = (await db.doc(`liveRaceMatches/${a.ticketId}`).get()).data()!;
    /** Current private riddle advances only through the production engine. */
    const run = match.runs[seat] as RaceRunRecord, riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `context-${seat}-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: START + 6000 + i * 1000});
  }
  return {ticketId, userId, contextId, creatorTicketId: a.ticketId, players};
}

it.each([0, 1])("records an authoritative live context winner in seat %i without another economy grant", async seat => {
  /** Real winning authority contains no corresponding legacy recorded run. */
  const {ticketId, userId, contextId, players} = await settledLivePair(seat);
  /** Existing winner settlement is captured before official board submissions. */
  const before = (await db.doc(`users/${userId}`).get()).data();
  /** Concurrent submissions converge on one best score and one improved result. */
  const records = await Promise.all(Array.from({length: 4}, () => recordFacebookContextBoardRun(userId,
    {contextId, runId: ticketId, locale: "en"}, {db, nowMs: START + 16000})));
  expect(records.filter(record => record.improved)).toHaveLength(1);
  expect(records[0].entry).toMatchObject({runId: ticketId, adjustedTimeMs: 9000});
  expect((await db.doc(`users/${userId}`).get()).data()).toEqual(before);
  expect((await db.doc(`raceRuns/${ticketId}`).get()).exists).toBe(false);
  await expect(recordFacebookContextBoardRun(players[1 - seat], {contextId, runId: ticketId, locale: "en"},
    {db, nowMs: START + 16000})).rejects.toMatchObject({code: "permission-denied"});
});

/** Invalid live submissions never create a context row or repeat settlement. */
it.each(["future", "expired", "late-membership", "corrupt-deck"] as const)("rejects %s live context scoring", async kind => {
  /** Real engine completion remains the common source for each authority check. */
  const {ticketId, userId, contextId, creatorTicketId} = await settledLivePair(1);
  /** Context scope is independently stored before any submission. */
  const contextKey = facebookContextKey(contextId);
  /** Baseline economy must survive rejected submissions unchanged. */
  const before = (await db.doc(`users/${userId}`).get()).data();
  if (kind === "late-membership") {
    /** Membership acquired after completion cannot backfill an earlier live score. */
    const context = (await db.doc(`facebookContextCompetitions/${contextKey}`).get()).data()!;
    await db.doc(`facebookContextCompetitions/${contextKey}`).update({members: context.members.map((member: {
      /** Canonical fixture member identity. */
      userId: string;
    }) =>
      member.userId === userId ? {...member, joinedAtMs: START + 16000} : member)});
  }
  if (kind === "corrupt-deck") {
    /** The creator's immutable authority must agree with the settled winner's deck. */
    const ticket = (await db.doc(`liveRaceTickets/${creatorTicketId}`).get()).data()!;
    /** Independently frozen source deck to deliberately corrupt in this fixture. */
    const source = ticket.run as RaceRunRecord;
    source.riddles[0].answer = "changed-private-answer";
    await db.doc(`liveRaceTickets/${creatorTicketId}`).update({run: source});
  }
  /** Caller time never precedes completion or crosses the seven-day membership window. */
  const nowMs = kind === "future" ? START + 14000 : kind === "expired" ? START + FACEBOOK_CONTEXT_BOARD_DURATION_MS : START + 17000;
  await expect(recordFacebookContextBoardRun(userId, {contextId, runId: ticketId, locale: "en"}, {db, nowMs}))
    .rejects.toMatchObject({code: kind === "corrupt-deck" ? "data-loss" : "failed-precondition"});
  expect((await db.doc(`facebookContextCompetitions/${contextKey}/entries/${userId}`).get()).exists).toBe(false);
  expect((await db.doc(`users/${userId}`).get()).data()).toEqual(before);
});

afterAll(async () =>
  Promise.all(
    ["users", "raceRuns", "raceDecks", "facebookContextCompetitions", "liveRaceTickets", "liveRaceMatches", "liveRacePlayers", "liveRaceQueues", "racePerformanceOutbox", "localizedRiddles"].map((name) =>
      db.recursiveDelete(db.collection(name)),
    ),
  ),
);

it("converges a group board on best authoritative scores and deletes every account entry", async () => {
  await Promise.all([
    db.doc(`users/${A}`).set({coins: 300}),
    db.doc(`users/${B}`).set({coins: 300}),
    joinFacebookContextCompetition(
      {
        userId: A,
        contextId: CONTEXT_ID,
        contextType: "GROUP",
        locale: "de",
        nowMs: START,
      },
      db,
    ),
  ]);
  await joinFacebookContextCompetition(
    {
      userId: B,
      contextId: CONTEXT_ID,
      contextType: "GROUP",
      locale: "de",
      nowMs: START + 1,
    },
    db,
  );

  /** Provides runs behavior. */
  const runs = [run(A, "a-slow", 50_000), run(A, "a-fast", 25_000), run(B, "b-mid", 35_000)];
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
      recordFacebookContextBoardRun(
        value.userId,
        {contextId: CONTEXT_ID, locale: "de", runId: value.runId},
        {db, nowMs: START + 60_000},
      ),
    ),
  );

  /** Provides board behavior. */
  const board = await listFacebookContextBoard(
    A,
    {contextId: CONTEXT_ID, locale: "de"},
    {
      db,
      nowMs: START + 60_000,
    },
  );
  expect(board.standings).toEqual([
    {rank: 1, adjustedTimeMs: 25_000, isCurrentPlayer: true},
    {rank: 2, adjustedTimeMs: 35_000, isCurrentPlayer: false},
  ]);
  expect(board.rewardsEnabled).toBe(false);
  expect(JSON.stringify(board)).not.toMatch(/facebook_|userId|runId|coins|rewardAmount/);
  expect((await db.doc(`users/${A}`).get()).data()).toEqual({coins: 300});
  expect((await db.doc(`users/${B}`).get()).data()).toEqual({coins: 300});

  await removeUserFromFacebookContextCompetitions(A, db);
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${A}`).get()).resolves.toMatchObject({
    exists: false,
  });
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${B}`).get()).resolves.toMatchObject({
    exists: true,
  });
  await removeUserFromFacebookContextCompetitions(B, db);
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}`).get()).resolves.toMatchObject({exists: false});
  await expect(db.doc(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${B}`).get()).resolves.toMatchObject({
    exists: false,
  });
});

it("rolls an expired context transactionally and archives identity-free metadata", async () => {
  /** Provides context id behavior. */
  const contextId = "rolling-thread";
  /** Provides key behavior. */
  const key = facebookContextKey(contextId);
  await joinFacebookContextCompetition(
    {
      userId: A,
      contextId,
      contextType: "GROUP",
      locale: "de",
      nowMs: START,
    },
    db,
  );
  await db.doc(`facebookContextCompetitions/${key}/entries/${A}`).set({
    contextKey: key,
    locale: "de",
    userId: A,
    adjustedTimeMs: 10_000,
  });
  /** Provides now ms behavior. */
  const nowMs = START + FACEBOOK_CONTEXT_BOARD_DURATION_MS;
  /** Provides rolled behavior. */
  const rolled = await joinFacebookContextCompetition(
    {
      userId: B,
      contextId,
      contextType: "THREAD",
      locale: "ja",
      nowMs,
    },
    db,
  );
  expect(rolled).toMatchObject({contextType: "THREAD", locale: "ja", hostUserId: B});
  await expect(db.doc(`facebookContextCompetitions/${key}/entries/${A}`).get()).resolves.toMatchObject({exists: false});
  /** Provides history behavior. */
  const history = (await db.doc(`facebookContextCompetitionHistory/${key}_${START}`).get()).data();
  expect(history).toMatchObject({locale: "de", participantCount: 1, rewardsEnabled: false});
  expect(JSON.stringify(history)).not.toMatch(/facebook_|userId|memberIds/);
});

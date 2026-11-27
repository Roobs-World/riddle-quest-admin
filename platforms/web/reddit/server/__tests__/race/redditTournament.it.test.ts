import {setEmulatorSystemTime} from "../../../../../../firebase-functions/src/__tests__/helpers/emulatorClock";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../../../src/races/contracts/index.js";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../../../../../firebase-functions/src/race/live/raceLiveService";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/runs/raceEngine";
import {recordRedditTournamentRun} from "../../race/redditTournament";
import {createHmac} from "node:crypto";
import {redditGameplay} from "../../redditGameplayEndpoint";
import {redditProviderIdentityId} from "../../redditEndpoints";
import {canonicalRedditGatewayAssertion, hashRedditGatewayPayload, redditFirebaseUid} from "../../redditSecurity";
import {recordJestAccountDeletion} from "../../../../jest/server/jestAccountDeletion";
import {removeCrossUserRaceIdentitySnapshots} from "../../../../../../firebase-functions/src/profile/accountDeletion/raceAccountDeletion";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the start interface. */
const START = Date.UTC(2026, 7, 20);
/** Defines the user id value. */
const USER_ID = `reddit_${"e".repeat(40)}`;
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
  locale: "ar",
  rulesVersion: "race10_v1",
  deckId: `deck-${id}`,
  riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `${id}-${position}`,
    canonicalRiddleId: `history:${position}`,
    text: `دليل ${position}`,
    answer: "إجابة",
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
/** Provides collections behavior. */
const collections = ["raceRuns", "raceDecks", "redditTournaments", "users", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "racePerformanceOutbox", "localizedRiddles/en/riddles",
  "providerIdentities", "raceConfig", "redditGatewayNonces", "redditGatewayRateLimits", "jestAccountDeletionTombstones"];

beforeAll(async () => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name))));
});
afterEach(() => jest.useRealTimers());
afterAll(async () => Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name)))));

it("converges concurrent locale-board submissions on the fastest score without economy writes", async () => {
  /** Provides runs behavior. */
  const runs = [run("reddit-slow", 50_000), run("reddit-fast", 25_000), run("reddit-mid", 35_000)];
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
      recordRedditTournamentRun(USER_ID, {runId: value.runId, locale: "ar"}, {db, nowMs: START + 60_000}),
    ),
  );
  /** Provides id behavior. */
  const id = "reddit-race10-ar-2026-08-20";
  /** Provides tournament behavior. */
  const tournament = (await db.doc(`redditTournaments/${id}`).get()).data();
  /** Provides entry behavior. */
  const entry = (await db.doc(`redditTournaments/${id}/entries/${USER_ID}`).get()).data();
  expect(tournament).toMatchObject({locale: "ar", sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false});
  expect(entry).toMatchObject({runId: "reddit-fast", adjustedTimeMs: 25_000, userId: USER_ID});
  expect(Object.keys({...tournament, ...entry})).not.toEqual(expect.arrayContaining(["coins", "reward", "grant"]));
  expect((await db.doc(`users/${USER_ID}`).get()).data()).toEqual({coins: 300});
});

/** Uses the real live authority and transaction store, including the shared creator deck. */
const LIVE_A = `reddit_${"a".repeat(40)}`, LIVE_B = `reddit_${"b".repeat(40)}`;
/** Independent live matches keep real concurrent receipts separate. */
let liveSequence = 0;
/** Provides live pair behavior. */
async function livePair() {
  for (const collection of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "redditTournaments", "racePerformanceOutbox"]) await db.recursiveDelete(db.collection(collection));
  /** Provides sequence behavior. */
  const sequence = ++liveSequence;
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const user of [LIVE_A, LIVE_B]) batch.set(db.doc(`users/${user}`), {username: user === LIVE_A ? "Alice" : "Bob", coins: 100});
  await batch.commit();
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(LIVE_A, {locale: "en", categoryId: "history", requestId: `tournament-live-a-${sequence}`}, {db, nowMs: START});
  /** Provides b behavior. */
  const b = await joinLiveRaceForUser(LIVE_B, {locale: "en", categoryId: "history", requestId: `tournament-live-b-${sequence}`}, {db, nowMs: START + 1000});
  return {a: await updateLiveRaceForUser(LIVE_A, {ticketId: a.ticketId, action: "poll", requestId: `tournament-live-poll-${sequence}`}, {db, nowMs: START + 1000}), b};
}
/** Provides live solve behavior. */
async function liveSolve(userId: string, ticketId: string, nowMs: number, action: "guess" | "skip" | "hint" = "guess") {
  /** Provides ticket behavior. */
  const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
  /** Provides seat behavior. */
  const seat = match.tickets.indexOf(ticketId), run = match.runs[seat] as RaceRunRecord;
  /** Provides riddle behavior. */
  const riddle = run.riddles[run.currentPosition];
  return updateLiveRaceForUser(userId, {ticketId, action, requestId: `tournament-${action}-${nowMs}`, riddleId: riddle.riddleId,
    ...(action === "guess" ? {guess: riddle.answer} : {})}, {db, nowMs});
}
/** Provides finish live behavior. */
async function finishLive(userId: string, ticketId: string) {
  for (let i = 0; i < 10; i++) await liveSolve(userId, ticketId, START + 6000 + i * 1000);
}

it.each([0, 1])("records a real live winner in seat %i without another economy grant", async seat => {
  /** Provides {a, b} behavior. */
  const {a, b} = await livePair(), winner = seat ? b : a, userId = seat ? LIVE_B : LIVE_A;
  await finishLive(userId, winner.ticketId);
  /** Provides before behavior. */
  const before = (await db.doc(`users/${userId}`).get()).data();
  /** Provides submissions behavior. */
  const submissions = await Promise.all(Array.from({length: 4}, () => recordRedditTournamentRun(userId,
    {runId: winner.ticketId, locale: "en"}, {db, nowMs: START + 86400000 + 1000})));
  expect(submissions.filter(value => value.improved)).toHaveLength(1);
  expect(submissions[0].entry).toMatchObject({runId: winner.ticketId, adjustedTimeMs: 9000, tournamentId: "reddit-race10-en-2026-08-20"});
  expect((await db.doc(`users/${userId}`).get()).data()).toEqual(before);
  expect((await db.doc(`raceRuns/${winner.ticketId}`).get()).exists).toBe(false);
  await expect(recordRedditTournamentRun(seat ? LIVE_A : LIVE_B,
    {runId: winner.ticketId, locale: "en"}, {db, nowMs: START + 16000})).rejects.toMatchObject({code: "permission-denied"});
  await expect(recordRedditTournamentRun(userId, {runId: winner.ticketId, locale: "fr"},
    {db, nowMs: START + 16000})).rejects.toMatchObject({code: "failed-precondition"});
});

it("records ten completed riddles with hint and skip penalties only after the live winner settles", async () => {
  /** Provides {b} behavior. */
  const {b} = await livePair();
  await liveSolve(LIVE_B, b.ticketId, START + 6000, "skip");
  /** Provides hinted at behavior. */
  const hintedAt = START + 6000 + RACE_RULES.skipPenaltyMs;
  await liveSolve(LIVE_B, b.ticketId, hintedAt, "hint");
  /** Provides solved at behavior. */
  const solvedAt = hintedAt + RACE_RULES.hintPenaltyMs;
  for (let i = 0; i < 9; i++) await liveSolve(LIVE_B, b.ticketId, solvedAt + i * 1000);
  /** Provides adjusted time ms behavior. */
  const adjustedTimeMs = 8000 + 2 * (RACE_RULES.skipPenaltyMs + RACE_RULES.hintPenaltyMs);
  await expect(recordRedditTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: solvedAt + 8000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  await updateLiveRaceForUser(LIVE_B, {ticketId: b.ticketId, action: "poll", requestId: "tournament-penalty-settlement"},
    {db, nowMs: START + 6000 + adjustedTimeMs});
  /** Provides record behavior. */
  const record = await recordRedditTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: START + 6000 + adjustedTimeMs});
  expect(record.entry.adjustedTimeMs).toBe(adjustedTimeMs);
});

it("rejects unfinished players and forfeit victories without writing a board", async () => {
  /** Provides {a, b} behavior. */
  const {a, b} = await livePair();
  await expect(recordRedditTournamentRun(LIVE_A, {runId: a.ticketId, locale: "en"}, {db, nowMs: START + 7000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  await updateLiveRaceForUser(LIVE_B, {ticketId: b.ticketId, action: "leave", requestId: "tournament-forfeit"}, {db, nowMs: START + 7000});
  await expect(recordRedditTournamentRun(LIVE_A, {runId: a.ticketId, locale: "en"}, {db, nowMs: START + 8000}))
    .rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc(`redditTournaments/reddit-race10-en-2026-08-20/entries/${LIVE_A}`).get()).exists).toBe(false);
});

it.each(["deck", "match", "finish"])("rejects corrupted live %s bindings", async field => {
  /** Provides {a, b} behavior. */
  const {a, b} = await livePair();
  await finishLive(LIVE_B, b.ticketId);
  if (field === "deck") {
    /** Provides ref behavior. */
    const ref = db.doc(`liveRaceTickets/${a.ticketId}`), value = (await ref.get()).data()!;
    value.run.riddles[0].answer = "different"; await ref.set(value);
  } else if (field === "match") await db.doc(`liveRaceTickets/${b.ticketId}`).update({matchId: "f".repeat(64)});
  else {
    /** Provides ref behavior. */
    const ref = db.doc(`liveRaceMatches/${a.ticketId}`), value = (await ref.get()).data()!;
    value.runs[1].finishedAtMs += 1; await ref.set(value);
  }
  await expect(recordRedditTournamentRun(LIVE_B, {runId: b.ticketId, locale: "en"}, {db, nowMs: START + 16000}))
    .rejects.toMatchObject({code: "data-loss"});
});

it("leases the signed HTTP recorder until deletion can sweep its committed board", async () => {
  /** Local fixture settings are restored even when an authority assertion fails. */
  const originalEnvironment = {REDDIT_GATEWAY_SECRET: process.env.REDDIT_GATEWAY_SECRET,
    REDDIT_UID_SECRET: process.env.REDDIT_UID_SECRET, REDDIT_DISABLED_FEATURES: process.env.REDDIT_DISABLED_FEATURES};
  /** Only synthetic loopback gateway credentials are used. */
  const gatewaySecret = "reddit-tournament-http-lease-fixture-at-least-32-characters";
  /** Synthetic provider identity derives the exact production UID generation. */
  const uidSecret = Buffer.alloc(32, 29).toString("base64"), providerUserId = "t2_tournament_lease";
  /** A real stored recorded score preserves the existing legacy recording contract. */
  const uid = redditFirebaseUid(providerUserId, uidSecret, 1), value = {...run("reddit-http-lease", 9000), userId: uid};
  /** The exact official entry is the write boundary held while deletion starts. */
  const entryRef = db.doc(`redditTournaments/reddit-race10-ar-2026-08-20/entries/${uid}`);
  /** Fluent response observes the production signature, identity, quota and dispatch paths. */
  let status = 200, body: unknown;
  /** Express-compatible endpoint response preserves safe output. */
  const response = {set: () => response, status: (code: number) => {status = code; return response;},
    json: (result: unknown) => {body = result; return response;}};
  /** The browser supplies only an opaque run ID and locale. */
  const payload = {runId: value.runId, locale: "ar"};
  /** Each request receives a distinct signed nonce through the real gateway. */
  const request = (nonce: string) => {
    /** Canonical signed provenance cannot be selected by browser payload fields. */
    const assertion = {version: 1 as const, appName: "riddle-quest", installationId: "riddle-quest:t5_test",
      subredditId: "t5_test", postId: "t3_test", userId: providerUserId, operation: "gameplay.tournament.record",
      issuedAtMs: START + 60000, nonce, payloadHash: hashRedditGatewayPayload(payload)};
    /** Production HMAC verification retains its exact domain and payload hash. */
    const signature = createHmac("sha256", gatewaySecret).update("riddle-quest-reddit-gateway-v1\0")
      .update(canonicalRedditGatewayAssertion(assertion)).digest("base64url");
    return {method: "POST", body: {assertion, payload}, get: () => signature};
  };
  /** Controlled pause observes the real account lease before committing the board. */
  let release!: () => void, observed!: () => void, held = false;
  /** Release always drains the in-flight HTTP request before teardown. */
  const pause = new Promise<void>(resolve => {release = resolve;}), ready = new Promise<void>(resolve => {observed = resolve;});
  /** Preserve real Firestore transactions while pausing only the entry read. */
  const originalTransaction = db.runTransaction.bind(db);
  /** Awaited request and proxy are retained for reliable cleanup after failures. */
  let pending: Promise<unknown> | undefined;
  try {
    process.env.REDDIT_GATEWAY_SECRET = gatewaySecret; process.env.REDDIT_UID_SECRET = uidSecret;
    process.env.REDDIT_DISABLED_FEATURES = "commerce,notifications";
    setEmulatorSystemTime(START + 60000);
    await db.doc(`users/${uid}`).set({coins: 300});
    await db.doc(`raceRuns/${value.runId}`).set(value);
    await db.doc(`raceDecks/${value.deckId}`).set({deckId: value.deckId, locale: value.locale,
      categoryId: value.categoryId, rulesVersion: value.rulesVersion, canonicalRiddleIds: value.riddles.map(riddle => riddle.canonicalRiddleId)});
    await db.doc(`providerIdentities/${redditProviderIdentityId("riddle-quest", providerUserId)}`).set({provider: "reddit",
      appName: "riddle-quest", providerUserId, accountGeneration: 1, status: "active", uid});
    await db.doc("raceConfig/rollout").set({enabled: true, percentage: 100, allowlistHashes: []});
    jest.spyOn(db, "runTransaction").mockImplementation(((operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) =>
      originalTransaction(tx => operation(new Proxy(tx, {
        /** Only the official entry boundary pauses; every other operation remains authoritative. */
        get(target, property) {
          if (property === "get") return async (ref: FirebaseFirestore.DocumentReference) => {
            if (!held && ref.path === entryRef.path) {held = true; observed(); await pause;}
            return target.get(ref);
          };
          /** Firestore method receivers retain their original transaction. */
          const member = Reflect.get(target, property);
          return typeof member === "function" ? member.bind(target) : member;
        },
      })))) as typeof db.runTransaction);
    pending = redditGameplay(request("http_lease_before_" + "n".repeat(32)) as never, response as never);
    await Promise.race([ready, pending.then(() => {throw new Error(`recorder-ended-before-entry:${status}`);})]);
    await expect(recordJestAccountDeletion(uid)).rejects.toThrow("account-deletion-in-progress");
    release(); await pending;
    expect(status).toBe(200); expect(body).toMatchObject({ok: true, result: {runId: value.runId, rewardsEnabled: false}});
    expect(Object.keys(Reflect.get(body as object, "result")).sort()).toEqual([
      "adjustedTimeMs", "completedAtMs", "improved", "locale", "rewardsEnabled", "runId", "sortOrder", "tournamentId",
    ]);
    expect((await entryRef.get()).exists).toBe(true);
    jest.restoreAllMocks(); jest.useRealTimers();
    await recordJestAccountDeletion(uid); await removeCrossUserRaceIdentitySnapshots(uid);
    expect((await entryRef.get()).exists).toBe(false);
    setEmulatorSystemTime(START + 60000);
    await redditGameplay(request("http_lease_after_" + "n".repeat(32)) as never, response as never);
    expect(status).toBe(401); expect((await entryRef.get()).exists).toBe(false);
    expect((await db.doc(`users/${uid}`).get()).data()?.coins).toBe(300);
  } finally {
    release(); await pending; jest.restoreAllMocks(); jest.useRealTimers();
    for (const [key, setting] of Object.entries(originalEnvironment)) {
      if (setting === undefined) delete process.env[key]; else process.env[key] = setting;
    }
  }
});

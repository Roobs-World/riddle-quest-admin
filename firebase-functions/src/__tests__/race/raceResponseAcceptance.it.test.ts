import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "../../../../src/core/race/index.js";
import {readyRaceRunForUser, resumeRaceRunForUser, startRaceRunForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";
import {raceDeckContentVersion} from "../../race/raceDeckSnapshot";
import type {RaceRunRecord} from "../../race/raceEngine";
import {Timestamp} from "firebase-admin/firestore";

/** Isolated demo authority for transactional response-acceptance regressions. */
let db: FirebaseFirestore.Firestore;
/** Canonical owned run whose optional presentation can expose a strict public contract failure. */
const fixture = (): RaceRunRecord => ({runId: "response-run", userId: "response-player", role: "challenger", status: "active",
  categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "response-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {displayName: "Creator", subjectUserId: "response-creator", avatarUrl: "not-a-url", adjustedFinishMs: 10000, events: []}});
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("response-acceptance-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "raceDecks", "raceStartRequests", "raceAttempts", "raceChallenges", "raceMatchOffers", "raceBotOffers",
    "users", "localizedRiddles/en/riddles", "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceSettlementOutbox"].map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/response-player").set({displayName: "Player", coins: 0});
  await db.doc("raceRuns/response-run").set(fixture());
});

it.each([false, true])("validates readiness before committing scheduling or expired preparation: %s", async expired => {
  await db.doc("raceRuns/response-run").set({...fixture(), status: "prepared", startedAtMs: 0,
    preparationExpiresAtMs: expired ? 2000 : 30000});
  /** A rejected response cannot permanently start or abandon the owned attempt. */
  const before = (await db.doc("raceRuns/response-run").get()).data();
  /** Capture rejection independently so the transaction's actual writes are checked first. */
  const error = await readyRaceRunForUser("response-player", {runId: "response-run", requestId: "response-ready"},
    {db, nowMs: 5000}).then(() => null, failure => failure);
  expect((await db.doc("raceRuns/response-run").get()).data()).toEqual(before);
  expect(error).toMatchObject({code: "data-loss"});
});

it.each([false, true])("validates terminal resume before granting rewards or creating outboxes, evaluation=%s", async includeEvaluation => {
  await db.doc("raceRuns/response-run").set({...fixture(), status: "completed", result: "player_win", correctCount: 10,
    currentPosition: 9, wallFinishMs: 5000, finishedAtMs: 6000, challengeId: "response-challenge"});
  /** Both complete run and account snapshots remain unchanged when projection fails. */
  const before = (await db.doc("raceRuns/response-run").get()).data();
  /** Full account includes balance, statistics and achievement grants. */
  const account = (await db.doc("users/response-player").get()).data();
  /** Before the fix, response decoding rejected only after settlement had granted the win. */
  const error = await resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 7000, includeEvaluation})
    .then(() => null, failure => failure);
  expect((await db.doc("users/response-player").get()).data()).toEqual(account);
  expect((await db.doc("raceRuns/response-run").get()).data()).toEqual(before);
  expect((await db.doc("racePerformanceOutbox/response-run").get()).exists).toBe(false);
  expect((await db.doc("raceSettlementOutbox/response-run").get()).exists).toBe(false);
  expect(error).toMatchObject({code: "data-loss"});
});

it.each([false, true])("validates a new challenger view before consuming its attempt or creating a run/deck, prepare=%s", async prepare => {
  /** Legacy immutable answers can exceed the public keyboard contract without breaking archive parsing. */
  const riddles = fixture().riddles.map((riddle, index) => index === 0 ? {...riddle, answer: "overflow"} : riddle);
  await db.doc("raceChallenges/response-challenge").set({challengeId: "response-challenge", creatorId: "response-creator",
    creatorRunId: "response-recording", creatorSnapshot: {displayName: "Creator"}, categoryId: "history", locale: "en",
    deckId: "response-original-deck", canonicalRiddleIds: riddles.map(riddle => riddle.canonicalRiddleId), riddles, snapshotVersion: 1,
    targetCorrect: 10, creatorWallFinishMs: 10000, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0, creatorTotalPenaltyMs: 0,
    creatorAdjustedFinishMs: 10000, ghostEvents: [], rules: RACE_RULES, contentVersion: raceDeckContentVersion(riddles),
    status: "active", createdAtMs: 20000, expiresAtMs: 100000});
  /** Exact accepted request must remain available for retry after authoritative repair. */
  const input = {locale: "en" as const, categoryId: "history" as const, challengeId: "response-challenge", requestId: "response-start", prepare};
  /** Before the fix, an undeliverable start had already consumed the exclusive recording attempt. */
  const error = await startRaceRunForUser("response-player", input, {db, nowMs: 30000}).then(() => null, failure => failure);
  expect((await db.doc(`raceStartRequests/${requestDocumentId("response-player", input.requestId)}`).get()).exists).toBe(false);
  expect((await db.doc(`raceAttempts/${requestDocumentId(input.challengeId, "response-player")}`).get()).exists).toBe(false);
  expect((await db.doc("users/response-player/raceMatchProfiles/en").get()).exists).toBe(false);
  expect((await db.collection("raceDecks").get()).empty).toBe(true);
  expect((await db.collection("raceRuns").get()).size).toBe(1);
  expect(error).toMatchObject({code: "data-loss"});
  /** Repair the immutable archive before retrying the identical request; no failed start survives. */
  const repaired = fixture().riddles;
  await db.doc("raceChallenges/response-challenge").update({riddles: repaired, contentVersion: raceDeckContentVersion(repaired)});
  /** Concurrent retries may project evaluation differently but consume exactly one canonical attempt. */
  const responses = await Promise.all([false, true].map(includeEvaluation => startRaceRunForUser("response-player",
    {...input, includeEvaluation}, {db, nowMs: 30000})));
  expect(responses[0].run.runId).toBe(responses[1].run.runId);
  expect(responses.every(response => response.run.status === (prepare ? "prepared" : "active"))).toBe(true);
  expect(responses[0].run.preloadedRiddles).toBeUndefined();
  expect(responses[1].run.preloadedRiddles).toHaveLength(15);
  expect((await db.collection("raceStartRequests").get()).size).toBe(1);
  expect((await db.collection("raceAttempts").get()).size).toBe(1);
  expect((await db.collection("raceDecks").get()).size).toBe(1);
  expect((await db.collection("raceRuns").get()).size).toBe(2);
});

it("validates an accepted fallback source before creating a new request alias", async () => {
  /** A historical accepted synthetic run can contain a prompt exceeding the public keyboard contract. */
  const offerId = requestDocumentId("response-player", "response-fallback");
  await db.doc(`raceBotOffers/${offerId}`).set({version: 1, userId: "response-player", requestId: "response-fallback", locale: "en",
    categoryId: "history", requestedCategoryId: "history", performanceMs: 100000, createdAtMs: 1000, expiresAtMs: 61000, acceptedRunId: "response-run"});
  await db.doc("raceRuns/response-run").set({...fixture(), fallbackOfferId: offerId,
    riddles: fixture().riddles.map((riddle, index) => index === 0 ? {...riddle, answer: "overflow"} : riddle),
    opponent: {kind: "bot", displayName: "Nova", adjustedFinishMs: 100000, events: []}});
  /** Canonical source and its request namespace are unchanged if the source cannot be resumed. */
  const before = (await db.doc("raceRuns/response-run").get()).data();
  /** Source validation belongs in alias acceptance rather than a later transaction. */
  const error = await startRaceRunForUser("response-player", {locale: "en", categoryId: "history", fallbackOfferId: offerId,
    requestId: "response-start"}, {db, nowMs: 30000}).then(() => null, failure => failure);
  expect((await db.doc(`raceStartRequests/${requestDocumentId("response-player", "response-start")}`).get()).exists).toBe(false);
  expect((await db.doc("raceRuns/response-run").get()).data()).toEqual(before);
  expect(error).toMatchObject({code: "data-loss"});
  await db.doc("raceRuns/response-run").update({riddles: fixture().riddles, expiresAt: Timestamp.fromMillis(50000)});
  /** Different retries alias the same owned source without extending its retention. */
  const responses = await Promise.all(["response-start", "response-alias"].map(requestId => startRaceRunForUser("response-player",
    {locale: "en", categoryId: "history", fallbackOfferId: offerId, requestId}, {db, nowMs: 30000})));
  expect(responses.every(response => response.run.runId === "response-run" && response.run.startsAtMs === 1000)).toBe(true);
  /** Aliases retain their parent's shorter expiry rather than creating a new race lifetime. */
  const receipts = await db.collection("raceStartRequests").get();
  expect(receipts.size).toBe(2);
  expect(receipts.docs.every(receipt => receipt.data().expiresAt.toMillis() === 50000)).toBe(true);
  expect((await db.collection("raceRuns").get()).size).toBe(1);
});

it("accepts concurrent readiness after repair once, with fresh replay clocks and evaluation", async () => {
  await db.doc("raceRuns/response-run").set({...fixture(), status: "prepared", startedAtMs: 0, preparationExpiresAtMs: 30000});
  await expect(readyRaceRunForUser("response-player", {runId: "response-run", requestId: "response-ready"}, {db, nowMs: 5000}))
    .rejects.toMatchObject({code: "data-loss", message: "Stored race view is invalid."});
  await db.doc("raceRuns/response-run").update({"opponent.avatarUrl": "https://example.com/avatar.png"});
  /** Readiness retries, even distinct command IDs, permanently share the first accepted countdown. */
  const responses = await Promise.all(["response-ready", "response-ready-other"].map(requestId => readyRaceRunForUser("response-player",
    {runId: "response-run", requestId}, {db, nowMs: 5000})));
  expect(responses.every(response => response.run.status === "scheduled" && response.run.startsAtMs === 8000)).toBe(true);
  /** Presentation can change on a later replay without resetting the canonical start or deadline. */
  const replay = await readyRaceRunForUser("response-player", {runId: "response-run", requestId: "response-ready", includeEvaluation: true},
    {db, nowMs: 9000});
  expect(replay.run).toMatchObject({status: "active", startsAtMs: 8000, serverNowMs: 9000, wallElapsedMs: 1000});
  expect(replay.run.preloadedRiddles).toHaveLength(15);
  expect((await db.doc("raceRuns/response-run").get()).data()).toMatchObject({status: "scheduled", startedAtMs: 8000});
});

it("settles concurrent resumes exactly once after presentation is repaired", async () => {
  await db.doc("raceRuns/response-run").set({...fixture(), status: "completed", result: "player_win", correctCount: 10,
    currentPosition: 9, wallFinishMs: 5000, finishedAtMs: 6000, challengeId: "response-challenge"});
  await expect(resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 7000})).rejects.toMatchObject({code: "data-loss"});
  await db.doc("raceRuns/response-run").update({"opponent.avatarUrl": "https://example.com/avatar.png"});
  /** Transaction retries must not duplicate the two achievement awards or either delivery outbox. */
  const responses = await Promise.all([false, true].map(includeEvaluation => resumeRaceRunForUser("response-player", "response-run",
    {db, nowMs: 7000, includeEvaluation})));
  expect(responses.every(response => response.run.status === "completed" && response.run.correctCount === 10)).toBe(true);
  expect((await db.doc("users/response-player").get()).data()?.coins).toBe(75);
  expect((await db.collection("racePerformanceOutbox").get()).size).toBe(1);
  expect((await db.collection("raceSettlementOutbox").get()).size).toBe(1);
  /** A later read does not reapply the grant or recreate a consumed delivery. */
  const account = (await db.doc("users/response-player").get()).data();
  await resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 10000});
  expect((await db.doc("users/response-player").get()).data()).toEqual(account);
});

it.each(["ready", "resume"])("anonymizes deleted opponent presentation before %s decoding and physically persists the scrub", async operation => {
  await db.doc("jestAccountDeletionTombstones/response-creator").set({deletedAtMs: 2000});
  /** A malformed copied avatar cannot prevent deletion-safe recovery of an owned race. */
  const response = operation === "ready"
    ? await readyRaceRunForUser("response-player", {runId: "response-run", requestId: "response-ready"}, {db, nowMs: 3000})
    : await resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 3000});
  expect(response.run.opponent).toMatchObject({displayName: "Riddle Quest player", adjustedFinishMs: 10000});
  expect(response.run.opponent?.avatarUrl).toBeUndefined();
  /** Neither private account linkage nor copied presentation remains in the persisted source. */
  const stored = (await db.doc("raceRuns/response-run").get()).data()?.opponent;
  expect(stored.subjectUserId).toBeUndefined();
  expect(stored.avatarUrl).toBeUndefined();
});

it("validates optional preloaded evaluation while respecting server-only policy", async () => {
  await db.doc("raceRuns/response-run").set({...fixture(), opponent: {...fixture().opponent!, avatarUrl: "https://example.com/avatar.png"},
    riddles: fixture().riddles.map((riddle, index) => index === 14 ? {...riddle, answer: "overflow"} : riddle)});
  await expect(resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 3000, includeEvaluation: true}))
    .rejects.toMatchObject({code: "data-loss"});
  /** Answer-free recovery can resume a valid current question without projecting later evaluation. */
  expect((await resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 3000})).run.currentRiddle?.riddleId).toBe("q-0");
  await db.doc("raceRuns/response-run").update({evaluationPolicy: "server-only"});
  expect((await resumeRaceRunForUser("response-player", "response-run", {db, nowMs: 3000, includeEvaluation: true})).run.preloadedRiddles)
    .toBeUndefined();
});

it("rejects an undeliverable concurrent fallback winner before alias acceptance", async () => {
  /** Discovery remains unaccepted during initial preparation, then another command accepts it. */
  const offerId = requestDocumentId("response-player", "response-fallback");
  await db.doc(`raceBotOffers/${offerId}`).set({version: 1, userId: "response-player", requestId: "response-fallback", locale: "en",
    categoryId: "history", requestedCategoryId: "history", performanceMs: 100000, createdAtMs: 1000, expiresAtMs: 61000});
  await db.doc("raceRuns/response-run").set({...fixture(), fallbackOfferId: offerId,
    riddles: fixture().riddles.map((riddle, index) => index === 0 ? {...riddle, answer: "overflow"} : riddle),
    opponent: {kind: "bot", displayName: "Nova", adjustedFinishMs: 100000, events: []}});
  /** Content preparation still uses real eligible localized records. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
  await batch.commit();
  /** Interleave acceptance deterministically while retaining the actual Firestore transaction and retry semantics. */
  const transact = db.runTransaction.bind(db);
  /** Only the first transaction is delayed; all authoritative reads and writes remain emulator-backed. */
  const interleave = jest.spyOn(db, "runTransaction").mockImplementationOnce(async update => {
    await db.doc(`raceBotOffers/${offerId}`).update({acceptedRunId: "response-run"});
    return transact(update);
  });
  try {
    await expect(startRaceRunForUser("response-player", {locale: "en", categoryId: "history", fallbackOfferId: offerId,
      requestId: "response-concurrent"}, {db, nowMs: 30000})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc(`raceStartRequests/${requestDocumentId("response-player", "response-concurrent")}`).get()).exists).toBe(false);
    expect((await db.collection("raceRuns").get()).size).toBe(1);
    expect((await db.collection("raceDecks").get()).empty).toBe(true);
  } finally {interleave.mockRestore();}
});

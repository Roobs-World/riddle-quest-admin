import {getDailyDate} from "../../../src/core/validation/dailyCalendar.js";
import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {ensureAuthoritativeSession, finalizeAuthoritativeSession, submitAuthoritativeGuess} from "../gameplay/singlePlayerSession";
import {completeAuthoritativeGame} from "../gameplay/completeGameLogic";
import {baseAttemptLimit} from "../gameplay/singlePlayerGuessTransition";
import {ensureUserDocumentComplete} from "../gameplay/firestoreService";

/** Content preparation receives committed progress while persistence and sessions stay real. */
const mockPrepareClassicSupply = jest.fn(async (_userId: string, _index: number, _locale: string) => undefined);
// Derived projections are isolated; sessions, repairs, economy and receipts use real Firestore transactions.
jest.mock("../gameplay/leaderboard", () => ({updateLeaderboardEntry: async () => undefined}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: (...args: [string, number, string]) => mockPrepareClassicSupply(...args)}));

/** Every destructive fixture is constrained to one private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Canonical provider identity cannot trigger another provider's referral delivery. */
const OWNER = `jest_${"d".repeat(40)}`;
/** Session completion and helper repair share the normal Admin SDK database. */
let db: FirebaseFirestore.Firestore;
/** User subcollections and completion receipts are removed only from the private fixture. */
const clear = async () => {await db.recursiveDelete(db.collection("users")); await db.recursiveDelete(db.collection("gameCompletionReceipts"));};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {await clear(); mockPrepareClassicSupply.mockClear();});
afterAll(clear);

/** Creates a real opaque session and a terminal authoritative guess sequence. */
async function terminal(win: boolean, gameMode: "classic" | "challenge" = "classic") {
  await db.doc(`users/${OWNER}`).set({userId: OWNER, username: "Legacy player", email: "legacy@example.invalid", coins: 550,
    hasPurchasedApp: true, stats: {gamesPlayed: 9, multiplayerWins: 2}, progress: {classicIndex: 1}});
  /** Canonical authored content is trusted by issuance, never supplied by a gameplay client. */
  /** Daily entitlement follows the same locale calendar as authoritative completion. */
  const day = getDailyDate("en");
  /** Each mode keeps its canonical content and completion identity. */
  const riddleId = gameMode === "classic" ? "classic-1" : `daily-${day}`;
  /** A real opaque session binds the content, entitlement and accepted attempt limit. */
  const sessionToken = await ensureAuthoritativeSession(OWNER, gameMode, riddleId, "en", gameMode === "classic" ? "classic:1" : `challenge:${day}`,
    gameMode === "classic" ? "classic:1" : day, "piano", {...(gameMode === "classic" ? {classicIndex: 1} : {challengeDate: day}), difficultyBand: "easy"});
  for (const [position, guess] of (win ? ["piano"] : ["organ", "crane", "flute", "drums", "cello", "viola"].slice(0, baseAttemptLimit(gameMode))).entries())
    await submitAuthoritativeGuess(OWNER, {gameMode, riddleId, sessionToken, guess, requestId: `repair-guess-${position}`});
  return {gameMode, riddleId, sessionToken};
}

it.each((["classic", "challenge"] as const).flatMap(gameMode => [false, true].flatMap(win => [false, true].map(isAnonymous =>
  ({gameMode, win, isAnonymous})))))("receipts real $gameMode win $win with anonymous $isAnonymous exactly once", async ({gameMode, win, isAnonymous}) => {
  /** Repeated callers use the same real terminal session and permanent completion identity. */
  const request = await terminal(win, gameMode);
  /** Real concurrent completion transactions contend on the account and receipt. */
  const results = await Promise.all(Array.from({length: 4}, () => completeAuthoritativeGame(request, {uid: OWNER, isAnonymous})));
  expect(results.every(value => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
  /** Committed profile retains other game counters and paid entitlement. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data()!;
  expect(profile).toMatchObject({coins: 550 + results[0]!.coinsEarned, hasPurchasedApp: true,
    stats: {gamesPlayed: 10, multiplayerWins: 2}, progress: {classicIndex: win && gameMode === "classic" ? 2 : 1, dailyChallengeIndex: win && gameMode === "challenge" ? 1 : 0}});
  expect(Array.isArray(profile.unlockedAchievements)).toBe(true);
  expect((await db.collection("gameCompletionReceipts").get()).size).toBe(1);
  expect(await completeAuthoritativeGame(request, {uid: OWNER, isAnonymous})).toEqual(results[0]);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
  expect(mockPrepareClassicSupply).toHaveBeenCalledTimes(win && gameMode === "classic" ? 5 : 0);
  if (win && gameMode === "classic") expect(mockPrepareClassicSupply.mock.calls.every(call => call[1] === 2)).toBe(true);
});

it("rolls back profile repair when the completion receipt is corrupt", async () => {
  /** Valid terminal authority isolates receipt corruption from session validation. */
  const request = await terminal(true);
  /** Existing corrupt receipt must reject before any profile default can be persisted. */
  const receiptId = createHash("sha256").update(`${OWNER}\0classic\0classic:1`).digest("hex");
  await db.doc(`gameCompletionReceipts/${receiptId}`).set({status: "corrupt"});
  /** This exact legacy profile must survive a failed completion transaction unchanged. */
  const before = (await db.doc(`users/${OWNER}`).get()).data();
  await expect(completeAuthoritativeGame(request, {uid: OWNER})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(before);
});

it("never recreates a missing account while replaying its existing completion receipt", async () => {
  /** The first real settlement establishes the permanent receipt. */
  const request = await terminal(true);
  /** Cached response is retained even after this fixture removes the account. */
  const first = await completeAuthoritativeGame(request, {uid: OWNER});
  await db.doc(`users/${OWNER}`).delete();
  mockPrepareClassicSupply.mockClear();
  expect(await completeAuthoritativeGame(request, {uid: OWNER})).toEqual(first);
  expect((await db.doc(`users/${OWNER}`).get()).exists).toBe(false);
  expect(mockPrepareClassicSupply).not.toHaveBeenCalled();
});

it("uses current committed progression while replaying a real earlier receipt", async () => {
  /** Real issuance, terminal guess and completion establish index two and its immutable receipt. */
  const request = await terminal(true);
  /** Receipt result remains unchanged when later progress has already committed. */
  const first = await completeAuthoritativeGame(request, {uid: OWNER});
  expect(mockPrepareClassicSupply).toHaveBeenLastCalledWith(OWNER, 2, "en");
  await db.doc(`users/${OWNER}`).update({"progress.classicIndex": 7});
  /** The fresh canonical snapshot must supply the post-commit task without another profile fetch. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  expect(await completeAuthoritativeGame(request, {uid: OWNER})).toEqual(first);
  expect(mockPrepareClassicSupply).toHaveBeenLastCalledWith(OWNER, 7, "en");
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
});

it("preserves an authoritative progression and purchase transaction amid concurrent legacy repairs", async () => {
  await db.doc(`users/${OWNER}`).set({stats: {gamesPlayed: 9}, progress: {classicIndex: 5}});
  /** The competing server mutation advances progress and grants the entitlement in one real transaction. */
  const advance = () => db.runTransaction(async transaction => {
    /** Canonical profile is read before the concurrent grant. */
    const ref = db.doc(`users/${OWNER}`), snapshot = await transaction.get(ref);
    transaction.update(ref, {"stats.gamesPlayed": snapshot.data()!.stats.gamesPlayed + 1,
      "progress.classicIndex": snapshot.data()!.progress.classicIndex + 1, coins: 550, hasPurchasedApp: true,
      unlockedAchievements: FieldValue.arrayUnion({achievementId: "race_debut", unlockedAt: 123})});
  });
  await Promise.all([ensureUserDocumentComplete(OWNER), advance(), ensureUserDocumentComplete(OWNER)]);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 550, hasPurchasedApp: true,
    stats: {gamesPlayed: 10}, progress: {classicIndex: 6}, unlockedAchievements: [{achievementId: "race_debut", unlockedAt: 123}]});
});

it("finalizes an already-terminal win from a lock-free snapshot without rewriting its pointer", async () => {
  /** A winning guess commits the terminal session and its recovery pointer. */
  const request = await terminal(true);
  /** Pointer written by the terminal guess. */
  const [pointer] = (await db.collection(`users/${OWNER}/singlePlayerCompletionBindings`).get()).docs;
  /** Records which transaction modes finalize opens. */
  const transactions = jest.spyOn(db, "runTransaction");
  /** Finalized state used by completion. */
  const state = await finalizeAuthoritativeSession(OWNER, request.gameMode, request.riddleId, request.sessionToken);
  expect(state).toMatchObject({terminal: true, isCorrect: true});
  expect(transactions.mock.calls.map(call => call[1])).toEqual([{readOnly: true}]);
  transactions.mockRestore();
  expect((await pointer!.ref.get()).updateTime).toEqual(pointer!.updateTime);
});

it("still terminalizes a declined base-limit loss through the authoritative path", async () => {
  /** A full base-limit loss is awaiting a continue decision, not yet terminal. */
  const request = await terminal(false);
  /** Finalized state used by completion. */
  const state = await finalizeAuthoritativeSession(OWNER, request.gameMode, request.riddleId, request.sessionToken);
  expect(state).toMatchObject({terminal: true, isCorrect: false});
  expect((await db.collection(`users/${OWNER}/singlePlayerCompletionBindings`).get()).size).toBe(1);
});

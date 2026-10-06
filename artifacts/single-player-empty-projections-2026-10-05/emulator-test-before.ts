import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {ensureAuthoritativeSession, submitAuthoritativeGuess} from "../gameplay/singlePlayerSession";
import {completeAuthoritativeGame} from "../gameplay/completeGameLogic";
import {baseAttemptLimit} from "../gameplay/singlePlayerGuessTransition";
import {ensureUserDocumentComplete} from "../gameplay/firestoreService";

// Derived projections are isolated; sessions, repairs, economy and receipts use real Firestore transactions.
jest.mock("../gameplay/leaderboard", () => ({updateLeaderboardEntry: async () => undefined}));
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: async () => undefined}));

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
beforeEach(clear);
afterAll(clear);

/** Creates a real opaque session and a terminal authoritative guess sequence. */
async function terminal(win: boolean) {
  await db.doc(`users/${OWNER}`).set({userId: OWNER, username: "Legacy player", email: "legacy@example.invalid", coins: 550,
    hasPurchasedApp: true, stats: {gamesPlayed: 9, multiplayerWins: 2}, progress: {classicIndex: 1}});
  /** Canonical authored content is trusted by issuance, never supplied by a gameplay client. */
  const sessionToken = await ensureAuthoritativeSession(OWNER, "classic", "classic-1", "en", "classic:1", "classic:1", "piano", {classicIndex: 1, difficultyBand: "easy"});
  for (const [position, guess] of (win ? ["piano"] : ["organ", "crane", "flute", "drums", "cello", "viola"].slice(0, baseAttemptLimit("classic"))).entries())
    await submitAuthoritativeGuess(OWNER, {gameMode: "classic", riddleId: "classic-1", sessionToken, guess, requestId: `repair-guess-${position}`});
  return {gameMode: "classic" as const, riddleId: "classic-1", sessionToken};
}

it.each([false, true])("repairs a legacy account and receipts a real terminal win %s exactly once", async win => {
  /** Repeated callers use the same real terminal session and permanent completion identity. */
  const request = await terminal(win);
  /** Real concurrent completion transactions contend on the account and receipt. */
  const results = await Promise.all(Array.from({length: 4}, () => completeAuthoritativeGame(request, {uid: OWNER})));
  expect(results.every(value => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
  /** Committed profile retains other game counters and paid entitlement. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data()!;
  expect(profile).toMatchObject({coins: 550 + results[0]!.coinsEarned, hasPurchasedApp: true,
    stats: {gamesPlayed: 10, multiplayerWins: 2}, progress: {classicIndex: win ? 2 : 1, dailyChallengeIndex: 0}});
  expect(Array.isArray(profile.unlockedAchievements)).toBe(true);
  expect((await db.collection("gameCompletionReceipts").get()).size).toBe(1);
  expect(await completeAuthoritativeGame(request, {uid: OWNER})).toEqual(results[0]);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
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
  expect(await completeAuthoritativeGame(request, {uid: OWNER})).toEqual(first);
  expect((await db.doc(`users/${OWNER}`).get()).exists).toBe(false);
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

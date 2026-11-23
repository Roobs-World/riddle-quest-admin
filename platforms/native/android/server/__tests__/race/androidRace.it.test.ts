import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../../../../../firebase-functions/src/race/live/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../../../../../firebase-functions/src/race/invitations/raceLiveInvitation";
import {liveJoinIntentRef} from "../../../../../../firebase-functions/src/race/invitations/raceLiveJoinIntent";
import {requestDocumentId} from "../../../../../../firebase-functions/src/race/raceSetupService";

/** Authenticated fixture identities share one provider. */
const A = "a".repeat(28), B = "b".repeat(28), C = `jest_${"c".repeat(40)}`;
/** Stable server clock for invitation expiration and countdowns. */
const NOW = 1_800_000_000_000;
/** Isolated emulator database for atomic reservation checks. */
let db: FirebaseFirestore.Firestore;
/** Deletes only this demo project's synthetic data. */
async function clear() {
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceMatches", "liveRaceQueues", "users", "localizedRiddles"])
    await db.recursiveDelete(db.collection(collection));
}
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: "demo-android-live-parity"});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Unique eligible riddles provide a real server deck. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: ["easy", "medium", "hard"][i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const [index, user] of [A, B, C].entries()) batch.set(db.doc(`users/${user}`), {username: ["Alice", "Bob", "Charlie"][index], coins: 100, ...(user === C ? {} : {androidProvider: "anonymous"})});
  await batch.commit();
});
afterAll(async () => {await clear(); await db.terminate();});

it("pairs Android players without mixing the Jest pool, and rejects unprovisioned identities", async () => {
  /** Retains join for this operation. */
  const join = (userId: string, requestId: string) => joinLiveRaceForUser(userId,
    {locale: "en", categoryId: "history", requestId}, {db, nowMs: NOW});
  expect((await join(C, "jest-pool-001")).phase).toBe("searching");
  expect((await join(A, "android-pool-001")).phase).toBe("searching");
  expect(await join(B, "android-pool-002")).toMatchObject({phase: "countdown", opponent: {displayName: "Alice", bot: false}});
  /** Retains unknown for this operation. */
  const unknown = "d".repeat(28);
  await db.doc(`users/${unknown}`).set({username: "Unprovisioned"});
  await expect(join(unknown, "unprovisioned-001")).rejects.toMatchObject({code: "permission-denied"});
});

it("accepts an Android share invitation and settles a completed race once", async () => {
  /** Retains a for this operation. */
  const a = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "private-android-001", createChallenge: true}, {db, nowMs: NOW});
  expect(await getLiveRaceChallengeForUser(B, a.challengeId!, {db, nowMs: NOW + 1000})).toMatchObject({status: "available"});
  await expect(getLiveRaceChallengeForUser(C, a.challengeId!, {db, nowMs: NOW + 1000})).rejects.toMatchObject({code: "not-found"});
  /** Retains b for this operation. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "accept-android-001", challengeId: a.challengeId}, {db, nowMs: NOW + 1000});
  expect(b.phase).toBe("countdown");
  for (let index = 0; index < 10; index++) {
    /** Retains match for this operation. */
    const match = (await db.doc(`liveRaceMatches/${a.ticketId}`).get()).data()!;
    /** Retains riddle for this operation. */
    const riddle = match.runs[0].riddles[index];
    await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "guess", requestId: `android-guess-${index}`, riddleId: riddle.riddleId, guess: riddle.answer},
      {db, nowMs: NOW + 7000 + index * 1000});
  }
  /** Retains result for this operation. */
  const result = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "android-final-result"}, {db, nowMs: NOW + 20000});
  expect(result).toMatchObject({phase: "result", rewardCoins: 50});
  /** Retains before for this operation. */
  const before = (await db.doc(`users/${A}`).get()).get("coins");
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "android-final-replay"}, {db, nowMs: NOW + 21000});
  expect((await db.doc(`users/${A}`).get()).get("coins")).toBe(before);
});

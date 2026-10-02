import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";

/** Authenticated fixture identities share one provider. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, C = `jest_${"c".repeat(40)}`;
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
  if (!getApps().length) initializeApp({projectId: "demo-live-pvp-invitations"});
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
  for (const [index, user] of [A, B, C].entries()) batch.set(db.doc(`users/${user}`), {username: ["Alice", "Bob", "Charlie"][index], coins: 100});
  await batch.commit();
});
afterAll(clear);
/** Reserves Alice's private lobby with a stable idempotency key. */
const reserve = () => joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "private-lobby-001", createChallenge: true}, {db, nowMs: NOW});
/** Explicitly accepts Alice's existing lobby. */
const accept = (userId: string, challengeId: string, nowMs = NOW + 1000, requestId = "accept-private-001") =>
  joinLiveRaceForUser(userId, {locale: "en", categoryId: "history", requestId, challengeId}, {db, nowMs});

it("previews without joining and reserves exactly one rival in the original lobby", async () => {
  /** Repeated publication retains one private seat. */
  const a = await reserve();
  expect((await reserve()).ticketId).toBe(a.ticketId);
  expect(a.challengeId).toBe(`live_${a.ticketId}`);
  expect(await getLiveRaceChallengeForUser(B, a.challengeId!, {db, nowMs: NOW + 1000})).toMatchObject({status: "available", creator: {displayName: "Alice"}});
  expect((await db.collection("liveRacePlayers").get()).size).toBe(1);
  /** Two concurrent recipients compete for the same server lock. */
  const outcomes = await Promise.allSettled([accept(B, a.challengeId!), accept(C, a.challengeId!)]);
  expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
  /** One existing lobby becomes one human match with a shared countdown. */
  const creator = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "creator-observe-001"}, {db, nowMs: NOW + 1000});
  expect(creator).toMatchObject({phase: "countdown", startsAtMs: NOW + 6000, opponent: {bot: false}});
  expect((await db.collection("liveRaceMatches").get()).docs[0].id).toBe(a.ticketId);
});

it("recovers a lost acceptance response without resetting the countdown or creating another seat", async () => {
  /** Recipient retries the original request and then a fresh browser journey. */
  const a = await reserve(), b = await accept(B, a.challengeId!);
  expect(await accept(B, a.challengeId!, NOW + 2000)).toMatchObject({ticketId: b.ticketId, startsAtMs: b.startsAtMs});
  expect(await accept(B, a.challengeId!, NOW + 3000, "reload-accept-001")).toMatchObject({ticketId: b.ticketId, startsAtMs: b.startsAtMs});
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
});

it("keeps private invitations out of public searches and bot fallback", async () => {
  /** Public search cannot consume a reserved invitation. */
  const a = await reserve();
  expect((await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "public-search-001"}, {db, nowMs: NOW + 1000})).phase).toBe("searching");
  expect((await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "private-no-bot-001"}, {db, nowMs: NOW + 60_000})).phase).toBe("searching");
  expect((await db.collection("liveRaceMatches").get()).size).toBe(0);
});

it("rejects self, cross-provider, expired, cancelled, offline and blocked invitations", async () => {
  /** Invitation existence cannot bypass authentication or safety boundaries. */
  const a = await reserve();
  await expect(accept(A, a.challengeId!)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(accept(`facebook_${"b".repeat(40)}`, a.challengeId!)).rejects.toMatchObject({code: "not-found"});
  await expect(accept(B, a.challengeId!, NOW + 900_000)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(accept(B, a.challengeId!, NOW + 31_000)).rejects.toMatchObject({code: "unavailable"});
  await db.doc(`users/${A}/blockedRivals/${B}`).set({blocked: true});
  await expect(accept(B, a.challengeId!)).rejects.toMatchObject({code: "not-found"});
  await db.doc(`users/${A}/blockedRivals/${B}`).delete();
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "leave", requestId: "cancel-private-001"}, {db, nowMs: NOW + 1000});
  await expect(accept(B, a.challengeId!)).rejects.toMatchObject({code: "failed-precondition"});
});

it("cannot replace an active public seat or reuse an unrelated join request id", async () => {
  /** An active recipient journey cannot be orphaned by an invitation. */
  const a = await reserve();
  await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "public-existing-001"}, {db, nowMs: NOW + 1000});
  await expect(accept(B, a.challengeId!)).rejects.toMatchObject({code: "failed-precondition"});
  await expect(accept(B, a.challengeId!, NOW + 1000, "public-existing-001")).rejects.toMatchObject({code: "failed-precondition"});
});


it("allows fresh searches and acceptances after an unattended private invitation expires", async () => {
  /** Expiry is authoritative even if the creator never delivered a final heartbeat. */
  const a = await reserve();
  /** New public entry retires the stale private pointer without requiring a recovery detour. */
  const publicSeat = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "new-public-after-expiry"}, {db, nowMs: NOW + 900_001});
  expect(publicSeat.ticketId).not.toBe(a.ticketId);
  expect(publicSeat.challengeId).toBeUndefined();
  /** Replaying the expired publication returns a terminal receipt. */
  expect((await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "private-lobby-001", createChallenge: true}, {db, nowMs: NOW + 900_002})).phase).toBe("cancelled");
  /** A recipient's expired invitation also cannot block acceptance of a new friend's lobby. */
  await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "recipient-old-invite", createChallenge: true}, {db, nowMs: NOW});
  /** Charlie's fresh private lobby is accepted under its original match identity. */
  const c = await joinLiveRaceForUser(C, {locale: "en", categoryId: "history", requestId: "fresh-friend-invite", createChallenge: true}, {db, nowMs: NOW + 900_001});
  expect(await accept(B, c.challengeId!, NOW + 900_002)).toMatchObject({phase: "countdown", opponent: {displayName: "Charlie"}});
});

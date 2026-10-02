import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {RaceRunRecord} from "../../race/raceEngine";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";

/** Real local authority; no production or non-emulated account access is allowed. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
const START = Date.UTC(2026, 9, 2, 12);
const PLAYERS = [`facebook_${"a".repeat(40)}`, `facebook_${"b".repeat(40)}`];
const INVITER = `facebook_${"e".repeat(40)}`;
const COLLECTIONS = ["users", "facebookReferralBindings", "facebookReferralDailyCaps", "facebookReferralSettlements",
  "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceMaintenance", "liveRaceTickets", "liveRaceMatches",
  "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles"];
let db: FirebaseFirestore.Firestore;
let sequence = 0;
const previousFeatures = process.env.FACEBOOK_DISABLED_FEATURES;

beforeAll(() => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});
beforeEach(async () => {
  process.env.FACEBOOK_DISABLED_FEATURES = "commerce,rewarded_ads";
  await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});
afterAll(async () => {
  if (previousFeatures === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
  else process.env.FACEBOOK_DISABLED_FEATURES = previousFeatures;
  if (db) await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});

/** A referral binding precedes the first authoritative win; both players start without wins. */
async function pair(players = PLAYERS) {
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  batch.set(db.doc(`users/${INVITER}`), {coins: 300, stats: {wins: 2, multiplayerWins: 0}});
  for (const userId of players) {
    batch.set(db.doc(`users/${userId}`), {username: "Live player", coins: 100, stats: {wins: 0, multiplayerWins: 0}});
    batch.set(db.doc(`facebookReferralBindings/${userId}`), {provider: "facebook", inviteeUid: userId,
      inviterUid: INVITER, tokenId: "c".repeat(64), boundAtMs: START - 1000, settledAtMs: null});
  }
  await batch.commit();
  sequence++;
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `referral-a-${sequence}`}, {db, nowMs: START});
  const b = await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `referral-b-${sequence}`}, {db, nowMs: START + 1000});
  return [a, b];
}

/** Solves the private creator deck through normal commands rather than manufacturing a terminal projection. */
async function finish(userId: string, ticketId: string, from = 0) {
  for (let i = from; i < 10; i++) {
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord;
    const riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `referral-guess-${sequence}-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: START + 6000 + i * 1000});
  }
}

it.each([0, 1])("durably grants the first live-win referral for winning seat %i exactly once", async seat => {
  const seats = await pair(), userId = PLAYERS[seat], winner = seats[seat];
  await finish(userId, winner.ticketId);
  expect((await db.doc(`users/${userId}`).get()).data()).toMatchObject({coins: 150, stats: {wins: 0, multiplayerWins: 1}});
  const events = await db.collection("racePerformanceOutbox").where("userId", "==", userId).get();
  expect(events.size).toBe(1);
  await Promise.all(Array.from({length: 4}, () => deliverRacePerformance(events.docs[0].id, db, START + 16000)));
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(1);
  expect((await events.docs[0].ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  await updateLiveRaceForUser(userId, {ticketId: winner.ticketId, action: "poll", requestId: "referral-terminal-retry"}, {db, nowMs: START + 17000});
  await deliverRacePerformance(events.docs[0].id, db, START + 18000);
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
});

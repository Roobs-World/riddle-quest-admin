import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {RaceRunRecord} from "../../race/raceEngine";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";
import {issueRedditReferralToken, bindRedditReferralToken} from "../../reddit/redditReferrals";
import {processRaceDeliveryQueue} from "../../race/raceDeliveryQueue";
import {replayRaceDelivery} from "../../race/raceDeliveryRecovery";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";
import {Timestamp} from "firebase-admin/firestore";
import {LIVE_RACE_WAIT_MS} from "@qwordly/core/race";
import {requestDocumentId} from "../../race/raceSetupService";
import {settleRedditReferralAfterAuthoritativeWin} from "../../reddit/redditReferrals";

/** Real local authority; no production or non-emulated account access is allowed. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
const START = Date.UTC(2026, 9, 2, 12);
const PLAYERS = [`reddit_${"a".repeat(40)}`, `reddit_${"b".repeat(40)}`];
const INVITER = `reddit_${"e".repeat(40)}`;
const COLLECTIONS = ["users", "redditReferralTokens", "redditReferralBindings", "redditReferralDailyCaps", "redditReferralSettlements",
  "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceMaintenance", "liveRaceTickets", "liveRaceMatches",
  "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles"];
let db: FirebaseFirestore.Firestore;
let sequence = 0;
const previousFeatures = process.env.REDDIT_DISABLED_FEATURES;

beforeAll(() => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});
beforeEach(async () => {
  process.env.REDDIT_DISABLED_FEATURES = "commerce,notifications";
  await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});
afterAll(async () => {
  if (previousFeatures === undefined) delete process.env.REDDIT_DISABLED_FEATURES;
  else process.env.REDDIT_DISABLED_FEATURES = previousFeatures;
  if (db) await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});
afterEach(() => jest.restoreAllMocks());

/** A referral binding precedes the first authoritative win; both players start without wins. */
async function pair(players = PLAYERS, bindReferral = true) {
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  if (!(await db.doc(`users/${INVITER}`).get()).exists)
    batch.set(db.doc(`users/${INVITER}`), {coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2, multiplayerWins: 0}});
  for (const userId of players) {
    batch.set(db.doc(`users/${userId}`), {username: "Live player", coins: 100, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0, multiplayerWins: 0}});
  }
  await batch.commit();
  sequence++;
  const provenance = {locale: "en" as const, postId: "t3_live_referral", environment: "sandbox" as const};
  const {token} = await issueRedditReferralToken(INVITER, START - 1000, () => String(sequence).padStart(43, "t"), db, provenance);
  for (const userId of players.filter(id => bindReferral && id.startsWith("reddit_"))) await bindRedditReferralToken(userId, token, START - 500, db, provenance);
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `referral-a-${sequence}`}, {db, nowMs: START});
  const b = players.length > 1 ? await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `referral-b-${sequence}`}, {db, nowMs: START + 1000}) : undefined;
  return b ? [a, b] : [a];
}

/** Solves the private creator deck through normal commands rather than manufacturing a terminal projection. */
async function finish(userId: string, ticketId: string, from = 0, firstGuessMs = START + 6000) {
  for (let i = from; i < 10; i++) {
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord;
    const riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `referral-guess-${sequence}-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: firstGuessMs + i * 1000});
  }
}

it.each([0, 1])("durably grants the first live-win referral for winning seat %i exactly once", async seat => {
  const seats = await pair(), userId = PLAYERS[seat], winner = seats[seat];
  const binding = (await db.doc(`redditReferralBindings/${userId}`).get()).data()!;
  expect(binding).toMatchObject({provider: "reddit", inviteeUid: userId, locale: "en", environment: "sandbox"});
  expect(binding.postIdHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(binding)).not.toContain("t3_live_referral");
  await finish(userId, winner.ticketId);
  expect((await db.doc(`users/${userId}`).get()).data()).toMatchObject({coins: 150, stats: {wins: 0, multiplayerWins: 1}});
  const events = await db.collection("racePerformanceOutbox").where("userId", "==", userId).get();
  expect(events.size).toBe(1);
  await Promise.all(Array.from({length: 4}, () => deliverRacePerformance(events.docs[0].id, db, START + 16000)));
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("redditReferralSettlements").get()).size).toBe(1);
  expect((await db.collection(`users/${userId}/raceMatchProfiles`).get()).empty).toBe(true);
  expect((await events.docs[0].ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  await updateLiveRaceForUser(userId, {ticketId: winner.ticketId, action: "poll", requestId: "referral-terminal-retry"}, {db, nowMs: START + 17000});
  await deliverRacePerformance(events.docs[0].id, db, START + 18000);
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
});

it("rejects first-win referral grants before a real live win", async () => {
  await pair();
  await expect(settleRedditReferralAfterAuthoritativeWin(PLAYERS[1], START + 2000, db)).rejects.toThrow("reddit-referral-win-not-established");
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(100);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
  expect((await db.collection("redditReferralSettlements").get()).empty).toBe(true);
});

it("rejects a first referral binding after a real live win", async () => {
  const seats = await pair(PLAYERS, false);
  await finish(PLAYERS[1], seats[1].ticketId);
  const provenance = {locale: "en" as const, postId: "t3_live_referral", environment: "sandbox" as const};
  const {token} = await issueRedditReferralToken(INVITER, START + 16000, () => "z".repeat(43), db, provenance);
  await expect(bindRedditReferralToken(PLAYERS[1], token, START + 17000, db, provenance))
    .rejects.toThrow("reddit-invitee-already-established");
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  await deliverRacePerformance(event.id, db, START + 18000);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(150);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
  expect((await db.collection("redditReferralSettlements").get()).empty).toBe(true);
});

it("settles a human fallback-bot win without rewarding the bot", async () => {
  const [seat] = await pair([PLAYERS[0]]);
  const matched = await updateLiveRaceForUser(PLAYERS[0], {ticketId: seat.ticketId, action: "poll", requestId: "referral-select-bot"}, {db, nowMs: START + LIVE_RACE_WAIT_MS});
  expect(matched.opponent?.bot).toBe(true);
  await finish(PLAYERS[0], seat.ticketId, 0, matched.startsAtMs!);
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(1);
  await deliverRacePerformance(events[0].id, db, matched.startsAtMs! + 10000);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
  expect((await db.doc("users/bot").get()).exists).toBe(false);
});

it("uses an authoritative forfeit win without requiring an official ten-solve tournament score", async () => {
  const seats = await pair();
  await updateLiveRaceForUser(PLAYERS[1], {ticketId: seats[1].ticketId, action: "leave", requestId: "referral-forfeit"}, {db, nowMs: START + 7000});
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  expect(event.data().userId).toBe(PLAYERS[0]);
  await deliverRacePerformance(event.id, db, START + 8000);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()).toMatchObject({coins: 250, stats: {multiplayerWins: 1}});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 100, stats: {multiplayerWins: 0}});
});

it("keeps the referral lifetime grant settled when the same player wins another live match", async () => {
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  const first = (await db.collection("racePerformanceOutbox").get()).docs[0];
  await deliverRacePerformance(first.id, db, START + 16000);
  sequence++;
  await joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: `referral-repeat-a-${sequence}`}, {db, nowMs: START + 20000});
  const again = await joinLiveRaceForUser(PLAYERS[1], {locale: "en", categoryId: "history", requestId: `referral-repeat-b-${sequence}`}, {db, nowMs: START + 21000});
  await finish(PLAYERS[1], again.ticketId, 0, START + 26000);
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(2);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 36000)));
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 300, stats: {multiplayerWins: 2}});
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("redditReferralSettlements").get()).size).toBe(1);
});

it("cannot collide with a chosen legacy recorded-race request ID", async () => {
  const seats = await pair();
  const alias = requestDocumentId(PLAYERS[1], `reddit-live-referral:${seats[1].ticketId}`);
  const retained = {runId: alias, userId: PLAYERS[1], createdAtMs: START - 1000, delivered: true,
    expiresAt: Timestamp.fromMillis(START + 86400000)};
  await db.doc(`racePerformanceOutbox/${alias}`).set(retained);
  await finish(PLAYERS[1], seats[1].ticketId);
  expect((await db.doc(`racePerformanceOutbox/${alias}`).get()).data()).toEqual(retained);
  const events = (await db.collection("racePerformanceOutbox").get()).docs.filter(event => event.data().source === "reddit_live");
  expect(events).toHaveLength(1);
  expect(events[0].id).not.toBe(alias);
  await deliverRacePerformance(events[0].id, db, START + 16000);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(250);
});

it.each(["jest", "facebook"])("preserves %s live wins without Reddit referral work", async provider => {
  const players = [0, 1].map(i => `${provider}_${String(i + 1).repeat(40)}`);
  const seats = await pair(players);
  await finish(players[1], seats[1].ticketId);
  expect((await db.doc(`users/${players[1]}`).get()).data()).toMatchObject({coins: 150, stats: {multiplayerWins: 1}});
  expect((await db.collection("racePerformanceOutbox").where("source", "==", "reddit_live").get()).empty).toBe(true);
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events.map(event => event.data().source)).toEqual(provider === "jest" ? [] : ["facebook_live"]);
  expect((await db.collection("redditReferralSettlements").get()).empty).toBe(true);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
});

it.each(["early-leave", "timeout"])("does not create referral work for a live %s tie", async action => {
  const seats = await pair();
  const result = await updateLiveRaceForUser(PLAYERS[1], {ticketId: seats[1].ticketId, action: action === "early-leave" ? "leave" : "poll",
    requestId: `referral-${action}`}, {db, nowMs: START + (action === "early-leave" ? 2000 : 1_000_000)});
  expect(result.result).toBe("tie");
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
});

it.each(["grant", "acknowledgement"])("recovers live referral %s failure through the existing bounded queue", async stage => {
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  const realTransaction = db.runTransaction.bind(db);
  const failure = jest.spyOn(db, "runTransaction").mockImplementationOnce(realTransaction);
  if (stage === "acknowledgement") failure.mockImplementationOnce(realTransaction);
  failure.mockRejectedValueOnce(new Error("temporary-live-referral-storage-failure"));
  try {await expect(deliverRacePerformance(event.id, db, START + 16000)).rejects.toThrow("temporary-live-referral-storage-failure");}
  finally {failure.mockRestore();}
  const pending = (await event.ref.get()).data()!;
  expect(pending).toMatchObject({delivered: false, deliveryState: "pending", deliveryAttempts: 1});
  const expectedBefore = stage === "grant" ? 150 : 250;
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(expectedBefore);
  await deliverRacePerformance(event.id, db, pending.nextAttemptAtMs - 1);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(expectedBefore);
  await processRaceDeliveryQueue(db, "racePerformanceOutbox", id => deliverRacePerformance(id, db, pending.nextAttemptAtMs), pending.nextAttemptAtMs);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 250, stats: {multiplayerWins: 1}});
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("redditReferralSettlements").get()).size).toBe(1);
});

it.each(["disabled", "deleted", "expired", "missing-source"])("suppresses pending live referral work when %s", async condition => {
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  if (condition === "disabled") process.env.REDDIT_DISABLED_FEATURES = "referrals,commerce,notifications";
  if (condition === "deleted") await getJestAccountDeletionRef(db, PLAYERS[1]).set({deletedAtMs: START + 15001});
  if (condition === "expired") await db.doc(`liveRaceTickets/${seats[1].ticketId}`).update({expiresAt: Timestamp.fromMillis(START + 15001)});
  if (condition === "missing-source") await db.doc(`liveRaceMatches/${seats[0].ticketId}`).delete();
  await deliverRacePerformance(event.id, db, START + 16000);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "suppressed"});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(150);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
  expect((await db.collection("redditReferralSettlements").get()).empty).toBe(true);
});

it("quarantines an altered source and replays only after restoring its private winner binding", async () => {
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  const original = event.data();
  await event.ref.update({liveTicketId: seats[0].ticketId});
  await deliverRacePerformance(event.id, db, START + 16000);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "quarantined"});
  await expect(replayRaceDelivery(db, "racePerformanceOutbox", event.id, START + 17000, {dryRun: true})).rejects.toMatchObject({code: "data-loss"});
  await event.ref.update({liveTicketId: original.liveTicketId});
  expect(await replayRaceDelivery(db, "racePerformanceOutbox", event.id, START + 17000, {dryRun: true})).toBe(false);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(150);
  await replayRaceDelivery(db, "racePerformanceOutbox", event.id, START + 18000);
  await replayRaceDelivery(db, "racePerformanceOutbox", event.id, START + 19000);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
});

it.each(["winner", "clock", "retention", "profile", "bot", "provider", "provider-binding"])("quarantines corrupt private live %s authority before any referral grant", async field => {
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  const match = db.doc(`liveRaceMatches/${seats[0].ticketId}`);
  if (field === "winner") await match.update({winner: 0});
  if (field === "clock") await match.update({"redditReferral.createdAtMs": START + 14000});
  if (field === "retention") await match.update({expiresAt: {seconds: 12345}});
  if (field === "profile") await db.doc(`users/${PLAYERS[1]}`).update({"stats.multiplayerWins": 0});
  if (field === "provider") await event.ref.update({source: "facebook_live"});
  if (field === "provider-binding") {
    const value = (await match.get()).data()!;
    value.facebookReferral = value.redditReferral;
    delete value.redditReferral;
    await match.set(value);
  }
  if (field === "bot") {
    const players = (await match.get()).data()!.players;
    players[1].bot = true;
    await match.update({players});
  }
  await deliverRacePerformance(event.id, db, START + 16000);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "quarantined"});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(150);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
});

it("retains the five-inviter-per-UTC-day cap across six concurrent real live-win deliveries", async () => {
  for (let i = 0; i < 6; i++) {
    const players = [`reddit_${String(i + 1).repeat(40)}`, `reddit_${(i + 8).toString(16).repeat(40)}`];
    const seats = await pair(players);
    await finish(players[0], seats[0].ticketId);
  }
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(6);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 16000)));
  for (const event of events) expect((await db.doc(`users/${event.data().userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(800);
  expect((await db.collection("redditReferralSettlements").get()).size).toBe(6);
  expect((await db.collection("redditReferralDailyCaps").get()).docs[0].data().count).toBe(5);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 17000)));
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(800);
});

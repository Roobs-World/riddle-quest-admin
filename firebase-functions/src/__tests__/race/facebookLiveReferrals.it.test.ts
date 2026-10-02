import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import type {RaceRunRecord} from "../../race/raceEngine";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";
import {issueFacebookReferralToken, bindFacebookReferralToken} from "../../facebook/facebookReferrals";
import {processRaceDeliveryQueue} from "../../race/raceDeliveryQueue";
import {replayRaceDelivery} from "../../race/raceDeliveryRecovery";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";
import {Timestamp} from "firebase-admin/firestore";
import {LIVE_RACE_WAIT_MS} from "@qwordly/core/race";
import {requestDocumentId} from "../../race/raceSetupService";

/** Real local authority; no production or non-emulated account access is allowed. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
/** Renders the start interface. */
const START = Date.UTC(2026, 9, 2, 12);
/** Renders the players interface. */
const PLAYERS = [`facebook_${"a".repeat(40)}`, `facebook_${"b".repeat(40)}`];
/** Renders the inviter interface. */
const INVITER = `facebook_${"e".repeat(40)}`;
/** Renders the collections interface. */
const COLLECTIONS = ["users", "facebookReferralTokens", "facebookReferralBindings", "facebookReferralDailyCaps", "facebookReferralSettlements",
  "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceMaintenance", "liveRaceTickets", "liveRaceMatches",
  "liveRaceQueues", "liveRacePlayers", "localizedRiddles/en/riddles", "facebookTournaments"];
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;
/** Provides sequence behavior. */
let sequence = 0;
/** Provides previous features behavior. */
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
afterEach(() => jest.restoreAllMocks());

/** A referral binding precedes the first authoritative win; both players start without wins. */
async function pair(players = PLAYERS) {
  /** Provides batch behavior. */
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
  /** Provides {token} behavior. */
  const {token} = await issueFacebookReferralToken(INVITER, START - 1000, () => String(sequence).padStart(43, "t"), db);
  for (const userId of players.filter(id => id.startsWith("facebook_"))) await bindFacebookReferralToken(userId, token, START - 500, db);
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `referral-a-${sequence}`}, {db, nowMs: START});
  /** Provides b behavior. */
  const b = players.length > 1 ? await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `referral-b-${sequence}`}, {db, nowMs: START + 1000}) : undefined;
  return b ? [a, b] : [a];
}

/** Solves the private creator deck through normal commands rather than manufacturing a terminal projection. */
async function finish(userId: string, ticketId: string, from = 0, firstGuessMs = START + 6000) {
  for (let i = from; i < 10; i++) {
    /** Provides ticket behavior. */
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    /** Provides match behavior. */
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    /** Provides run behavior. */
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord;
    /** Provides riddle behavior. */
    const riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `referral-guess-${sequence}-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: firstGuessMs + i * 1000});
  }
}

it.each([0, 1])("durably grants the first live-win referral for winning seat %i exactly once", async seat => {
  /** Provides seats behavior. */
  const seats = await pair(), userId = PLAYERS[seat], winner = seats[seat];
  await finish(userId, winner.ticketId);
  expect((await db.doc(`users/${userId}`).get()).data()).toMatchObject({coins: 150, stats: {wins: 0, multiplayerWins: 1}});
  /** Provides events behavior. */
  const events = await db.collection("racePerformanceOutbox").where("userId", "==", userId).get();
  expect(events.size).toBe(1);
  await Promise.all(Array.from({length: 4}, () => deliverRacePerformance(events.docs[0].id, db, START + 16000)));
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(1);
  expect((await db.collection(`users/${userId}/raceMatchProfiles`).get()).empty).toBe(true);
  expect((await events.docs[0].ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  await updateLiveRaceForUser(userId, {ticketId: winner.ticketId, action: "poll", requestId: "referral-terminal-retry"}, {db, nowMs: START + 17000});
  await deliverRacePerformance(events.docs[0].id, db, START + 18000);
  expect((await db.doc(`users/${userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
});

it("settles a human fallback-bot win without rewarding the bot", async () => {
  /** Provides [seat] behavior. */
  const [seat] = await pair([PLAYERS[0]]);
  /** Provides matched behavior. */
  const matched = await updateLiveRaceForUser(PLAYERS[0], {ticketId: seat.ticketId, action: "poll", requestId: "referral-select-bot"}, {db, nowMs: START + LIVE_RACE_WAIT_MS});
  expect(matched.opponent?.bot).toBe(true);
  await finish(PLAYERS[0], seat.ticketId, 0, matched.startsAtMs!);
  /** Provides events behavior. */
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(1);
  await deliverRacePerformance(events[0].id, db, matched.startsAtMs! + 10000);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
  expect((await db.doc("users/bot").get()).exists).toBe(false);
});

it("uses an authoritative forfeit win without requiring an official ten-solve tournament score", async () => {
  /** Provides seats behavior. */
  const seats = await pair();
  await updateLiveRaceForUser(PLAYERS[1], {ticketId: seats[1].ticketId, action: "leave", requestId: "referral-forfeit"}, {db, nowMs: START + 7000});
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  expect(event.data().userId).toBe(PLAYERS[0]);
  await deliverRacePerformance(event.id, db, START + 8000);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()).toMatchObject({coins: 250, stats: {multiplayerWins: 1}});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 100, stats: {multiplayerWins: 0}});
});

it("keeps the referral lifetime grant settled when the same player wins another live match", async () => {
  /** Provides seats behavior. */
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  /** Provides first behavior. */
  const first = (await db.collection("racePerformanceOutbox").get()).docs[0];
  await deliverRacePerformance(first.id, db, START + 16000);
  sequence++;
  await joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: `referral-repeat-a-${sequence}`}, {db, nowMs: START + 20000});
  /** Provides again behavior. */
  const again = await joinLiveRaceForUser(PLAYERS[1], {locale: "en", categoryId: "history", requestId: `referral-repeat-b-${sequence}`}, {db, nowMs: START + 21000});
  await finish(PLAYERS[1], again.ticketId, 0, START + 26000);
  /** Provides events behavior. */
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(2);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 36000)));
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 300, stats: {multiplayerWins: 2}});
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(1);
});

it("cannot collide with a chosen legacy recorded-race request ID", async () => {
  /** Provides seats behavior. */
  const seats = await pair();
  /** Provides alias behavior. */
  const alias = requestDocumentId(PLAYERS[1], `facebook-live-referral:${seats[1].ticketId}`);
  /** Provides retained behavior. */
  const retained = {runId: alias, userId: PLAYERS[1], createdAtMs: START - 1000, delivered: true,
    expiresAt: Timestamp.fromMillis(START + 86400000)};
  await db.doc(`racePerformanceOutbox/${alias}`).set(retained);
  await finish(PLAYERS[1], seats[1].ticketId);
  expect((await db.doc(`racePerformanceOutbox/${alias}`).get()).data()).toEqual(retained);
  /** Provides events behavior. */
  const events = (await db.collection("racePerformanceOutbox").get()).docs.filter(event => event.data().source === "facebook_live");
  expect(events).toHaveLength(1);
  expect(events[0].id).not.toBe(alias);
  await deliverRacePerformance(events[0].id, db, START + 16000);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(250);
});

it.each(["jest", "reddit"])("preserves %s live wins without Facebook referral work", async provider => {
  /** Provides players behavior. */
  const players = [0, 1].map(i => `${provider}_${String(i + 1).repeat(40)}`);
  /** Provides seats behavior. */
  const seats = await pair(players);
  await finish(players[1], seats[1].ticketId);
  expect((await db.doc(`users/${players[1]}`).get()).data()).toMatchObject({coins: 150, stats: {multiplayerWins: 1}});
  expect((await db.collection("racePerformanceOutbox").where("source", "==", "facebook_live").get()).empty).toBe(true);
  /** Provides events behavior. */
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events.map(event => event.data().source)).toEqual(provider === "jest" ? [] : ["reddit_live"]);
  expect((await db.collection("facebookReferralSettlements").get()).empty).toBe(true);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
});

it.each(["early-leave", "timeout"])("does not create referral work for a live %s tie", async action => {
  /** Provides seats behavior. */
  const seats = await pair();
  /** Provides result behavior. */
  const result = await updateLiveRaceForUser(PLAYERS[1], {ticketId: seats[1].ticketId, action: action === "early-leave" ? "leave" : "poll",
    requestId: `referral-${action}`}, {db, nowMs: START + (action === "early-leave" ? 2000 : 1_000_000)});
  expect(result.result).toBe("tie");
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
});

it.each(["grant", "acknowledgement"])("recovers live referral %s failure through the existing bounded queue", async stage => {
  /** Provides seats behavior. */
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  /** Provides real transaction behavior. */
  const realTransaction = db.runTransaction.bind(db);
  /** Provides failure behavior. */
  let failed = false;
  /** Fault injection targets a concrete grant or acknowledgement, independent of transaction ordering. */
  const failure = jest.spyOn(db, "runTransaction").mockImplementation(((operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) =>
    realTransaction(tx => operation(new Proxy(tx, {
    /** Forwards real Firestore operations while intercepting the selected failure or pause boundary. */
    get(target, property) {
      if (property === "create" || property === "update") return (ref: FirebaseFirestore.DocumentReference, value: Record<string, unknown>) => {
        /** Only the authoritative referral settlement creation triggers the grant failure. */
        const grant = property === "create" && ref.parent.id === "facebookReferralSettlements";
        /** Only the owner outbox acknowledgement triggers this delivery failure. */
        const acknowledgement = property === "update" && ref.path === event.ref.path && value.delivered === true;
        if (!failed && (stage === "grant" ? grant : acknowledgement)) {
          failed = true; throw new Error("temporary-live-referral-storage-failure");
        }
        return property === "create" ? target.create(ref, value) : target.update(ref, value);
      };
      /** Unintercepted transaction methods retain their real receiver and behavior. */
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }})))) as typeof db.runTransaction);
  try {await expect(deliverRacePerformance(event.id, db, START + 16000)).rejects.toThrow("temporary-live-referral-storage-failure");}
  finally {failure.mockRestore();}
  /** Provides pending behavior. */
  const pending = (await event.ref.get()).data()!;
  expect(pending).toMatchObject({delivered: false, deliveryState: "pending", deliveryAttempts: 1});
  /** Provides expected before behavior. */
  const expectedBefore = stage === "grant" ? 150 : 250;
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(expectedBefore);
  await deliverRacePerformance(event.id, db, pending.nextAttemptAtMs - 1);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(expectedBefore);
  await processRaceDeliveryQueue(db, "racePerformanceOutbox", id => deliverRacePerformance(id, db, pending.nextAttemptAtMs), pending.nextAttemptAtMs);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()).toMatchObject({coins: 250, stats: {multiplayerWins: 1}});
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(1);
});

it.each(["disabled", "deleted", "expired", "missing-source"])("suppresses pending live referral work when %s", async condition => {
  /** Provides seats behavior. */
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  if (condition === "disabled") process.env.FACEBOOK_DISABLED_FEATURES = "referrals,commerce,rewarded_ads";
  if (condition === "deleted") await getJestAccountDeletionRef(db, PLAYERS[1]).set({deletedAtMs: START + 15001});
  if (condition === "expired") await db.doc(`liveRaceTickets/${seats[1].ticketId}`).update({expiresAt: Timestamp.fromMillis(START + 15001)});
  if (condition === "missing-source") await db.doc(`liveRaceMatches/${seats[0].ticketId}`).delete();
  await deliverRacePerformance(event.id, db, START + 16000);
  expect((await event.ref.get()).data()).toMatchObject({delivered: true, deliveryState: condition === "disabled" ? "delivered" : "suppressed"});
  expect((await db.collectionGroup("entries").where("userId", "==", PLAYERS[1]).get()).size).toBe(condition === "disabled" ? 1 : 0);
  expect((await db.doc(`users/${PLAYERS[1]}`).get()).data()?.coins).toBe(150);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(300);
  expect((await db.collection("facebookReferralSettlements").get()).empty).toBe(true);
});

it("quarantines an altered source and replays only after restoring its private winner binding", async () => {
  /** Provides seats behavior. */
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  /** Provides original behavior. */
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

it.each(["winner", "clock", "retention", "profile", "bot"])("quarantines corrupt private live %s authority before any referral grant", async field => {
  /** Provides seats behavior. */
  const seats = await pair();
  await finish(PLAYERS[1], seats[1].ticketId);
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  /** Provides match behavior. */
  const match = db.doc(`liveRaceMatches/${seats[0].ticketId}`);
  if (field === "winner") await match.update({winner: 0});
  if (field === "clock") await match.update({"facebookReferral.createdAtMs": START + 14000});
  if (field === "retention") await match.update({expiresAt: {seconds: 12345}});
  if (field === "profile") await db.doc(`users/${PLAYERS[1]}`).update({"stats.multiplayerWins": 0});
  if (field === "bot") {
    /** Provides players behavior. */
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
    /** Provides players behavior. */
    const players = [`facebook_${String(i + 1).repeat(40)}`, `facebook_${(i + 8).toString(16).repeat(40)}`];
    /** Provides seats behavior. */
    const seats = await pair(players);
    await finish(players[0], seats[0].ticketId);
  }
  /** Provides events behavior. */
  const events = (await db.collection("racePerformanceOutbox").get()).docs;
  expect(events).toHaveLength(6);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 16000)));
  for (const event of events) expect((await db.doc(`users/${event.data().userId}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(800);
  expect((await db.collection("facebookReferralSettlements").get()).size).toBe(6);
  expect((await db.collection("facebookReferralDailyCaps").get()).docs[0].data().count).toBe(5);
  await Promise.all(events.map(event => deliverRacePerformance(event.id, db, START + 17000)));
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(800);
});

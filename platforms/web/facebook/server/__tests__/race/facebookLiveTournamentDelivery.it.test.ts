import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../../../../../firebase-functions/src/race/live/raceLiveService";
import {deliverRacePerformance} from "../../../../../../firebase-functions/src/race/settlement/racePerformanceDelivery";
import {facebookTournamentWindow} from "../../race/facebookTournament";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/runs/raceEngine";
import {ACCOUNT_DELETION_COLLECTION, getAccountDeletionRef, recordAccountDeletion} from "../../../../../../firebase-functions/src/shared/accountDeletion";
import {removeCrossUserRaceIdentitySnapshots} from "../../../../../../firebase-functions/src/profile/accountDeletion/raceAccountDeletion";
import {replayRaceDelivery} from "../../../../../../firebase-functions/src/race/delivery/raceDeliveryRecovery";
import {issueFacebookReferralToken, bindFacebookReferralToken} from "../../facebookReferrals";

/** Browser-independent production delivery runs only against a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Fixed authoritative server clock makes score and retention assertions deterministic. */
const START = Date.UTC(2026, 9, 2, 12);
/** Synthetic canonical Facebook identities keep fixture ownership provider-scoped. */
const PLAYERS = [`facebook_${"a".repeat(40)}`, `facebook_${"b".repeat(40)}`];
/** Synthetic inviter exercises the independent idempotent referral ledger. */
const INVITER = `facebook_${"e".repeat(40)}`;
/** Only private emulator fixture collections are recursively cleaned. */
const COLLECTIONS = ["users", "liveRaceTickets", "liveRaceMatches", "liveRacePlayers", "liveRaceQueues", "racePerformanceOutbox",
  ACCOUNT_DELETION_COLLECTION, "localizedRiddles/en/riddles", "facebookTournaments", "facebookReferralTokens",
  "facebookReferralBindings", "facebookReferralSettlements", "facebookReferralDailyCaps"];
/** Restores the caller feature configuration after isolated tests. */
const previousFeatures = process.env.FACEBOOK_DISABLED_FEATURES;
/** The destructive fixture guard permits only the isolated demo Firestore instance. */
let db: FirebaseFirestore.Firestore;
/** Distinct request IDs preserve real idempotency across fixture lifetimes. */
let sequence = 0;
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  process.env.FACEBOOK_DISABLED_FEATURES = "commerce,rewarded_ads";
  await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  if (previousFeatures === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
  else process.env.FACEBOOK_DISABLED_FEATURES = previousFeatures;
  if (db) await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});

/** Seeds catalog inputs and starts a real two-person match. */
async function pair(bindReferral = false) {
  /** Real catalog and account inputs are committed before production matchmaking. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  for (const userId of PLAYERS) batch.set(db.doc(`users/${userId}`), {username: "Live player", coins: 100,
    hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0, multiplayerWins: 0}});
  batch.set(db.doc(`users/${INVITER}`), {coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2, multiplayerWins: 0}});
  await batch.commit();
  if (bindReferral) {
    /** Synthetic provider fixtures preserve authoritative server and native SDK boundaries. */
    const {token} = await issueFacebookReferralToken(INVITER, START - 1000, () => "t".repeat(43), db);
    await bindFacebookReferralToken(PLAYERS[0], token, START - 500, db);
  }
  sequence++;
  /** The first real ticket becomes the independently frozen creator source. */
  const a = await joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: `score-a-${sequence}`}, {db, nowMs: START});
  /** The joining real ticket shares the creator deck and accepted start. */
  const b = await joinLiveRaceForUser(PLAYERS[1], {locale: "en", categoryId: "history", requestId: `score-b-${sequence}`}, {db, nowMs: START + 1000});
  return [a, b];
}
/** Answers are obtained from private fixture authority and submitted through the production engine. */
async function solve(ticketId: string, userId: string, count = 10) {
  for (let i = 0; i < count; i++) {
    /** Provides ticket behavior. */
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    /** Private match linkage identifies the settled human winner. */
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    /** Provides run behavior. */
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord, riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `score-${sequence}-${i}`, riddleId: riddle.riddleId,
      guess: riddle.answer}, {db, nowMs: START + 6000 + i * 1000});
  }
}
/** The authoritative finish-day window identifies the official player row. */
const entry = (userId: string) => db.doc(`facebookTournaments/${facebookTournamentWindow("en", START).tournamentId}/entries/${userId}`);
/** Reads the existing durable winner receipt without fabricating completion. */
const event = async () => (await db.collection("racePerformanceOutbox").get()).docs[0];

it.each([0, 1])("records winning seat %i with no browser score submission and no additional currency", async seat => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair();
  await solve(tickets[seat].ticketId, PLAYERS[seat]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  await Promise.all(Array.from({length: 4}, () => deliverRacePerformance(receipt.id, db, START + 16000)));
  expect((await entry(PLAYERS[seat]).get()).data()).toMatchObject({runId: tickets[seat].ticketId, adjustedTimeMs: 9000});
  expect((await db.doc(`users/${PLAYERS[seat]}`).get()).data()?.coins).toBe(225);
  expect((await receipt.ref.get()).data()).toMatchObject({delivered: true, deliveryState: "delivered"});
});

it("records the official score when referrals are independently disabled", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  process.env.FACEBOOK_DISABLED_FEATURES += ",referrals";
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
  expect((await db.collection("facebookReferralSettlements").get()).empty).toBe(true);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(225);
});


it("keeps referrals working when official tournaments are independently disabled", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  process.env.FACEBOOK_DISABLED_FEATURES += ",tournaments";
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(325);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
});

it("does not record a nine-solve forfeit while preserving its valid first-win referral", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0], 9);
  await updateLiveRaceForUser(PLAYERS[1], {ticketId: tickets[1].ticketId, action: "leave", requestId: "score-forfeit"}, {db, nowMs: START + 15000});
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(300);
});

it("retains the finish-day score through recovery after midnight", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair();
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 86400000);
  expect((await entry(PLAYERS[0]).get()).data()).toMatchObject({runId: tickets[0].ticketId, completedAtMs: START + 15000});
  expect((await db.collection("facebookTournaments").get()).size).toBe(1);
});

it("retries a lost acknowledgement after the official write without a second referral grant", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event();
  /** The original private source or transaction implementation is retained for repair. */
  const original = db.runTransaction.bind(db);
  /** Injects the targeted transport/storage failure once. */
  let failed = false;
  /** Proxy injection preserves real transaction authority around the chosen boundary. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation(((operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) =>
    original(tx => operation(new Proxy(tx, {
    /** Forwards real Firestore operations while intercepting the selected failure or pause boundary. */
    get(target, property) {
      if (property === "update") return (ref: FirebaseFirestore.DocumentReference, value: Record<string, unknown>) => {
        if (!failed && ref.path === receipt.ref.path && value.delivered === true) {failed = true; throw new Error("lost-live-score-ack");}
        return target.update(ref, value);
      };
      /** Unintercepted transaction methods retain their real receiver and behavior. */
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }})))) as typeof db.runTransaction);
  await expect(deliverRacePerformance(receipt.id, db, START + 16000)).rejects.toThrow("lost-live-score-ack");
  spy.mockRestore();
  expect((await entry(PLAYERS[0]).get()).data()?.adjustedTimeMs).toBe(9000);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(325);
  /** Owned asynchronous operation remains observable until it settles. */
  const pending = (await receipt.ref.get()).data()!;
  expect(pending.delivered).toBe(false);
  await deliverRacePerformance(receipt.id, db, pending.nextAttemptAtMs);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(325);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await db.collectionGroup("entries").where("userId", "==", PLAYERS[0]).get()).size).toBe(1);
  expect((await receipt.ref.get()).data()?.delivered).toBe(true);
});

it("quarantines a corrupt frozen score source and recovers only after repair and replay", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event(), ref = db.doc(`liveRaceTickets/${tickets[0].ticketId}`);
  /** The original private source or transaction implementation is retained for repair. */
  const original = (await ref.get()).data()!;
  /** Changes the frozen answer while retaining the independently completed match run. */
  const corrupt = {...original.run, riddles: original.run.riddles.map((riddle: unknown, i: number) => i ? riddle : {...riddle as object, answer: "tampered"})};
  await ref.update({run: corrupt});
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await receipt.ref.get()).data()?.deliveryState).toBe("quarantined");
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(225);
  await expect(replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000, {dryRun: true})).rejects.toMatchObject({code: "data-loss"});
  await ref.set(original);
  await replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000, {dryRun: true});
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  await replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(325);
});

it("holds an account lease until the official write drains and deletion removes the row", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair();
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event(), original = db.runTransaction.bind(db);
  /** Controlled pause keeps the official write pending while deletion checks its operation lease. */
  let release!: () => void, observed!: () => void, held = false;
  /** The write resumes only after the deletion guard has observed the active lease. */
  const pause = new Promise<void>(yes => {release = yes;}), ready = new Promise<void>(yes => {observed = yes;});
  /** Proxy injection preserves real transaction authority around the chosen boundary. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation(((operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) =>
    original(tx => operation(new Proxy(tx, {
    /** Forwards real Firestore operations while intercepting the selected failure or pause boundary. */
    get(target, property) {
      if (property === "get") return async (ref: FirebaseFirestore.DocumentReference) => {
        if (!held && ref.path === entry(PLAYERS[0]).path) {held = true; observed(); await pause;}
        return target.get(ref);
      };
      /** Unintercepted transaction methods retain their real receiver and behavior. */
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }})))) as typeof db.runTransaction);
  /** The real worker remains pending until its leased official write drains. */
  const delivery = deliverRacePerformance(receipt.id, db, START + 16000);
  void delivery.catch(() => undefined);
  try {
    await ready;
    await expect(recordAccountDeletion(PLAYERS[0])).rejects.toThrow("account-deletion-in-progress");
    expect((await getAccountDeletionRef(db, PLAYERS[0]).get()).exists).toBe(true);
  } finally {release();}
  await expect(delivery).rejects.toThrow("account-deleted");
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
  spy.mockRestore();
  await recordAccountDeletion(PLAYERS[0]);
  await removeCrossUserRaceIdentitySnapshots(PLAYERS[0]);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  await deliverRacePerformance(receipt.id, db, START + 18000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
});

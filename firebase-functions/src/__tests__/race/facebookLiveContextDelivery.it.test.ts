import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";
import {facebookContextKey} from "../../race/facebookContextCompetition";
import {joinFacebookContextCompetition, leaveFacebookContextCompetition, removeUserFromFacebookContextCompetitions} from "../../race/facebookContextService";
import {recordFacebookContextBoardRun} from "../../race/facebookContextBoard";
import {joinFacebookContext, leaveFacebookContext, recordFacebookContextRun} from "../../race/facebookContextCallables";
import {facebookTournamentWindow} from "../../race/facebookTournament";
import type {RaceRunRecord} from "../../race/raceEngine";
import {recordJestAccountDeletion, getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";
import {removeCrossUserRaceIdentitySnapshots} from "../../profile/accountDeletion/raceAccountDeletion";
import {replayRaceDelivery} from "../../race/raceDeliveryRecovery";
import {issueFacebookReferralToken, bindFacebookReferralToken} from "../../facebook/facebookReferrals";

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
  "liveRacePushOutbox", "liveRaceSignals",
  "jestAccountDeletionTombstones", "localizedRiddles/en/riddles", "facebookTournaments", "facebookReferralTokens",
  "facebookReferralBindings", "facebookReferralSettlements", "facebookReferralDailyCaps", "facebookContextCompetitions"];
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
async function pair(bindReferral = false, contexts = true, contextStartedAt = START - 500) {
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
  if (contexts) for (const [seat, userId] of PLAYERS.entries())
    await joinFacebookContextCompetition({userId, contextId: `durable-${seat}`, contextType: "GROUP", locale: "en", nowMs: contextStartedAt}, db);
  sequence++;
  /** The first real ticket becomes the independently frozen creator source. */
  const first = {locale: "en" as const, categoryId: "history" as const, requestId: `score-a-${sequence}`, ...(contexts ? {facebookContextId: "durable-0"} : {})};
  /** Each owner selects their synchronized context without changing public pairing. */
  const a = await joinLiveRaceForUser(PLAYERS[0], first, {db, nowMs: START});
  /** The joining real ticket shares the creator deck and accepted start. */
  const second = {locale: "en" as const, categoryId: "history" as const, requestId: `score-b-${sequence}`, ...(contexts ? {facebookContextId: "durable-1"} : {})};
  /** The recipient keeps its independent immutable board selection. */
  const b = await joinLiveRaceForUser(PLAYERS[1], second, {db, nowMs: START + 1000});
  return [a, b];
}
/** Answers are obtained from private fixture authority and submitted through the production engine. */
async function solve(ticketId: string, userId: string, count = 10, startsAtMs = START + 6000) {
  for (let i = 0; i < count; i++) {
    /** Provides ticket behavior. */
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    /** Private match linkage identifies the settled human winner. */
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    /** Provides run behavior. */
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord, riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `score-${sequence}-${i}`, riddleId: riddle.riddleId,
      guess: riddle.answer}, {db, nowMs: startsAtMs + i * 1000});
  }
}
/** The authoritative finish-day window identifies the official player row. */
const entry = (userId: string) => db.doc(`facebookTournaments/${facebookTournamentWindow("en", START).tournamentId}/entries/${userId}`);
/** Reads the existing durable winner receipt without fabricating completion. */
const event = async () => (await db.collection("racePerformanceOutbox").get()).docs[0];


/** Entries are scoped to the owner's original board, never a later browser context. */
const contextEntry = (seat: number) => db.doc(`facebookContextCompetitions/${facebookContextKey(`durable-${seat}`)}/entries/${PLAYERS[seat]}`);

it.each([0, 1])("recovers original context for winning seat %i after the browser disappears", async seat => {
  /** Real matchmaking and ten authoritative guesses create the existing durable winner receipt. */
  const tickets = await pair();
  await solve(tickets[seat].ticketId, PLAYERS[seat]);
  /** Durable winner receipt remains recoverable after the browser has disappeared. */
  const receipt = await event();
  await Promise.all(Array.from({length: 4}, () => deliverRacePerformance(receipt.id, db, START + 16000)));
  expect((await contextEntry(seat).get()).data()).toMatchObject({runId: tickets[seat].ticketId, adjustedTimeMs: 9000});
  expect((await contextEntry(1 - seat).get()).exists).toBe(false);
  expect((await entry(PLAYERS[seat]).get()).exists).toBe(true);
  expect((await db.doc(`users/${PLAYERS[seat]}`).get()).data()?.coins).toBe(150);
  expect(JSON.stringify(receipt.data())).not.toContain(`durable-${seat}`);
});

it("records context standings with tournaments and referrals independently disabled", async () => {
  /** A bound solve needs no optional commerce, official board or referral grant. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  process.env.FACEBOOK_DISABLED_FEATURES += ",tournaments,referrals";
  /** Original durable receipt is already committed with the win. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await contextEntry(0).get()).exists).toBe(true);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.collection("facebookReferralSettlements").get()).empty).toBe(true);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(150);
  expect((await receipt.ref.get()).data()?.delivered).toBe(true);
});

it("disables context recording independently of official tournaments", async () => {
  /** Existing official scoring remains available during a context emergency-off. */
  const tickets = await pair();
  await solve(tickets[0].ticketId, PLAYERS[0]);
  process.env.FACEBOOK_DISABLED_FEATURES += ",matchmaking,referrals";
  /** Disabled context projection cannot suppress unrelated eligible official delivery. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await contextEntry(0).get()).exists).toBe(false);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
});

it("does not synthesize a context solve from a nine-answer forfeit win", async () => {
  /** Real partial play distinguishes a valid coin win from a completed context score. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0], 9);
  await updateLiveRaceForUser(PLAYERS[1], {ticketId: tickets[1].ticketId, action: "leave", requestId: "context-nine-forfeit"}, {db, nowMs: START + 16000});
  /** Existing reward/referral work remains independently valid. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 17000);
  expect((await contextEntry(0).get()).exists).toBe(false);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
});

it.each(["missing", "left", "rejoined", "replaced", "expired"])("suppresses original context after it becomes %s without suppressing the official score", async mode => {
  /** The expiry case finishes just before the original seven-day board ends. */
  const tickets = await pair(false, true, mode === "expired" ? START - 7 * 86400000 + 20000 : START - 500);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  if (mode === "missing") await db.recursiveDelete(db.doc(`facebookContextCompetitions/${facebookContextKey("durable-0")}`));
  if (mode === "left" || mode === "rejoined") {
    await joinFacebookContextCompetition({userId: INVITER, contextId: "durable-0", contextType: "GROUP", locale: "en", nowMs: START + 16000}, db);
    await leaveFacebookContextCompetition({userId: PLAYERS[0], contextId: "durable-0", nowMs: START + 16000}, db);
    if (mode === "rejoined") await joinFacebookContextCompetition({userId: PLAYERS[0], contextId: "durable-0", contextType: "GROUP", locale: "en", nowMs: START + 17000}, db);
  }
  if (mode === "replaced") {
    await leaveFacebookContextCompetition({userId: PLAYERS[0], contextId: "durable-0", nowMs: START + 16000}, db);
    await joinFacebookContextCompetition({userId: PLAYERS[0], contextId: "durable-0", contextType: "GROUP", locale: "en", nowMs: START + 17000}, db);
  }
  /** Delayed delivery never transfers the original score into a later membership or board window. */
  const receipt = await event();
  await deliverRacePerformance(receipt.id, db, START + 21000);
  expect((await contextEntry(0).get()).exists).toBe(false);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(150);
  expect((await receipt.ref.get()).data()?.delivered).toBe(true);
});

it.each(["jest", "reddit"])("rejects a Facebook selector from %s before publishing any new seat", async provider => {
  /** Cross-provider selection must fail before any owner, catalog or queue side effect. */
  await expect(joinLiveRaceForUser(`${provider}_${"c".repeat(40)}`, {locale: "en", categoryId: "history", requestId: "foreign-context-selector",
    facebookContextId: "durable-0"}, {db, nowMs: START})).rejects.toMatchObject({code: "permission-denied"});
  expect((await db.collection("liveRaceTickets").get()).empty).toBe(true);
  expect((await db.collection("liveRaceQueues").get()).empty).toBe(true);
});

it("binds retries to the original context and prevents the browser from recording on another board", async () => {
  /** A second real board cannot become the first seat's score destination retroactively. */
  const tickets = await pair();
  await joinFacebookContextCompetition({userId: PLAYERS[0], contextId: "later-group", contextType: "GROUP", locale: "en", nowMs: START + 1000}, db);
  await expect(joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: `score-a-${sequence}`,
    facebookContextId: "later-group"}, {db, nowMs: START + 2000})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  await expect(recordFacebookContextBoardRun(PLAYERS[0], {locale: "en", runId: tickets[0].ticketId, contextId: "later-group"},
    {db, nowMs: START + 16000})).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.collection(`facebookContextCompetitions/${facebookContextKey("later-group")}/entries`).get()).empty).toBe(true);
});

it.each(["contextKey", "createdAtMs", "joinedAtMs"])("quarantines a modified %s receipt before any score or referral write", async field => {
  /** Real settlement supplies immutable source and outbox context bindings. */
  const tickets = await pair(true);
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** A modified copied binding may never override the private original seat. */
  const receipt = await event(), binding = receipt.data().facebookContext;
  await receipt.ref.update({facebookContext: {...binding, [field]: field === "contextKey" ? "f".repeat(64) : binding[field] + 1}});
  await deliverRacePerformance(receipt.id, db, START + 16000);
  expect((await receipt.ref.get()).data()?.deliveryState).toBe("quarantined");
  expect((await contextEntry(0).get()).exists).toBe(false);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(150);
});
it("retries a lost acknowledgement after the context and official writes without a second referral grant", async () => {
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
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
  /** Owned asynchronous operation remains observable until it settles. */
  const pending = (await receipt.ref.get()).data()!;
  expect(pending.delivered).toBe(false);
  await deliverRacePerformance(receipt.id, db, pending.nextAttemptAtMs);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
  expect((await db.doc(`users/${INVITER}`).get()).data()?.coins).toBe(400);
  expect((await contextEntry(0).get()).data()?.adjustedTimeMs).toBe(9000);
  expect((await db.collectionGroup("entries").where("userId", "==", PLAYERS[0]).get()).size).toBe(2);
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
  expect((await contextEntry(0).get()).exists).toBe(false);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(150);
  await expect(replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000, {dryRun: true})).rejects.toMatchObject({code: "data-loss"});
  await ref.set(original);
  await replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000, {dryRun: true});
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await contextEntry(0).get()).exists).toBe(false);
  await replayRaceDelivery(db, "racePerformanceOutbox", receipt.id, START + 17000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(true);
  expect((await contextEntry(0).get()).exists).toBe(true);
  expect((await db.doc(`users/${PLAYERS[0]}`).get()).data()?.coins).toBe(250);
});

it("holds an account lease until the context write drains and deletion removes the row", async () => {
  /** Real production matchmaking supplies both owned ticket identities. */
  const tickets = await pair();
  await solve(tickets[0].ticketId, PLAYERS[0]);
  /** Existing winner delivery receipt retains its original owner, source and retention. */
  const receipt = await event(), original = db.runTransaction.bind(db);
  /** Controlled pause keeps the context write pending while deletion checks its operation lease. */
  let release!: () => void, observed!: () => void, held = false;
  /** The write resumes only after the deletion guard has observed the active lease. */
  const pause = new Promise<void>(yes => {release = yes;}), ready = new Promise<void>(yes => {observed = yes;});
  /** Proxy injection preserves real transaction authority around the chosen boundary. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation(((operation: (tx: FirebaseFirestore.Transaction) => Promise<unknown>) =>
    original(tx => operation(new Proxy(tx, {
    /** Forwards real Firestore operations while intercepting the selected failure or pause boundary. */
    get(target, property) {
      if (property === "get") return async (ref: FirebaseFirestore.DocumentReference) => {
        if (!held && ref.path === contextEntry(0).path) {held = true; observed(); await pause;}
        return target.get(ref);
      };
      /** Unintercepted transaction methods retain their real receiver and behavior. */
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }})))) as typeof db.runTransaction);
  /** The real worker remains pending until its leased context write drains. */
  const delivery = deliverRacePerformance(receipt.id, db, START + 16000);
  void delivery.catch(() => undefined);
  try {
    await ready;
    await expect(recordJestAccountDeletion(PLAYERS[0])).rejects.toThrow("account-deletion-in-progress");
    expect((await getJestAccountDeletionRef(db, PLAYERS[0]).get()).exists).toBe(true);
  } finally {release();}
  await expect(delivery).rejects.toThrow("account-deleted");
  expect((await contextEntry(0).get()).exists).toBe(true);
  spy.mockRestore();
  await recordJestAccountDeletion(PLAYERS[0]);
  await removeCrossUserRaceIdentitySnapshots(PLAYERS[0]);
  await removeUserFromFacebookContextCompetitions(PLAYERS[0], db);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await contextEntry(0).get()).exists).toBe(false);
  await deliverRacePerformance(receipt.id, db, START + 18000);
  expect((await entry(PLAYERS[0]).get()).exists).toBe(false);
  expect((await contextEntry(0).get()).exists).toBe(false);
});

it.each(["private", "rematch"].flatMap(mode => [0, 1].map(seat => ({mode, seat}))))(
  "captures independent context destinations for $mode invitation winning seat $seat", async ({mode, seat}) => {
    /** Both original owners first settle a real source before a new private journey. */
    const original = await pair();
    await updateLiveRaceForUser(PLAYERS[1], {ticketId: original[1].ticketId, action: "leave", requestId: "source-private-forfeit"}, {db, nowMs: START + 8000});
    /** Creator selection is captured before any native share or in-game rematch acceptance. */
    const creator = await joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: "context-private-creator",
      facebookContextId: "durable-0", ...(mode === "rematch" ? {rematchOfTicketId: original[0].ticketId} : {createChallenge: true})}, {db, nowMs: START + 9000});
    /** The recipient does not inherit the creator's board, despite sharing the immutable creator deck. */
    const acceptance = {locale: "en" as const, categoryId: "history" as const, requestId: "context-private-recipient",
      facebookContextId: "durable-1", challengeId: creator.challengeId!};
    /** The accepted seat retains its own board and the shared start across recovery. */
    const recipient = await joinLiveRaceForUser(PLAYERS[1], acceptance, {db, nowMs: START + 10000});
    expect((await joinLiveRaceForUser(PLAYERS[1], acceptance, {db, nowMs: START + 11000})).startsAtMs).toBe(recipient.startsAtMs);
    /** Canonical balances before solving distinguish the prior forfeit grant from this new win. */
    const before = (await db.doc(`users/${PLAYERS[seat]}`).get()).data()!.coins;
    /** Both seat positions must resolve the winner's own immutable destination. */
    const ticketId = [creator, recipient][seat].ticketId;
    await solve(ticketId, PLAYERS[seat], 10, START + 15000);
    /** Exactly the new winner's durable receipt is delivered. */
    const receipt = (await db.collection("racePerformanceOutbox").where("liveTicketId", "==", ticketId).get()).docs[0];
    await deliverRacePerformance(receipt.id, db, START + 25000);
    expect((await contextEntry(seat).get()).data()).toMatchObject({runId: ticketId, adjustedTimeMs: 9000});
    expect((await contextEntry(1 - seat).get()).exists).toBe(false);
    expect((await db.doc(`users/${PLAYERS[seat]}`).get()).data()?.coins).toBe(before + 50);
  },
);

it.each([joinFacebookContext, leaveFacebookContext, recordFacebookContextRun])(
  "rejects a deleted owner at the actual context callable lease before recreating membership or scores", async handler => {
    /** Account/profile existence alone cannot override its permanent deletion guard. */
    const tickets = await pair();
    await getJestAccountDeletionRef(db, PLAYERS[0]).set({recreationBlocked: true});
    /** Each real callable receives exact Facebook identity and a valid operation payload. */
    const data = handler === leaveFacebookContext ? {contextId: "durable-0"} : handler === joinFacebookContext
      ? {contextId: "durable-0", contextType: "GROUP", locale: "en"} : {contextId: "durable-0", locale: "en", runId: tickets[0].ticketId};
    await expect((handler as unknown as {
      /** Production callable execution seam. */
      run(input: unknown): Promise<unknown>;
    }).run({
      auth: {uid: PLAYERS[0], token: {provider: "facebook"}}, data,
    })).rejects.toMatchObject({code: "failed-precondition", message: "This account was permanently deleted."});
    expect((await contextEntry(0).get()).exists).toBe(false);
  },
);

it.each(["missing", "wrong-locale", "inactive", "future"])("rejects %s membership before publishing a new context-bound seat", async mode => {
  /** Retiring the first genuine pair permits a new source-bound entry rather than active-pointer recovery. */
  const tickets = await pair();
  await updateLiveRaceForUser(PLAYERS[1], {ticketId: tickets[1].ticketId, action: "leave", requestId: "invalid-context-forfeit"}, {db, nowMs: START + 8000});
  /** The original owned board is the only optional score selection the caller requests. */
  const ref = db.doc(`facebookContextCompetitions/${facebookContextKey("durable-0")}`);
  if (mode === "missing") await db.recursiveDelete(ref);
  if (mode === "wrong-locale") await ref.update({locale: "fr"});
  if (mode === "inactive") {
    await joinFacebookContextCompetition({userId: INVITER, contextId: "durable-0", contextType: "GROUP", locale: "en", nowMs: START + 8000}, db);
    await leaveFacebookContextCompetition({userId: PLAYERS[0], contextId: "durable-0", nowMs: START + 8000}, db);
  }
  if (mode === "future") await ref.update({createdAtMs: START + 12000, expiresAtMs: START + 12000 + 604800000,
    members: [{userId: PLAYERS[0], joinedAtMs: START + 12000, active: true}]});
  await expect(joinLiveRaceForUser(PLAYERS[0], {locale: "en", categoryId: "history", requestId: "invalid-context-new-seat",
    facebookContextId: "durable-0"}, {db, nowMs: START + 9000})).rejects.toThrow();
  expect((await db.collection("liveRaceTickets").get()).size).toBe(2);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(1);
});

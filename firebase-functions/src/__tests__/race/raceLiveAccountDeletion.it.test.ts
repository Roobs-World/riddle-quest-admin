import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";
import {removeCrossUserRaceIdentitySnapshots} from "../../profile/accountDeletion/raceAccountDeletion";
import {requestDocumentId} from "../../race/raceSetupService";
import type {RaceRunRecord} from "../../race/raceEngine";
import {deliverRacePerformance} from "../../race/racePerformanceDelivery";
import {recordFacebookTournamentRun} from "../../race/facebookTournament";
import {issueFacebookReferralToken, bindFacebookReferralToken} from "../../facebook/facebookReferrals";
import {issueRedditReferralToken, bindRedditReferralToken} from "../../reddit/redditReferrals";
import {LIVE_RACE_WAIT_MS} from "@qwordly/core/race";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {sendLiveRaceChallengeForUser} from "../../race/raceLiveChallengeNotifications";
import {createUsernameReservationId} from "../../profile/usernameReservations";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";
import {listLiveRaceChallengesForUser} from "../../race/raceLiveChallengeNotifications";

/** All destructive fixture work is restricted to an isolated loopback demo emulator. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
/** Renders the start interface. */
const START = Date.UTC(2026, 9, 2, 12);
/** Renders the collections interface. */
const COLLECTIONS = ["users", "jestAccountDeletionTombstones", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues",
  "liveRacePlayers", "liveRaceInvitations", "liveRacePushTokens", "liveRacePushOutbox", "racePerformanceOutbox", "localizedRiddles/en/riddles",
  "facebookReferralTokens", "facebookReferralBindings", "facebookReferralDailyCaps", "facebookReferralSettlements", "facebookTournaments",
  "redditReferralTokens", "redditReferralBindings", "redditReferralDailyCaps", "redditReferralSettlements", "redditTournaments", "usernameReservations"];
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;
/** Provides sequence behavior. */
let sequence = 0;
beforeAll(() => {
  if (!PROJECT_ID.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});
afterAll(async () => {
  if (db) await Promise.all(COLLECTIONS.map(name => db.recursiveDelete(db.collection(name))));
});

/** Creates real catalog/identity inputs for the production live service. */
async function fixtures(provider: string) {
  /** Provides players behavior. */
  const players = [`${provider}_${"a".repeat(40)}`, `${provider}_${"b".repeat(40)}`];
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history",
    text: `Unique historical question ${i} follows its own trail`, answer: `a${String(i).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  players.forEach((userId, seat) => batch.set(db.doc(`users/${userId}`), {username: `Private live name ${seat}`,
    avatarUrl: `https://example.invalid/private-live-${seat}.png`, coins: 100, hasPurchasedApp: false, stats: {wins: 0, gamesPlayed: 0, multiplayerWins: 0}}));
  await batch.commit();
  sequence++;
  return players;
}

/** Mirrors the real deletion guard-before-race-sweep order without any Auth/Storage/provider call. */
async function erase(userId: string) {
  await getJestAccountDeletionRef(db, userId).set({recreationBlocked: true});
  await removeCrossUserRaceIdentitySnapshots(userId);
}

it.each(["facebook", "reddit", "jest"])("removes %s searching tickets and active pointers without retiring another player", async provider => {
  /** Provides [owner, other] behavior. */
  const [owner, other] = await fixtures(provider);
  /** Provides ticket behavior. */
  const ticket = await joinLiveRaceForUser(owner, {locale: "en", categoryId: "history", requestId: `delete-search-${sequence}`}, {db, nowMs: START});
  await erase(owner);
  expect((await db.doc(`liveRaceTickets/${ticket.ticketId}`).get()).exists).toBe(false);
  expect((await db.doc(`liveRacePlayers/${requestDocumentId(owner, "active-live-race")}`).get()).exists).toBe(false);
  /** Provides queues behavior. */
  const queues = (await db.collection("liveRaceQueues").get()).docs;
  expect(queues.every(doc => !doc.data().tickets.includes(ticket.ticketId))).toBe(true);
  await expect(updateLiveRaceForUser(owner, {ticketId: ticket.ticketId, action: "poll", requestId: "deleted-poll"}, {db, nowMs: START + 2000}))
    .rejects.toThrow("account-deleted");
  /** Provides next behavior. */
  const next = await joinLiveRaceForUser(other, {locale: "en", categoryId: "history", requestId: `delete-next-${sequence}`}, {db, nowMs: START + 1000});
  expect(next.phase).toBe("searching");
  expect((await db.doc(`users/${other}`).get()).data()?.coins).toBe(100);
});

it.each([0, 1])("removes copied seat %i identity before its surviving rival polls", async seat => {
  /** Provides players behavior. */
  const players = await fixtures("facebook");
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `delete-a-${sequence}`}, {db, nowMs: START});
  /** Provides b behavior. */
  const b = await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `delete-b-${sequence}`}, {db, nowMs: START + 1000});
  /** Provides creator expiry behavior. */
  const creatorExpiry = (await db.doc(`liveRaceTickets/${a.ticketId}`).get()).data()!.expiresAt;
  // Historical human matches were created without a root expiry until a poll.
  await db.doc(`liveRaceMatches/${a.ticketId}`).update({expiresAt: FieldValue.delete()});
  await erase(players[seat]);
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${a.ticketId}`).get()).data()!;
  expect(match.expiresAt).toEqual(creatorExpiry);
  expect(JSON.stringify(match).includes(players[seat])).toBe(false);
  expect(JSON.stringify(match).includes(`Private live name ${seat}`)).toBe(false);
  expect(JSON.stringify(match).includes(`private-live-${seat}.png`)).toBe(false);
  /** Provides survivor behavior. */
  const survivor = seat ? a : b;
  /** Provides result behavior. */
  const result = await updateLiveRaceForUser(players[1 - seat], {ticketId: survivor.ticketId, action: "poll", requestId: "surviving-poll"}, {db, nowMs: START + 7000});
  expect(result).toMatchObject({phase: "result", result: "tie", rewardCoins: 0, opponent: {displayName: "Riddle Quest player", avatarUrl: null}});
  expect((await db.doc(`users/${players[1 - seat]}`).get()).data()?.coins).toBe(100);
});

/** Exercises real matchmaking and commands for terminal-source preservation. */
async function pair(provider: string) {
  /** Provides players behavior. */
  const players = await fixtures(provider);
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `delete-pair-a-${sequence}`}, {db, nowMs: START});
  /** Provides b behavior. */
  const b = await joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: `delete-pair-b-${sequence}`}, {db, nowMs: START + 1000});
  return {players, tickets: [a, b]};
}
/** Provides finish behavior. */
async function finish(userId: string, ticketId: string, startsAt = START + 6000) {
  for (let i = 0; i < 10; i++) {
    /** Provides ticket behavior. */
    const ticket = (await db.doc(`liveRaceTickets/${ticketId}`).get()).data()!;
    /** Provides match behavior. */
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data()!;
    /** Provides run behavior. */
    const run = match.runs[match.tickets.indexOf(ticketId)] as RaceRunRecord;
    /** Provides riddle behavior. */
    const riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(userId, {ticketId, action: "guess", requestId: `delete-finish-${sequence}-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: startsAt + i * 1000});
  }
}

it.each(["facebook", "reddit"])("preserves a %s winner's pending referral after its creator rival deletes", async provider => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair(provider);
  /** Provides inviter behavior. */
  const inviter = `${provider}_${"e".repeat(40)}`;
  await db.doc(`users/${inviter}`).set({coins: 300, hasPurchasedApp: false, stats: {wins: 2, gamesPlayed: 2, multiplayerWins: 0}});
  if (provider === "facebook") {
    /** Provides {token} behavior. */
    const {token} = await issueFacebookReferralToken(inviter, START - 1000, () => "t".repeat(43), db);
    await bindFacebookReferralToken(players[1], token, START - 500, db);
  } else {
    /** Provides provenance behavior. */
    const provenance = {locale: "en" as const, postId: "t3_live_delete", environment: "sandbox" as const};
    /** Provides {token} behavior. */
    const {token} = await issueRedditReferralToken(inviter, START - 1000, () => "t".repeat(43), db, provenance);
    await bindRedditReferralToken(players[1], token, START - 500, db, provenance);
  }
  await finish(players[1], tickets[1].ticketId);
  /** Provides event behavior. */
  const event = (await db.collection("racePerformanceOutbox").get()).docs[0];
  await erase(players[0]);
  await erase(players[0]);
  await deliverRacePerformance(event.id, db, START + 16000);
  expect((await db.doc(`users/${players[1]}`).get()).data()).toMatchObject({coins: 325, stats: {multiplayerWins: 1}});
  expect((await db.doc(`users/${inviter}`).get()).data()?.coins).toBe(400);
  /** Provides result behavior. */
  const result = await updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "poll", requestId: "preserved-win"}, {db, nowMs: START + 17000});
  expect(result).toMatchObject({result: "win", rewardCoins: 50, opponent: {displayName: "Riddle Quest player", avatarUrl: null}});
  if (provider === "facebook") {
    /** Provides score behavior. */
    const score = await recordFacebookTournamentRun(players[1], {runId: tickets[1].ticketId, locale: "en"}, {db, nowMs: START + 18000});
    expect(score.entry.adjustedTimeMs).toBe(9000);
    expect((await db.doc(`users/${players[1]}`).get()).data()?.coins).toBe(325);
  }
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
  /** Provides creator behavior. */
  const creator = (await db.doc(`liveRaceTickets/${tickets[0].ticketId}`).get()).data()!;
  expect(JSON.stringify({match, creator}).includes(players[0])).toBe(false);
  expect(JSON.stringify({match, creator}).includes("Private live name 0")).toBe(false);
  expect((await db.collection(`liveRaceMatches/${tickets[0].ticketId}/requests`).where("userId", "==", players[0]).get()).empty).toBe(true);
});

it.each(["indexed", "legacy"])("finds an %s orphan match after both source tickets are missing", async mode => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("reddit");
  if (mode === "legacy") await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).update({participantIds: FieldValue.delete()});
  await Promise.all(tickets.map(ticket => db.doc(`liveRaceTickets/${ticket.ticketId}`).delete()));
  await erase(players[0]);
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
  expect(JSON.stringify(match).includes(players[0])).toBe(false);
  expect(match.winner).toBeNull();
});

it("removes the final anonymous match, frozen deck and nested receipts when both players delete", async () => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("facebook");
  await finish(players[1], tickets[1].ticketId);
  await erase(players[0]);
  await erase(players[1]);
  expect((await db.collection("liveRaceTickets").get()).empty).toBe(true);
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
  expect((await db.collection(`liveRaceMatches/${tickets[0].ticketId}/requests`).get()).empty).toBe(true);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
});

it("removes a bot match without retaining an anonymous account or deck", async () => {
  /** Provides [owner] behavior. */
  const [owner] = await fixtures("reddit");
  /** Provides ticket behavior. */
  const ticket = await joinLiveRaceForUser(owner, {locale: "en", categoryId: "history", requestId: `delete-bot-${sequence}`}, {db, nowMs: START});
  await updateLiveRaceForUser(owner, {ticketId: ticket.ticketId, action: "poll", requestId: "select-bot"}, {db, nowMs: START + LIVE_RACE_WAIT_MS});
  await erase(owner);
  expect((await db.collection("liveRaceTickets").get()).empty).toBe(true);
  expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
});

it("rejects cleanup before the permanent deletion guard exists", async () => {
  /** Provides [owner] behavior. */
  const [owner] = await fixtures("facebook");
  /** Provides ticket behavior. */
  const ticket = await joinLiveRaceForUser(owner, {locale: "en", categoryId: "history", requestId: `delete-no-guard-${sequence}`}, {db, nowMs: START});
  await expect(removeCrossUserRaceIdentitySnapshots(owner)).rejects.toMatchObject({code: "failed-precondition"});
  expect((await db.doc(`liveRaceTickets/${ticket.ticketId}`).get()).exists).toBe(true);
});

it.each(["creator", "recipient"])("removes direct invitation/push linkage after the %s deletes", async role => {
  /** Provides players behavior. */
  const players = await fixtures("facebook");
  /** Provides reservation id behavior. */
  const reservationId = createUsernameReservationId("Private live name 1");
  await db.doc(`usernameReservations/${reservationId}`).set({userId: players[1]});
  await db.doc(`users/${players[1]}`).update({usernameReservationId: reservationId});
  /** Provides challenge behavior. */
  const challenge = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: `delete-direct-${sequence}`, createChallenge: true}, {db, nowMs: START});
  await sendLiveRaceChallengeForUser(db, players[0], {challengeId: challenge.challengeId!, recipientUsername: "Private live name 1"}, START + 1000);
  /** Provides owner behavior. */
  const owner = players[role === "creator" ? 0 : 1];
  await db.doc(`liveRacePushTokens/${"e".repeat(64)}`).set({uid: owner, expiresAt: Timestamp.fromMillis(START + 86400000)});
  await erase(owner);
  expect((await db.collection("liveRacePushOutbox").get()).empty).toBe(true);
  expect((await db.collection("liveRacePushTokens").where("uid", "==", owner).get()).empty).toBe(true);
  /** Provides ticket behavior. */
  const ticket = (await db.doc(`liveRaceTickets/${challenge.ticketId}`).get()).data();
  if (role === "recipient") expect(ticket).toMatchObject({userId: players[0], cancelled: true});
  else expect(ticket).toBeUndefined();
  expect(ticket?.inviteRecipientId).toBeUndefined();
  if (role === "creator") expect((await db.collection(`users/${players[1]}/liveRaceInvitations`).get()).empty).toBe(true);
});

it.each(["facebook", "reddit"].flatMap(provider => ["creator", "recipient"].map(role => ({provider, role}))))(
  "retires a reserved $provider rematch after its $role deletes", async ({provider, role}) => {
    /** A real completed pair supplies the immutable original opponent. */
    const {players, tickets} = await pair(provider);
    await updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "leave", requestId: "delete-rematch-source-forfeit"}, {db, nowMs: START + 8000});
    /** The new invitation owns a separate seat and original invitation deadline. */
    const lobby = await joinLiveRaceForUser(players[0], {locale: "en", categoryId: "history", requestId: "delete-rematch-invite",
      rematchOfTicketId: tickets[0].ticketId}, {db, nowMs: START + 10_000});
    expect(await getLiveRaceChallengeForUser(players[1], lobby.challengeId!, {db, nowMs: START + 11_000})).toMatchObject({status: "available"});
    /** Canonical balances must remain unchanged by creation and account cleanup. */
    const before = await Promise.all(players.map(async userId => (await db.doc(`users/${userId}`).get()).data()?.coins));
    await erase(players[role === "creator" ? 0 : 1]);
    expect(await listLiveRaceChallengesForUser(db, players[1], START + 12_000)).toEqual([]);
    await expect(joinLiveRaceForUser(players[1], {locale: "en", categoryId: "history", requestId: "deleted-rematch-accept", challengeId: lobby.challengeId},
      {db, nowMs: START + 12_000})).rejects.toThrow();
    /** Cleanup removes or cancels the waiting reservation, including provider push linkage. */
    const retained = (await db.doc(`liveRaceTickets/${lobby.ticketId}`).get()).data();
    if (role === "creator") {
      expect(retained).toBeUndefined();
      expect((await db.collection(`users/${players[1]}/liveRaceInvitations`).get()).empty).toBe(true);
    } else expect(retained).toMatchObject({userId: players[0], cancelled: true});
    expect(retained?.inviteRecipientId).toBeUndefined();
    expect((await db.collection("liveRacePushOutbox").get()).empty).toBe(true);
    expect(await Promise.all(players.map(async userId => (await db.doc(`users/${userId}`).get()).data()?.coins))).toEqual(before);
  },
);

it("removes a deleting winner's board entry and balance snapshot without changing the surviving loss", async () => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("facebook");
  await finish(players[0], tickets[0].ticketId);
  /** Provides score behavior. */
  const score = await recordFacebookTournamentRun(players[0], {runId: tickets[0].ticketId, locale: "en"}, {db, nowMs: START + 16000});
  await erase(players[0]);
  expect((await db.doc(`facebookTournaments/${score.entry.tournamentId}/entries/${players[0]}`).get()).exists).toBe(false);
  expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
  expect(match.newCoins).toBeUndefined();
  expect(match.settlementCoins).toBeUndefined();
  expect(match.runs[0].settlementCoins).toBeUndefined();
  expect(match.runs[1].settlementCoins).toBe(125);
  expect(match.facebookReferral).toBeUndefined();
  /** Provides loss behavior. */
  const loss = await updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "poll", requestId: "preserved-loss"}, {db, nowMs: START + 18000});
  expect(loss).toMatchObject({result: "loss", rewardCoins: 0, opponent: {displayName: "Riddle Quest player", avatarUrl: null}});
  expect((await db.doc(`users/${players[1]}`).get()).data()?.coins).toBe(125);
});

it.each(["cleanup-first", "guard-first", "completion-first", "concurrent"] as const)(
  "serializes rival completion with deletion (%s) without another economic grant", async order => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("reddit");
  for (let i = 0; i < 9; i++) {
    /** Provides value behavior. */
    const value = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
    /** Provides run behavior. */
    const run = value.runs[1] as RaceRunRecord, riddle = run.riddles[run.currentPosition];
    await updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "guess", requestId: `delete-race-${i}`,
      riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: START + 6000 + i * 1000});
  }
  /** Provides value behavior. */
  const value = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
  /** Provides run behavior. */
  const run = value.runs[1] as RaceRunRecord, riddle = run.riddles[run.currentPosition];
  /** One final answer races the guard and the identity sweep in distinct serializations. */
  const complete = () => updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "guess", requestId: "delete-final-race",
    riddleId: riddle.riddleId, guess: riddle.answer}, {db, nowMs: START + 15000});
  if (order === "cleanup-first") {await erase(players[0]); await complete();}
  else if (order === "guard-first") {
    await getJestAccountDeletionRef(db, players[0]).set({recreationBlocked: true});
    await complete(); await erase(players[0]);
  } else if (order === "completion-first") {await complete(); await erase(players[0]);}
  else await Promise.all([erase(players[0]), complete()]);
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).get()).data()!;
  expect([null, 1]).toContain(match.winner);
  /** A settled draw carries its balance; cleanup cancellation has no economic receipt. */
  const expectedCoins = match.winner === 1 ? 225 : match.runs[1].settlementCoins === undefined ? 100 : 125;
  if (order !== "concurrent") expect(expectedCoins).toBe(order === "cleanup-first" ? 100 : order === "guard-first" ? 125 : 225);
  /** Persisted economy must agree with the terminal serialization before any replay. */
  const settledProfile = (await db.doc(`users/${players[1]}`).get()).data()!;
  expect(settledProfile.coins).toBe(expectedCoins);
  expect(settledProfile.stats.multiplayerWins).toBe(match.winner === 1 ? 1 : 0);
  expect(settledProfile.stats.multiplayerGamesPlayed ?? 0).toBe(expectedCoins === 100 ? 0 : 1);
  expect(match.runs[1].settlementCoins).toBe(expectedCoins === 100 ? undefined : expectedCoins);
  expect(match.rewardCoins).toBe(match.winner === 1 ? 50 : 0);
  await Promise.all(Array.from({length: 4}, (_, i) => updateLiveRaceForUser(players[1], {ticketId: tickets[1].ticketId, action: "poll", requestId: `delete-repeat-${i}`}, {db, nowMs: START + 16000})));
  expect((await db.doc(`users/${players[1]}`).get()).data()).toEqual(settledProfile);
  expect(JSON.stringify(match).includes(players[0])).toBe(false);
});

it("fails closed on a corrupt participant index instead of looping or erasing another account", async () => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("facebook");
  /** Provides ref behavior. */
  const ref = db.doc(`liveRaceMatches/${tickets[0].ticketId}`), original = (await ref.get()).data()!;
  /** Provides runs behavior. */
  const runs = original.runs.map((run: RaceRunRecord) => ({...run, userId: players[1]}));
  await ref.update({runs});
  await expect(erase(players[0])).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc(`users/${players[1]}`).get()).data()?.coins).toBe(100);
  await ref.set(original);
  await erase(players[0]);
  expect(JSON.stringify((await ref.get()).data()).includes(players[0])).toBe(false);
});


it("pages past 100 unrelated legacy matches and clears more than 100 nested receipts", async () => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("facebook");
  /** Provides ref behavior. */
  const ref = db.doc(`liveRaceMatches/${tickets[0].ticketId}`);
  /** Provides original behavior. */
  const original = (await ref.get()).data()!;
  /** Provides legacy behavior. */
  const legacy = {...original};
  delete legacy.participantIds;
  delete legacy.expiresAt;
  await ref.set(legacy);
  await Promise.all(tickets.map(ticket => db.doc(`liveRaceTickets/${ticket.ticketId}`).delete()));
  // Small hex document IDs sort before the production opaque match ID. These
  // unrelated legacy fixtures carry only the surviving player's identity.
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let i = 0; i < 101; i++) {
    /** Provides id behavior. */
    const id = i.toString(16).padStart(64, "0");
    expect(id < ref.id).toBe(true);
    batch.set(db.collection("liveRaceMatches").doc(id), {...legacy,
      runs: legacy.runs.map((run: RaceRunRecord) => ({...run, userId: players[1]})),
      players: [legacy.players[1], legacy.players[1]]});
    batch.set(ref.collection("requests").doc(`old-${i}`), {binding: `legacy-${i}`, userId: players[0]});
  }
  await batch.commit();
  await erase(players[0]);
  expect((await ref.get()).data()?.expiresAt).toEqual(Timestamp.fromMillis(legacy.startsAtMs + 7 * 86400000));
  expect(JSON.stringify((await ref.get()).data()).includes(players[0])).toBe(false);
  expect((await ref.collection("requests").get()).empty).toBe(true);
  expect((await db.collection("liveRaceMatches").get()).size).toBe(102);
  expect((await db.doc(`liveRaceMatches/${"0".repeat(64)}`).get()).data()?.runs[0].userId).toBe(players[1]);
});


it.each(["creator-marker", "match-marker", "frozen-answer"])("rejects a tampered %s after creator deletion before official Facebook scoring", async kind => {
  /** Provides {players, tickets} behavior. */
  const {players, tickets} = await pair("facebook");
  await finish(players[1], tickets[1].ticketId);
  await erase(players[0]);
  /** Provides creator ref behavior. */
  const creatorRef = db.doc(`liveRaceTickets/${tickets[0].ticketId}`);
  if (kind === "creator-marker") await creatorRef.update({deleted: false});
  else if (kind === "match-marker") await db.doc(`liveRaceMatches/${tickets[0].ticketId}`).update({deletedSeats: [false, false]});
  else {
    /** Provides creator behavior. */
    const creator = (await creatorRef.get()).data()!;
    creator.run.riddles[0].answer = "tampered frozen answer";
    await creatorRef.update({run: creator.run});
  }
  await expect(recordFacebookTournamentRun(players[1], {runId: tickets[1].ticketId, locale: "en"}, {db, nowMs: START + 16000}))
    .rejects.toMatchObject({code: "data-loss"});
  expect((await db.collectionGroup("entries").where("userId", "==", players[1]).get()).empty).toBe(true);
  expect((await db.doc(`users/${players[1]}`).get()).data()?.coins).toBe(225);
});

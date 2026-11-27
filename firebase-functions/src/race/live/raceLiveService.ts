import {getProfileLevel} from "../../profile/profileLevel";
import {androidReferralPlayPatch} from "../../../../platforms/native/android/server/androidReferralIdentity";
import {androidReferralLiveEventId} from "../../../../platforms/native/android/server/androidReferralDelivery";
import {publishLiveRaceSignals} from "./raceLiveSignals";
import {acceptLiveRaceChallengeForUser} from "../invitations/raceLiveInvitation";
import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_WIN_COINS, RACE_RULES,
  type JoinLiveRace, type UpdateLiveRace} from "../../../../src/races/contracts/index.js";
import {admin} from "../../shared/firebaseAdmin";
import {getJestAccountDeletionRef, assertJestAccountActive} from "../../shared/accountDeletion";
import {raceProviderScope} from "../access/raceProviderScope";
import {assertAndroidRaceAccount} from "../../../../platforms/native/android/server/race/androidRaceAccount";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, refreshRaceRun} from "../runs/raceEngine";
import {applyActionRateLimit, buildDeterministicRaceDeck, loadEligibleContent,
  requestDocumentId, stripUndefined, prepareRaceAchievementEvent, type Firestore} from "../raceSetupService";
import {createLiveMatch, expireLiveMatchReadiness, scheduleReadyLiveMatch, liveRun, liveView, liveOperationAtMs, liveRaceSearchEndsAtMs, advanceLiveBot, type LiveTicket, type LiveMatch} from "./raceLiveState";
import {isFacebookFirebaseUid} from "../../../../platforms/web/facebook/server/facebookSecurity";
import {pendingRaceDelivery} from "../delivery/raceDeliveryFailures";
import {facebookLiveRaceReferralEventId} from "../../../../platforms/web/facebook/server/facebookLiveRaceReferralDelivery";
import {isRedditFirebaseUid} from "../../../../platforms/web/reddit/server/redditSecurity";
import {redditLiveRaceReferralEventId} from "../../../../platforms/web/reddit/server/redditLiveRaceReferralDelivery";
import {settleLiveFinish} from "./raceLiveScoring";
import {prepareLiveRaceRematch, createLiveRaceRematchInvitation} from "../invitations/raceLiveRematch";
import {facebookLiveContextSelection, prepareFacebookLiveContext, assertFacebookLiveContextSelection} from "../../../../platforms/web/facebook/server/race/facebookLiveContextBinding";
import {assertLiveRaceDeckCompatible} from "../runs/raceDeckCompatibility";
import {isLiveRaceRetained, prepareLiveRaceQueue} from "./raceLiveQueue";
import {readLiveJoinIntent, claimLiveJoinIntent} from "../invitations/raceLiveJoinIntent";
import {generateRaceBotName} from "../matchmaking/raceBotName";
import {recordRaceBotWin} from "../settlement/raceBotLeaderboard";

/** Server persistence and time seams support transaction concurrency tests. */
type Options = {
  /** Emulator database for concurrency tests. */
  db?: Firestore;
  /** Authoritative clock supplied only by tests. */
  nowMs?: number;
};
/** A callable may authorize access alongside initial reads, before the transaction can mutate state. */
type UpdateOptions = Options & {
  /** Background retirement is conditional on this original server-accepted join claim. */
  expectedJoinId?: string;
  /** Evaluates the current server rollout without caching access between requests. */
  authorize?: () => Promise<void>;
};
/** Restricts pairing to one exact approved provider, language and category. */
function livePool(userId: string, input: JoinLiveRace): string {
  /** Provides provider behavior. */
  const provider = raceProviderScope(userId);
  if (!provider) throw new HttpsError("permission-denied", "Live races require a provider identity.");
  return createHash("sha256").update(`${provider}:${input.locale}:${input.categoryId}`).digest("hex");
}

/** Join recovery and polling seat the same authoritative bot after an empty public search. */
function createLiveBotMatch(ticketId: string, ticket: LiveTicket, nowMs: number): LiveMatch {
  assertLiveRaceDeckCompatible(ticket.run);
  ticket.matchId = ticketId;
  return createLiveMatch({tickets: [ticketId, null], participantIds: [ticket.userId], nowMs,
    readySeats: [!ticket.requiresReady, true],
    players: [ticket.player, {displayName: generateRaceBotName(ticketId), avatarUrl: null, bot: true, correctCount: 0}],
    runs: [liveRun(ticket.run, ticket.userId, ticketId), liveRun(ticket.run, "bot", `${ticketId}-bot`)]});
}

/** Enters one owned queue seat; retries and concurrent tabs recover the same active ticket. */
export async function joinLiveRaceForUser(userId: string, input: JoinLiveRace, options: Options = {}) {
  if (input.expectedOwnerId && input.expectedOwnerId !== userId)
    throw new HttpsError("permission-denied", "Live race account changed.");
  /** Other providers cannot select a Facebook board, including invitation recovery. */
  const contextKey = facebookLiveContextSelection(userId, input.facebookContextId);
  if (input.waitForPlayer && (input.createChallenge || input.challengeId || input.rematchOfTicketId))
    throw new HttpsError("invalid-argument", "Human waiting requires a public lobby.");
  if (input.resumeTicketId && !input.waitForPlayer)
    throw new HttpsError("invalid-argument", "Only an existing public player lobby can be resumed.");
  if (input.challengeId) return acceptLiveRaceChallengeForUser(userId, input, options);
  /** Rematches share private-lobby authority while preserving the default public join. */
  const privateEntry = Boolean(input.createChallenge || input.rematchOfTicketId);
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  /** Provides pool behavior. */
  const pool = livePool(userId, input);
  /** Provides ticket id behavior. */
  const ticketId = requestDocumentId(userId, input.requestId);
  /** Provides ticket ref behavior. */
  const ticketRef = db.doc(`liveRaceTickets/${ticketId}`);
  /** Provides pointer behavior. */
  const pointer = db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`);
  /** Reuses this invocation's validated immutable deck if Firestore retries the queue transaction. */
  let preparedDeck: Promise<ReturnType<typeof buildDeterministicRaceDeck>> | undefined;
  return db.runTransaction(async transaction => {
    /** Reads fresh recovery authority and only public identity fields before shared-pool locks or content queries. */
    const [intent, current, receipt, owner, deletion] = await Promise.all([readLiveJoinIntent(db, transaction, userId, input), transaction.get(pointer), transaction.get(ticketRef),
      transaction.getAll(db.doc(`users/${userId}`), {fieldMask: ["username", "stats.level", "avatarUrl", "androidProvider"]}).then(([profile]) => profile),
      transaction.get(getJestAccountDeletionRef(db, userId))]);
    assertJestAccountActive(deletion);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    assertAndroidRaceAccount(userId, owner.data());
    /** Provides previous id behavior. */
    const previousId = current.data()?.ticketId as string | undefined;
    if (input.resumeTicketId && (previousId !== input.resumeTicketId ||
      receipt.exists && receipt.id !== input.resumeTicketId ||
      intent?.record?.ticketId && intent.record.ticketId !== input.resumeTicketId))
      throw new HttpsError("failed-precondition", "The original public lobby is unavailable.");
    if (previousId || receipt.exists || intent?.record?.ticketId) {
      /** Provides id behavior. */
      const id = input.resumeTicketId ?? intent?.record?.ticketId ?? (receipt.exists ? ticketId : previousId!);
      /** Provides old behavior. */
      const old = id === ticketId && receipt.exists ? receipt : await transaction.get(db.doc(`liveRaceTickets/${id}`));
      /** Provides ticket behavior. */
      const ticket = old.data() as LiveTicket | undefined;
      if (input.resumeTicketId && (!ticket || ticket.userId !== userId))
        throw new HttpsError("failed-precondition", "The original public lobby is unavailable.");
      if (intent?.record?.ticketId && (!ticket || ticket.userId !== userId))
        throw new HttpsError("not-found", "Original live join unavailable.");
      if (ticket && !isLiveRaceRetained(old, nowMs) && (input.resumeTicketId || receipt.exists || intent?.record?.ticketId))
        throw new HttpsError(input.resumeTicketId ? "failed-precondition" : "not-found", "Original live join expired.");
      if (ticket && ticket.userId === userId && isLiveRaceRetained(old, nowMs)) {
        /** Allows an upgraded client to finish its unchanged legacy public seat. */
        const recoverLegacyPublic = !ticket.privateChallenge && !privateEntry && !ticket.waitForPlayer &&
          input.waitForPlayer && !input.resumeTicketId && !receipt.exists;
        if (receipt.exists) assertFacebookLiveContextSelection(ticket.facebookContext, contextKey);
        if (receipt.exists && (Boolean(ticket.privateChallenge) !== privateEntry ||
          ticket.rematchOfTicketId !== input.rematchOfTicketId || ticket.pool !== pool ||
          Boolean(ticket.waitForPlayer) !== Boolean(input.waitForPlayer) || Boolean(ticket.requiresReady) !== Boolean(input.requiresReady)))
          throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
        /** Provides match behavior. */
        const matchSnapshot = ticket.matchId ? await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`)) : undefined;
        /** Existing match recovered from the retained original ticket. */
        let match = matchSnapshot?.data() as LiveMatch | undefined;
        /** Recovery clock floored by the ticket and shared match observations. */
        const recoveryNowMs = liveOperationAtMs(ticket, match, options.nowMs ?? Date.now());
        /** Whether either retained authority document has expired or disappeared. */
        const unavailable = !isLiveRaceRetained(old, recoveryNowMs) || Boolean(matchSnapshot && !isLiveRaceRetained(matchSnapshot, recoveryNowMs));
        if (unavailable && (input.resumeTicketId || receipt.exists || intent?.record?.ticketId))
          throw new HttpsError(input.resumeTicketId ? "failed-precondition" : "not-found", "Original live authority unavailable.");
        if (!unavailable) {
          ticket.player.level = getProfileLevel(owner.data());
          const seat = match?.tickets[0] === id ? 0 : 1;
          const refreshMatchLevel = match && match.winner === undefined && match.players[seat].level !== ticket.player.level;
          if (match && refreshMatchLevel) match.players[seat].level = ticket.player.level;
          /** Expired waits cannot strand the active pointer, and immutable receipts remain terminal. */
          const waitExpired = !match && ticket.privateChallenge &&
            recoveryNowMs >= liveRaceSearchEndsAtMs(ticket);
          if (input.resumeTicketId && (ticket.cancelled || waitExpired || match?.winner !== undefined))
            throw new HttpsError("failed-precondition", "The original public lobby has ended.");
          if (waitExpired && (receipt.exists || intent?.record?.ticketId)) {
            ticket.cancelled = true;
            transaction.update(old.ref, {cancelled: true});
            publishLiveRaceSignals(db, transaction, [id], old.data()!.expiresAt);
            return liveView(id, ticket, undefined, options.nowMs ?? Date.now());
          }
          if (!waitExpired && (receipt.exists || intent?.record?.ticketId || !ticket.cancelled && (!match || match.winner === undefined))) {
            assertFacebookLiveContextSelection(ticket.facebookContext, contextKey);
            if (Boolean(ticket.privateChallenge) !== privateEntry || ticket.rematchOfTicketId !== input.rematchOfTicketId)
              throw new HttpsError("failed-precondition", "Finish the current live race first.");
            if (ticket.pool !== pool || Boolean(ticket.waitForPlayer) !== Boolean(input.waitForPlayer) && !recoverLegacyPublic)
              throw new HttpsError("failed-precondition", "Finish the current live race first.");
            if (matchSnapshot && match && expireLiveMatchReadiness(match, recoveryNowMs)) {
              transaction.set(db.doc(`liveRaceMatches/${ticket.matchId}`), {...stripUndefined(match), expiresAt: matchSnapshot.data()!.expiresAt});
              publishLiveRaceSignals(db, transaction, match.tickets, old.data()!.expiresAt);
              return liveView(id, ticket, match, recoveryNowMs);
            }
            /** Reconnect observations preserve the original seat, deck and countdown. */
            const observedAtMs = recoveryNowMs;
            if (ticket.cancelled || match?.winner !== undefined) return liveView(id, ticket, match, observedAtMs);
            if (!match && current.data()?.ticketId !== id)
              throw new HttpsError("failed-precondition", "Another live journey owns this account.");
            /** Prepared pairing plan for an existing public player-wait seat. */
            const queue = !match && !ticket.privateChallenge && observedAtMs < liveRaceSearchEndsAtMs(ticket) ? await prepareLiveRaceQueue(db, transaction,
              {ticketId: id, ticket, nowMs: observedAtMs, expiresAt: old.data()!.expiresAt, ownerProfile: owner, ownerPointer: current}) : undefined;
            match = queue?.match ?? match;
            const fallback = !match && !ticket.privateChallenge && observedAtMs >= liveRaceSearchEndsAtMs(ticket)
              ? createLiveBotMatch(id, ticket, observedAtMs) : undefined;
            match = fallback ?? match;
            queue?.commit();
            transaction.update(old.ref, {seenAtMs: observedAtMs, "player.level": ticket.player.level, ...(match ? {matchId: ticket.matchId} : {})});
            if (fallback) transaction.create(db.doc(`liveRaceMatches/${ticket.matchId}`), {...stripUndefined(fallback), expiresAt: old.data()!.expiresAt});
            else if (match && !queue?.match) transaction.update(db.doc(`liveRaceMatches/${ticket.matchId}`), {observedAtMs,
              ...(refreshMatchLevel ? {players: match.players} : {})});
            if (queue?.match || fallback) publishLiveRaceSignals(db, transaction, match!.tickets, old.data()!.expiresAt);
            claimLiveJoinIntent(transaction, intent, old.ref, observedAtMs);
            return liveView(id, ticket, match, observedAtMs);
          }
        }
      }
    }
    /** Recipient and source binding are validated atomically before preparing or publishing a new seat. */
    const rematch = input.rematchOfTicketId ? await prepareLiveRaceRematch(transaction, db, userId, input, nowMs) : undefined;
    /** Score destination is fixed before a queue seat or reserved invitation is published. */
    const facebookContext = await prepareFacebookLiveContext(transaction, db, userId, input.locale, contextKey, nowMs);
    /** New seats validate one catalog per invocation; restored seats never start this query. */
    const deck = await (preparedDeck ??= loadEligibleContent(db, input.locale, input.categoryId)
      .then(content => buildDeterministicRaceDeck(content, {locale: input.locale, categoryId: input.categoryId, seed: ticketId})));
    /** Provides data behavior. */
    const data = owner.data()!;
    /** Provides player behavior. */
    const player = {displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
      level: getProfileLevel(data),
      avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0};
    /** Provides ticket behavior. */
    const ticket: LiveTicket = {userId, pool, player, ...(privateEntry ? {privateChallenge: true} : {}),
      ...(input.waitForPlayer ? {waitForPlayer: true} : {}),
      ...(input.requiresReady ? {requiresReady: true} : {}),
      ...(facebookContext ? {facebookContext} : {}),
      ...(rematch ? {rematchOfTicketId: input.rematchOfTicketId, inviteRecipientId: rematch.recipientId} : {}), createdAtMs: nowMs, seenAtMs: nowMs,
      run: liveRun({...deck, locale: input.locale, categoryId: input.categoryId}, userId, ticketId)};
    if (privateEntry) {
      if (!rematch && !["jest", "facebook", "android"].includes(raceProviderScope(userId) ?? ""))
        throw new HttpsError("permission-denied", "Platform invitations unavailable.");
      /** Private seats are recoverable but cannot be selected by public searches. */
      const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000);
      /** A new native private seat establishes play without changing another provider's account. */
      const referralActivity = androidReferralPlayPatch(owner.data() ?? {});
      if (referralActivity.androidReferralPlayed) transaction.update(owner.ref, referralActivity);
      transaction.create(ticketRef, {...stripUndefined(ticket), expiresAt});
      claimLiveJoinIntent(transaction, intent, ticketRef, nowMs);
      transaction.set(pointer, {ticketId, expiresAt});
      if (rematch) createLiveRaceRematchInvitation(transaction, db, userId, ticketId, rematch, nowMs);
      publishLiveRaceSignals(db, transaction, [ticketId], expiresAt);
      return liveView(ticketId, ticket, undefined, nowMs);
    }
    /** Seven-day retention deadline for the new public ticket. */
    const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000);
    /** Fresh server clock sampled after content preparation and before queue selection. */
    const queueNowMs = options.nowMs ?? Date.now();
    // Content preparation cannot consume the player's opponent search window.
    ticket.createdAtMs = queueNowMs;
    ticket.seenAtMs = queueNowMs;
    /** Prepared public pairing and queue writes for the new owned seat. */
    const queue = await prepareLiveRaceQueue(db, transaction, {ticketId, ticket, nowMs: queueNowMs, expiresAt, ownerProfile: owner, newTicket: true});
    /** Verified human match, or no match while the ticket remains searching. */
    const match = queue.match;
    queue.commit();
    /** Native matchmaking establishes play atomically with the new public seat. */
    const referralActivity = androidReferralPlayPatch(owner.data() ?? {});
    if (referralActivity.androidReferralPlayed) transaction.update(owner.ref, referralActivity);
    /** Provides response behavior. */
    const response = liveView(ticketId, ticket, match, options.nowMs ?? Date.now());
    transaction.create(ticketRef, {...stripUndefined(ticket), expiresAt});
    claimLiveJoinIntent(transaction, intent, ticketRef, nowMs);
    transaction.set(pointer, {ticketId, expiresAt});
    publishLiveRaceSignals(db, transaction, match?.tickets ?? [ticketId], expiresAt);
    return response;
  });
}

/** Raised inside a read-only observation when the authoritative update would need to write. */
class LiveRaceObservationRequiresWrite extends Error {}

/** Bound on remembered seats; the oldest entries are evicted first. */
const OBSERVATION_HINT_LIMIT = 5_000;
/** Per database, seats whose latest poll on this instance changed nothing, so the next poll is tried lock-free. */
const readOnlyObservationHints = new WeakMap<Firestore, Set<string>>();

/** Hint set for one database. */
function observationHints(db: Firestore): Set<string> {
  /** Existing set. */
  let hints = readOnlyObservationHints.get(db);
  if (!hints) readOnlyObservationHints.set(db, hints = new Set());
  return hints;
}

/** Records whether a seat's latest poll was a pure observation. */
function rememberObservation(db: Firestore, ticketId: string, pure: boolean): void {
  /** Hints for this database. */
  const hints = observationHints(db);
  hints.delete(ticketId);
  if (!pure) return;
  hints.add(ticketId);
  if (hints.size > OBSERVATION_HINT_LIMIT) hints.delete(hints.values().next().value!);
}

/** Transaction view that rejects mutations so an unchanged observation never takes write locks. */
function observationOnly(transaction: FirebaseFirestore.Transaction): FirebaseFirestore.Transaction {
  return new Proxy(transaction, {
    /** Rejects mutations and forwards reads to the real transaction. */
    get(target, key) {
      if (key === "create" || key === "set" || key === "update" || key === "delete")
        return () => {throw new LiveRaceObservationRequiresWrite();};
      /** Original SDK member, bound to the real transaction. */
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Transaction view that reports whether the evaluation queued any mutation. */
function writeTracking(transaction: FirebaseFirestore.Transaction, onWrite: () => void): FirebaseFirestore.Transaction {
  return new Proxy(transaction, {
    /** Forwards members, recording each queued mutation. */
    get(target, key) {
      /** Original SDK member, bound to the real transaction. */
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      if (key === "create" || key === "set" || key === "update" || key === "delete")
        return (...args: unknown[]) => {onWrite(); return value.apply(target, args);};
      return value.bind(target);
    },
  });
}

/**
 * Atomically observes both scores, accepts one action and grants exactly one winner reward.
 *
 * Once a seat's poll has changed nothing, its next poll on this instance runs as
 * a read-only transaction: no locks are held on the shared match (so the rival's
 * guess never waits behind an observation) and no commit round trip is paid.
 * A poll that turns out to need a write (leases, bot moves, start or finish
 * settlement) is re-evaluated in the ordinary read-write transaction.
 */
export async function updateLiveRaceForUser(userId: string, input: UpdateLiveRace, options: UpdateOptions = {}) {
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const sampledAtMs = options.nowMs ?? Date.now();
  /** One authoritative evaluation shared by both transaction modes. */
  const evaluate = (transaction: FirebaseFirestore.Transaction) => evaluateLiveRaceUpdate(db, transaction, userId, input, options, sampledAtMs);
  if (input.action !== "poll") return db.runTransaction(evaluate);
  if (observationHints(db).has(input.ticketId)) {
    try {
      /** Lock-free observation. */
      const observed = await db.runTransaction(transaction => evaluate(observationOnly(transaction)), {readOnly: true});
      rememberObservation(db, input.ticketId, true);
      return observed;
    } catch (error) {
      if (!(error instanceof LiveRaceObservationRequiresWrite)) throw error;
    }
  }
  /** Whether the latest attempt queued a mutation; reset on every transaction retry. */
  let wrote = false;
  /** Authoritative observation that may persist state. */
  const observed = await db.runTransaction(transaction => {
    wrote = false;
    return evaluate(writeTracking(transaction, () => {wrote = true;}));
  });
  rememberObservation(db, input.ticketId, !wrote);
  return observed;
}

/** Evaluates one live update inside the supplied transaction. */
async function evaluateLiveRaceUpdate(db: Firestore, transaction: FirebaseFirestore.Transaction, userId: string,
  input: UpdateLiveRace, options: UpdateOptions, sampledAtMs: number) {
  /** Provides ticket ref behavior. */
  const ticketRef = db.doc(`liveRaceTickets/${input.ticketId}`);
  /** Provides [snapshot, deletion] behavior. */
  const [snapshot, deletion] = await Promise.all([transaction.get(ticketRef),
    transaction.get(getJestAccountDeletionRef(db, userId)), options.authorize?.()]);
  assertJestAccountActive(deletion);
  /** Deletion boundaries stay local to this attempt; a retry must read them again. */
  const deletionSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>([[userId, deletion]]);
  if (!snapshot.exists) throw new HttpsError("not-found", "Live race unavailable.");
  /** Provides ticket behavior. */
  const ticket = snapshot.data() as LiveTicket;
  if (ticket.userId !== userId) throw new HttpsError("permission-denied", "This live seat belongs to another player.");
  if (!isLiveRaceRetained(snapshot, sampledAtMs)) throw new HttpsError("not-found", "Live race expired.");
  if (options.expectedJoinId && ticket.activeJoinId !== options.expectedJoinId)
    throw new HttpsError("permission-denied", "A newer live join owns this seat.", {reason: "live-join-superseded"});
  /** Private lease supplies the clock floor before a match has been assigned. */
  let nowMs = liveOperationAtMs(ticket, undefined, sampledAtMs);
  if (ticket.cancelled) return liveView(input.ticketId, ticket, undefined, nowMs);
  /** Provides match behavior. */
  const matchSnapshot = ticket.matchId ? await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`)) : undefined;
  if (matchSnapshot && !isLiveRaceRetained(matchSnapshot, nowMs))
    throw new HttpsError("not-found", "Live match unavailable.");
  /** Retained shared match, later replaced only by an authorized pairing or bot start. */
  let match = matchSnapshot?.data() as LiveMatch | undefined;
  /** Deferred queue writes prepared before request and settlement reads. */
  let queue: Awaited<ReturnType<typeof prepareLiveRaceQueue>> | undefined;
  /** Unchanged observations do not rewrite or contend on the shared match. */
  let matchChanged = false;
  /** Only assigning a new bot match changes this matched ticket. */
  const previousMatchId = ticket.matchId;
  nowMs = liveOperationAtMs(ticket, match, nowMs);
  if (!isLiveRaceRetained(snapshot, nowMs) || matchSnapshot && !isLiveRaceRetained(matchSnapshot, nowMs))
    throw new HttpsError("not-found", "Live authority expired.");
  /** Current active-seat pointer required for any unmatched ticket update. */
  const ownerPointer = !match ? await transaction.get(db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`)) : undefined;
  if (!match && ownerPointer?.data()?.ticketId !== input.ticketId)
    throw new HttpsError("failed-precondition", "Another live journey owns this account.");
  if (!match && input.action === "leave") {
    ticket.cancelled = true;
    transaction.update(ticketRef, {cancelled: true, seenAtMs: nowMs});
    publishLiveRaceSignals(db, transaction, [input.ticketId], snapshot.data()!.expiresAt);
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  if (!match && ticket.privateChallenge && nowMs >= liveRaceSearchEndsAtMs(ticket)) {
    ticket.cancelled = true;
    transaction.update(ticketRef, {cancelled: true, seenAtMs: nowMs});
    publishLiveRaceSignals(db, transaction, [input.ticketId], snapshot.data()!.expiresAt);
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  if (!match && !ticket.privateChallenge && input.action === "poll" && nowMs < liveRaceSearchEndsAtMs(ticket)) {
    /** Public account identity required before a waiting seat re-enters the queue. */
    const [ownerProfile] = await transaction.getAll(db.doc(`users/${userId}`), {fieldMask: ["username", "stats.level", "avatarUrl", "androidProvider"]});
    assertAndroidRaceAccount(userId, ownerProfile.data());
    queue = await prepareLiveRaceQueue(db, transaction, {ticketId: input.ticketId, ticket, nowMs, expiresAt: snapshot.data()!.expiresAt, ownerProfile, ownerPointer});
    match = queue.match;
    matchChanged = Boolean(match);
  }
  if (!match && !ticket.privateChallenge && nowMs >= liveRaceSearchEndsAtMs(ticket)) {
    match = createLiveBotMatch(input.ticketId, ticket, nowMs);
    matchChanged = true;
  }
  if (!match) {
    if (input.action !== "poll") throw new HttpsError("failed-precondition", "No opponent has joined yet.");
    queue?.commit();
    transaction.update(ticketRef, {seenAtMs: nowMs, ...(queue ? {"player.level": ticket.player.level} : {})});
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  // Persist the first shared start observation once; subsequent unchanged polls remain read-only.
  if (match.startsAtMs !== null && match.winner === undefined && nowMs >= match.startsAtMs && (match.observedAtMs ?? 0) < match.startsAtMs)
    matchChanged = true;
  /** Provides seat behavior. */
  const seat = match.tickets[0] === input.ticketId ? 0 : match.tickets[1] === input.ticketId ? 1 : -1;
  if (seat === -1) throw new HttpsError("data-loss", "Invalid live seat.");
  if (match.runs[seat].userId !== userId || match.deletedSeats?.[seat])
    throw new HttpsError("permission-denied", "Live participant unavailable.");
  /** Requests ref. */
  const requestRef = db.doc(`liveRaceMatches/${ticket.matchId}/requests/${requestDocumentId(userId, input.requestId)}`);
  /** Provides rival id behavior. */
  const rivalId = match.tickets[1 - seat];
  /** Provides rival user behavior. */
  const rivalUser = match.runs[1 - seat].userId;
  /** Receipt and privacy checks depend only on the accepted match, so share one read round trip. */
  const [receipt, checks] = await Promise.all([
    input.action === "poll" ? null : transaction.get(requestRef),
    rivalId && !match.deletedSeats?.[1 - seat] ? Promise.all([transaction.get(db.doc(`users/${userId}/blockedRivals/${rivalUser}`)),
      transaction.get(db.doc(`users/${rivalUser}/blockedRivals/${userId}`)), transaction.get(getJestAccountDeletionRef(db, rivalUser))]) : [],
  ]);
  if (checks[2]) deletionSnapshots.set(rivalUser, checks[2]);
  /** Read-only polls have no command binding or receipt to persist. */
  const binding = input.action === "poll" ? "" : createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (receipt?.exists && receipt.data()?.binding !== binding) throw new HttpsError("invalid-argument", "Live command id reused.");
  /** Private proof identifies only a newly accepted wrong guess that retains its question. */
  let guessProof: {
    /** Original viewer-owned ticket. */ ticketId: string;
    /** Question whose accepted attempt advances. */ riddleId: string;
    /** Repeated content cannot cross positions. */ position: number;
    /** Canonical attempt version before acceptance. */ guessesUsedBefore: number;
    /** Canonical attempt version committed with this receipt. */ guessesUsedAfter: number;
  } | undefined;
  if (checks.some(check => check.exists)) {
    matchChanged ||= match.players[1 - seat].displayName !== "Riddle Quest player" || match.players[1 - seat].avatarUrl !== null || match.winner === undefined;
    match.players[1 - seat] = {...match.players[1 - seat], displayName: "Riddle Quest player", avatarUrl: null, level: 1};
    if (match.winner === undefined) match.winner = null;
  }
  matchChanged = expireLiveMatchReadiness(match, nowMs) || matchChanged;
  matchChanged = advanceLiveBot(match, nowMs) || matchChanged;
  matchChanged = settleLiveFinish(match, nowMs) || matchChanged;
  /** Whether this invocation accepted a state-changing command that needs a receipt. */
  let acceptedCommand = false;
  if (match.winner === undefined && !receipt?.exists && input.action !== "poll") {
    if (input.action === "leave") {
      // Closing a finished seat cannot forfeit or shorten the rival's remaining opportunity.
      if (match.runs[seat].status !== "completed") {
        acceptedCommand = true;
        matchChanged = true;
        match.winner = match.startsAtMs === null || nowMs < match.startsAtMs ? null : 1 - seat;
      }
    }
    else if (input.action === "ready") {
      acceptedCommand = true;
      if (match.startsAtMs === null && match.readySeats && !match.readySeats[seat]) {
        match.readySeats[seat] = true;
        scheduleReadyLiveMatch(match, nowMs);
        matchChanged = true;
      }
    }
    else {
      acceptedCommand = true;
      matchChanged = true;
      if (match.startsAtMs === null || nowMs < match.startsAtMs) throw new HttpsError("failed-precondition", "Match has not started.");
      /** Provides run behavior. */
      const run = applyActionRateLimit(refreshRaceRun(match.runs[seat], nowMs), userId, nowMs);
      // Scoring uses the existing hint/guess rules, without an opponent recording.
      if (input.action === "guess") {
        /** Scalars are captured before the scoring engine can advance the attempt or question. */
        const position = run.currentPosition, guessesUsedBefore = run.guessesUsed;
        /** Only the authoritative scoring result can establish eligible recovery evidence. */
        const guessed = applyRaceGuess(run, {riddleId: input.riddleId!, guess: input.guess!}, nowMs);
        match.runs[seat] = guessed.run;
        if (!guessed.isCorrect && !guessed.autoSkipped && guessed.run.currentPosition === position && guessed.run.guessesUsed === guessesUsedBefore + 1)
          guessProof = {ticketId: input.ticketId, riddleId: input.riddleId!, position, guessesUsedBefore, guessesUsedAfter: guessed.run.guessesUsed};
      } else match.runs[seat] = input.action === "hint" ? applyRaceHint(run, {riddleId: input.riddleId!}, nowMs).run : applyRaceSkip(run, {riddleId: input.riddleId!}, nowMs);
      /** Provides changed behavior. */
      const changed = match.runs[seat];
      changed.lastActionAtMs = Math.max(nowMs, changed.lastActionAtMs ?? 0);
      // Use the shared engine's completed-riddle count for guesses and skips.
      // A penalized finish leaves the rival time to beat its adjusted duration.
      matchChanged = settleLiveFinish(match, nowMs) || matchChanged;
    }
  }
  if (match.winner !== undefined && match.rewardCoins === undefined) {
    matchChanged = true;
    /** Provides winner behavior. */
    const winner = match.winner === null ? undefined : match.runs[match.winner];
    /** Provides winner ticket behavior. */
    const winnerTicket = match.winner === null ? null : match.tickets[match.winner];
    /** Read human accounts and the winner's destination together before any settlement writes. */
    const participantsRead = Promise.all(match.tickets.map(async (id, seat) => {
      if (!id || match.deletedSeats?.[seat]) return null;
      /** Human participant owns its canonical account and deletion boundary. */
      const participantId = match.runs[seat]!.userId;
      /** Reuse only this attempt's canonical deletion read; unobserved accounts still need one. */
      const [profile, deletion] = await Promise.all([transaction.get(db.doc(`users/${participantId}`)),
        deletionSnapshots.get(participantId) ?? transaction.get(getJestAccountDeletionRef(db, participantId))]);
      return profile.exists && !deletion.exists ? profile : null;
    }));
    /** Only Facebook delivery needs the winner's frozen context; other providers use the match receipt. */
    const winnerSourceRead = winner && winnerTicket && isFacebookFirebaseUid(winner.userId) ? winnerTicket === input.ticketId ? ticket :
      transaction.get(db.doc(`liveRaceTickets/${winnerTicket}`)).then(source => source.data() as LiveTicket | undefined) : undefined;
    /** Every read completes before balances, statistics, receipts or delivery outboxes can change. */
    const [participants, winnerSource] = await Promise.all([participantsRead, winnerSourceRead]);
    if (match.winner === 1 && match.tickets[1] === null && match.players[1].bot &&
      match.startsAtMs !== null && nowMs >= match.startsAtMs && participants[0]) {
      recordRaceBotWin(transaction, db, match.players[1].displayName, nowMs);
    }
    /** Both seats share the one-time terminal receipt, including losses and draws. */
    const profileUpdates = new Map<FirebaseFirestore.DocumentSnapshot, Record<string, unknown>>();
    if (match.startsAtMs !== null && nowMs >= match.startsAtMs) for (const [seat, profile] of participants.entries()) {
      if (!profile || !match.runs[seat]!.events.some(event => event.type === "correct")) continue;
      /** Persisted account counters supply the authoritative achievement baseline. */
      const data = profile.data()!;
      for (const field of ["multiplayerGamesPlayed", "multiplayerWins"]) {
        /** Reject corrupt counters before applying the one-time terminal increment. */
        const count = data.stats?.[field] ?? 0;
        /** Only a winner increments wins; every started match increments games played. */
        const increment = field === "multiplayerGamesPlayed" || match.winner === seat ? 1 : 0;
        if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(count + increment))
          throw new HttpsError("data-loss", "Invalid multiplayer game total.");
      }
      /** Confirmed terminal seat state determines achievement eligibility. */
      const run = match.runs[seat]!;
      /** Computes idempotent achievement changes alongside the match settlement. */
      const award = prepareRaceAchievementEvent(data, {kind: "completed", won: match.winner === seat,
        cleanRun: run.status === "completed" && run.correctCount === RACE_RULES.targetCorrect && run.hintPenaltyMs === 0 && run.skipPenaltyMs === 0}, nowMs);
      /** Winner coins combine with the account's validated achievement balance. */
      const coins = award.newCoins + (match.winner === seat ? LIVE_RACE_WIN_COINS : 0);
      if (!Number.isSafeInteger(coins)) throw new HttpsError("data-loss", "Invalid coin balance.");
      profileUpdates.set(profile, {coins, "stats.multiplayerGamesPlayed": award.stats.multiplayerGamesPlayed,
        "stats.multiplayerWins": award.stats.multiplayerWins,
        ...(award.unlockedAchievementEntries.length ? {
          unlockedAchievements: admin.firestore.FieldValue.arrayUnion(...award.unlockedAchievementEntries),
        } : {})});
      // Retain each human's own confirmed balance without exposing the rival's currency.
      run.settlementCoins = coins;
    }
    /** Only an existing, non-deleted human winner can receive coins and a win. */
    const owner = match.winner === null || !match.runs[match.winner]!.events.some(event => event.type === "correct") ? null : participants[match.winner];
    match.rewardCoins = 0;
    if (owner) {
      /** Provides coins behavior. */
      const coins = match.winner === null ? null : match.runs[match.winner]?.settlementCoins;
      if (typeof coins !== "number" || !Number.isSafeInteger(coins)) throw new HttpsError("data-loss", "Invalid coin balance.");
      match.rewardCoins = LIVE_RACE_WIN_COINS;
      match.newCoins = coins;
      if (winner && winnerTicket && (isFacebookFirebaseUid(winner.userId) || isRedditFirebaseUid(winner.userId))) {
        // Namespace this receipt separately from legacy recorded runs using the same request ID.
        /** Provides facebook behavior. */
        const facebook = isFacebookFirebaseUid(winner.userId);
        /** Provides event id behavior. */
        const eventId = facebook ? facebookLiveRaceReferralEventId(winner.userId, winnerTicket) : redditLiveRaceReferralEventId(winner.userId, winnerTicket);
        match[facebook ? "facebookReferral" : "redditReferral"] = {eventId, ticketId: winnerTicket, userId: winner.userId, createdAtMs: nowMs};
        transaction.create(db.doc(`racePerformanceOutbox/${eventId}`), {runId: eventId, userId: winner.userId,
          ...(facebook && winnerSource?.facebookContext ? {facebookContext: winnerSource.facebookContext} : {}),
          source: facebook ? "facebook_live" : "reddit_live", liveTicketId: winnerTicket, liveMatchId: ticket.matchId, createdAtMs: nowMs,
          ...pendingRaceDelivery(nowMs), expiresAt: snapshot.data()!.expiresAt});
      }
    }
    for (const [profile, update] of profileUpdates) {
      transaction.update(profile.ref, update);
      if (raceProviderScope(profile.id) === "android" && typeof profile.data()?.androidGoogleSubjectHash === "string") {
        /** The participant's immutable ticket selects its private terminal referral proof. */
        const seat = match.runs.findIndex(run => run.userId === profile.id), sourceTicket = match.tickets[seat];
        if (sourceTicket) transaction.create(db.doc(`androidReferralPlayOutbox/${androidReferralLiveEventId(profile.id, sourceTicket)}`), {
          uid: profile.id, matchId: ticket.matchId, ticketId: sourceTicket, delivered: false, expiresAt: snapshot.data()!.expiresAt,
        });
      }
    }
  }
  match.observedAtMs = nowMs;
  /** Provides response behavior. */
  const response = liveView(input.ticketId, ticket, match, nowMs);
  /** Provides expires at behavior. */
  const expiresAt = snapshot.data()!.expiresAt;
  queue?.commit();
  if (matchChanged) {
    transaction.set(db.doc(`liveRaceMatches/${ticket.matchId}`), {...stripUndefined(match),
      expiresAt: matchSnapshot?.data()?.expiresAt ?? queue?.matchExpiresAt ?? expiresAt});
    publishLiveRaceSignals(db, transaction, match.tickets.filter((_, seat) => !match!.deletedSeats?.[seat]), expiresAt);
  }
  if (previousMatchId !== ticket.matchId) transaction.update(ticketRef, {matchId: ticket.matchId, seenAtMs: nowMs,
    ...(queue ? {"player.level": ticket.player.level} : {})});
  if (acceptedCommand) transaction.create(requestRef, {userId, binding, expiresAt, ...(guessProof ? {guessProof} : {})});
  return response;
}

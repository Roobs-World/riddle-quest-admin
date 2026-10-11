import {publishLiveRaceSignals} from "./raceLiveSignals";
import {acceptLiveRaceChallengeForUser} from "./raceLiveInvitation";
import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_WAIT_MS, LIVE_RACE_INVITE_MS, LIVE_RACE_COUNTDOWN_MS, LIVE_RACE_WIN_COINS, RACE_RULES,
  type JoinLiveRace, type UpdateLiveRace} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef, assertJestAccountActive} from "../jest/jestAccountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, refreshRaceRun} from "./raceEngine";
import {applyActionRateLimit, buildDeterministicRaceDeck, loadEligibleContent,
  requestDocumentId, stripUndefined, prepareRaceAchievementEvent, type Firestore} from "./raceSetupService";
import {liveRun, liveView, liveOperationAtMs, advanceLiveBot, type LiveTicket, type LiveMatch} from "./raceLiveState";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";
import {pendingRaceDelivery} from "./raceDeliveryFailures";
import {facebookLiveRaceReferralEventId} from "../facebook/facebookLiveRaceReferralDelivery";
import {isRedditFirebaseUid} from "../reddit/redditSecurity";
import {redditLiveRaceReferralEventId} from "../reddit/redditLiveRaceReferralDelivery";
import {settleLiveFinish} from "./raceLiveScoring";
import {prepareLiveRaceRematch, createLiveRaceRematchInvitation} from "./raceLiveRematch";
import {facebookLiveContextSelection, prepareFacebookLiveContext, assertFacebookLiveContextSelection} from "./facebookLiveContextBinding";
import {assertLiveRaceDeckCompatible, isLiveRaceDeckCompatible} from "./raceDeckCompatibility";
import {readLiveJoinIntent, claimLiveJoinIntent} from "./raceLiveJoinIntent";

/** A short lobby heartbeat prevents matching players who already closed their game. */
const LOBBY_LEASE_MS = 10_000;
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

/** Enters one owned queue seat; retries and concurrent tabs recover the same active ticket. */
export async function joinLiveRaceForUser(userId: string, input: JoinLiveRace, options: Options = {}) {
  if (input.expectedOwnerId && input.expectedOwnerId !== userId)
    throw new HttpsError("permission-denied", "Live race account changed.");
  /** Other providers cannot select a Facebook board, including invitation recovery. */
  const contextKey = facebookLiveContextSelection(userId, input.facebookContextId);
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
  /** Provides queue ref behavior. */
  const queueRef = db.doc(`liveRaceQueues/${pool}`);
  /** Reuses this invocation's validated immutable deck if Firestore retries the queue transaction. */
  let preparedDeck: Promise<ReturnType<typeof buildDeterministicRaceDeck>> | undefined;
  return db.runTransaction(async transaction => {
    /** Reads fresh recovery authority and only public identity fields before shared-pool locks or content queries. */
    const [intent, current, receipt, owner, deletion] = await Promise.all([readLiveJoinIntent(db, transaction, userId, input), transaction.get(pointer), transaction.get(ticketRef),
      transaction.getAll(db.doc(`users/${userId}`), {fieldMask: ["username", "level", "avatarUrl"]}).then(([profile]) => profile),
      transaction.get(getJestAccountDeletionRef(db, userId))]);
    assertJestAccountActive(deletion);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    /** Provides previous id behavior. */
    const previousId = current.data()?.ticketId as string | undefined;
    if (previousId || receipt.exists || intent?.record?.ticketId) {
      /** Provides id behavior. */
      const id = intent?.record?.ticketId ?? (receipt.exists ? ticketId : previousId!);
      /** Provides old behavior. */
      const old = id === ticketId && receipt.exists ? receipt : await transaction.get(db.doc(`liveRaceTickets/${id}`));
      /** Provides ticket behavior. */
      const ticket = old.data() as LiveTicket | undefined;
      if (intent?.record?.ticketId && (!ticket || ticket.userId !== userId))
        throw new HttpsError("not-found", "Original live join unavailable.");
      if (ticket && ticket.userId === userId) {
        if (receipt.exists) assertFacebookLiveContextSelection(ticket.facebookContext, contextKey);
        if (receipt.exists && (Boolean(ticket.privateChallenge) !== privateEntry ||
          ticket.rematchOfTicketId !== input.rematchOfTicketId || ticket.pool !== pool))
          throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
        /** Provides match behavior. */
        const match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as LiveMatch : undefined;
        /** An unattended expired invitation must not strand the account's active-seat pointer. */
        const privateExpired = ticket.privateChallenge && !match &&
          liveOperationAtMs(ticket, undefined, options.nowMs ?? Date.now()) >= ticket.createdAtMs + LIVE_RACE_INVITE_MS;
        if (privateExpired && (receipt.exists || intent?.record?.ticketId)) {
          ticket.cancelled = true;
          transaction.update(old.ref, {cancelled: true});
          publishLiveRaceSignals(db, transaction, [id], old.data()!.expiresAt);
          return liveView(id, ticket, undefined, options.nowMs ?? Date.now());
        }
        if (!privateExpired && (receipt.exists || intent?.record?.ticketId || !ticket.cancelled && (!match || match.winner === undefined))) {
          assertFacebookLiveContextSelection(ticket.facebookContext, contextKey);
          if (Boolean(ticket.privateChallenge) !== privateEntry || ticket.rematchOfTicketId !== input.rematchOfTicketId)
            throw new HttpsError("failed-precondition", "Finish the current live race first.");
          if (ticket.pool !== pool) throw new HttpsError("failed-precondition", "Finish the current live race first.");
          /** Reconnect observations renew this owned lease without rewinding either seat's clock. */
          const observedAtMs = liveOperationAtMs(ticket, match, options.nowMs ?? Date.now());
          transaction.update(old.ref, {seenAtMs: observedAtMs});
          if (match) transaction.update(db.doc(`liveRaceMatches/${ticket.matchId}`), {observedAtMs});
          claimLiveJoinIntent(transaction, intent, old.ref, observedAtMs);
          return liveView(id, ticket, match, observedAtMs);
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
      level: typeof data.level === "number" && Number.isInteger(data.level) && data.level > 0 ? data.level : 1,
      avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0};
    /** Provides ticket behavior. */
    const ticket: LiveTicket = {userId, pool, player, ...(privateEntry ? {privateChallenge: true} : {}),
      ...(facebookContext ? {facebookContext} : {}),
      ...(rematch ? {rematchOfTicketId: input.rematchOfTicketId, inviteRecipientId: rematch.recipientId} : {}), createdAtMs: nowMs, seenAtMs: nowMs,
      run: liveRun({...deck, locale: input.locale, categoryId: input.categoryId}, userId, ticketId)};
    if (privateEntry) {
      if (!rematch && !["jest", "facebook"].includes(raceProviderScope(userId) ?? ""))
        throw new HttpsError("permission-denied", "Platform invitations unavailable.");
      /** Private seats are recoverable but cannot be selected by public searches. */
      const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000);
      transaction.create(ticketRef, {...stripUndefined(ticket), expiresAt});
      claimLiveJoinIntent(transaction, intent, ticketRef, nowMs);
      transaction.set(pointer, {ticketId, expiresAt});
      if (rematch) createLiveRaceRematchInvitation(transaction, db, userId, ticketId, rematch, nowMs);
      publishLiveRaceSignals(db, transaction, [ticketId], expiresAt);
      return liveView(ticketId, ticket, undefined, nowMs);
    }
    /** Shared queue is locked only after the new deck is ready; reconnects never read it. */
    const queue = await transaction.get(queueRef);
    /** Provides ids behavior. */
    const ids: string[] = queue.data()?.tickets ?? [];
    /** Provides candidates behavior. */
    const candidates = ids.length ? await transaction.getAll(...ids.slice(0, 40).map(id => db.doc(`liveRaceTickets/${id}`))) : [];
    /** Provides eligible behavior. */
    const eligible = candidates.filter(snapshot => {
      /** Provides other behavior. */
      const other = snapshot.data() as LiveTicket | undefined;
      return other && other.userId !== userId && other.pool === pool && !other.cancelled && !other.matchId &&
        other.createdAtMs + LIVE_RACE_WAIT_MS > nowMs && other.seenAtMs + LOBBY_LEASE_MS > nowMs &&
        isLiveRaceDeckCompatible(other.run);
    });
    /** Provides opponent behavior. */
    let opponent: (typeof eligible)[number] | undefined;
    for (const candidate of eligible) {
      /** Provides other behavior. */
      const other = candidate.data() as LiveTicket;
      /** Provides checks behavior. */
      const checks = await Promise.all([transaction.get(db.doc(`users/${userId}/blockedRivals/${other.userId}`)),
        transaction.get(db.doc(`users/${other.userId}/blockedRivals/${userId}`)), transaction.get(getJestAccountDeletionRef(db, other.userId))]);
      if (!checks.some(check => check.exists)) {opponent = candidate; break;}
    }
    /** Provides match behavior. */
    let match: LiveMatch | undefined;
    if (opponent) {
      /** Provides other behavior. */
      const other = opponent.data() as LiveTicket;
      /** Provides starts at ms behavior. */
      const startsAtMs = Math.max(options.nowMs ?? Date.now(), other.seenAtMs, ticket.seenAtMs) + LIVE_RACE_COUNTDOWN_MS;
      ticket.matchId = opponent.id;
      match = {tickets: [opponent.id, ticketId], participantIds: [other.userId, userId], startsAtMs, observedAtMs: startsAtMs - LIVE_RACE_COUNTDOWN_MS, players: [other.player, player], runs: [
        liveRun(other.run, other.userId, opponent.id, startsAtMs), liveRun(other.run, userId, ticketId, startsAtMs)]};
      transaction.update(opponent.ref, {matchId: opponent.id});
      transaction.create(db.doc(`liveRaceMatches/${opponent.id}`), {...stripUndefined(match), expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000)});
    }
    /** Provides expires at behavior. */
    const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000);
    /** Provides response behavior. */
    const response = liveView(ticketId, ticket, match, options.nowMs ?? Date.now());
    transaction.create(ticketRef, {...stripUndefined(ticket), expiresAt});
    claimLiveJoinIntent(transaction, intent, ticketRef, nowMs);
    transaction.set(pointer, {ticketId, expiresAt});
    transaction.set(queueRef, {tickets: [...eligible.filter(item => item !== opponent).map(item => item.id), ...(!opponent ? [ticketId] : [])].slice(-40), expiresAt});
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
  if (options.expectedJoinId && ticket.activeJoinId !== options.expectedJoinId)
    throw new HttpsError("permission-denied", "A newer live join owns this seat.", {reason: "live-join-superseded"});
  /** Private lease supplies the clock floor before a match has been assigned. */
  let nowMs = liveOperationAtMs(ticket, undefined, sampledAtMs);
  if (ticket.cancelled) return liveView(input.ticketId, ticket, undefined, nowMs);
  /** Provides match behavior. */
  let match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as LiveMatch : undefined;
  /** Unchanged observations do not rewrite or contend on the shared match. */
  let matchChanged = false;
  /** Only assigning a new bot match changes this matched ticket. */
  const previousMatchId = ticket.matchId;
  nowMs = liveOperationAtMs(ticket, match, nowMs);
  if (!match && input.action === "leave") {
    ticket.cancelled = true;
    transaction.update(ticketRef, {cancelled: true, seenAtMs: nowMs});
    publishLiveRaceSignals(db, transaction, [input.ticketId], snapshot.data()!.expiresAt);
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  if (!match && ticket.privateChallenge && nowMs >= ticket.createdAtMs + LIVE_RACE_INVITE_MS) {
    ticket.cancelled = true;
    transaction.update(ticketRef, {cancelled: true, seenAtMs: nowMs});
    publishLiveRaceSignals(db, transaction, [input.ticketId], snapshot.data()!.expiresAt);
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  if (!match && !ticket.privateChallenge && nowMs >= ticket.createdAtMs + LIVE_RACE_WAIT_MS) {
    assertLiveRaceDeckCompatible(ticket.run);
    ticket.matchId = input.ticketId;
    /** Provides starts at ms behavior. */
    const startsAtMs = nowMs + LIVE_RACE_COUNTDOWN_MS;
    match = {tickets: [input.ticketId, null], participantIds: [userId], startsAtMs, observedAtMs: nowMs,
      players: [ticket.player, {displayName: "Riddle Bot", avatarUrl: null, bot: true, correctCount: 0}],
      runs: [liveRun(ticket.run, userId, input.ticketId, startsAtMs), liveRun(ticket.run, "bot", `${input.ticketId}-bot`, startsAtMs)]};
    matchChanged = true;
  }
  if (!match) {
    if (input.action !== "poll") throw new HttpsError("failed-precondition", "No opponent has joined yet.");
    transaction.update(ticketRef, {seenAtMs: nowMs});
    return liveView(input.ticketId, ticket, undefined, nowMs);
  }
  // Persist the first shared start observation once; subsequent unchanged polls remain read-only.
  if (match.winner === undefined && nowMs >= match.startsAtMs && (match.observedAtMs ?? 0) < match.startsAtMs)
    matchChanged = true;
  /** Provides seat behavior. */
  const seat = match.tickets[0] === input.ticketId ? 0 : match.tickets[1] === input.ticketId ? 1 : -1;
  if (seat === -1) throw new HttpsError("data-loss", "Invalid live seat.");
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
  matchChanged = advanceLiveBot(match, nowMs) || matchChanged;
  matchChanged = settleLiveFinish(match, nowMs) || matchChanged;
  if (match.winner === undefined && !receipt?.exists && input.action !== "poll") {
    matchChanged = true;
    if (input.action === "leave") {
      // Closing a finished seat cannot forfeit or shorten the rival's remaining opportunity.
      if (match.runs[seat].status !== "completed") match.winner = nowMs < match.startsAtMs ? null : 1 - seat;
    }
    else {
      if (nowMs < match.startsAtMs) throw new HttpsError("failed-precondition", "Match has not started.");
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
    /** Both seats share the one-time terminal receipt, including losses and draws. */
    const profileUpdates = new Map<FirebaseFirestore.DocumentSnapshot, Record<string, unknown>>();
    if (nowMs >= match.startsAtMs) for (const [seat, profile] of participants.entries()) {
      if (!profile) continue;
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
    const owner = match.winner === null ? null : participants[match.winner];
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
    for (const [profile, update] of profileUpdates) transaction.update(profile.ref, update);
  }
  match.observedAtMs = nowMs;
  /** Provides response behavior. */
  const response = liveView(input.ticketId, ticket, match, nowMs);
  /** Provides expires at behavior. */
  const expiresAt = snapshot.data()!.expiresAt;
  if (matchChanged) {
    transaction.set(db.doc(`liveRaceMatches/${ticket.matchId}`), {...stripUndefined(match), expiresAt});
    publishLiveRaceSignals(db, transaction, match.tickets.filter((_, seat) => !match!.deletedSeats?.[seat]), expiresAt);
  }
  if (previousMatchId !== ticket.matchId) transaction.update(ticketRef, {matchId: ticket.matchId, seenAtMs: nowMs});
  if (input.action !== "poll" && !receipt?.exists) transaction.create(requestRef, {userId, binding, expiresAt, ...(guessProof ? {guessProof} : {})});
  return response;
}

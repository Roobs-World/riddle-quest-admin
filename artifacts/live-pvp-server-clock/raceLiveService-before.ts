import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_WAIT_MS, LIVE_RACE_COUNTDOWN_MS, LIVE_RACE_WIN_COINS, RACE_RULES,
  type JoinLiveRace, type UpdateLiveRace} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef, assertJestAccountActive} from "../jest/jestAccountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, refreshRaceRun} from "./raceEngine";
import {applyActionRateLimit, buildDeterministicRaceDeck, loadEligibleContent, readRaceCoinBalance,
  requestDocumentId, stripUndefined, type Firestore} from "./raceSetupService";
import {liveRun, liveView, advanceLiveBot, type LiveTicket, type LiveMatch} from "./raceLiveState";

/** A short lobby heartbeat prevents matching players who already closed their game. */
const LOBBY_LEASE_MS = 10_000;
/** Server persistence and time seams support transaction concurrency tests. */
type Options = {
  /** Emulator database for concurrency tests. */
  db?: Firestore;
  /** Authoritative clock supplied only by tests. */
  nowMs?: number;
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
  return db.runTransaction(async transaction => {
    /** Reads owned recovery state before any shared-pool lock or content query. */
    const [current, receipt, owner, deletion] = await Promise.all([transaction.get(pointer), transaction.get(ticketRef),
      transaction.get(db.doc(`users/${userId}`)), transaction.get(getJestAccountDeletionRef(db, userId))]);
    assertJestAccountActive(deletion);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    /** Provides previous id behavior. */
    const previousId = current.data()?.ticketId as string | undefined;
    if (previousId || receipt.exists) {
      /** Provides id behavior. */
      const id = receipt.exists ? ticketId : previousId!;
      /** Provides old behavior. */
      const old = receipt.exists ? receipt : await transaction.get(db.doc(`liveRaceTickets/${id}`));
      /** Provides ticket behavior. */
      const ticket = old.data() as LiveTicket | undefined;
      if (ticket && ticket.userId === userId) {
        /** Provides match behavior. */
        const match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as LiveMatch : undefined;
        if (receipt.exists || !ticket.cancelled && (!match || match.winner === undefined)) {
          if (ticket.pool !== pool) throw new HttpsError("failed-precondition", "Finish the current live race first.");
          return liveView(id, ticket, match, options.nowMs ?? Date.now());
        }
      }
    }
    /** New seats require a currently validated catalog; restored seats retain their immutable deck. */
    const content = await loadEligibleContent(db, input.locale, input.categoryId);
    /** Deck construction runs only after idempotent receipt and active-seat recovery have been ruled out. */
    const deck = buildDeterministicRaceDeck(content, {locale: input.locale, categoryId: input.categoryId, seed: ticketId});
    /** Provides data behavior. */
    const data = owner.data()!;
    /** Provides player behavior. */
    const player = {displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
      avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0};
    /** Provides ticket behavior. */
    const ticket: LiveTicket = {userId, pool, player, createdAtMs: nowMs, seenAtMs: nowMs,
      run: liveRun({...deck, locale: input.locale, categoryId: input.categoryId}, userId, ticketId)};
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
        other.createdAtMs + LIVE_RACE_WAIT_MS > nowMs && other.seenAtMs + LOBBY_LEASE_MS > nowMs;
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
      const startsAtMs = (options.nowMs ?? Date.now()) + LIVE_RACE_COUNTDOWN_MS;
      ticket.matchId = opponent.id;
      match = {tickets: [opponent.id, ticketId], startsAtMs, players: [other.player, player], runs: [
        liveRun(other.run, other.userId, opponent.id, startsAtMs), liveRun(other.run, userId, ticketId, startsAtMs)]};
      transaction.update(opponent.ref, {matchId: opponent.id});
      transaction.create(db.doc(`liveRaceMatches/${opponent.id}`), stripUndefined(match));
    }
    /** Provides expires at behavior. */
    const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000);
    /** Provides response behavior. */
    const response = liveView(ticketId, ticket, match, options.nowMs ?? Date.now());
    transaction.create(ticketRef, {...stripUndefined(ticket), expiresAt});
    transaction.set(pointer, {ticketId, expiresAt});
    transaction.set(queueRef, {tickets: [...eligible.filter(item => item !== opponent).map(item => item.id), ...(!opponent ? [ticketId] : [])].slice(-40), expiresAt});
    return response;
  });
}

/** Atomically observes both scores, accepts one action and grants exactly one winner reward. */
export async function updateLiveRaceForUser(userId: string, input: UpdateLiveRace, options: Options = {}) {
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  return db.runTransaction(async transaction => {
    /** Provides ticket ref behavior. */
    const ticketRef = db.doc(`liveRaceTickets/${input.ticketId}`);
    /** Provides [snapshot, deletion] behavior. */
    const [snapshot, deletion] = await Promise.all([transaction.get(ticketRef), transaction.get(getJestAccountDeletionRef(db, userId))]);
    assertJestAccountActive(deletion);
    if (!snapshot.exists) throw new HttpsError("not-found", "Live race unavailable.");
    /** Provides ticket behavior. */
    const ticket = snapshot.data() as LiveTicket;
    if (ticket.userId !== userId) throw new HttpsError("permission-denied", "This live seat belongs to another player.");
    if (ticket.cancelled) return liveView(input.ticketId, ticket, undefined, options.nowMs ?? Date.now());
    /** Provides match behavior. */
    let match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as LiveMatch : undefined;
    /** Unchanged observations do not rewrite or contend on the shared match. */
    let matchChanged = false;
    /** Only assigning a new bot match changes this matched ticket. */
    const previousMatchId = ticket.matchId;
    if (!match && input.action === "leave") {
      ticket.cancelled = true;
      transaction.update(ticketRef, {cancelled: true});
      return liveView(input.ticketId, ticket, undefined, options.nowMs ?? Date.now());
    }
    if (!match && nowMs >= ticket.createdAtMs + LIVE_RACE_WAIT_MS) {
      ticket.matchId = input.ticketId;
      /** Provides starts at ms behavior. */
      const startsAtMs = (options.nowMs ?? Date.now()) + LIVE_RACE_COUNTDOWN_MS;
      match = {tickets: [input.ticketId, null], startsAtMs,
        players: [ticket.player, {displayName: "Riddle Bot", avatarUrl: null, bot: true, correctCount: 0}],
        runs: [liveRun(ticket.run, userId, input.ticketId, startsAtMs), liveRun(ticket.run, "bot", `${input.ticketId}-bot`, startsAtMs)]};
      matchChanged = true;
    }
    if (!match) {
      if (input.action !== "poll") throw new HttpsError("failed-precondition", "No opponent has joined yet.");
      transaction.update(ticketRef, {seenAtMs: nowMs});
      return liveView(input.ticketId, ticket, undefined, options.nowMs ?? Date.now());
    }
    /** Provides seat behavior. */
    const seat = match.tickets[0] === input.ticketId ? 0 : match.tickets[1] === input.ticketId ? 1 : -1;
    if (seat === -1) throw new HttpsError("data-loss", "Invalid live seat.");
    /** Requests ref. */
    const requestRef = db.doc(`liveRaceMatches/${ticket.matchId}/requests/${requestDocumentId(userId, input.requestId)}`);
    /** Provides receipt behavior. */
    const receipt = input.action === "poll" ? null : await transaction.get(requestRef);
    /** Provides binding behavior. */
    const binding = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    if (receipt?.exists && receipt.data()?.binding !== binding) throw new HttpsError("invalid-argument", "Live command id reused.");
    /** Provides rival id behavior. */
    const rivalId = match.tickets[1 - seat];
    /** Provides rival user behavior. */
    const rivalUser = match.runs[1 - seat].userId;
    /** Provides checks behavior. */
    const checks = rivalId ? await Promise.all([transaction.get(db.doc(`users/${userId}/blockedRivals/${rivalUser}`)),
      transaction.get(db.doc(`users/${rivalUser}/blockedRivals/${userId}`)), transaction.get(getJestAccountDeletionRef(db, rivalUser))]) : [];
    if (checks.some(check => check.exists)) {
      matchChanged ||= match.players[1 - seat].displayName !== "Riddle Quest player" || match.players[1 - seat].avatarUrl !== null || match.winner === undefined;
      match.players[1 - seat] = {...match.players[1 - seat], displayName: "Riddle Quest player", avatarUrl: null};
      if (match.winner === undefined) match.winner = null;
    }
    matchChanged = advanceLiveBot(match, nowMs) || matchChanged;
    if (match.winner === undefined && nowMs >= match.startsAtMs + RACE_RULES.maxAdjustedTimeMs) {match.winner = null; matchChanged = true;}
    if (match.winner === undefined && !receipt?.exists && input.action !== "poll") {
      matchChanged = true;
      if (input.action === "leave") match.winner = nowMs < match.startsAtMs ? null : 1 - seat;
      else {
        if (nowMs < match.startsAtMs) throw new HttpsError("failed-precondition", "Match has not started.");
        /** Provides run behavior. */
        const run = applyActionRateLimit(refreshRaceRun(match.runs[seat], nowMs), userId, nowMs);
        // Scoring uses the existing hint/guess rules, without an opponent recording.
        match.runs[seat] = input.action === "guess" ? applyRaceGuess(run, {riddleId: input.riddleId!, guess: input.guess!}, nowMs).run :
          input.action === "hint" ? applyRaceHint(run, {riddleId: input.riddleId!}, nowMs).run : applyRaceSkip(run, {riddleId: input.riddleId!}, nowMs);
        /** Provides changed behavior. */
        const changed = match.runs[seat];
        changed.lastActionAtMs = Math.max(nowMs, changed.lastActionAtMs ?? 0);
        // Only solved answers count toward victory; skips still advance the shared deck.
        /** Provides solved behavior. */
        const solved = changed.events.filter(event => event.type === "correct").length;
        if (changed.correctCount !== solved) {
          if (changed.status === "completed") {
            changed.status = "active";
            changed.currentPosition += 1;
            delete changed.finishedAtMs; delete changed.wallFinishMs; delete changed.result;
          }
          changed.correctCount = solved;
          /** Provides correct behavior. */
          let correct = 0;
          changed.events = changed.events.map(event => ({...event, correctCount: event.type === "correct" ? ++correct : correct}));
        }
        if (solved >= RACE_RULES.targetCorrect) match.winner = seat;
      }
    }
    if (match.winner !== undefined && match.rewardCoins === undefined) {
      matchChanged = true;
      /** Provides winner behavior. */
      const winner = match.winner === null ? undefined : match.runs[match.winner];
      /** Provides winner ticket behavior. */
      const winnerTicket = match.winner === null ? null : match.tickets[match.winner];
      /** Provides [owner, deleted] behavior. */
      const [owner, deleted] = winner && winnerTicket ? await Promise.all([transaction.get(db.doc(`users/${winner.userId}`)),
        transaction.get(getJestAccountDeletionRef(db, winner.userId))]) : [null, null];
      match.rewardCoins = 0;
      if (owner?.exists && !deleted?.exists) {
        /** Provides coins behavior. */
        const coins = readRaceCoinBalance(owner.data()!) + LIVE_RACE_WIN_COINS;
        if (!Number.isSafeInteger(coins)) throw new HttpsError("data-loss", "Invalid coin balance.");
        match.rewardCoins = LIVE_RACE_WIN_COINS;
        match.newCoins = coins;
        transaction.update(owner.ref, {coins});
      }
    }
    /** Provides response behavior. */
    const response = liveView(input.ticketId, ticket, match, options.nowMs ?? Date.now());
    /** Provides expires at behavior. */
    const expiresAt = snapshot.data()!.expiresAt;
    if (matchChanged) transaction.set(db.doc(`liveRaceMatches/${ticket.matchId}`), {...stripUndefined(match), expiresAt});
    if (previousMatchId !== ticket.matchId) transaction.update(ticketRef, {matchId: ticket.matchId, seenAtMs: nowMs});
    if (input.action !== "poll" && !receipt?.exists) transaction.create(requestRef, {binding, expiresAt});
    return response;
  });
}

import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_INVITE_MS, LIVE_RACE_COUNTDOWN_MS, LiveRaceChallengeSchema,
  type JoinLiveRace, type LiveRaceView} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {requestDocumentId, stripUndefined, type Firestore} from "./raceSetupService";
import {liveOperationAtMs, liveRun, liveView, type LiveMatch, type LiveTicket} from "./raceLiveState";

/** Private invitations use the existing server transport and clock test seams. */
type Options = {
  /** Isolated transaction database for tests. */ db?: Firestore;
  /** Server clock override for tests. */ nowMs?: number;
};
/** Resolves an opaque platform entry handle without accepting paths or arbitrary ticket ids. */
function invitationTicketId(challengeId: string): string {
  if (!/^live_[a-f0-9]{64}$/.test(challengeId)) throw new HttpsError("invalid-argument", "Invalid invitation.");
  return challengeId.slice(5);
}
/** Validates both authenticated providers and reciprocal safety boundaries before exposing identity. */
async function readInvitation(db: Firestore, transaction: FirebaseFirestore.Transaction, userId: string, ticketId: string) {
  /** Server-only lobby receipt, never supplied as authority by the platform entry payload. */
  const snapshot = await transaction.get(db.doc(`liveRaceTickets/${ticketId}`));
  /** Authoritative invitation creator and immutable content selection. */
  const ticket = snapshot.data() as LiveTicket | undefined;
  if (!ticket?.privateChallenge || raceProviderScope(userId) !== raceProviderScope(ticket.userId) ||
    !["jest", "facebook"].includes(raceProviderScope(userId) ?? ""))
    throw new HttpsError("not-found", "Invitation unavailable.");
  /** Account deletion and blocks are checked in the same transaction as acceptance. */
  const [viewerDeleted, creatorDeleted, blocked, reverseBlocked, creator] = await Promise.all([
    transaction.get(getJestAccountDeletionRef(db, userId)), transaction.get(getJestAccountDeletionRef(db, ticket.userId)),
    transaction.get(db.doc(`users/${userId}/blockedRivals/${ticket.userId}`)),
    transaction.get(db.doc(`users/${ticket.userId}/blockedRivals/${userId}`)), transaction.get(db.doc(`users/${ticket.userId}`)),
  ]);
  assertJestAccountActive(viewerDeleted);
  if (creatorDeleted.exists || blocked.exists || reverseBlocked.exists || !creator.exists)
    throw new HttpsError("not-found", "Invitation unavailable.");
  return {snapshot, ticket};
}
/** Reads a challenge notice without joining; the recipient chooses whether to accept. */
export async function getLiveRaceChallengeForUser(userId: string, challengeId: string, options: Options = {}) {
  /** Approved server database. */
  const db = options.db ?? admin.firestore();
  return db.runTransaction(async transaction => {
    /** Private invitation and creator are validated before returning any display identity. */
    const {ticket} = await readInvitation(db, transaction, userId, invitationTicketId(challengeId));
    /** The same persisted clock floor governs preview and acceptance. */
    const nowMs = liveOperationAtMs(ticket, undefined, options.nowMs ?? Date.now());
    /** Match determines whether this authenticated recipient already owns the second seat. */
    const match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() as LiveMatch | undefined : undefined;
    return LiveRaceChallengeSchema.parse({challengeId, creator: ticket.player, locale: ticket.run.locale,
      categoryId: ticket.run.categoryId, expiresAtMs: ticket.createdAtMs + LIVE_RACE_INVITE_MS,
      status: ticket.userId === userId ? "own" : match?.runs[1].userId === userId && match.winner === undefined ? "accepted" :
        ticket.cancelled || ticket.matchId || nowMs >= ticket.createdAtMs + LIVE_RACE_INVITE_MS ? "unavailable" : "available"});
  });
}
/** Reserves the second seat atomically; concurrent recipients cannot replace an accepted rival. */
export async function acceptLiveRaceChallengeForUser(userId: string, input: JoinLiveRace, options: Options = {}): Promise<LiveRaceView> {
  /** Approved database and authenticated invitation identity. */
  const db = options.db ?? admin.firestore();
  /** Existing creator ticket remains the canonical shared lobby and match id. */
  const creatorId = invitationTicketId(input.challengeId!);
  return db.runTransaction(async transaction => {
    /** Creator seat is locked together with the recipient's active-seat pointer. */
    const {snapshot, ticket: creator} = await readInvitation(db, transaction, userId, creatorId);
    if (creator.userId === userId) throw new HttpsError("failed-precondition", "Cannot accept your own challenge.");
    if (input.locale !== creator.run.locale || input.categoryId !== creator.run.categoryId)
      throw new HttpsError("failed-precondition", "Use the invitation's content selection.");
    /** Clock cannot move backwards across creator heartbeats. */
    const nowMs = liveOperationAtMs(creator, undefined, options.nowMs ?? Date.now());
    /** Existing accepted match is recovered before checking invitation expiry. */
    const existing = creator.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${creator.matchId}`))).data() as LiveMatch | undefined : undefined;
    if (existing) {
      if (existing.runs[1].userId !== userId) throw new HttpsError("failed-precondition", "Challenge already accepted.");
      /** Recovery returns the original recipient seat without restarting the countdown. */
      const ownId = existing.tickets[1]!;
      /** Server ticket supplies ownership, never the untrusted caller request id. */
      const own = (await transaction.get(db.doc(`liveRaceTickets/${ownId}`))).data() as LiveTicket;
      return liveView(ownId, own, existing, nowMs);
    }
    if (creator.cancelled || nowMs >= creator.createdAtMs + LIVE_RACE_INVITE_MS)
      throw new HttpsError("failed-precondition", "Challenge expired or cancelled.");
    if (nowMs > creator.seenAtMs + 30_000) throw new HttpsError("unavailable", "Challenge creator is reconnecting.");
    /** New acceptances must not replace another active PvP journey. */
    const pointer = db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`);
    /** Receipt remains tied to one authenticated recipient and invitation. */
    const ownId = requestDocumentId(userId, input.requestId);
    /** Account profile and existing idempotency receipt are read before writes. */
    const [current, owner, receipt] = await Promise.all([transaction.get(pointer), transaction.get(db.doc(`users/${userId}`)),
      transaction.get(db.doc(`liveRaceTickets/${ownId}`))]);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    if (receipt.exists) throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
    if (current.data()?.ticketId) {
      /** Active journey cannot be orphaned by an invitation acceptance. */
      const old = (await transaction.get(db.doc(`liveRaceTickets/${current.data()!.ticketId}`))).data() as LiveTicket | undefined;
      /** Completed or retired seats may be replaced. */
      const match = old?.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${old.matchId}`))).data() as LiveMatch | undefined : undefined;
      if (old && !old.cancelled && !(old.privateChallenge && !match && nowMs >= old.createdAtMs + LIVE_RACE_INVITE_MS) &&
        (!match || match.winner === undefined))
        throw new HttpsError("failed-precondition", "Finish the current live race first.");
    }
    /** Identity comes from the authenticated server account. */
    const data = owner.data()!;
    /** Safe identity snapshot for the creator's lobby. */
    const player = {displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
      avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0};
    /** Both seats receive the creator's immutable deck and the same five-second countdown. */
    const startsAtMs = nowMs + LIVE_RACE_COUNTDOWN_MS;
    /** Private match uses the existing authoritative scoring and settlement lifecycle. */
    const match: LiveMatch = {tickets: [creatorId, ownId], startsAtMs, observedAtMs: nowMs, players: [creator.player, player],
      runs: [liveRun(creator.run, creator.userId, creatorId, startsAtMs), liveRun(creator.run, userId, ownId, startsAtMs)]};
    /** Recipient seat does not expose the creator's share handle as its own invitation. */
    const own: LiveTicket = {userId, pool: creator.pool, player, createdAtMs: nowMs, seenAtMs: nowMs, matchId: creatorId, run: match.runs[1]};
    /** Reuse the creator's retention policy for both seats. */
    const expiresAt = snapshot.data()!.expiresAt;
    transaction.update(snapshot.ref, {matchId: creatorId});
    transaction.create(db.doc(`liveRaceMatches/${creatorId}`), {...stripUndefined(match), expiresAt});
    transaction.create(db.doc(`liveRaceTickets/${ownId}`), {...stripUndefined(own), expiresAt});
    transaction.set(pointer, {ticketId: ownId, expiresAt});
    return liveView(ownId, own, match, nowMs);
  });
}

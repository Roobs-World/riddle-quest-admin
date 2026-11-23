import {androidReferralPlayPatch} from "../../../platforms/native/android/server/androidReferralIdentity";
import {publishLiveRaceSignals} from "./raceLiveSignals";
import {HttpsError} from "firebase-functions/v2/https";
import {facebookLiveContextSelection, prepareFacebookLiveContext, assertFacebookLiveContextSelection} from "../../../platforms/web/facebook/server/race/facebookLiveContextBinding";
import {LIVE_RACE_INVITE_MS, LIVE_RACE_COUNTDOWN_MS, LiveRaceChallengeSchema,
  type JoinLiveRace, type LiveRaceView, type LiveRaceChallenge} from "../../../src/core/race/index.js";
import {admin} from "../shared/firebaseAdmin";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../shared/accountDeletion";
import {raceProviderScope, assertAndroidRaceAccount} from "./raceEligibility";
import {requestDocumentId, stripUndefined, type Firestore} from "./raceSetupService";
import {liveOperationAtMs, liveRaceSearchEndsAtMs, liveRun, liveView, type LiveMatch, type LiveTicket} from "./raceLiveState";
import {assertLiveRaceDeckCompatible, isLiveRaceDeckCompatible} from "./raceDeckCompatibility";
import {readLiveJoinIntent, claimLiveJoinIntent} from "./raceLiveJoinIntent";
import {isLiveRaceRetained} from "./raceLiveQueue";

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
/** An owned link recovers only its still-active original lobby or unfinished match. */
function canResumeCreatorInvitation({ticketId, ticket, activeTicketId, match, nowMs}: {
  /** Original creator ticket selected by the opaque invitation handle. */
  ticketId: string;
  /** Retained creator lobby and its immutable content selection. */
  ticket: LiveTicket;
  /** Current account pointer that must still own this invitation. */
  activeTicketId: unknown;
  /** Already accepted match, if the invitation has a recipient. */
  match: LiveMatch | undefined;
  /** Server clock after applying the stored observation floor. */
  nowMs: number;
}): boolean {
  if (ticket.cancelled || activeTicketId !== ticketId) return false;
  if (ticket.matchId) return Boolean(match && match.tickets[0] === ticketId &&
    match.runs[0].userId === ticket.userId && match.winner === undefined);
  return nowMs < ticket.createdAtMs + LIVE_RACE_INVITE_MS;
}
/** Validates both authenticated providers and reciprocal safety boundaries before exposing identity. */
async function readInvitation(db: Firestore, transaction: FirebaseFirestore.Transaction, userId: string, ticketId: string, nowMs: number) {
  /** Server-only lobby receipt, never supplied as authority by the platform entry payload. */
  const snapshot = await transaction.get(db.doc(`liveRaceTickets/${ticketId}`));
  /** Authoritative invitation creator and immutable content selection. */
  const ticket = snapshot.data() as LiveTicket | undefined;
  if (!isLiveRaceRetained(snapshot, nowMs) || !ticket?.privateChallenge || raceProviderScope(userId) !== raceProviderScope(ticket.userId) ||
    ticket.inviteRecipientId && ![ticket.userId, ticket.inviteRecipientId].includes(userId) ||
    !(["jest", "facebook", "android"].includes(raceProviderScope(userId) ?? "") ||
      raceProviderScope(userId) === "reddit" && ticket.rematchOfTicketId && ticket.inviteRecipientId))
    throw new HttpsError("not-found", "Invitation unavailable.");
  /** Account deletion and blocks are checked in the same transaction as acceptance. */
  const [viewerDeleted, creatorDeleted, blocked, reverseBlocked, [creator, viewer]] = await Promise.all([
    transaction.get(getJestAccountDeletionRef(db, userId)), transaction.get(getJestAccountDeletionRef(db, ticket.userId)),
    transaction.get(db.doc(`users/${userId}/blockedRivals/${ticket.userId}`)),
    transaction.get(db.doc(`users/${ticket.userId}/blockedRivals/${userId}`)),
    transaction.getAll(db.doc(`users/${ticket.userId}`), db.doc(`users/${userId}`), {fieldMask: ["username", "level", "avatarUrl", "androidProvider"]}),
  ]);
  assertJestAccountActive(viewerDeleted);
  assertAndroidRaceAccount(userId, viewer.data());
  assertAndroidRaceAccount(ticket.userId, creator.data());
  if (creatorDeleted.exists || blocked.exists || reverseBlocked.exists || !creator.exists || ticket.rematchOfTicketId && !viewer.exists)
    throw new HttpsError("not-found", "Invitation unavailable.");
  /** Rematch notices use current game-owned identity, while legacy invitations retain their established projection. */
  const data = creator.data()!;
  /** No copied historical profile may outlive a current rematch account projection. */
  const player = ticket.rematchOfTicketId ? {displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
    level: Number.isInteger(data.level) && data.level > 0 ? data.level : 1,
    avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0} : ticket.player;
  return {snapshot, ticket, player, viewer};
}
/** Reads a challenge notice without joining; the recipient chooses whether to accept. */
export async function getLiveRaceChallengeForUser(userId: string, challengeId: string, options: Options = {}) {
  /** Approved server database. */
  const db = options.db ?? admin.firestore();
  return db.runTransaction(async transaction => {
    /** Private invitation and creator are validated before returning any display identity. */
    const ticketId = invitationTicketId(challengeId);
    /** Validated invitation, retained snapshot and safe creator identity. */
    const {snapshot, ticket, player} = await readInvitation(db, transaction, userId, ticketId, options.nowMs ?? Date.now());
    /** Match determines whether this authenticated recipient already owns the second seat. */
    const matchSnapshot = ticket.matchId ? await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`)) : undefined;
    /** Existing shared match used to recognize accepted participants. */
    const match = matchSnapshot?.data() as LiveMatch | undefined;
    /** Monotonic preview time shared with invitation acceptance. */
    const nowMs = liveOperationAtMs(ticket, match, options.nowMs ?? Date.now());
    if (!isLiveRaceRetained(snapshot, nowMs) || matchSnapshot && (!isLiveRaceRetained(matchSnapshot, nowMs) ||
      match?.tickets[0] !== ticketId || match.runs[0].userId !== ticket.userId))
      throw new HttpsError("not-found", "Invitation unavailable.");
    /** Accepted SMS links reveal their invitation only to the two committed participants. */
    if (ticket.matchId && ticket.userId !== userId && match?.runs[1].userId !== userId)
      throw new HttpsError("not-found", "Invitation unavailable.");
    /** The same persisted clock floor governs preview and acceptance. */
    const current = ticket.userId === userId ? await transaction.get(db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`)) : undefined;
    /** Only new entry availability depends on the original deck; owned and accepted journeys remain recoverable. */
    let status: LiveRaceChallenge["status"] = ticket.userId === userId ?
      canResumeCreatorInvitation({ticketId, ticket, activeTicketId: current?.data()?.ticketId, match, nowMs}) ? "own" : "unavailable" :
      match?.runs[1].userId === userId && match.winner === undefined ? "accepted" :
      ticket.cancelled || ticket.matchId || nowMs >= ticket.createdAtMs + LIVE_RACE_INVITE_MS ? "unavailable" : "available";
    if (status === "available" && !isLiveRaceDeckCompatible(ticket.run)) status = "unavailable";
    return LiveRaceChallengeSchema.parse({challengeId, creator: player, locale: ticket.run.locale,
      categoryId: ticket.run.categoryId, expiresAtMs: ticket.createdAtMs + LIVE_RACE_INVITE_MS,
      status});
  });
}
/** Recovers an exact creator lobby or atomically reserves its sole recipient seat. */
export async function acceptLiveRaceChallengeForUser(userId: string, input: JoinLiveRace, options: Options = {}): Promise<LiveRaceView> {
  if (input.expectedOwnerId && input.expectedOwnerId !== userId)
    throw new HttpsError("permission-denied", "Live race account changed.");
  /** Invitation recipients keep their own synchronized Facebook score destination. */
  const contextKey = facebookLiveContextSelection(userId, input.facebookContextId);
  /** Approved database and authenticated invitation identity. */
  const db = options.db ?? admin.firestore();
  /** Existing creator ticket remains the canonical shared lobby and match id. */
  const creatorId = invitationTicketId(input.challengeId!);
  return db.runTransaction(async transaction => {
    /** Creator seat is locked together with the recipient's active-seat pointer. */
    const [intent, {snapshot, ticket: creator, player: creatorPlayer, viewer: owner}] = await Promise.all([
      readLiveJoinIntent(db, transaction, userId, input), readInvitation(db, transaction, userId, creatorId, options.nowMs ?? Date.now())]);
    if (input.locale !== creator.run.locale || input.categoryId !== creator.run.categoryId)
      throw new HttpsError("failed-precondition", "Use the invitation's content selection.");
    /** Existing accepted match is recovered before checking invitation expiry. */
    const matchSnapshot = creator.matchId ? await transaction.get(db.doc(`liveRaceMatches/${creator.matchId}`)) : undefined;
    /** Original accepted match recovered before checking lobby expiry. */
    const existing = matchSnapshot?.data() as LiveMatch | undefined;
    /** Clock cannot move backwards across creator heartbeats or accepted match progress. */
    const nowMs = liveOperationAtMs(creator, existing, options.nowMs ?? Date.now());
    if (!isLiveRaceRetained(snapshot, nowMs) || matchSnapshot && (!isLiveRaceRetained(matchSnapshot, nowMs) ||
      existing?.tickets[0] !== creatorId || existing.runs[0].userId !== creator.userId))
      throw new HttpsError("not-found", "Invitation unavailable.");
    if (creator.userId === userId) {
      /** Creator account pointer that prevents an old link replacing a newer seat. */
      const current = await transaction.get(db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`));
      if (!canResumeCreatorInvitation({ticketId: creatorId, ticket: creator, activeTicketId: current.data()?.ticketId, match: existing, nowMs}))
        throw new HttpsError("failed-precondition", "Challenge expired or cancelled.");
      assertFacebookLiveContextSelection(creator.facebookContext, contextKey);
      if (intent?.record?.ticketId && intent.record.ticketId !== creatorId)
        throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
      transaction.update(snapshot.ref, {seenAtMs: nowMs});
      if (existing) transaction.update(db.doc(`liveRaceMatches/${creator.matchId}`), {observedAtMs: nowMs});
      claimLiveJoinIntent(transaction, intent, snapshot.ref, nowMs);
      return liveView(creatorId, creator, existing, nowMs);
    }
    if (existing) {
      if (existing.runs[1].userId !== userId) throw new HttpsError("failed-precondition", "Challenge already accepted.");
      /** Recovery returns the original recipient seat without restarting the countdown. */
      const ownId = existing.tickets[1]!;
      /** Server ticket supplies ownership, never the untrusted caller request id. */
      const ownSnapshot = await transaction.get(db.doc(`liveRaceTickets/${ownId}`));
      /** Recipient ticket whose owner and match must agree with the invitation. */
      const own = ownSnapshot.data() as LiveTicket | undefined;
      if (!isLiveRaceRetained(ownSnapshot, nowMs) || !own || own.userId !== userId || own.matchId !== creator.matchId)
        throw new HttpsError("not-found", "Invitation unavailable.");
      assertFacebookLiveContextSelection(own.facebookContext, contextKey);
      if (intent?.record?.ticketId && intent.record.ticketId !== ownId)
        throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
      claimLiveJoinIntent(transaction, intent, db.doc(`liveRaceTickets/${ownId}`), nowMs);
      return liveView(ownId, own, existing, nowMs);
    }
    if (creator.cancelled || nowMs >= creator.createdAtMs + LIVE_RACE_INVITE_MS)
      throw new HttpsError("failed-precondition", "Challenge expired or cancelled.");
    if (nowMs > creator.seenAtMs + 30_000) throw new HttpsError("unavailable", "Challenge creator is reconnecting.");
    /** New acceptances must not replace another active PvP journey. */
    const pointer = db.doc(`liveRacePlayers/${requestDocumentId(userId, "active-live-race")}`);
    /** Receipt remains tied to one authenticated recipient and invitation. */
    const ownId = requestDocumentId(userId, input.requestId);
    /** The same transaction already read and locked viewer identity; only pointer and receipt remain. */
    const [current, receipt] = await Promise.all([transaction.get(pointer), transaction.get(db.doc(`liveRaceTickets/${ownId}`))]);
    if (!owner.exists) throw new HttpsError("not-found", "Player profile unavailable.");
    if (receipt.exists) throw new HttpsError("failed-precondition", "Request belongs to another live seat.");
    if (current.data()?.ticketId) {
      /** Active journey cannot be orphaned by an invitation acceptance. */
      const oldSnapshot = await transaction.get(db.doc(`liveRaceTickets/${current.data()!.ticketId}`));
      /** Previously owned seat inspected before replacing the active pointer. */
      const old = oldSnapshot.data() as LiveTicket | undefined;
      /** Completed or retired seats may be replaced. */
      const oldMatchSnapshot = old?.matchId ? await transaction.get(db.doc(`liveRaceMatches/${old.matchId}`)) : undefined;
      /** Previous match whose unfinished state prevents another acceptance. */
      const match = oldMatchSnapshot?.data() as LiveMatch | undefined;
      if (old && isLiveRaceRetained(oldSnapshot, nowMs) && !old.cancelled && (old.matchId
        ? oldMatchSnapshot && isLiveRaceRetained(oldMatchSnapshot, nowMs) && match?.winner === undefined
        : liveRaceSearchEndsAtMs(old) > nowMs))
        throw new HttpsError("failed-precondition", "Finish the current live race first.");
    }
    assertLiveRaceDeckCompatible(creator.run);
    /** Recipient membership is captured before any acceptance writes. */
    const facebookContext = await prepareFacebookLiveContext(transaction, db, userId, input.locale, contextKey, nowMs);
    /** Identity comes from the authenticated server account. */
    const data = owner.data()!;
    /** Safe identity snapshot for the creator's lobby. */
    const player = {displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
      level: typeof data.level === "number" && Number.isInteger(data.level) && data.level > 0 ? data.level : 1,
      avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0};
    /** Both seats receive the creator's immutable deck and the same five-second countdown. */
    const startsAtMs = nowMs + LIVE_RACE_COUNTDOWN_MS;
    /** Private match uses the existing authoritative scoring and settlement lifecycle. */
    const match: LiveMatch = {tickets: [creatorId, ownId], participantIds: [creator.userId, userId], startsAtMs, observedAtMs: nowMs, players: [creatorPlayer, player],
      runs: [liveRun(creator.run, creator.userId, creatorId, startsAtMs), liveRun(creator.run, userId, ownId, startsAtMs)]};
    /** Recipient seat does not expose the creator's share handle as its own invitation. */
    const own: LiveTicket = {userId, pool: creator.pool, player, ...(facebookContext ? {facebookContext} : {}),
      createdAtMs: nowMs, seenAtMs: nowMs, matchId: creatorId, run: match.runs[1]};
    /** Reuse the creator's retention policy for both seats. */
    const expiresAt = snapshot.data()!.expiresAt;
    /** Accepting a native race closes acquisition before the recipient seat is published. */
    const referralActivity = androidReferralPlayPatch(owner.data() ?? {});
    if (referralActivity.androidReferralPlayed) transaction.update(owner.ref, referralActivity);
    transaction.update(snapshot.ref, {matchId: creatorId});
    transaction.create(db.doc(`liveRaceMatches/${creatorId}`), {...stripUndefined(match), expiresAt});
    transaction.create(db.doc(`liveRaceTickets/${ownId}`), {...stripUndefined(own), expiresAt});
    claimLiveJoinIntent(transaction, intent, db.doc(`liveRaceTickets/${ownId}`), nowMs);
    transaction.set(pointer, {ticketId: ownId, expiresAt});
    publishLiveRaceSignals(db, transaction, match.tickets, expiresAt);
    return liveView(ownId, own, match, nowMs);
  });
}

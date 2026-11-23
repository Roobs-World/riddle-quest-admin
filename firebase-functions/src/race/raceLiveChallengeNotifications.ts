import {isAndroidAccountProvider} from "../../../platforms/native/android/server/androidUser";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {LIVE_RACE_INVITE_MS, type LiveRaceChallenge} from "../../../src/core/race/index.js";
import {createUsernameReservationId, normalizeUsernameForReservation} from "../profile/usernameReservations";
import {assertJestAccountActive, getJestAccountDeletionRef} from "../shared/accountDeletion";
import {raceProviderScope} from "./raceEligibility";
import {getLiveRaceChallengeForUser} from "./raceLiveInvitation";
import {type LiveTicket} from "./raceLiveState";

/** Durable server work contains identities but never client-supplied notification copy or URLs. */
export type LiveChallengePushEvent = {
  /** Canonical lobby handle. */ challengeId: string;
  /** Authenticated creator. */ creatorId: string;
  /** Recipient resolved from the server username reservation. */ recipientId: string;
  /** Authority-owned invitation deadline. */ expiresAtMs: number;
  /** Original issuance is retained unchanged for provider replay protection. */ createdAtMs: number;
  /** One irreversible attempt avoids duplicate pushes after ambiguous transport failures. */ status: "queued" | "sending" | "submitted" | "unconfirmed" | "skipped";
};

/** Atomically reserves the recipient, inbox entry and one notification event for an owned private lobby. */
export async function sendLiveRaceChallengeForUser(db: Firestore, userId: string,
  input: {
    /** Server-owned lobby. */
    challengeId: string;
    /** Existing game username. */
    recipientUsername: string;
  }, nowMs = Date.now()) {
  if (!/^live_[a-f0-9]{64}$/.test(input.challengeId)) throw new HttpsError("invalid-argument", "Invalid invitation.");
  /** Stable lookup uses the same canonical normalization as username ownership. */
  const reservationId = createUsernameReservationId(input.recipientUsername);
  return db.runTransaction(async tx => {
    /** Invitation authority and username reservation are read before any writes. */
    const [seat, reservation] = await Promise.all([tx.get(db.doc(`liveRaceTickets/${input.challengeId.slice(5)}`)),
      tx.get(db.doc(`usernameReservations/${reservationId}`))]);
    /** Raw provider IDs and Firebase UIDs are never accepted from the browser. */
    const ticket = seat.data() as LiveTicket | undefined, recipientId = reservation.data()?.userId;
    if (!ticket?.privateChallenge || ticket.userId !== userId || typeof recipientId !== "string" || recipientId === userId ||
        !["jest", "facebook", "android"].includes(raceProviderScope(userId) ?? "") || raceProviderScope(recipientId) !== raceProviderScope(userId))
      throw new HttpsError("not-found", "Invitation recipient unavailable.");
    /** Accounts, blocks and rate receipts share the recipient binding transaction. */
    const rateRef = db.doc(`users/${userId}/liveChallengeRate/current`);
    /** Exactly one outbox event belongs to this lobby. */
    const eventRef = db.doc(`liveRacePushOutbox/${seat.id}`);
    /** Independent recipient throttling bounds notifications from multiple inviters. */
    const recipientRateRef = db.doc(`users/${recipientId}/liveChallengeInboxRate/current`);
    /** Account, safety and receipt snapshots read before transaction writes. */
    const [creator, recipient, deleted, recipientDeleted, blocked, reverse, rate, existing, recipientRate] = await Promise.all([
      tx.get(db.doc(`users/${userId}`)), tx.get(db.doc(`users/${recipientId}`)), tx.get(getJestAccountDeletionRef(db, userId)),
      tx.get(getJestAccountDeletionRef(db, recipientId)), tx.get(db.doc(`users/${userId}/blockedRivals/${recipientId}`)),
      tx.get(db.doc(`users/${recipientId}/blockedRivals/${userId}`)), tx.get(rateRef), tx.get(eventRef), tx.get(recipientRateRef),
    ]);
    assertJestAccountActive(deleted);
    if ((raceProviderScope(userId) === "android" && (!isAndroidAccountProvider(creator.data()?.androidProvider) || !isAndroidAccountProvider(recipient.data()?.androidProvider))) ||
        !creator.exists || !recipient.exists || recipientDeleted.exists || blocked.exists || reverse.exists ||
        recipient.data()?.usernameReservationId !== reservationId || typeof recipient.data()?.username !== "string" ||
        normalizeUsernameForReservation(recipient.data()!.username) !== normalizeUsernameForReservation(input.recipientUsername))
      throw new HttpsError("not-found", "Invitation recipient unavailable.");
    if (ticket.inviteRecipientId && ticket.inviteRecipientId !== recipientId)
      throw new HttpsError("failed-precondition", "Invitation already addressed.");
    /** A lost callable reply recovers the exact original work without sending again or charging quota. */
    if (existing.exists) {
      if (existing.data()?.recipientId !== recipientId || existing.data()?.creatorId !== userId)
        throw new HttpsError("failed-precondition", "Invitation receipt conflict.");
      return {status: "queued" as const};
    }
    /** Completed, cancelled, unattended or expired lobbies cannot enqueue an actionable push. */
    const expiresAtMs = ticket.createdAtMs + LIVE_RACE_INVITE_MS;
    if (ticket.cancelled || ticket.matchId || nowMs >= expiresAtMs || nowMs > ticket.seenAtMs + 30_000)
      throw new HttpsError("failed-precondition", "Invitation unavailable.");
    /** Five new direct invitations per creator per hour bounds unsolicited delivery. */
    const freshWindow = typeof rate.data()?.resetAtMs === "number" && rate.data()!.resetAtMs > nowMs;
    /** New invitation count for the current rate window. */
    const count = freshWindow ? Number(rate.data()?.count ?? 0) : 0;
    if (!Number.isSafeInteger(count) || count < 0 || count >= 5) throw new HttpsError("resource-exhausted", "Try again later.");
    if (typeof recipientRate.data()?.lastAtMs === "number" && recipientRate.data()!.lastAtMs > nowMs - 60_000)
      throw new HttpsError("resource-exhausted", "Try again later.");
    tx.set(rateRef, {count: count + 1, resetAtMs: freshWindow ? rate.data()!.resetAtMs : nowMs + 3_600_000});
    tx.set(recipientRateRef, {lastAtMs: nowMs});
    tx.update(seat.ref, {inviteRecipientId: recipientId});
    tx.set(db.doc(`users/${recipientId}/liveRaceInvitations/${seat.id}`), {challengeId: input.challengeId,
      createdAtMs: nowMs, expiresAt: Timestamp.fromMillis(expiresAtMs)});
    tx.create(eventRef, {challengeId: input.challengeId, creatorId: userId, recipientId, expiresAtMs,
      status: "queued", createdAtMs: nowMs, expiresAt: Timestamp.fromMillis(expiresAtMs + 86_400_000)} satisfies LiveChallengePushEvent & Record<string, unknown>);
    return {status: "queued" as const};
  });
}

/** Reads bounded invitations through the same safety checks as SDK deep links; reading never accepts. */
export async function listLiveRaceChallengesForUser(db: Firestore, userId: string, nowMs = Date.now()): Promise<LiveRaceChallenge[]> {
  /** Query is confined to the authenticated account and uses one single-field index. */
  const rows = await db.collection(`users/${userId}/liveRaceInvitations`).orderBy("createdAtMs", "desc").limit(10).get();
  /** Expired, blocked, deleted and consumed entries are omitted without exposing the failed authority. */
  const results = await Promise.allSettled(rows.docs.map(row => getLiveRaceChallengeForUser(userId, row.data().challengeId, {db, nowMs})));
  return results.flatMap(result => result.status === "fulfilled" && ["available", "accepted"].includes(result.value.status) ? [result.value] : []);
}

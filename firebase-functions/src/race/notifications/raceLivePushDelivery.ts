import {isAndroidAccountProvider} from "../../../../platforms/native/android/server/androidUser";
import {type Firestore} from "firebase-admin/firestore";
import {getJestAccountDeletionRef} from "../../shared/accountDeletion";
import {raceProviderScope} from "../access/raceProviderScope";
import {type LiveChallengePushEvent} from "../invitations/raceLiveChallengeNotifications";
import {LIVE_RACE_INVITE_MS} from "../../../../src/races/contracts/index.js";
import {type LiveTicket} from "../live/raceLiveState";
import {liveChallengePushCopy} from "./raceLivePushCopy";

/** Server-resolved notification content for the recipient's platform API. */
export type LiveChallengePushDelivery = {
  /** Committed recipient and lobby. */ event: LiveChallengePushEvent;
  /** Recipient-language notification headline. */ title: string;
  /** Recipient-language acceptance instruction. */ body: string;
};
/** Provider outcome is deliberately separate from actual delivery to the player. */
export type LiveChallengePushResult = "submitted" | "unconfirmed" | "skipped";

/** Claims a committed challenge once; uncertain or crashed sends can never be blindly replayed. */
export async function deliverLiveRacePush(db: Firestore, eventId: string,
  send: (input: LiveChallengePushDelivery) => Promise<LiveChallengePushResult>, nowMs = Date.now()): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(eventId)) return;
  /** Only server-written events are accepted. */
  const ref = db.doc(`liveRacePushOutbox/${eventId}`);
  /** Transactionally admitted work with resolved content and consent. */
  const delivery = await db.runTransaction(async tx => {
    /** Firestore redelivery observes the terminal claim before contacting a provider. */
    const snapshot = await tx.get(ref), event = snapshot.data() as LiveChallengePushEvent | undefined;
    if (!event || event.status !== "queued") return null;
    if (event.challengeId !== `live_${eventId}` || !Number.isSafeInteger(event.createdAtMs) || event.createdAtMs > nowMs ||
        !["facebook", "android"].includes(raceProviderScope(event.recipientId) ?? "") ||
        raceProviderScope(event.creatorId) !== raceProviderScope(event.recipientId)) {tx.update(ref, {status: "skipped"}); return null;}
    /** Content, targeting, consent and safety are checked immediately before the irreversible claim. */
    const [seat, creator, recipient, deleted, creatorDeleted, blocked, reverse] = await Promise.all([
      tx.get(db.doc(`liveRaceTickets/${eventId}`)), tx.get(db.doc(`users/${event.creatorId}`)), tx.get(db.doc(`users/${event.recipientId}`)),
      tx.get(getJestAccountDeletionRef(db, event.recipientId)), tx.get(getJestAccountDeletionRef(db, event.creatorId)),
      tx.get(db.doc(`users/${event.creatorId}/blockedRivals/${event.recipientId}`)), tx.get(db.doc(`users/${event.recipientId}/blockedRivals/${event.creatorId}`)),
    ]);
    /** Outbox data cannot manufacture an invitation or change the original deadline. */
    const ticket = seat.data() as LiveTicket | undefined;
    if ((raceProviderScope(event.recipientId) === "android" && (!isAndroidAccountProvider(recipient.data()?.androidProvider) || !isAndroidAccountProvider(creator.data()?.androidProvider))) ||
        !ticket?.privateChallenge || ticket.userId !== event.creatorId || ticket.inviteRecipientId !== event.recipientId ||
        ticket.cancelled || ticket.matchId || event.expiresAtMs !== ticket.createdAtMs + LIVE_RACE_INVITE_MS || nowMs >= event.expiresAtMs ||
        nowMs > ticket.seenAtMs + 30_000 || !creator.exists || !recipient.exists || recipient.data()?.notificationsEnabled === false ||
        deleted.exists || creatorDeleted.exists || blocked.exists || reverse.exists) {
      tx.update(ref, {status: "skipped"}); return null;
    }
    /** Raw display names cannot inject control characters into provider copy. */
    const name = typeof creator.data()?.username === "string" ? creator.data()!.username.replace(/[\r\n\t]/g, " ").slice(0, 80) : "Riddle Quest";
    /** Recipient-language notification copy. */
    const copy = liveChallengePushCopy(recipient.data()?.preferredLanguage, name);
    tx.update(ref, {status: "sending", attemptedAtMs: nowMs});
    return {event, ...copy};
  });
  if (!delivery) return;
  /** A timeout may have delivered already; provider exceptions become terminal uncertainty. */
  let outcome: LiveChallengePushResult = "unconfirmed";
  try {outcome = await send(delivery);} catch { /* Never log a token, provider body or credential-bearing URL. */ }
  await db.runTransaction(async tx => {
    /** Account cleanup or another invocation cannot recreate a removed receipt. */
    const current = await tx.get(ref);
    if (current.data()?.status === "sending") tx.update(ref, {status: outcome, finishedAtMs: Date.now()});
  });
}

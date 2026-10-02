import {createHash} from "node:crypto";
import {type Firestore} from "firebase-admin/firestore";
import {getJestAccountDeletionRef} from "../jest/jestAccountDeletion";
import {createFacebookNotificationTransport} from "../facebook/facebookNotificationTransport";
import {createFacebookNotificationDispatchLedger} from "../facebook/facebookNotificationDispatch";
import {isFacebookFeatureEnabled} from "../facebook/facebookFeatureFlags";
import {raceProviderScope} from "./raceEligibility";
import {type LiveChallengePushEvent} from "./raceLiveChallengeNotifications";
import {LIVE_RACE_INVITE_MS} from "@qwordly/core/race";
import {type LiveTicket} from "./raceLiveState";
import {liveChallengePushCopy} from "./raceLivePushCopy";

/** Server-resolved push contents and browser token, never a caller URL or provider identity. */
export type LiveChallengePushDelivery = {
  /** Committed recipient and lobby. */ event: LiveChallengePushEvent;
  /** Recipient-language notification headline. */ title: string;
  /** Recipient-language acceptance instruction. */ body: string;
  /** Optional self-managed browser registration. */ token?: string;
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
        !["jest", "facebook"].includes(raceProviderScope(event.recipientId) ?? "") ||
        raceProviderScope(event.creatorId) !== raceProviderScope(event.recipientId)) {tx.update(ref, {status: "skipped"}); return null;}
    /** Content, targeting, consent and safety are checked immediately before the irreversible claim. */
    const [seat, creator, recipient, deleted, creatorDeleted, blocked, reverse, subscription] = await Promise.all([
      tx.get(db.doc(`liveRaceTickets/${eventId}`)), tx.get(db.doc(`users/${event.creatorId}`)), tx.get(db.doc(`users/${event.recipientId}`)),
      tx.get(getJestAccountDeletionRef(db, event.recipientId)), tx.get(getJestAccountDeletionRef(db, event.creatorId)),
      tx.get(db.doc(`users/${event.creatorId}/blockedRivals/${event.recipientId}`)), tx.get(db.doc(`users/${event.recipientId}/blockedRivals/${event.creatorId}`)),
      tx.get(db.doc(`users/${event.recipientId}/livePushSubscriptions/current`)),
    ]);
    /** Outbox data cannot manufacture an invitation or change the original deadline. */
    const ticket = seat.data() as LiveTicket | undefined;
    if (!ticket?.privateChallenge || ticket.userId !== event.creatorId || ticket.inviteRecipientId !== event.recipientId ||
        ticket.cancelled || ticket.matchId || event.expiresAtMs !== ticket.createdAtMs + LIVE_RACE_INVITE_MS || nowMs >= event.expiresAtMs ||
        nowMs > ticket.seenAtMs + 30_000 || !creator.exists || !recipient.exists || deleted.exists || creatorDeleted.exists || blocked.exists || reverse.exists) {
      tx.update(ref, {status: "skipped"}); return null;
    }
    /** Missing browser consent never falls back to sending Jest SDK messages to another user. */
    const consent = subscription.data();
    /** Fresh browser subscription resolved from recipient consent. */
    const token = consent?.enabled === true && consent.updatedAtMs > nowMs - 30 * 86_400_000 &&
      typeof consent.token === "string" && consent.token.length >= 20 && consent.token.length <= 4096 ? consent.token : undefined;
    /** Latest signed-in owner of this browser token. */
    const tokenBinding = token ? await tx.get(db.doc(`liveRacePushTokens/${createHash("sha256").update(token).digest("hex")}`)) : undefined;
    if (raceProviderScope(event.recipientId) === "jest" && (!token || tokenBinding?.data()?.uid !== event.recipientId)) {
      tx.update(ref, {status: "skipped"}); return null;
    }
    /** Raw display names cannot inject control characters into provider copy. */
    const name = typeof creator.data()?.username === "string" ? creator.data()!.username.replace(/[\r\n\t]/g, " ").slice(0, 80) : "Riddle Quest";
    /** Recipient-language notification copy. */
    const copy = liveChallengePushCopy(recipient.data()?.preferredLanguage, name);
    tx.update(ref, {status: "sending", attemptedAtMs: nowMs});
    return {event, ...copy, ...(token ? {token} : {})};
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

/** Sends through Meta's fixed Gaming Domain endpoint using a canonical identity and the existing consent ledger. */
export async function sendFacebookLiveChallengePush(db: Firestore, delivery: LiveChallengePushDelivery, options: {
  /** Configured Meta app. */ appId: string;
  /** Server-only UID derivation secret. */ uidSecret: string;
  /** Server-only notification credential. */ appAccessToken: string;
  /** Explicit notification rollout. */ enabled: boolean;
  /** Test-only provider HTTP boundary; credentials still have a fixed destination. */ fetch?: typeof fetch;
}): Promise<LiveChallengePushResult> {
  if (!options.enabled || !isFacebookFeatureEnabled("notifications")) return "skipped";
  /** A bounded UID lookup uses the canonical signed-identity collection. */
  const links = await db.collection("providerIdentities").where("uid", "==", delivery.event.recipientId).limit(2).get();
  /** Unique server-owned provider identity link. */
  const identity = links.docs.length === 1 ? links.docs[0].data() : undefined;
  if (identity?.provider !== "facebook" || identity.status !== "active" || identity.appId !== options.appId) return "skipped";
  /** Exact request bytes are bound to the recipient's one-time ledger admission. */
  const label = `riddlequest_live_${delivery.event.challengeId.slice(5, 37)}`, payload = JSON.stringify({challengeId: delivery.event.challengeId});
  /** Exact documented provider request before hashing. */
  const body = {player_id: identity.providerPlayerId, message: {title: delivery.title, body: delivery.body}, label, payload};
  /** Stable provider admission work preserves original server issuance. */
  const request = {attemptId: delivery.event.challengeId, issuedAtMs: delivery.event.createdAtMs, operation: "send" as const, label,
    requestDigest: createHash("sha256").update(JSON.stringify(body)).digest("hex")};
  /** Consent, deletion and capacity boundary for this recipient. */
  const ledger = createFacebookNotificationDispatchLedger(db, {uid: delivery.event.recipientId,
    playerId: identity.providerPlayerId, accountGeneration: identity.accountGeneration}, {appId: options.appId, uidSecret: options.uidSecret});
  /** Only admitted sends can finish a provider receipt. */
  let claimed = false;
  /** One fixed-host provider attempt with conservative acknowledgement handling. */
  const transport = createFacebookNotificationTransport({appId: options.appId, getAppAccessToken: async () => options.appAccessToken,
    isProviderReady: () => options.enabled, allowUnconfirmedResponse: true, fetch: options.fetch,
    authorizeAttempt: async scope => {
      // The transport snapshots and hashes its actual body before awaiting this
      // callback. Content or recipient drift must not consume the original work.
      if (scope.operation !== request.operation || scope.requestDigest !== request.requestDigest) return false;
      claimed = await ledger.claim(request); return claimed;
    }});
  /** The public Meta docs do not specify an acknowledgement body; preserve uncertainty instead of guessing success. */
  const result = await transport.send({playerId: identity.providerPlayerId, message: body.message, label, payload});
  if (claimed) await ledger.finish(request, result);
  return result.outcome === "confirmed" ? "submitted" : result.outcome === "not-sent" ? "skipped" : "unconfirmed";
}

import {createHash} from "node:crypto";
import type {Firestore} from "firebase-admin/firestore";
import {createFacebookNotificationTransport} from "../facebookNotificationTransport";
import {createFacebookNotificationDispatchLedger} from "../facebookNotificationDispatch";
import {isFacebookFeatureEnabled} from "../facebookFeatureFlags";
import type {LiveChallengePushDelivery, LiveChallengePushResult} from "../../../../../firebase-functions/src/race/notifications/raceLivePushDelivery";

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
      claimed = await ledger.claim(request);
      if (!claimed) return false;
      const recipient = await db.doc(`users/${delivery.event.recipientId}`).get();
      return recipient.exists && recipient.data()?.notificationsEnabled !== false;
    }});
  /** The public Meta docs do not specify an acknowledgement body; preserve uncertainty instead of guessing success. */
  const result = await transport.send({playerId: identity.providerPlayerId, message: body.message, label, payload});
  if (claimed) await ledger.finish(request, result);
  return result.outcome === "confirmed" ? "submitted" : result.outcome === "not-sent" ? "skipped" : "unconfirmed";
}

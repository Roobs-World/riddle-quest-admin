import {Timestamp, type DocumentSnapshot, type Firestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {admin} from "../../../../../firebase-functions/src/shared/firebaseAdmin";
import {getAccountDeletionRef, isAccountDeletedError, runWithAccountOperationLease} from "../../../../../firebase-functions/src/shared/accountDeletion";
import {bridgeAuthorized, notificationBridgeSecret, pushDigest} from "../../../../../firebase-functions/src/notifications/notificationBridge";
import {isFacebookFeatureEnabled} from "../facebookFeatureFlags";
import {createFacebookNotificationTransport} from "../facebookNotificationTransport";
import {FacebookDispatch, FacebookDispatchResult} from "./managerProtocol";
import {facebookRegistration, facebookRouteIdentity} from "./managerRegistration";

const appSecret = defineSecret("FACEBOOK_APP_SECRET");
type Outcome = FacebookDispatchResult["outcome"];

/** Meta's documented A2U acknowledgement identifies the created notification. */
function creationConfirmed(_: unknown, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return "success" in value && value.success === true && "notification_id" in value &&
    typeof value.notification_id === "string" && /^[0-9]{1,128}$/u.test(value.notification_id);
}

function eligible(snapshot: DocumentSnapshot, input: FacebookDispatch): boolean {
  const registration = facebookRegistration(snapshot);
  return registration?.enabled === true && registration.revision === input.revision &&
    Math.min(registration.expiresAtMs, input.expiresAtMs) > Date.now() && isFacebookFeatureEnabled("notifications");
}

/** A concurrent replay can observe the saved outcome but cannot send a second request to Meta. */
async function dispatch(db: Firestore, input: FacebookDispatch): Promise<Outcome | "conflict"> {
  const provider = db.doc(`providerIdentities/${input.recipientHash}`);
  const initial = await provider.get();
  const identity = facebookRouteIdentity(initial);
  if (!identity) return "skipped";
  const user = db.doc(`users/${identity.uid}`);
  const receipt = user.collection("facebookManagerDeliveries").doc(input.notificationId);
  const digest = pushDigest(JSON.stringify(input));
  const previousOutcome = (stored: DocumentSnapshot): Outcome | "conflict" => {
    if (stored.get("digest") !== digest) return "conflict";
    const parsed = FacebookDispatchResult.safeParse({outcome: stored.get("outcome")});
    return parsed.success ? parsed.data.outcome : "uncertain";
  };
  const previous = await receipt.get();
  if (previous.exists) return previousOutcome(previous);
  if (!eligible(initial, input)) return "skipped";

  return runWithAccountOperationLease(identity.uid, 30, async () => {
    let duplicate: Outcome | "conflict" | undefined;
    let claimed = false;
    let admissionError = false;
    const transport = createFacebookNotificationTransport({
      appId: identity.appId, isProviderReady: () => input.expiresAtMs > Date.now(),
      getAppAccessToken: async () => {
        const secret = appSecret.value();
        if (!secret) throw new Error("facebook-credential-unavailable");
        return `${identity.appId}|${secret}`;
      },
      confirmResponse: creationConfirmed,
      authorizeAttempt: async () => {
        const admission = await db.runTransaction(async tx => {
          const [current, account, deleted, existing] = await Promise.all([tx.get(provider), tx.get(user),
            tx.get(getAccountDeletionRef(db, identity.uid)), tx.get(receipt)]);
          if (existing.exists) return {prior: previousOutcome(existing)};
          if (!eligible(current, input) || facebookRouteIdentity(current)?.uid !== identity.uid ||
              account.get("notificationsEnabled") !== true || deleted.exists) return {allowed: false};
          tx.create(receipt, {digest, outcome: "uncertain", createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromMillis(Date.now() + 31 * 86_400_000)});
          return {allowed: true};
        }).catch(() => {admissionError = true; throw new Error("facebook-admission-unavailable");});
        duplicate = admission.prior;
        claimed = admission.allowed === true;
        return claimed;
      },
    });
    const result = await transport.send({playerId: identity.playerId,
      label: `riddlequest_${input.notificationId.slice(0, 48)}`,
      message: {title: input.title, body: input.body, ...(input.imageUrl ? {media_url: input.imageUrl} : {})}});
    if (admissionError) throw new Error("facebook-admission-unavailable");
    if (duplicate) return duplicate;
    let outcome: Outcome;
    if (result.outcome === "confirmed") outcome = "accepted";
    else if (result.outcome === "not-sent") outcome = result.reason === "credentials-unavailable" ||
      result.reason === "invalid-request" ? "failed" : "skipped";
    else if ([400, 401, 403, 404].includes(result.httpStatus ?? 0)) outcome = "failed";
    else outcome = "uncertain";
    if (claimed) await receipt.update({outcome});
    return outcome;
  }, db);
}

/** Receives immutable manager campaigns at a server-authenticated endpoint. */
export const dispatchFacebookManagerNotification = onRequest({region: "europe-west1", minInstances: 0, timeoutSeconds: 60,
  secrets: [notificationBridgeSecret, appSecret], cors: false}, async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  if (request.get("Origin") || !bridgeAuthorized(request.get("Authorization"))) {
    response.status(401).json({error: "bridge-authorization-required"}); return;
  }
  const parsed = request.rawBody.length <= 8192 ? FacebookDispatch.safeParse(request.body) : null;
  if (!parsed?.success) {response.status(400).json({error: "notification-dispatch-invalid"}); return;}
  try {
    const outcome = await dispatch(admin.firestore(), parsed.data);
    if (outcome === "conflict") response.status(409).json({error: "notification-dispatch-conflict"});
    else response.json({outcome});
  } catch (error) {
    if (isAccountDeletedError(error)) response.json({outcome: "skipped"});
    else response.status(503).json({error: "notification-dispatch-unavailable"});
  }
});

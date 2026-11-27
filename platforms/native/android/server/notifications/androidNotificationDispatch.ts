import {createHash, timingSafeEqual} from "node:crypto";
import {Timestamp} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {admin} from "../../../../../firebase-functions/src/shared/firebaseAdmin";
import {runWithAccountOperationLease} from "../../../../../firebase-functions/src/shared/accountDeletion";
import {sendAndroidPush} from "../androidNotifications";
import {AndroidDispatch, type AndroidDispatchResult} from "../notificationManagerProtocol";
import {notificationManagerBridgeSecret} from "./androidNotificationBridge";
import {FcmDeliveryError, notificationFcmEdgeSecret} from "../../../../../firebase-functions/src/notifications/fcmEdgeDelivery";

/** The hosted manager supplies immutable content; Firebase retains token and account authority. */
export const dispatchAndroidNotification = onRequest({region: "europe-west1", minInstances: 0, timeoutSeconds: 60,
  secrets: [notificationManagerBridgeSecret, notificationFcmEdgeSecret], cors: false}, async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  const secret = notificationManagerBridgeSecret.value(), expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.get("Authorization") ?? "");
  if (secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    response.status(401).json({error: "bridge-authorization-required"}); return;
  }
  const parsed = request.rawBody.length <= 8192 ? AndroidDispatch.safeParse(request.body) : null;
  if (!parsed?.success) {response.status(400).json({error: "notification-dispatch-invalid"}); return;}
  const input = parsed.data, db = admin.firestore();
  const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const id = createHash("sha256").update(`${input.notificationId}:${input.tokenHash}`).digest("hex");
  const receipt = db.doc(`androidPushDeliveries/${id}`);
  try {
    const admission = await db.runTransaction(async tx => {
      const [previous, registration] = await Promise.all([tx.get(receipt), tx.get(db.doc(`androidPushTokens/${input.tokenHash}`))]);
      if (previous.exists) {
        if (previous.data()?.digest !== digest) return {kind: "conflict"} as const;
        const outcome = previous.data()?.outcome;
        return {kind: "finished", outcome: outcome === "accepted" || outcome === "failed" || outcome === "skipped" ? outcome : "uncertain"} as const;
      }
      const binding = registration.data();
      if (input.expiresAtMs <= Date.now() || binding?.enabled !== true || binding.revision !== input.revision || typeof binding.uid !== "string")
        return {kind: "finished", outcome: "skipped"} as const;
      tx.create(receipt, {digest, outcome: "uncertain", uid: binding.uid, createdAtMs: Date.now(),
        expiresAt: Timestamp.fromMillis(Math.max(Date.now(), input.expiresAtMs) + 30 * 86_400_000)});
      return {kind: "send", uid: binding.uid} as const;
    });
    if (admission.kind === "conflict") {response.status(409).json({error: "notification-dispatch-conflict"}); return;}
    if (admission.kind === "finished") {response.json({outcome: admission.outcome} satisfies AndroidDispatchResult); return;}
    let outcome: AndroidDispatchResult["outcome"] = "uncertain";
    try {
      const sent = await runWithAccountOperationLease(admission.uid, 30, () => sendAndroidPush(db, input.tokenHash, admission.uid, {
        version: "1", kind: "campaign", notificationId: input.notificationId, registrationRevision: String(input.revision),
        title: input.title, body: input.body, ...(input.imageUrl ? {imageUrl: input.imageUrl} : {}), expiresAtMs: String(input.expiresAtMs),
      }, "campaign", input.expiresAtMs - Date.now(), input.revision));
      outcome = sent ? "accepted" : "skipped";
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") outcome = "failed";
      if (error instanceof FcmDeliveryError && error.code === "messaging/invalid-argument") outcome = "failed";
    }
    await receipt.update({outcome, finishedAtMs: Date.now()});
    response.json({outcome} satisfies AndroidDispatchResult);
  } catch {response.status(503).json({error: "notification-dispatch-unavailable"});}
});

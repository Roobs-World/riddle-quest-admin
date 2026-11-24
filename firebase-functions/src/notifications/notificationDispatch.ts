import {Timestamp} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import webPush from "web-push";
import {FirebasePushDispatch, FirebasePushDispatchResult} from "../../../src/notifications/contracts/firebasePush";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../shared/accountDeletion";
import {AccountPushDevice} from "./notificationDevices";
import {bridgeAuthorized, browserPushConfiguration, notificationBridgeSecret, notificationVapidPrivateKey, notificationLaunchUrl, pushDigest, synchronizeFirebaseRegistration} from "./notificationBridge";

type DispatchOutcome = ReturnType<typeof FirebasePushDispatchResult.parse>["outcome"];

export const dispatchFirebaseNotification = onRequest({region: "europe-west1", minInstances: 0, timeoutSeconds: 60,
  secrets: [notificationBridgeSecret, notificationVapidPrivateKey], cors: false}, async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  if (!bridgeAuthorized(request.get("Authorization"))) {response.status(401).json({error: "bridge-authorization-required"}); return;}
  const parsed = request.rawBody.length <= 8192 ? FirebasePushDispatch.safeParse(request.body) : null;
  if (!parsed?.success || parsed.data.expiresAtMs > Date.now() + 6 * 3_600_000 + 60_000) {response.status(400).json({error: "notification-dispatch-invalid"}); return;}
  const input = parsed.data, db = admin.firestore(), digest = pushDigest(JSON.stringify(input));
  const receipt = db.doc(`accountPushDeliveries/${pushDigest(`${input.notificationId}:${input.deviceHash}`)}`);
  try {
    const admission = await db.runTransaction(async tx => {
      const ref = db.doc(`accountPushDevices/${input.deviceHash}`);
      const [previous, snapshot] = await Promise.all([tx.get(receipt), tx.get(ref)]);
      if (previous.exists) {
        if (previous.data()?.digest !== digest) return {kind: "conflict"} as const;
        const result = FirebasePushDispatchResult.safeParse({outcome: previous.data()?.outcome});
        return {kind: "finished", outcome: result.success ? result.data.outcome : "uncertain"} as const;
      }
      const device = AccountPushDevice.safeParse(snapshot.data());
      if (!device.success || !device.data.enabled || device.data.revision !== input.revision || device.data.expiresAtMs <= Date.now() || input.expiresAtMs <= Date.now())
        return {kind: "finished", outcome: "skipped"} as const;
      const [user, deleted] = await Promise.all([tx.get(db.doc(`users/${device.data.uid}`)), tx.get(getJestAccountDeletionRef(db, device.data.uid))]);
      if (!user.exists || user.data()?.notificationsEnabled === false || deleted.exists) return {kind: "finished", outcome: "skipped"} as const;
      tx.create(receipt, {digest, uid: device.data.uid, outcome: "uncertain", createdAtMs: Date.now(),
        expiresAt: Timestamp.fromMillis(Math.max(Date.now(), input.expiresAtMs) + 30 * 86_400_000)});
      return {kind: "send", uid: device.data.uid} as const;
    });
    if (admission.kind === "conflict") {response.status(409).json({error: "notification-dispatch-conflict"}); return;}
    if (admission.kind === "finished") {response.json({outcome: admission.outcome}); return;}
    let outcome: DispatchOutcome = "uncertain";
    try {
      outcome = await runWithJestAccountOperationLease(admission.uid, 30, async () => {
        const ref = db.doc(`accountPushDevices/${input.deviceHash}`);
        const [snapshot, user, deleted] = await Promise.all([ref.get(), db.doc(`users/${admission.uid}`).get(), getJestAccountDeletionRef(db, admission.uid).get()]);
        const device = AccountPushDevice.safeParse(snapshot.data());
        if (!device.success || device.data.uid !== admission.uid || !device.data.enabled || device.data.revision !== input.revision ||
            device.data.expiresAtMs <= Date.now() || input.expiresAtMs <= Date.now() || !user.exists || user.data()?.notificationsEnabled === false || deleted.exists) return "skipped";
        const payload = JSON.stringify({version: 1, kind: "notification", deviceHash: input.deviceHash, notificationId: input.notificationId, registrationRevision: input.revision,
          target: device.data.target, title: input.title, body: input.body, imageUrl: input.imageUrl, expiresAtMs: input.expiresAtMs,
          launchUrl: notificationLaunchUrl(device.data.target)});
        if (Buffer.byteLength(payload) > 3800) return "failed";
        const {subject, publicKey, privateKey} = browserPushConfiguration();
        await webPush.sendNotification(device.data.subscription, payload, {TTL: Math.max(1, Math.ceil((input.expiresAtMs - Date.now()) / 1000)),
          urgency: "normal", timeout: 8000, vapidDetails: {subject, publicKey, privateKey}});
        return "accepted";
      });
    } catch (error) {
      const status = error instanceof Error && "statusCode" in error ? error.statusCode : undefined;
      if (status === 404 || status === 410) {
        outcome = "failed";
        const retired = await db.runTransaction(async tx => {
          const ref = db.doc(`accountPushDevices/${input.deviceHash}`), snapshot = await tx.get(ref);
          const parsedDevice = AccountPushDevice.safeParse(snapshot.data());
          if (!parsedDevice.success || parsedDevice.data.uid !== admission.uid || parsedDevice.data.revision !== input.revision) return null;
          const device = parsedDevice.data, now = Date.now(), revision = Math.max(now, device.revision + 1);
          tx.update(ref, {enabled: false, revision, updatedAtMs: now, expiresAtMs: now, expiresAt: Timestamp.fromMillis(now)});
          return {version: 1, deviceHash: input.deviceHash, target: device.target, revision, enabled: false, locale: device.locale, expiresAtMs: now} as const;
        });
        if (retired) await synchronizeFirebaseRegistration(retired).catch(() => undefined);
      }
    }
    await receipt.update({outcome, finishedAtMs: Date.now()});
    response.json({outcome} satisfies ReturnType<typeof FirebasePushDispatchResult.parse>);
  } catch {response.status(503).json({error: "notification-dispatch-unavailable"});}
});

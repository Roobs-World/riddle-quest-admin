import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {z} from "zod";
import {FirebasePushTarget} from "../../../src/notifications/contracts/firebasePush";
import {admin} from "../shared/firebaseAdmin";
import {pushDigest, synchronizeFirebaseRegistration} from "./notificationBridge";

const Time = z.number().int().nonnegative().safe();
const LegacyDevice = z.object({
  target: FirebasePushTarget, locale: z.string().max(16), enabled: z.boolean(),
  revision: Time, expiresAtMs: Time, managerRevision: Time.optional(), managerExpiresAtMs: Time.optional(),
});

export const inactiveBrowserStatus = {registered: false, enabled: false, expiresAtMs: 0, revision: 0} as const;

/** A previously enrolled browser can revoke its own installation and retry a pending removal. */
export async function disableBrowserDevice(deviceToken: string) {
  const db = admin.firestore();
  const deviceHash = pushDigest(deviceToken);
  const ref = db.doc(`accountPushDevices/${deviceHash}`);
  const disabled = await db.runTransaction(async tx => {
    const row = await tx.get(ref);
    const parsed = LegacyDevice.safeParse(row.data());
    if (!parsed.success) return null;
    const device = parsed.data;
    const credentials = {subscription: FieldValue.delete(), fcmToken: FieldValue.delete()};
    if (!device.enabled) {
      if (row.get("subscription") !== undefined || row.get("fcmToken") !== undefined) tx.update(ref, credentials);
      return device;
    }
    const expiresAtMs = Date.now();
    const revision = Math.max(expiresAtMs, device.revision + 1);
    tx.update(ref, {enabled: false, revision, expiresAtMs, updatedAtMs: expiresAtMs,
      expiresAt: Timestamp.fromMillis(expiresAtMs), ...credentials});
    return {...device, enabled: false, revision, expiresAtMs};
  });
  if (!disabled) return inactiveBrowserStatus;
  if (disabled.managerRevision !== disabled.revision || (disabled.managerExpiresAtMs ?? disabled.expiresAtMs) !== disabled.expiresAtMs) {
    await synchronizeFirebaseRegistration({version: 1, deviceHash, target: disabled.target, locale: disabled.locale,
      enabled: false, revision: disabled.revision, expiresAtMs: disabled.expiresAtMs});
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.get("enabled") === false && current.get("revision") === disabled.revision) {
        tx.update(ref, {managerRevision: disabled.revision, managerExpiresAtMs: disabled.expiresAtMs});
      }
    });
  }
  return {...inactiveBrowserStatus, revision: disabled.revision, expiresAtMs: disabled.expiresAtMs};
}

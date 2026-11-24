import {ECDH} from "node:crypto";
import {Timestamp} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {FirebasePushBridgeInput, FirebasePushRegistration, FirebasePushSubscription, FirebasePushTarget} from "../../../src/notifications/contracts/firebasePush";
import {admin} from "../shared/firebaseAdmin";
import {getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../shared/accountDeletion";
import {PUSH_DEVICE_TTL_MS, pushDigest, synchronizeFirebaseRegistration} from "./notificationBridge";

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const AccountPushDevice = z.object({
  uid: z.string().min(1).max(128), target: FirebasePushTarget, locale: z.string().max(16), enabled: z.boolean(),
  revision: Time, expiresAtMs: Time, endpointHash: Hash, pairingHash: Hash, subscription: FirebasePushSubscription, managerRevision: Time.optional(), managerExpiresAtMs: Time.optional(),
});
const Pairing = z.object({uid: z.string().min(1).max(128), target: FirebasePushTarget, locale: z.string().max(16),
  expiresAtMs: Time, deviceHash: Hash.optional()});
const revisionAfter = (previous: number): number => Math.max(Date.now(), previous + 1);
const registration = (deviceHash: string, device: z.infer<typeof AccountPushDevice>): FirebasePushRegistration => ({
  version: 1, deviceHash, target: device.target, revision: device.revision, enabled: device.enabled,
  locale: device.locale, expiresAtMs: device.expiresAtMs,
});
async function synchronizeDevice(deviceHash: string, device: z.infer<typeof AccountPushDevice>): Promise<void> {
  await synchronizeFirebaseRegistration(registration(deviceHash, device));
  const db = admin.firestore(), ref = db.doc(`accountPushDevices/${deviceHash}`);
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.uid === device.uid && current.data()?.revision === device.revision && current.data()?.expiresAtMs === device.expiresAtMs)
      tx.update(ref, {managerRevision: device.revision, managerExpiresAtMs: device.expiresAtMs});
  });
}

type EnrollInput = Extract<z.infer<typeof FirebasePushBridgeInput>, {action: "enroll"}>;

export async function enrollBrowserDevice(input: EnrollInput) {
  try {ECDH.convertKey(Buffer.from(input.subscription.keys.p256dh, "base64url"), "prime256v1");}
  catch {throw new HttpsError("failed-precondition", "Notification subscription is invalid.");}
  const db = admin.firestore(), deviceHash = pushDigest(input.deviceToken), endpointHash = pushDigest(input.subscription.endpoint);
  const pairingRef = db.doc(`notificationPairings/${pushDigest(input.pairingCode)}`);
  const initial = Pairing.safeParse((await pairingRef.get()).data());
  if (!initial.success || initial.data.expiresAtMs <= Date.now() && initial.data.deviceHash !== deviceHash)
    throw new HttpsError("failed-precondition", "Notification setup has expired.");
  const committed = await runWithJestAccountOperationLease(initial.data.uid, 60, () => db.runTransaction(async tx => {
    const deviceRef = db.doc(`accountPushDevices/${deviceHash}`), endpointRef = db.doc(`accountPushEndpoints/${endpointHash}`);
    const [pairingSnapshot, deviceSnapshot, endpoint, user, deleted] = await Promise.all([
      tx.get(pairingRef), tx.get(deviceRef), tx.get(endpointRef), tx.get(db.doc(`users/${initial.data.uid}`)), tx.get(getJestAccountDeletionRef(db, initial.data.uid)),
    ]);
    const parsed = Pairing.safeParse(pairingSnapshot.data());
    if (!parsed.success || parsed.data.uid !== initial.data.uid || parsed.data.expiresAtMs <= Date.now() && parsed.data.deviceHash !== deviceHash || deleted.exists ||
        !user.exists || user.data()?.notificationsEnabled === false || parsed.data.deviceHash && parsed.data.deviceHash !== deviceHash)
      throw new HttpsError("failed-precondition", "Notification setup is unavailable.");
    const pairing = parsed.data, existing = AccountPushDevice.safeParse(deviceSnapshot.data());
    if (endpoint.exists && (endpoint.data()?.deviceHash !== deviceHash))
      throw new HttpsError("failed-precondition", "This browser subscription is already associated with a device.");
    const oldEndpointRef = existing.success && existing.data.endpointHash !== endpointHash ? db.doc(`accountPushEndpoints/${existing.data.endpointHash}`) : null;
    const oldEndpoint = oldEndpointRef ? await tx.get(oldEndpointRef) : null;
    if (pairing.deviceHash) {
      if (existing.success && existing.data.uid === pairing.uid && existing.data.enabled && existing.data.endpointHash === endpointHash &&
          JSON.stringify(existing.data.subscription) === JSON.stringify(input.subscription) && existing.data.expiresAtMs > Date.now()) return existing.data;
      throw new HttpsError("failed-precondition", "Notification setup was already used.");
    }
    const now = Date.now(), expiresAtMs = now + PUSH_DEVICE_TTL_MS;
    const device = AccountPushDevice.parse({uid: pairing.uid, target: pairing.target, locale: input.locale,
      enabled: true, revision: revisionAfter(existing.success ? existing.data.revision : 0), expiresAtMs, endpointHash, pairingHash: pairingRef.id, subscription: input.subscription});
    if (oldEndpointRef && oldEndpoint?.data()?.deviceHash === deviceHash) tx.delete(oldEndpointRef);
    tx.set(deviceRef, {...device, updatedAtMs: now, expiresAt: Timestamp.fromMillis(expiresAtMs)});
    tx.set(endpointRef, {uid: pairing.uid, deviceHash, expiresAt: Timestamp.fromMillis(expiresAtMs)});
    tx.update(pairingRef, {deviceHash, consumedAtMs: now, expiresAt: Timestamp.fromMillis(expiresAtMs)});
    return device;
  }));
  await synchronizeDevice(deviceHash, committed);
  return {registered: true, enabled: committed.enabled, expiresAtMs: committed.expiresAtMs, revision: committed.revision};
}

export async function browserDeviceStatus(deviceToken: string, disable: boolean, renewRequested = false) {
  const db = admin.firestore(), deviceHash = pushDigest(deviceToken), ref = db.doc(`accountPushDevices/${deviceHash}`);
  const initial = AccountPushDevice.safeParse((await ref.get()).data());
  if (!initial.success) return {registered: false, enabled: false, expiresAtMs: 0, revision: 0};
  const committed = await db.runTransaction(async tx => {
    const [snapshot, user, deleted] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${initial.data.uid}`)), tx.get(getJestAccountDeletionRef(db, initial.data.uid))]);
    const parsed = AccountPushDevice.safeParse(snapshot.data());
    if (!parsed.success || parsed.data.uid !== initial.data.uid) return null;
    const device = parsed.data;
    const retired = disable || !user.exists || deleted.exists;
    const enabled = device.enabled && !retired;
    const accountEnabled = enabled && user.data()?.notificationsEnabled !== false;
    const renew = renewRequested && accountEnabled && device.expiresAtMs < Date.now() + 7 * 86_400_000;
    const effectiveEnabled = accountEnabled && (renew || device.expiresAtMs > Date.now());
    if (enabled === device.enabled && !renew) return {device, effectiveEnabled};
    const expiresAtMs = enabled ? Date.now() + PUSH_DEVICE_TTL_MS : Date.now();
    const updated = {...device, enabled, expiresAtMs, revision: revisionAfter(device.revision)};
    const pairingRef = db.doc(`notificationPairings/${device.pairingHash}`), endpointRef = db.doc(`accountPushEndpoints/${device.endpointHash}`);
    const [pairing, endpoint] = renew ? await Promise.all([tx.get(pairingRef), tx.get(endpointRef)]) : [null, null];
    if (renew && pairing?.data()?.uid === device.uid && pairing.data()?.deviceHash === deviceHash)
      tx.update(pairingRef, {expiresAt: Timestamp.fromMillis(expiresAtMs)});
    if (renew && endpoint?.data()?.uid === device.uid && endpoint.data()?.deviceHash === deviceHash)
      tx.update(endpointRef, {expiresAt: Timestamp.fromMillis(expiresAtMs)});
    tx.set(ref, {...updated, updatedAtMs: Date.now(), expiresAt: Timestamp.fromMillis(expiresAtMs)});
    return {device: updated, effectiveEnabled};
  });
  if (!committed) return {registered: false, enabled: false, expiresAtMs: 0, revision: 0};
  if ((committed.effectiveEnabled || !committed.device.enabled) && !managerRegistrationAcknowledged(committed.device))
    await synchronizeDevice(deviceHash, committed.device);
  return {registered: true, enabled: committed.effectiveEnabled, expiresAtMs: committed.device.expiresAtMs, revision: committed.device.revision};
}

export function managerRegistrationAcknowledged(device: z.infer<typeof AccountPushDevice>): boolean {
  return device.managerRevision === device.revision && (device.managerExpiresAtMs ?? device.expiresAtMs) === device.expiresAtMs;
}

/** Authenticated gameplay may extend an existing proof, never create or reactivate a device. */
export async function renewPairedBrowserDevice(uid: string, pairingCode: string): Promise<void> {
  const db = admin.firestore(), pairingRef = db.doc(`notificationPairings/${pushDigest(pairingCode)}`);
  const committed = await db.runTransaction(async tx => {
    const [pairingSnapshot, user, deleted] = await Promise.all([tx.get(pairingRef), tx.get(db.doc(`users/${uid}`)), tx.get(getJestAccountDeletionRef(db, uid))]);
    const pairing = Pairing.safeParse(pairingSnapshot.data());
    if (!pairing.success || pairing.data.uid !== uid || !pairing.data.deviceHash || !user.exists ||
        user.data()?.notificationsEnabled === false || deleted.exists) return null;
    const deviceHash = pairing.data.deviceHash, ref = db.doc(`accountPushDevices/${deviceHash}`);
    const parsed = AccountPushDevice.safeParse((await tx.get(ref)).data());
    const now = Date.now();
    if (!parsed.success || parsed.data.uid !== uid || parsed.data.pairingHash !== pairingRef.id ||
        parsed.data.target !== pairing.data.target || !parsed.data.enabled || parsed.data.expiresAtMs <= now) return null;
    const device = parsed.data;
    if (device.expiresAtMs >= now + 7 * 86_400_000)
      return managerRegistrationAcknowledged(device) ? null : {deviceHash, device};
    const endpointRef = db.doc(`accountPushEndpoints/${device.endpointHash}`), endpoint = await tx.get(endpointRef);
    if (endpoint.data()?.uid !== uid || endpoint.data()?.deviceHash !== deviceHash) return null;
    const expiresAtMs = now + PUSH_DEVICE_TTL_MS;
    const updated = {...device, expiresAtMs, managerExpiresAtMs: device.managerExpiresAtMs ?? device.expiresAtMs};
    tx.update(ref, {expiresAtMs, managerExpiresAtMs: updated.managerExpiresAtMs, expiresAt: Timestamp.fromMillis(expiresAtMs), updatedAtMs: now});
    tx.update(pairingRef, {expiresAt: Timestamp.fromMillis(expiresAtMs)});
    tx.update(endpointRef, {expiresAt: Timestamp.fromMillis(expiresAtMs)});
    return {deviceHash, device: updated};
  });
  if (committed) await synchronizeDevice(committed.deviceHash, committed.device);
}

import {createHash, createECDH, timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {defineSecret} from "firebase-functions/params";
import {FirebaseFcmWebConfiguration, FirebasePushConfiguration, FirebasePushRegistration, FirebasePushTarget} from "../../../src/notifications/contracts/firebasePush";

export const notificationBridgeSecret = defineSecret("NOTIFICATION_MANAGER_BRIDGE_SECRET");
export const notificationVapidPrivateKey = defineSecret("HOSTED_PUSH_VAPID_PRIVATE_KEY");
export const pushDigest = (value: string): string => createHash("sha256").update(value).digest("hex");
export const PUSH_DEVICE_TTL_MS = 30 * 86_400_000;

export function managerOrigin(): string {
  const value = process.env.NOTIFICATION_MANAGER_URL ?? "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) throw new Error("notification-manager-unconfigured");
  return url.origin;
}

export function bridgeAuthorized(authorization: string | undefined): boolean {
  const secret = notificationBridgeSecret.value();
  const expected = Buffer.from(`Bearer ${secret}`), supplied = Buffer.from(authorization ?? "");
  return secret.length >= 32 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function browserPushConfiguration(): {publicKey: string; privateKey: string; subject: string} {
  const {publicKey} = FirebasePushConfiguration.parse({version: 1, publicKey: process.env.HOSTED_PUSH_VAPID_PUBLIC_KEY});
  const privateKey = notificationVapidPrivateKey.value(), subject = process.env.HOSTED_PUSH_VAPID_SUBJECT ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/u.test(privateKey)) throw new Error("notification-vapid-unconfigured");
  const contact = new URL(subject);
  if (subject.length > 256 || !(contact.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.pathname) ||
      contact.protocol === "https:" && !contact.username && !contact.password && !contact.hash && contact.hostname !== "localhost"))
    throw new Error("notification-vapid-contact-invalid");
  const key = createECDH("prime256v1");
  key.setPrivateKey(Buffer.from(privateKey, "base64url"));
  if (key.getPublicKey().toString("base64url") !== publicKey) throw new Error("notification-vapid-key-mismatch");
  return {publicKey, privateKey, subject};
}

export function browserFcmConfiguration(): ReturnType<typeof FirebaseFcmWebConfiguration.parse> | null {
  const raw = process.env.NOTIFICATION_FCM_WEB_CONFIG;
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  const configuration = FirebaseFcmWebConfiguration.parse(value);
  if (configuration.projectId !== "riddle-quest-ec2b2" || configuration.appId.split(":")[1] !== configuration.messagingSenderId)
    throw new Error("notification-fcm-web-configuration-invalid");
  return configuration;
}

export async function synchronizeFirebaseRegistration(registration: FirebasePushRegistration): Promise<void> {
  const response = await fetch(`${managerOrigin()}/api/devices/firebase/registration`, {
    method: "POST", redirect: "error", headers: {"Content-Type": "application/json", Authorization: `Bearer ${notificationBridgeSecret.value()}`},
    body: JSON.stringify(registration), signal: AbortSignal.timeout(8000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error("notification-manager-unavailable");
}

const LaunchUrls = z.record(FirebasePushTarget, z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {return false;}
}));

export function notificationLaunchUrl(target: string): string | null {
  const value: unknown = JSON.parse(process.env.NOTIFICATION_GAME_URLS ?? "{}");
  const urls = LaunchUrls.parse(value);
  return urls[target] ?? null;
}

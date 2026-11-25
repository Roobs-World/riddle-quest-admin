import {z} from "zod";
import {FcmRegistrationToken} from "./fcmDelivery";

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Locale = z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/u).max(16);
export const FirebasePushTarget = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u).refine(value => value !== "all");
export function firebasePushEndpointAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.port &&
      (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/u.test(url.hostname));
  } catch {return false;}
}
export const FirebasePushSubscription = z.object({
  endpoint: z.string().url().max(4096).refine(firebasePushEndpointAllowed),
  keys: z.object({p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/u), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/u)}).strict(),
}).strict();
export type FirebasePushSubscription = z.infer<typeof FirebasePushSubscription>;
export const FirebasePushRegistration = z.object({
  version: z.literal(1), deviceHash: Hash, target: FirebasePushTarget, revision: Revision,
  enabled: z.boolean(), locale: Locale, expiresAtMs: Revision,
}).strict();
export type FirebasePushRegistration = z.infer<typeof FirebasePushRegistration>;
export const FirebasePushBridgeInput = z.discriminatedUnion("action", [
  z.object({action: z.literal("configuration")}).strict(),
  z.object({action: z.literal("configuration-fcm")}).strict(),
  z.object({action: z.literal("audience")}).strict(),
  z.object({action: z.literal("enroll"), pairingCode: Hash, deviceToken: Hash, locale: Locale, subscription: FirebasePushSubscription}).strict(),
  z.object({action: z.literal("enroll-fcm"), pairingCode: Hash, deviceToken: Hash, locale: Locale, fcmToken: FcmRegistrationToken}).strict(),
  z.object({action: z.literal("status"), deviceToken: Hash, renew: z.boolean().optional()}).strict(),
  z.object({action: z.literal("disable"), deviceToken: Hash}).strict(),
]);
export const FirebasePushConfiguration = z.object({version: z.literal(1), publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/u)}).strict();
export const FirebaseFcmWebConfiguration = z.object({
  apiKey: z.string().regex(/^AIza[A-Za-z0-9_-]{35}$/u), projectId: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u),
  appId: z.string().regex(/^1:[0-9]+:web:[a-f0-9]+$/u), messagingSenderId: z.string().regex(/^[0-9]{1,32}$/u),
  vapidKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/u),
}).strict();
export const FirebaseFcmPushConfiguration = FirebasePushConfiguration.extend({fcm: FirebaseFcmWebConfiguration.nullable()});
export const FirebasePushDeviceStatus = z.object({registered: z.boolean(), enabled: z.boolean(), expiresAtMs: Revision, revision: Revision}).strict();
export const FirebasePushAudience = z.object({accounts: Revision, registeredDevices: Revision}).strict();
export const FirebasePushDispatch = z.object({
  version: z.literal(1), deviceHash: Hash, revision: Revision, notificationId: Hash,
  title: z.string().min(1).max(200), body: z.string().min(1).max(2000),
  imageUrl: z.string().url().max(2048).nullable(), expiresAtMs: Revision,
}).strict();
export const FirebasePushDispatchResult = z.object({outcome: z.enum(["accepted", "failed", "uncertain", "skipped"])}).strict();

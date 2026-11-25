import {FirebaseFcmWebConfiguration} from "../../src/notifications/contracts/firebasePush";
import {FcmRegistrationToken} from "../../src/notifications/contracts/fcmDelivery";
import type {z} from "zod";
import type {Messaging} from "firebase/messaging";

type Configuration = z.infer<typeof FirebaseFcmWebConfiguration>;
const STORAGE_KEY = "riddle-quest-fcm-device-v1";
let current: {messaging: Messaging; registration: ServiceWorkerRegistration} | null = null;

export function savedFcmConfiguration(): Configuration | null {
  try {
    const parsed = FirebaseFcmWebConfiguration.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {return null;}
}

export async function fcmSupported(): Promise<boolean> {
  const {isSupported} = await import("firebase/messaging");
  return isSupported();
}

async function messagingFor(configuration: Configuration) {
  const [{getApps, initializeApp}, {getMessaging}] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  const name = `riddle-quest-device-${configuration.appId}`;
  const app = getApps().find(candidate => candidate.name === name) ?? initializeApp({
    apiKey: configuration.apiKey, appId: configuration.appId, projectId: configuration.projectId,
    messagingSenderId: configuration.messagingSenderId,
  }, name);
  return getMessaging(app);
}

/** A fresh pairing is required before a refreshed FCM token can change account routing. */
export async function createFcmEnrollment(configuration: Configuration, registration: ServiceWorkerRegistration): Promise<string> {
  try {
    const messaging = await messagingFor(configuration);
    const {getToken} = await import("firebase/messaging");
    const token = FcmRegistrationToken.parse(await getToken(messaging, {vapidKey: configuration.vapidKey, serviceWorkerRegistration: registration}));
    current = {messaging, registration};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configuration));
    return token;
  } catch {throw new Error("This browser could not connect to the notification service. Please try again shortly.");}
}

/** Revoke only this manager's messaging registration, after its server consent is disabled. */
export async function revokeFcmEnrollment(registration: ServiceWorkerRegistration | undefined): Promise<void> {
  try {
    if (registration && current?.registration.scope === registration.scope) {
      const {deleteToken} = await import("firebase/messaging");
      await deleteToken(current.messaging);
    }
  } finally {
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
    current = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

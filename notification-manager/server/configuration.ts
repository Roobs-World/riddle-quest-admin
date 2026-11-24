import {createECDH} from "node:crypto";
import {z} from "zod";
import {BrowserPlatform} from "./model.js";
import {FirebasePushTarget} from "../../src/notifications/contracts/firebasePush.js";

export function localDevelopmentEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NOTIFICATION_ALLOW_LOCALHOST === "true";
}

const AllowedOrigins = z.record(BrowserPlatform, z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && value.replace(/\/$/u, "") === url.origin &&
      (url.protocol === "https:" || localDevelopmentEnabled() && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {return false;}
}));

/** Every admitted game origin is explicit; deployments cannot enable wildcard browser access. */
export function admittedOrigins(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(process.env.NOTIFICATION_ALLOWED_ORIGINS ?? "{}");
    const parsed = AllowedOrigins.parse(value);
    return Object.fromEntries(Object.entries(parsed).map(([target, origin]) => [target, new URL(origin).origin]));
  } catch {throw new Error("notification-origin-configuration-invalid");}
}

export interface AndroidBridgeConfiguration {endpoint: string; secret: string}

export interface FirebaseBridgeConfiguration {endpoint: string; dispatchEndpoint: string; secret: string}

/** One authenticated Firebase bridge owns account-linked browser devices on every target. */
export function firebaseBridgeConfiguration(): FirebaseBridgeConfiguration | null {
  const endpoint = process.env.FIREBASE_NOTIFICATION_BRIDGE_URL ?? "";
  const secret = process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET ?? "";
  if (endpoint.length > 2048 || /[\u0000-\u0020\u007f]/u.test(endpoint) || !/^[A-Za-z0-9_-]{32,256}$/u.test(secret)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port ||
        !/^[a-z0-9-]+\.cloudfunctions\.net$/u.test(url.hostname) || url.pathname !== "/notificationBrowserBridge") return null;
    return {endpoint, dispatchEndpoint: new URL("/dispatchFirebaseNotification", url).href, secret};
  } catch {return null;}
}

export function firebaseNotificationTargets(): string[] {
  const value: unknown = JSON.parse(process.env.FIREBASE_NOTIFICATION_TARGETS ?? "[]");
  return [...new Set(z.array(FirebasePushTarget).max(100).parse(value))];
}

/** Native devices are admitted only through the trusted Firebase server bridge. */
export function androidBridgeConfiguration(): AndroidBridgeConfiguration | null {
  const endpoint = process.env.ANDROID_NOTIFICATION_BRIDGE_URL ?? "";
  const secret = process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET ?? "";
  if (endpoint.length > 2048 || /[\u0000-\u0020\u007f]/u.test(endpoint) || !/^[A-Za-z0-9_-]{32,256}$/u.test(secret)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port ||
        !/^[a-z0-9-]+\.cloudfunctions\.net$/u.test(url.hostname) || url.pathname !== "/dispatchAndroidNotification") return null;
    return {endpoint, secret};
  } catch {return null;}
}

export function admittedPlatforms(): Array<{id: string; origin: string | null}> {
  const platforms: Array<{id: string; origin: string | null}> = Object.entries(admittedOrigins()).map(([id, origin]) => ({id, origin}));
  if (androidBridgeConfiguration()) platforms.push({id: "android", origin: null});
  if (firebaseBridgeConfiguration()) {
    for (const id of firebaseNotificationTargets()) {
      if (platforms.some(platform => platform.id === id && platform.origin !== null)) throw new Error("notification-platform-transport-conflict");
      if (!platforms.some(platform => platform.id === id)) platforms.push({id, origin: null});
    }
  }
  return platforms;
}

export function requireCampaignTransports(target: string): void {
  const platforms = admittedPlatforms();
  if (target !== "all" && !platforms.some(platform => platform.id === target) || !platforms.length) {
    throw new Error("notification-platform-unconfigured");
  }
  if (platforms.some(platform => platform.origin !== null && (target === "all" || platform.id === target))) vapidConfiguration();
}

export type VapidConfiguration = Readonly<{publicKey: string; privateKey: string; subject: string}>;
let cachedVapid: VapidConfiguration | undefined;

/** Loads a stable matching key pair without returning private material to browser handlers. */
export function vapidConfiguration(): VapidConfiguration {
  if (cachedVapid) return cachedVapid;
  const publicKey = process.env.HOSTED_PUSH_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.HOSTED_PUSH_VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.HOSTED_PUSH_VAPID_SUBJECT ?? "";
  if (!/^[A-Za-z0-9_-]{87}$/u.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/u.test(privateKey)) throw new Error("notification-vapid-unconfigured");
  let contact: URL;
  try {contact = new URL(subject);} catch {throw new Error("notification-vapid-contact-invalid");}
  if (subject.length > 256 || !(contact.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.pathname) ||
      contact.protocol === "https:" && !contact.username && !contact.password && !contact.hash && contact.hostname !== "localhost"))
    throw new Error("notification-vapid-contact-invalid");
  const key = createECDH("prime256v1");
  try {
    key.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (key.getPublicKey().toString("base64url") !== publicKey) throw new Error("mismatch");
  } catch {throw new Error("notification-vapid-key-mismatch");}
  cachedVapid = {publicKey, privateKey, subject};
  return cachedVapid;
}

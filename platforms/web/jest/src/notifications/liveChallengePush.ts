import workerUrl from "./liveChallengePushWorker.js?url";
import {auth} from "../../../../../src/platform/firebase/browserClient";

/** A newer opt-out or account switch supersedes an older browser registration attempt. */
let latestIntent = 0;
let intentOwner: string | undefined;
let workerWrites: Promise<unknown> = Promise.resolve();

function writeWorkerPreference(enabled: boolean, owner?: string, isCurrent = () => true): Promise<boolean> {
  const write = workerWrites.then(async () => {
    if (!("caches" in globalThis) || !isCurrent()) return false;
    const cache = await caches.open("riddleQuest:jestNotificationPreferences:v1");
    if (!isCurrent()) return false;
    await cache.put(new URL("/riddle-quest-notification-preference", location.origin),
      new Response(JSON.stringify({enabled, owner}), {headers: {"Content-Type": "application/json"}}));
    return true;
  }).catch(() => false);
  workerWrites = write;
  return write;
}

/** Retires only this account's local display gate, preserving a replacement owner. */
export function retireJestLiveChallengePush(owner: string): Promise<boolean> {
  if (intentOwner === owner) {latestIntent += 1; intentOwner = undefined;}
  const retire = workerWrites.then(async () => {
    if (!("caches" in globalThis)) return true;
    const cache = await caches.open("riddleQuest:jestNotificationPreferences:v1");
    const key = new URL("/riddle-quest-notification-preference", location.origin);
    const saved = await cache.match(key);
    const value: unknown = saved ? await saved.json() : null;
    if (!value || typeof value !== "object" || !("owner" in value) || value.owner !== owner) return true;
    await cache.put(key, new Response(JSON.stringify({enabled: false, owner}), {headers: {"Content-Type": "application/json"}}));
    return true;
  }).catch(() => false);
  workerWrites = retire;
  return retire;
}

/** Explicit opt-in for self-managed offline challenges; platform frames may reject browser permission. */
export async function setJestLiveChallengePush(enabled: boolean, {
  requestPermission = true,
  isCurrent = () => true,
  beforeRegister = async () => true,
}: {requestPermission?: boolean; isCurrent?: () => boolean; beforeRegister?: () => Promise<boolean>} = {}): Promise<boolean> {
  /** Signed-in account and consent intent must remain current before persisting a browser token. */
  const owner = auth.currentUser?.uid, intent = ++latestIntent;
  intentOwner = owner;
  const current = () => isCurrent() && intent === latestIntent && auth.currentUser?.uid === owner;
  const vapidKey = import.meta.env.VITE_JEST_CHALLENGE_PUSH_VAPID_KEY;
  const supported = enabled && owner && current() && vapidKey && globalThis.isSecureContext &&
    "Notification" in globalThis && "serviceWorker" in navigator;
  const permission = supported ? Notification.permission === "granted" ? Promise.resolve("granted") :
    requestPermission ? Notification.requestPermission().catch(() => "denied") : Promise.resolve("default") : null;
  await writeWorkerPreference(false, owner, current);
  if (!owner) return false;
  if (!enabled) {
    /** Validated dependencies and server state for this operation. */
    const {setLiveRacePushSubscription} = await import("../../../../../src/platform/firebase/browserClient");
    if (!current()) return false;
    await setLiveRacePushSubscription({enabled: false});
    return true;
  }
  /** Public Web Push certificate configured for this target. */
  if (!permission || await permission !== "granted") return false;
  if (!current()) return false;
  if (!await beforeRegister() || !current()) return false;
  /** Local presentation state for this mounted invitation or consent flow. */
  const [{getMessaging, getToken, isSupported}, {firebaseApp, setLiveRacePushSubscription}] = await Promise.all([
    import("firebase/messaging"), import("../../../../../src/platform/firebase/browserClient"),
  ]);
  if (!await isSupported() || !current()) return false;
  /** Clicks return through the approved Jest game route instead of opening a standalone SDK iframe URL. */
  const launch = new URL(import.meta.env.VITE_JEST_PUBLIC_GAME_URL || "https://jest.com/g/riddle-q");
  if (launch.origin !== "https://jest.com" || !/^\/g\/[a-z0-9-]+$/.test(launch.pathname) || launch.search || launch.hash) return false;
  /** Target-local worker asset carrying only a fixed public launch route. */
  const url = new URL(workerUrl, location.href);
  url.searchParams.set("gameUrl", launch.href);
  /** Dedicated browser worker for offline challenge notifications. */
  const registration = await navigator.serviceWorker.register(url.href, {type: "module"});
  /** The supplied registration avoids Firebase's default root worker and cross-target assets. */
  if (!registration.active) await new Promise<void>((resolve, reject) => {
    /** Installing or waiting worker before Firebase token registration. */
    const worker = registration.installing ?? registration.waiting;
    if (!worker) {reject(new Error("push-worker-unavailable")); return;}
    /** Bounded timeout releases an unavailable transport. */
    const timer = window.setTimeout(() => reject(new Error("push-worker-timeout")), 8000);
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {clearTimeout(timer); resolve();}
      if (worker.state === "redundant") {clearTimeout(timer); reject(new Error("push-worker-unavailable"));}
    });
  });
  /** Opaque instance registration returned by Firebase Messaging. */
  const token = await getToken(getMessaging(firebaseApp), {vapidKey, serviceWorkerRegistration: registration});
  if (!token || !current()) return false;
  await setLiveRacePushSubscription({enabled: true, token});
  if (!current()) return false;
  return writeWorkerPreference(true, owner, current);
}

import workerUrl from "./liveChallengePushWorker.js?url";
import {auth} from "../../../../../src/web/firebase";

/** A newer opt-out or account switch supersedes an older browser registration attempt. */
let latestIntent = 0;

/** Explicit opt-in for self-managed offline challenges; platform frames may reject browser permission. */
export async function setJestLiveChallengePush(enabled: boolean): Promise<boolean> {
  /** Signed-in account and consent intent must remain current before persisting a browser token. */
  const owner = auth.currentUser?.uid, intent = ++latestIntent;
  if (!owner) return false;
  if (!enabled) {
    /** Validated dependencies and server state for this operation. */
    const {setLiveRacePushSubscription} = await import("../../../../../src/web/firebase");
    await setLiveRacePushSubscription({enabled: false});
    return true;
  }
  /** Public Web Push certificate configured for this target. */
  const vapidKey = import.meta.env.VITE_JEST_CHALLENGE_PUSH_VAPID_KEY;
  if (!vapidKey || !globalThis.isSecureContext || !("Notification" in globalThis) || !("serviceWorker" in navigator)) return false;
  /** Start the browser prompt in the click gesture before loading optional messaging code. */
  if (await Notification.requestPermission() !== "granted") return false;
  /** Local presentation state for this mounted invitation or consent flow. */
  const [{getMessaging, getToken, isSupported}, {firebaseApp, setLiveRacePushSubscription}] = await Promise.all([
    import("firebase/messaging"), import("../../../../../src/web/firebase"),
  ]);
  if (!await isSupported()) return false;
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
  if (!token || intent !== latestIntent || auth.currentUser?.uid !== owner) return false;
  await setLiveRacePushSubscription({enabled: true, token});
  return true;
}

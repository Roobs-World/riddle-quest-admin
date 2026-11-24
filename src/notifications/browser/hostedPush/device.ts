import {z} from "zod";
import {HOSTED_PUSH_WORKER_PATH, type HostedPushSubscription} from "../../contracts/hostedPush";

const Subscription = z.object({endpoint: z.url().max(4096), keys: z.object({p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/)})});
let browserMutations: Promise<unknown> = Promise.resolve();

/** Serializes native subscription changes so a retiring Off cannot remove a newer enrollment. */
export function withHostedPushMutation<Result>(target: string, operation: () => Promise<Result>): Promise<Result> {
  const result = browserMutations.then(() => typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(`riddleQuest:hostedPushBrowser:${target}`, {mode: "exclusive"}, operation)
    : operation());
  browserMutations = result.catch(() => undefined);
  return result;
}

export function hostedPushSupported(): boolean {
  try {
    return isSecureContext && window.top === window && "Notification" in globalThis && "serviceWorker" in navigator &&
      "PushManager" in globalThis && "caches" in globalThis && Boolean(crypto.subtle);
  } catch {return false;}
}

export function hostedPushPermission(): NotificationPermission {
  try {return Notification.permission;} catch {return "denied";}
}

/** Invoked synchronously from the player's gesture, before enrollment awaits any I/O. */
export function requestHostedPushPermission(): Promise<NotificationPermission> {
  if (!hostedPushSupported()) return Promise.resolve("denied");
  const permission = hostedPushPermission();
  if (permission !== "default") return Promise.resolve(permission);
  try {return Notification.requestPermission().catch(() => "denied");} catch {return Promise.resolve("denied");}
}

export async function withHostedPushDeadline<Result>(operation: Promise<Result>): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("hosted-push-device-timeout")), 8000);
    })]);
  } finally {clearTimeout(timer);}
}

export async function hostedPushRegistration(workerPath = HOSTED_PUSH_WORKER_PATH): Promise<ServiceWorkerRegistration> {
  const worker = new URL(workerPath, location.origin);
  if (worker.origin !== location.origin || !workerPath.startsWith("/") || workerPath.startsWith("//") || worker.search || worker.hash)
    throw new Error("hosted-push-worker-origin-invalid");
  const registration = await withHostedPushDeadline(navigator.serviceWorker.register(worker.href, {scope: "/", type: "module", updateViaCache: "none"}));
  if (registration.active?.state === "activated") return registration;
  const candidate = registration.installing ?? registration.waiting ?? registration.active;
  if (!candidate) throw new Error("hosted-push-worker-unavailable");
  await withHostedPushDeadline(new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (candidate.state === "activated") {candidate.removeEventListener("statechange", changed); resolve();}
      if (candidate.state === "redundant") {candidate.removeEventListener("statechange", changed); reject(new Error("hosted-push-worker-retired"));}
    };
    candidate.addEventListener("statechange", changed);
    changed();
  }));
  return registration;
}

export function hostedPushApplicationKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(publicKey.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - publicKey.length % 4) % 4));
  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("hosted-push-public-key-invalid");
  return bytes;
}

export function serializeHostedPushSubscription(subscription: PushSubscription): HostedPushSubscription {
  const raw: unknown = subscription.toJSON();
  const parsed = Subscription.parse(raw);
  const endpoint = new URL(parsed.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash || endpoint.port)
    throw new Error("hosted-push-endpoint-invalid");
  return {endpoint: parsed.endpoint, keys: parsed.keys};
}

/** The scope lookup never installs a new worker while opting out. */
export function unsubscribeHostedPush({target = "default", isCurrent = () => true}: {target?: string; isCurrent?: () => boolean} = {}): Promise<boolean> {
  return withHostedPushMutation(target, async () => {
    try {
      if (!isCurrent()) return false;
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return true;
      const registration = await withHostedPushDeadline(navigator.serviceWorker.getRegistration(new URL("/", location.origin)));
      if (!isCurrent()) return false;
      const subscription = await withHostedPushDeadline(registration?.pushManager.getSubscription() ?? Promise.resolve(null));
      if (!isCurrent()) return false;
      if (!subscription) return true;
      await withHostedPushDeadline(subscription.unsubscribe());
      const current = await withHostedPushDeadline(registration?.pushManager.getSubscription() ?? Promise.resolve(null));
      return current === null;
    } catch {return false;}
  });
}

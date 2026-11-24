import {z} from "zod";
import {HOSTED_PUSH_API_BASE, type HostedPushTarget} from "../../contracts/hostedPush";

const Hex = z.string().regex(/^[a-f0-9]{64}$/);
const InstallationId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const StoredState = z.object({
  version: z.literal(1), token: Hex, installationId: InstallationId.nullable(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  enabled: z.boolean(), pendingRevocation: z.boolean(), locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/),
}).strict();
export type HostedPushStoredState = z.infer<typeof StoredState>;

export const hostedPushStorageKey = (target: HostedPushTarget) => `riddleQuest:hostedPush:${target}:v1`;
export const HOSTED_PUSH_CACHE = "riddleQuest:hostedNotifications:v1";
export const hostedPushGateUrl = (target: HostedPushTarget) => new URL(`${HOSTED_PUSH_API_BASE}/display-gate?target=${target}`, location.origin);

export function readHostedPushState(target: HostedPushTarget): HostedPushStoredState | null {
  const raw = localStorage.getItem(hostedPushStorageKey(target));
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  return StoredState.parse(parsed);
}

export function saveHostedPushState(target: HostedPushTarget, state: HostedPushStoredState): void {
  const value = JSON.stringify(StoredState.parse(state));
  localStorage.setItem(hostedPushStorageKey(target), value);
  if (localStorage.getItem(hostedPushStorageKey(target)) !== value) throw new Error("hosted-push-storage-unavailable");
}

export function initializeHostedPushState(target: HostedPushTarget): HostedPushStoredState {
  const stored = readHostedPushState(target);
  if (stored) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state: HostedPushStoredState = {version: 1, token: Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""),
    installationId: null, revision: 0, enabled: true, pendingRevocation: false, locale: "en"};
  saveHostedPushState(target, state);
  return state;
}

export function nextHostedPushRevision(state: HostedPushStoredState): number {
  const revision = Math.max(Date.now(), state.revision + 1);
  if (!Number.isSafeInteger(revision)) throw new Error("hosted-push-revision-exhausted");
  return revision;
}

let gateWrites: Promise<unknown> = Promise.resolve();

/** Serial writes and an ownership check make a newer Off command win over a late enrollment. */
export function writeHostedPushGate(target: HostedPushTarget, installationId: string | null, enabled: boolean, isCurrent = () => true, launchPath = "/"): Promise<boolean> {
  const write = async () => {
    if (!isCurrent()) return false;
    const cache = await caches.open(HOSTED_PUSH_CACHE);
    if (!isCurrent()) return false;
    if (!enabled) {
      await cache.delete(hostedPushGateUrl(target));
      return true;
    }
    const destination = new URL(launchPath, location.origin);
    if (destination.origin !== location.origin || !launchPath.startsWith("/") || launchPath.startsWith("//") || destination.search || destination.hash)
      throw new Error("hosted-push-launch-path-invalid");
    await cache.put(hostedPushGateUrl(target), new Response(JSON.stringify({target, installationId, enabled, launchPath: destination.pathname}), {headers: {"Content-Type": "application/json"}}));
    return true;
  };
  const queued = gateWrites.then(() => navigator.locks
    ? navigator.locks.request(`riddleQuest:hostedPushGate:${target}`, {mode: "exclusive"}, write)
    : write()).catch(() => false);
  gateWrites = queued;
  return queued;
}

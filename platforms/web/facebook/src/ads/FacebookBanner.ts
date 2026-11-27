import type {LifecycleCapability} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "../fbinstant";
import {isFacebookSdkDialogOpen, registerFacebookSdkDialogGuard} from "../FacebookSdkDialogGate";

type NativeState = "hidden" | "loading" | "visible" | "hiding" | "hide-failed";
type NativeBanner = {tail: Promise<void>; state: NativeState; owner: object; notify: () => void};
const nativeBanners = new WeakMap<FacebookInstantSdk, NativeBanner>();
const END_OF_SERVICE = Date.UTC(2027, 2, 31);

export type FacebookBannerSnapshot = Readonly<{reserved: boolean; interactionBlocked: boolean; retryable: boolean}>;
export type FacebookBanner = NonNullable<ReturnType<typeof createFacebookBanner>>;

/** Native banner operations remain serialized even when an account owner is replaced. */
export function createFacebookBanner({sdk, enabled, placementId, isActive, allowsBanner, refreshEligibility, lifecycle,
  reportFailure = () => undefined, now = Date.now}: {
  sdk: FacebookInstantSdk;
  enabled: boolean;
  placementId: string;
  isActive: () => boolean;
  /** Current verified subscription, interstitial feature and durable ad-removal policy. */
  allowsBanner: () => boolean;
  refreshEligibility: () => Promise<boolean>;
  lifecycle?: LifecycleCapability;
  reportFailure?: (operation: "load" | "hide") => void;
  now?: () => number;
}) {
  const placement = placementId.trim();
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const load = sdk.loadBannerAdAsync?.bind(sdk), hide = sdk.hideBannerAdAsync?.bind(sdk);
  if (!enabled || !isActive() || !/^[A-Za-z0-9_-]{1,256}$/u.test(placement) || !load || !hide ||
    !supported.has("loadBannerAdAsync") || !supported.has("hideBannerAdAsync")) return undefined;

  const owner = {};
  const native: NativeBanner = nativeBanners.get(sdk) ?? {tail: Promise.resolve(), state: "hidden", owner, notify: () => undefined};
  nativeBanners.set(sdk, native);
  native.owner = owner;
  let retired = false, mounted = false, paused = false, dialogOpen = false, queued = false;
  let activity: "online" | "playing" | "racing" = "playing";
  let visit = 0, attemptedVisit = -1;
  let retirement: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  let snapshot: FacebookBannerSnapshot = {reserved: native.state !== "hidden", interactionBlocked: native.state !== "hidden", retryable: native.state === "hide-failed"};
  const owns = () => native.owner === owner;
  const eligibleSurface = () => owns() && !retired && mounted && !paused && !dialogOpen && activity === "online" &&
    !isFacebookSdkDialogOpen(sdk) && isActive() && document.visibilityState === "visible";
  const canUseSurface = () => {
    try {
      const clock = now();
      return eligibleSurface() && Number.isSafeInteger(clock) && clock >= 0 && clock < END_OF_SERVICE;
    } catch {return false;}
  };
  const shouldShow = () => {
    try {return canUseSurface() && allowsBanner();} catch {return false;}
  };
  const publish = () => {
    if (!owns()) return;
    const reserved = native.state !== "hidden";
    const next = {reserved, interactionBlocked: reserved && !eligibleSurface(), retryable: native.state === "hide-failed"};
    if (next.reserved === snapshot.reserved && next.interactionBlocked === snapshot.interactionBlocked && next.retryable === snapshot.retryable) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  native.notify = publish;
  const setState = (state: NativeState) => {native.state = state; native.notify();};
  const report = (operation: "load" | "hide") => {try {reportFailure(operation);} catch { /* Diagnostics do not control native UI. */ }};
  const enqueue = (operation: () => Promise<void>) => {
    const pending = native.tail.then(operation);
    native.tail = pending.catch(() => undefined);
    return pending;
  };
  const hideNative = async () => {
    if (native.state === "hidden") return;
    setState("hiding");
    try {await hide(); setState("hidden");} catch (error) {
      // Keep space reserved, and prevent another native dialog, until hiding is confirmed.
      setState("hide-failed"); report("hide"); throw error;
    }
  };
  const reconcile = async () => {
    if (!owns()) return;
    if (!canUseSurface() || native.state === "hide-failed") {await hideNative(); return;}
    if (native.state === "visible") {
      if (!shouldShow()) await hideNative();
      return;
    }
    if (attemptedVisit === visit) return;
    attemptedVisit = visit;
    let eligible = false;
    try {eligible = await refreshEligibility();} catch {report("load");}
    if (!eligible || !shouldShow()) return;
    setState("loading");
    try {
      await load(placement, "bottom");
      setState("visible");
    } catch {
      setState("hidden"); report("load"); return;
    }
    // Loading displays immediately. Late completion must never retain a retired or ineligible impression.
    try {eligible = await refreshEligibility();} catch {eligible = false;}
    if (!eligible || !shouldShow()) await hideNative();
  };
  const schedule = () => {
    publish();
    if (queued || !owns()) return;
    queued = true;
    void enqueue(async () => {queued = false; await reconcile();}).catch(() => undefined);
  };
  let removeGuard: () => void = () => undefined;
  removeGuard = registerFacebookSdkDialogGuard(sdk, {
    beforeOpen: async () => {
      dialogOpen = true; publish();
      await enqueue(hideNative);
      if (retired) removeGuard();
    },
    afterClose: () => {dialogOpen = false; if (!retired) {visit++; schedule();}},
  });
  const stopPause = lifecycle?.onPause(() => {paused = true; schedule();});
  const stopResume = lifecycle?.onResume?.(() => {paused = false; visit++; schedule();});
  const visibilityChanged = () => {if (document.visibilityState === "visible") visit++; schedule();};
  document.addEventListener("visibilitychange", visibilityChanged);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    setMounted(value: boolean) {mounted = value; if (value) visit++; schedule();},
    setActivity(value: typeof activity) {if (activity === value) return; activity = value; if (value === "online") visit++; schedule();},
    refresh: schedule,
    retire() {
      if (retirement) return retirement;
      retired = true;
      stopPause?.(); stopResume?.();
      document.removeEventListener("visibilitychange", visibilityChanged);
      publish();
      retirement = (async () => {
        // The old owner's queued load finishes and is hidden before a new owner's load is admitted.
        if (owns()) await enqueue(hideNative);
        removeGuard();
        listeners.clear();
      })().catch(error => {
        retirement = undefined;
        throw error;
      });
      return retirement;
    },
  };
}

import type {OverlayCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk, FacebookOverlayView} from "./fbinstant";
import {prepareFacebookOverlayFrame, selectFacebookProfileFactory} from "./overlays/FacebookOverlayFactories";
import {subscribeFacebookOverlayEvents} from "./overlays/FacebookOverlayEvents";
import {FACEBOOK_PROFILE_LAYOUT, FACEBOOK_PROFILE_NAME_LAYOUT, FACEBOOK_PROFILE_PHOTO_ERROR,
  type FacebookProfileOverlayLayout} from "./overlays/FacebookProfileOverlayLayout";

const failure = (error: unknown): PlatformResult<never> => ({status: "retryable-failure",
  message: error instanceof Error ? error.message : "facebook-overlay-failed"});

/** Renders current-player identity entirely inside Meta's profile frames. */
export function createFacebookOverlayCapability(sdk: FacebookInstantSdk): OverlayCapability | undefined {
  const overlays = sdk.overlayViews;
  if (!overlays) return undefined;
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const factory = selectFacebookProfileFactory(overlays, supported);
  if (!factory) return undefined;
  const inventory = supported.has("overlayViews.getOverlayViews") && typeof overlays.getOverlayViews === "function"
    ? overlays.getOverlayViews.bind(overlays) : undefined;

  return {
    async renderPlayer({playerId, surface, signal}) {
      if (signal?.aborted) return {status: "cancelled"};
      if (playerId !== sdk.player.getID()) return {status: "terminal-failure", message: "facebook-overlay-player-mismatch"};
      if (!surface.isConnected) return {status: "terminal-failure", message: "facebook-overlay-surface-detached"};

      type OwnedView = {view: FacebookOverlayView; cleanup?: Promise<void>};
      const created: OwnedView[] = [];
      const genericViews = new Map<FacebookOverlayView, OwnedView>();
      let retired = false;
      let stopEvents: () => void = () => undefined;
      let interrupt: () => void = () => undefined;
      let markAborted: () => void = () => undefined;
      const interruption = new Promise<never>((_resolve, reject) => {interrupt = () => reject(new Error("facebook-overlay-retired"));});
      // After a successful mount, a later disposal can interrupt its image-error fallback.
      void interruption.catch(() => undefined);
      const aborted = new Promise<void>(resolve => {markAborted = resolve;});
      const assertCurrent = () => {
        if (retired || signal?.aborted || !surface.isConnected || playerId !== sdk.player.getID()) throw new Error("facebook-overlay-retired");
      };
      const dispose = (entry: OwnedView) => entry.cleanup ??= Promise.resolve().then(async () => {
        try {
          // Destruction rejects pending show/dismiss work; awaiting dismissal first can deadlock cleanup.
          if (typeof entry.view.destroyAsync === "function") await entry.view.destroyAsync();
          else await entry.view.dismissAsync?.();
        } finally {
          const frame = entry.view.getIFrameElement?.();
          if (frame && surface.contains(frame)) frame.remove();
        }
      });
      const own = (view: FacebookOverlayView): OwnedView => {
        const existing = factory.kind === "generic" ? genericViews.get(view) : undefined;
        if (existing) return existing;
        const entry: OwnedView = {view};
        created.push(entry);
        if (factory.kind === "generic") genericViews.set(view, entry);
        if (retired) void dispose(entry).catch(() => undefined);
        return entry;
      };
      const adoptInventory = () => {
        if (!inventory || factory.kind !== "generic") return;
        try {
          for (const view of inventory().values()) {
            try {
              const frame = view.getIFrameElement?.();
              // The render caller supplies a private surface; never reclaim another overlay's frame.
              if (frame && surface.contains(frame)) own(view);
            } catch { /* An unrelated malformed inventory entry must not hide an owned handle. */ }
          }
        } catch { /* Optional inventory cannot prevent normal returned-handle cleanup. */ }
      };
      const retire = () => {
        retired = true;
        stopEvents();
        interrupt();
        adoptInventory();
        return Promise.allSettled(created.map(dispose)).then(() => {signal?.removeEventListener("abort", abort);});
      };
      const abort = () => {markAborted(); void retire();};
      signal?.addEventListener("abort", abort, {once: true});
      if (signal?.aborted) abort();
      const wait = <Value,>(operation: Promise<Value>) => Promise.race([operation, interruption]);

      const createGeneric = async (layout: FacebookProfileOverlayLayout) => {
        if (factory.kind !== "generic") throw new Error("facebook-overlay-factory-unavailable");
        assertCurrent();
        try {
          const pending = factory.create(layout, {surface, own, assertCurrent});
          // Async factories insert their native handle before their readiness promise settles.
          adoptInventory();
          const view = await wait(pending);
          assertCurrent();
          return view;
        } catch (error) {adoptInventory(); throw error;}
      };
      let initialComplete = false;
      let photoFailed = false;
      let fallback: Promise<void> | undefined;
      const replaceFailedPhoto = () => fallback ??= (async () => {
        assertCurrent();
        await wait(Promise.allSettled(created.map(dispose)));
        assertCurrent();
        const name = await createGeneric(FACEBOOK_PROFILE_NAME_LAYOUT);
        assertCurrent();
        await wait(name.showAsync());
        assertCurrent();
      })();
      if (factory.kind === "generic") stopEvents = subscribeFacebookOverlayEvents(overlays, supported, (event, id) => {
        if (event !== FACEBOOK_PROFILE_PHOTO_ERROR || photoFailed || retired) return;
        try {assertCurrent();} catch {return;}
        adoptInventory();
        const owned = created.some(entry => !entry.cleanup && entry.view.getID?.() === id);
        if (!owned) return;
        photoFailed = true;
        if (initialComplete) void replaceFailedPhoto().catch(() => {void retire();});
      });

      try {
        if (factory.kind === "convenience") {
          const create = async (pending: Promise<FacebookOverlayView>) => {
            const view = await wait(pending.then(value => {own(value); return value;}));
            assertCurrent();
            prepareFacebookOverlayFrame(view);
          };
          assertCurrent();
          await create(factory.picture(surface));
          assertCurrent();
          await create(factory.name(surface));
          assertCurrent();
          await wait(Promise.all(created.map(entry => Promise.resolve().then(() => {
            assertCurrent();
            return entry.view.showAsync();
          }))));
        } else {
          const profile = await createGeneric(FACEBOOK_PROFILE_LAYOUT);
          assertCurrent();
          await wait(profile.showAsync());
          initialComplete = true;
          if (photoFailed) await replaceFailedPhoto();
        }
        assertCurrent();
        return {status: "success", value: retire};
      } catch (error) {
        await Promise.race([retire(), aborted]);
        return signal?.aborted ? {status: "cancelled"} : failure(error);
      }
    },
  };
}

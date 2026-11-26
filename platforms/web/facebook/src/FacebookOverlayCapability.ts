import type {OverlayCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk, FacebookOverlayView} from "./fbinstant";

/** Defines the profile picture style value. */
const PROFILE_PICTURE_STYLE = "border:0;width:48px;height:48px;overflow:hidden;background:transparent;";
/** Defines the profile name style value. */
const PROFILE_NAME_STYLE =
  "border:0;max-width:240px;overflow:hidden;background:transparent;white-space:nowrap;text-overflow:ellipsis;";
/** Defines the iframe style value. */
const IFRAME_STYLE =
  "position:relative;border:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none;";

/** Provides failure behavior. */
const failure = (error: unknown): PlatformResult<never> => ({
  status: "retryable-failure",
  message: error instanceof Error ? error.message : "facebook-overlay-failed",
});

/** Provides destroy views behavior. */
const destroyViews = async (views: FacebookOverlayView[]): Promise<void> => {
  await Promise.allSettled(
    views.map(async (view) => {
      try {
        await view.dismissAsync?.();
      } finally {
        await view.destroyAsync?.();
      }
    }),
  );
};

/** Renders provider-owned current-player identity without returning Meta profile data to game code. */
export function createFacebookOverlayCapability(sdk: FacebookInstantSdk): OverlayCapability | undefined {
  /** Provides overlays behavior. */
  const overlays = sdk.overlayViews;
  if (!overlays) return undefined;
  /** Provides supported behavior. */
  const supported = new Set(sdk.getSupportedAPIs());
  if (
    !supported.has("overlayViews.createProfilePictureOverlayViewAsync") ||
    !supported.has("overlayViews.createProfileNameOverlayViewAsync")
  )
    return undefined;

  return {
    /** Renders player. */
    async renderPlayer({playerId, surface, signal}) {
      if (signal?.aborted) return {status: "cancelled"};
      if (playerId !== sdk.player.getID()) {
        return {status: "terminal-failure", message: "facebook-overlay-player-mismatch"};
      }
      if (!surface.isConnected) {
        return {status: "terminal-failure", message: "facebook-overlay-surface-detached"};
      }
      /** Each native creation owns cleanup independently, including SDKs returning shared handles. */
      const created: Array<{
        /** Native view returned by one admitted creation. */ view: FacebookOverlayView;
        /** One observed cleanup per creation. */ cleanup?: Promise<void>;
      }> = [];
      /** Retirement prevents any subsequent native admission and reclaims late creations. */
      let retired = false;
      /** Resolve local cancellation without rejecting an otherwise unobserved promise. */
      let interrupt!: (value: null) => void;
      /** Original SDK operations retain observers after local cancellation wins. */
      const interruption = new Promise<null>(resolve => {interrupt = resolve;});
      /** Marks cleanup before invoking the SDK, containing repeated abort/disposer paths. */
      const dispose = (entry: typeof created[number]) => entry.cleanup ??= Promise.resolve().then(() => destroyViews([entry.view]));
      /** Existing views retire immediately; late creation observers reclaim their own result. */
      const retire = () => {
        retired = true;
        return Promise.allSettled(created.map(dispose)).then(() => {});
      };
      /** Cancellation starts cleanup immediately, even when another SDK phase never settles. */
      const abort = () => {void retire(); interrupt(null);};
      signal?.addEventListener("abort", abort, {once: true});
      if (signal?.aborted) abort();
      /** Every phase rechecks the connected mount and opaque SDK identity before admission. */
      const assertCurrent = () => {
        if (!surface.isConnected || playerId !== sdk.player.getID() || retired || signal?.aborted)
          throw new Error("facebook-overlay-retired");
      };
      /** Local cancellation leaves the admitted SDK creation observed and cleans its late result. */
      const create = async (operation: Promise<FacebookOverlayView>) => {
        /** This observer runs even after the local race has completed. */
        const observed = operation.then(view => {
          /** Native ownership begins only when the original creation returns its view. */
          const entry: typeof created[number] = {view};
          created.push(entry);
          if (retired) void dispose(entry);
          return entry;
        });
        /** A cancelled consumer never accepts an original late creation as current. */
        const entry = await Promise.race([observed, interruption]);
        if (entry === null) throw new Error("facebook-overlay-retired");
        return entry.view;
      };
      try {
        assertCurrent();
        await create(overlays.createProfilePictureOverlayViewAsync(surface, PROFILE_PICTURE_STYLE, IFRAME_STYLE));
        assertCurrent();
        await create(overlays.createProfileNameOverlayViewAsync(surface, PROFILE_NAME_STYLE, IFRAME_STYLE, ""));
        assertCurrent();
        await Promise.race([Promise.all(created.map(entry => Promise.resolve().then(() => {
          // An earlier show may synchronously retire the scope before the next SDK admission.
          assertCurrent();
          return entry.view.showAsync();
        }))), interruption]);
        assertCurrent();
        return {status: "success", value: retire};
      } catch (error) {
        // Cancellation also bounds waiting for cleanup; every native cleanup promise remains observed.
        await Promise.race([retire(), interruption]);
        return signal?.aborted ? {status: "cancelled"} : failure(error);
      } finally {
        signal?.removeEventListener("abort", abort);
        interrupt(null);
      }
    },
  };
}

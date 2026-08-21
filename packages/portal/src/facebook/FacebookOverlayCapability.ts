import type {OverlayCapability, PlatformResult} from "../platform/types";
import type {FacebookInstantSdk, FacebookOverlayView} from "./fbinstant";

/** Defines the profile picture style value. */
const PROFILE_PICTURE_STYLE =
  "border:0;width:48px;height:48px;overflow:hidden;background:transparent;";
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
  await Promise.allSettled(views.map(async (view) => {
    await view.dismissAsync?.();
    await view.destroyOverlayView();
  }));
};

/** Renders provider-owned current-player identity without returning Meta profile data to game code. */
export function createFacebookOverlayCapability(sdk: FacebookInstantSdk): OverlayCapability | undefined {
  const overlays = sdk.overlayViews;
  if (!overlays) return undefined;
  const supported = new Set(sdk.getSupportedAPIs());
  if (
    !supported.has("overlayViews.createProfilePictureOverlayViewAsync") ||
    !supported.has("overlayViews.createProfileNameOverlayViewAsync")
  ) return undefined;

  return {
    async renderPlayer({playerId, surface}) {
      if (playerId !== sdk.player.getID()) {
        return {status: "terminal-failure", message: "facebook-overlay-player-mismatch"};
      }
      if (!surface.isConnected) {
        return {status: "terminal-failure", message: "facebook-overlay-surface-detached"};
      }
      const created: FacebookOverlayView[] = [];
      try {
        const picture = await overlays.createProfilePictureOverlayViewAsync(
          surface,
          PROFILE_PICTURE_STYLE,
          IFRAME_STYLE,
        );
        created.push(picture);
        const name = await overlays.createProfileNameOverlayViewAsync(
          surface,
          PROFILE_NAME_STYLE,
          IFRAME_STYLE,
          "",
        );
        created.push(name);
        await Promise.all(created.map((view) => view.showAsync()));
        let destroyed = false;
        return {
          status: "success",
          value: async () => {
            if (destroyed) return;
            destroyed = true;
            await destroyViews(created);
          },
        };
      } catch (error) {
        await destroyViews(created);
        return failure(error);
      }
    },
  };
}

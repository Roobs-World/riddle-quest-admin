import {tr} from "../../../../../src/localization/browser/i18n";
import type {FacebookOverlayView, FacebookOverlayViews} from "../fbinstant";
import {FACEBOOK_OVERLAY_DIRECTORY, type FacebookProfileOverlayLayout} from "./FacebookProfileOverlayLayout";

export const FACEBOOK_OVERLAY_FRAME_STYLE = "position:relative;border:0;width:100%;height:64px;overflow:hidden;background:transparent;pointer-events:none;";
const convenienceFrameStyle = "position:relative;border:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none;";
const pictureStyle = "border:0;width:48px;height:48px;overflow:hidden;background:transparent;";
const nameStyle = "border:0;max-width:240px;overflow:hidden;background:transparent;white-space:nowrap;text-overflow:ellipsis;";

type CreateOptions = {
  surface: HTMLElement;
  own: (view: FacebookOverlayView) => void;
  assertCurrent: () => void;
};
type GenericFactory = (layout: FacebookProfileOverlayLayout, options: CreateOptions) => Promise<FacebookOverlayView>;
export type FacebookProfileFactory =
  | {kind: "convenience"; picture(surface: HTMLElement): Promise<FacebookOverlayView>; name(surface: HTMLElement): Promise<FacebookOverlayView>}
  | {kind: "generic"; create: GenericFactory};

/** Frame attributes describe the provider surface without extracting its private content. */
export function prepareFacebookOverlayFrame(view: FacebookOverlayView, iframeStyle?: string): HTMLIFrameElement | undefined {
  const frame = view.getIFrameElement?.();
  if (!frame) return undefined;
  if (iframeStyle !== undefined) frame.style.cssText = iframeStyle;
  frame.title = tr("Profile.TITLE");
  frame.tabIndex = -1;
  return frame;
}

/** Optional factory variants select one rendering path, never duplicate profile surfaces. */
export function selectFacebookProfileFactory(overlays: FacebookOverlayViews, supported: Set<string>): FacebookProfileFactory | undefined {
  const has = (api: string) => supported.has(`overlayViews.${api}`);
  if (has("createProfilePictureOverlayViewAsync") && typeof overlays.createProfilePictureOverlayViewAsync === "function" &&
    has("createProfileNameOverlayViewAsync") && typeof overlays.createProfileNameOverlayViewAsync === "function") {
    const picture = overlays.createProfilePictureOverlayViewAsync.bind(overlays);
    const name = overlays.createProfileNameOverlayViewAsync.bind(overlays);
    return {kind: "convenience",
      picture: surface => picture(surface, pictureStyle, convenienceFrameStyle),
      name: surface => name(surface, nameStyle, convenienceFrameStyle, "")};
  }

  const fileAsync = has("createOverlayViewAsync") && typeof overlays.createOverlayViewAsync === "function"
    ? overlays.createOverlayViewAsync.bind(overlays) : undefined;
  const inlineAsync = has("createOverlayViewWithXMLStringAsync") && typeof overlays.createOverlayViewWithXMLStringAsync === "function"
    ? overlays.createOverlayViewWithXMLStringAsync.bind(overlays) : undefined;
  if (fileAsync || inlineAsync) return {kind: "generic", create: async (layout, options) => {
    const pending = fileAsync
      ? fileAsync(layout.filename, options.surface, FACEBOOK_OVERLAY_FRAME_STYLE, "", {})
      : inlineAsync?.(layout.xml, options.surface, FACEBOOK_OVERLAY_FRAME_STYLE, "", {}, FACEBOOK_OVERLAY_DIRECTORY);
    const view = await pending;
    if (!view) throw new Error("facebook-overlay-factory-unavailable");
    options.own(view);
    options.assertCurrent();
    prepareFacebookOverlayFrame(view, FACEBOOK_OVERLAY_FRAME_STYLE);
    return view;
  }};

  const file = has("createOverlayView") && typeof overlays.createOverlayView === "function"
    ? overlays.createOverlayView.bind(overlays) : undefined;
  const inline = has("createOverlayViewWithXMLString") && typeof overlays.createOverlayViewWithXMLString === "function"
    ? overlays.createOverlayViewWithXMLString.bind(overlays) : undefined;
  if (!file && !inline) return undefined;
  return {kind: "generic", create: async (layout, options) => {
    let ready: (view: FacebookOverlayView) => void = () => undefined;
    let failed: (view: FacebookOverlayView, error: unknown) => void = () => undefined;
    const initialized = new Promise<FacebookOverlayView>((resolve, reject) => {
      ready = view => {
        try {options.own(view); resolve(view);} catch (error) {reject(error);}
      };
      failed = (view, error) => {
        try {options.own(view);} catch (ownershipError) {reject(ownershipError); return;}
        reject(error);
      };
    });
    // Initialization can reject synchronously, including when the factory subsequently throws.
    void initialized.catch(() => undefined);
    const view = file ? file(layout.filename, "", {}, ready, failed)
      : inline?.(layout.xml, "", {}, ready, failed, FACEBOOK_OVERLAY_DIRECTORY);
    if (!view) throw new Error("facebook-overlay-factory-unavailable");
    options.own(view);
    options.assertCurrent();
    const frame = prepareFacebookOverlayFrame(view, FACEBOOK_OVERLAY_FRAME_STYLE);
    if (!frame) throw new Error("facebook-overlay-frame-unavailable");
    // Callback factories initialize only after their immediately returned frame is attached.
    options.surface.appendChild(frame);
    return await initialized;
  }};
}

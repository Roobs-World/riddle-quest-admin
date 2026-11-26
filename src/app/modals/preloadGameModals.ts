import {preload} from "react-dom";
import chestClosedUrl from "../../../assets/images-web/chest-closed.webp";
import chestOpenUrl from "../../../assets/images-web/chest-open.webp";

/** Shared preparation of Hint, Skip, and the other gameplay modal assets. */
let pending: Promise<{
  /** Component exposed to React's lazy loader. */
  default: typeof import("./components/GameModalView").GameModalView;
}> | null = null;

/** Reuses background preparation and permits a later retry if loading fails. */
export function preloadGameModals() {
  preload(chestClosedUrl, {as: "image"});
  preload(chestOpenUrl, {as: "image"});
  return pending ??= import("./components/GameModalView")
    .then((module) => ({default: module.GameModalView}))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
}

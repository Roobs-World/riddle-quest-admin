import {
  useYouTubePlayableBoot as useSharedYouTubePlayableBoot,
  type YouTubeBootController,
  type YouTubeBootPresentation,
} from "../../local/hooks/index";
import {youtubeContentSource} from "../../../content/browser/bundledContent";
import type {YouTubeSdkPort} from "../../../platform/contracts/localGamePolicy";
export type {YouTubeBootController, YouTubeBootState, YouTubeRuntime} from "../../local/hooks/index";
/** Applies platform pause state to the document. */
const markPaused = (paused: boolean): void => {
  document.documentElement.classList.toggle("youtube-game-paused", paused);
  /** Interactive YouTube root. */
  const root = document.querySelector<HTMLElement>("[data-youtube-playable-root]");
  if (paused) root?.setAttribute("inert", "");
  else root?.removeAttribute("inert");
};
/** Mirrors the platform audio preference onto the document for stylesheet-driven media. */
const applyAudio = (enabled: boolean): void => {
  document.documentElement.dataset.youtubeAudio = enabled ? "enabled" : "disabled";
};
/** Browser presentation for the shared boot controller. */
const browserPresentation: YouTubeBootPresentation = Object.freeze({
  onPausedChange: markPaused,
  onAudioChange: applyAudio,
});
/** Owns YouTube load, migration, recovery, and lifecycle ordering behind one interface. */
export function useYouTubePlayableBoot(sdk: YouTubeSdkPort): YouTubeBootController {
  return useSharedYouTubePlayableBoot(sdk, youtubeContentSource, browserPresentation);
}

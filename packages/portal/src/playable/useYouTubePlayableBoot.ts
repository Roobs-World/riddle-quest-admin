import {
  useYouTubePlayableBoot as useSharedYouTubePlayableBoot,
  type YouTubeBootController,
  type YouTubeBootPresentation,
} from "@qwordly/solo/react";
import {youtubeContentSource} from "./content";
import type {YouTubeSdkPort} from "./types";
export type {YouTubeBootController, YouTubeBootState, YouTubeRuntime} from "@qwordly/solo/react";
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

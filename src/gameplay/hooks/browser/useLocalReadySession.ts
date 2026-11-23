import type {RefObject} from "react";
import {
  useYouTubeReadySession as useSharedYouTubeReadySession,
  type YouTubeAccessibilityPreferences,
  type YouTubeReadySession,
} from "../../local/hooks/index";
import {type LocalSoloAuthority} from "../../local/LocalSoloAuthority";
import type {YouTubeSdkPort} from "../../../platform/contracts/localGamePolicy";
/** Applies accessibility preferences as document classes consumed by the Playable stylesheet. */
const applyPreferences = (preferences: YouTubeAccessibilityPreferences): (() => void) => {
  document.documentElement.classList.toggle("youtube-reduced-motion", preferences.reducedMotion);
  document.documentElement.classList.toggle("youtube-high-contrast", preferences.highContrast);
  return () => {
    document.documentElement.classList.remove("youtube-reduced-motion", "youtube-high-contrast");
  };
};
/** Coordinates authority, platform, accessibility, focus, and UTC lifecycle for the ready view. */
export function useYouTubeReadySession(
  authority: LocalSoloAuthority,
  sdk: YouTubeSdkPort,
  inputRef: RefObject<HTMLInputElement | null>,
): YouTubeReadySession {
  return useSharedYouTubeReadySession(authority, sdk, {
    focusAnswer: () => inputRef.current?.focus(),
    applyPreferences,
  });
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public FCM Web Push certificate; never a private VAPID key. */
  readonly VITE_JEST_CHALLENGE_PUSH_VAPID_KEY?: string;
  /** Approved Jest launch route for offline notification clicks. */
  readonly VITE_JEST_PUBLIC_GAME_URL?: string;
  /** Compile-time Web Target selected by the Vite build profile. */
  readonly VITE_PLATFORM_TARGET: "jest" | "facebook" | "reddit" | "youtube" | "netflix" | "yahoo";
  readonly VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID?: string;
  readonly VITE_FACEBOOK_REWARDED_PLACEMENT_ID?: string;
  readonly VITE_YAHOO_OAUTH_START_URL?: string;
}

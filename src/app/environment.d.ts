/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Explicit deployment origin of our hosted notification service. */
  readonly VITE_NOTIFICATION_SERVICE_URL?: string;
  /** Compile-time Web Target selected by the Vite build profile. */
  readonly VITE_PLATFORM_TARGET: "jest" | "facebook" | "reddit" | "youtube" | "netflix" | "yahoo";
  readonly VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID?: string;
  readonly VITE_FACEBOOK_REWARDED_PLACEMENT_ID?: string;
  readonly VITE_YAHOO_OAUTH_START_URL?: string;
}

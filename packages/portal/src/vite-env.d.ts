/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Compile-time Web Target selected by the Vite build profile. */
  readonly VITE_PLATFORM_TARGET: "jest" | "facebook" | "reddit" | "youtube" | "netflix" | "yahoo";
  readonly VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID?: string;
  readonly VITE_FACEBOOK_REWARDED_PLACEMENT_ID?: string;
}

import type {AdsCapability, PlatformResult} from "../platform/types";
import type {FacebookInstantSdk} from "./fbinstant";
import {
  canShowFacebookInterstitial,
  createFacebookInterstitialState,
  recordFacebookInterstitialShown,
  type FacebookInterstitialState,
} from "./FacebookInterstitialPolicy";

/** Provides failure behavior. */
const failure = (error: unknown): PlatformResult<void> => ({
  status: "retryable-failure",
  message: error instanceof Error ? error.message : "facebook-ad-failed",
});

/** Creates a result-only interstitial adapter whose in-memory state is scoped to one game session. */
export function createFacebookAdsCapability({
  sdk,
  placementId,
  adFree,
  now = Date.now,
}: {
  /** Stores sdk. */
  sdk: FacebookInstantSdk;
  /** Stores placement id. */
  placementId: string;
  /** Stores ad free. */
  adFree: boolean;
  /** Stores now. */
  now?: () => number;
}): AdsCapability | undefined {
  /** Normalizes d placement. */
  const normalizedPlacement = placementId.trim();
  if (!normalizedPlacement || normalizedPlacement.length > 256 || !sdk.getInterstitialAdAsync) return undefined;
  /** Provides state behavior. */
  let state: FacebookInterstitialState = createFacebookInterstitialState(adFree);
  /** Provides showing interstitial behavior. */
  let showingInterstitial = false;
  /** Provides interstitials disabled behavior. */
  let interstitialsDisabled = false;

  return {
    /** Provides show interstitial behavior. */
    async showInterstitial(placement) {
      /** Starts ed at ms. */
      let startedAtMs: number;
      try {
        startedAtMs = now();
      } catch {
        return {status: "unavailable", message: "facebook-interstitial-clock-invalid"};
      }
      if (
        interstitialsDisabled ||
        showingInterstitial ||
        placement !== "result" ||
        !canShowFacebookInterstitial(state, "result", startedAtMs)
      ) {
        return {status: "unavailable", message: "facebook-interstitial-suppressed"};
      }
      showingInterstitial = true;
      /** Provides impression displayed behavior. */
      let impressionDisplayed = false;
      try {
        /** Provides ad behavior. */
        const ad = await sdk.getInterstitialAdAsync!(normalizedPlacement);
        await ad.loadAsync();
        await ad.showAsync();
        impressionDisplayed = true;
        /** Completes d at ms. */
        const completedAtMs = now();
        if (!Number.isSafeInteger(completedAtMs) || completedAtMs < startedAtMs) {
          throw new Error("facebook-interstitial-clock-invalid");
        }
        state = recordFacebookInterstitialShown(state, completedAtMs);
        return {status: "success", value: undefined};
      } catch (error) {
        // Meta may have displayed the impression even when local bookkeeping became unsafe.
        // Suppress the rest of the session instead of risking a frequency-policy violation.
        if (impressionDisplayed) interstitialsDisabled = true;
        return failure(error);
      } finally {
        showingInterstitial = false;
      }
    },
    /** Provides show rewarded behavior. */
    async showRewarded() {
      return {status: "unavailable", message: "facebook-rewarded-unavailable"};
    },
  };
}

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
  sdk: FacebookInstantSdk;
  placementId: string;
  adFree: boolean;
  now?: () => number;
}): AdsCapability | undefined {
  const normalizedPlacement = placementId.trim();
  if (!normalizedPlacement || normalizedPlacement.length > 256 || !sdk.getInterstitialAdAsync) return undefined;
  let state: FacebookInterstitialState = createFacebookInterstitialState(adFree);
  let showingInterstitial = false;
  let interstitialsDisabled = false;

  return {
    async showInterstitial(placement) {
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
      let impressionDisplayed = false;
      try {
        const ad = await sdk.getInterstitialAdAsync!(normalizedPlacement);
        await ad.loadAsync();
        await ad.showAsync();
        impressionDisplayed = true;
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
    async showRewarded() {
      return {status: "unavailable", message: "facebook-rewarded-unavailable"};
    },
  };
}

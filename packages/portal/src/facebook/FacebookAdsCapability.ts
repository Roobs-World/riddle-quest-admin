import type {AdsCapability, PlatformResult} from "../platform/types";
import type {FacebookInstantSdk} from "./fbinstant";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {
  canShowFacebookInterstitial,
  createFacebookInterstitialState,
  recordFacebookInterstitialShown,
  recordFacebookRewardedShown,
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
  rewardedPlacementId = "",
  rewardedEnabled = false,
  adFree,
  now = Date.now,
}: {
  /** Stores sdk. */
  sdk: FacebookInstantSdk;
  /** Stores placement id. */
  placementId: string;
  /** Provider placement for opt-in rewarded video. */
  rewardedPlacementId?: string;
  /** Server-controlled release switch for rewarded video. */
  rewardedEnabled?: boolean;
  /** Stores ad free. */
  adFree: boolean;
  /** Stores now. */
  now?: () => number;
}): AdsCapability | undefined {
  /** Normalizes d placement. */
  const normalizedPlacement = placementId.trim();
  /** Provides normalized rewarded placement behavior. */
  const normalizedRewardedPlacement = rewardedPlacementId.trim();
  /** Each ad format must be supported by this host, even if both SDK methods exist. */
  const supportedApis = new Set(sdk.getSupportedAPIs());
  /** Provides interstitial available behavior. */
  const interstitialAvailable = Boolean(
    normalizedPlacement && normalizedPlacement.length <= 256 &&
      supportedApis.has("getInterstitialAdAsync") && typeof sdk.getInterstitialAdAsync === "function",
  );
  /** Provides rewarded available behavior. */
  const rewardedAvailable = Boolean(
    rewardedEnabled &&
      normalizedRewardedPlacement &&
      normalizedRewardedPlacement.length <= 256 &&
      supportedApis.has("getRewardedVideoAsync") && typeof sdk.getRewardedVideoAsync === "function",
  );
  if (!interstitialAvailable && !rewardedAvailable) return undefined;
  /** Provides state behavior. */
  let state: FacebookInterstitialState = createFacebookInterstitialState(adFree);
  /** Provides showing interstitial behavior. */
  let showingInterstitial = false;
  /** Provides showing rewarded behavior. */
  let showingRewarded = false;
  /** Provides interstitials disabled behavior. */
  let interstitialsDisabled = false;

  return {
    rewardedAvailable,
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
        !interstitialAvailable ||
        showingInterstitial ||
        showingRewarded ||
        placement !== "result" ||
        !canShowFacebookInterstitial(state, "result", startedAtMs)
      ) {
        return {status: "unavailable", message: "facebook-interstitial-suppressed"};
      }
      showingInterstitial = true;
      /** Provides impression displayed behavior. */
      let impressionDisplayed = false;
      return runFacebookSdkDialog(sdk, async () => {
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
        }
      }).finally(() => {showingInterstitial = false;});
    },
    /** Provides show rewarded behavior. */
    async showRewarded(placement) {
      if (!rewardedAvailable || showingRewarded || showingInterstitial || placement !== "continue") {
        return {status: "unavailable", message: "facebook-rewarded-unavailable"};
      }
      showingRewarded = true;
      return runFacebookSdkDialog(sdk, async () => {
        try {
          /** Provides started at ms behavior. */
          const startedAtMs = now();
          if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) {
            return {status: "unavailable", message: "facebook-rewarded-clock-invalid"};
          }
          /** Provides ad behavior. */
          const ad = await sdk.getRewardedVideoAsync!(normalizedRewardedPlacement);
          await ad.loadAsync();
          await ad.showAsync();
          /** Provides completed at ms behavior. */
          const completedAtMs = now();
          if (!Number.isSafeInteger(completedAtMs) || completedAtMs < startedAtMs) {
            throw new Error("facebook-rewarded-clock-invalid");
          }
          state = recordFacebookRewardedShown(state, completedAtMs);
          return {status: "success", value: undefined};
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "USER_INPUT") {
            return {status: "cancelled"};
          }
          return failure(error);
        }
      }).finally(() => {showingRewarded = false;});
    },
  };
}

import type {AdsCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "./fbinstant";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {trackEvent} from "../../../../src/observability/analytics/events";
import type {FacebookAdFormat} from "./FacebookAdConfiguration";
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
  isActive = () => true,
  refreshEligibility = async () => true,
  now = Date.now,
}: {
  /** Stores sdk. */
  sdk: FacebookInstantSdk;
  /** Stores placement id. */
  placementId: string;
  /** Provider placement for opt-in rewarded video. */
  rewardedPlacementId?: string;
  /** Server-controlled release switch for rewarded video. */
  rewardedEnabled?: boolean | (() => boolean);
  /** Stores ad free. */
  adFree: boolean | (() => boolean);
  isActive?: () => boolean;
  /** Resolves current server feature and subscription gates before requesting or displaying an ad. */
  refreshEligibility?: (format: FacebookAdFormat) => Promise<boolean>;
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
  const rewardedSupported = Boolean(
      normalizedRewardedPlacement &&
      normalizedRewardedPlacement.length <= 256 &&
      supportedApis.has("getRewardedVideoAsync") && typeof sdk.getRewardedVideoAsync === "function",
  );
  if (!interstitialAvailable && !rewardedSupported) return undefined;
  const isRewardedEnabled = () => typeof rewardedEnabled === "function" ? rewardedEnabled() : rewardedEnabled;
  /** Provides state behavior. */
  const hasAdFreeEntitlement = () => typeof adFree === "function" ? adFree() : adFree;
  /** Current interstitial readiness, cooldown, and entitlement state. */
  let state: FacebookInterstitialState = createFacebookInterstitialState(hasAdFreeEntitlement());
  /** Provides showing interstitial behavior. */
  let showingInterstitial = false;
  /** Provides showing rewarded behavior. */
  let showingRewarded = false;
  /** Provides interstitials disabled behavior. */
  let interstitialsDisabled = false;

  return {
    get rewardedAvailable() {return rewardedSupported && isActive() && isRewardedEnabled();},
    /** Provides show interstitial behavior. */
    async showInterstitial(placement, isPlacementCurrent = () => true) {
      /** Starts ed at ms. */
      let startedAtMs: number;
      try {
        startedAtMs = now();
      } catch {
        return {status: "unavailable", message: "facebook-interstitial-clock-invalid"};
      }
      if (
        !isActive() ||
        interstitialsDisabled ||
        !interstitialAvailable ||
        showingInterstitial ||
        showingRewarded ||
        placement !== "result" ||
        !isPlacementCurrent()
      ) {
        return {status: "unavailable", message: "facebook-interstitial-suppressed"};
      }
      showingInterstitial = true;
      let impressionDisplayed = false;
      try {
        if (!await refreshEligibility("interstitial") || !isActive() || !isPlacementCurrent() ||
          !canShowFacebookInterstitial({...state, adFree: hasAdFreeEntitlement()}, "result", startedAtMs)) {
          return {status: "unavailable", message: "facebook-interstitial-suppressed"};
        }
        return await runFacebookSdkDialog(sdk, async () => {
          if (!isActive() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
            return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          }
          trackEvent("ad_requested", {ad_format: "interstitial", placement});
          const ad = await sdk.getInterstitialAdAsync!(normalizedPlacement);
          if (!isActive() || !isPlacementCurrent()) return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          await ad.loadAsync();
          if (!await refreshEligibility("interstitial") || !isActive() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
            return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          }
          await ad.showAsync();
          if (isActive()) trackEvent("ad_completed", {ad_format: "interstitial", placement});
          impressionDisplayed = true;
          /** Completes d at ms. */
          const completedAtMs = now();
          if (!Number.isSafeInteger(completedAtMs) || completedAtMs < startedAtMs) {
            throw new Error("facebook-interstitial-clock-invalid");
          }
          state = recordFacebookInterstitialShown(state, completedAtMs);
          return {status: "success", value: undefined};
        });
      } catch (error) {
        if (isActive()) trackEvent("ad_failed", {ad_format: "interstitial", placement});
        // A displayed impression still counts when local bookkeeping fails.
        if (impressionDisplayed) interstitialsDisabled = true;
        return failure(error);
      } finally {
        showingInterstitial = false;
      }
    },
    /** Provides show rewarded behavior. */
    async showRewarded(placement) {
      if (!isActive() || !rewardedSupported || showingRewarded || showingInterstitial || placement !== "continue") {
        return {status: "unavailable", message: "facebook-rewarded-unavailable"};
      }
      showingRewarded = true;
      try {
        if (!await refreshEligibility("rewarded") || !isActive() || !isRewardedEnabled()) {
          return {status: "unavailable", message: "facebook-rewarded-unavailable"};
        }
        return await runFacebookSdkDialog(sdk, async () => {
          if (!isActive() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          /** Provides started at ms behavior. */
          const startedAtMs = now();
          if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) {
            return {status: "unavailable", message: "facebook-rewarded-clock-invalid"};
          }
          trackEvent("ad_requested", {ad_format: "rewarded", placement});
          /** Provides ad behavior. */
          const ad = await sdk.getRewardedVideoAsync!(normalizedRewardedPlacement);
          if (!isActive() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          await ad.loadAsync();
          if (!await refreshEligibility("rewarded") || !isActive() || !isRewardedEnabled()) {
            return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          }
          await ad.showAsync();
          if (isActive()) trackEvent("ad_completed", {ad_format: "rewarded", placement});
          /** Provides completed at ms behavior. */
          const completedAtMs = now();
          if (!Number.isSafeInteger(completedAtMs) || completedAtMs < startedAtMs) {
            throw new Error("facebook-rewarded-clock-invalid");
          }
          state = recordFacebookRewardedShown(state, completedAtMs);
          return {status: "success", value: undefined};
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "USER_INPUT") {
          if (isActive()) trackEvent("ad_cancelled", {ad_format: "rewarded", placement});
          return {status: "cancelled"};
        }
        if (isActive()) trackEvent("ad_failed", {ad_format: "rewarded", placement});
        return failure(error);
      } finally {
        showingRewarded = false;
      }
    },
  };
}

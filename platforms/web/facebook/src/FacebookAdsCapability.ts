import type {AdsCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "./fbinstant";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {trackEvent} from "../../../../src/observability/analytics/events";
import type {FacebookAdFormat} from "./FacebookAdConfiguration";
import {createFacebookAdPreparation} from "./ads/FacebookAdPreparation";
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

/** Validates metadata on the handle returned by the requested native ad factory. */
const assertPlacement = (ad: unknown, expected: string): void => {
  let matches = false;
  try {
    if (typeof ad === "object" && ad !== null && "getPlacementID" in ad &&
        typeof ad.getPlacementID === "function") {
      const reported: unknown = ad.getPlacementID();
      // Native Android handles can omit placement metadata even for the requested factory placement.
      matches = reported === undefined || reported === expected;
    }
  } catch { /* Provider errors and identifiers never become game diagnostics. */ }
  if (!matches) throw new Error("facebook-ad-placement-invalid");
};

/** Creates a result-only interstitial adapter whose in-memory state is scoped to one game session. */
export function createFacebookAdsCapability({
  sdk,
  placementId,
  rewardedPlacementId = "",
  rewardedEnabled = false,
  rewardedOfferAvailable,
  adFree,
  isActive = () => true,
  capturePresentation = () => () => true,
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
  /** A retryable offer can remain visible while strict impression authorization is unknown. */
  rewardedOfferAvailable?: () => boolean;
  /** Stores ad free. */
  adFree: boolean | (() => boolean);
  isActive?: () => boolean;
  /** Captures the foreground visit before preparation; an admitted display keeps its native lifetime. */
  capturePresentation?: () => () => boolean;
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
  const preparation = createFacebookAdPreparation();

  return {
    get rewardedAvailable() {return rewardedSupported && isActive() && (rewardedOfferAvailable?.() ?? isRewardedEnabled());},
    /** Provides show interstitial behavior. */
    async showInterstitial(placement, isPlacementCurrent = () => true) {
      const presentationIsCurrent = capturePresentation();
      const canPresent = () => isActive() && presentationIsCurrent();
      /** Starts ed at ms. */
      let startedAtMs: number;
      try {
        startedAtMs = now();
      } catch {
        return {status: "unavailable", message: "facebook-interstitial-clock-invalid"};
      }
      if (
        !canPresent() ||
        interstitialsDisabled ||
        !interstitialAvailable ||
        showingInterstitial ||
        showingRewarded ||
        preparation.isPending() ||
        placement !== "result" ||
        !isPlacementCurrent()
      ) {
        return {status: "unavailable", message: "facebook-interstitial-suppressed"};
      }
      showingInterstitial = true;
      let impressionDisplayed = false;
      try {
        if (!await refreshEligibility("interstitial") || !canPresent() || !isPlacementCurrent() ||
          !canShowFacebookInterstitial({...state, adFree: hasAdFreeEntitlement()}, "result", startedAtMs)) {
          return {status: "unavailable", message: "facebook-interstitial-suppressed"};
        }
        return await runFacebookSdkDialog(sdk, async () => {
          if (!canPresent() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
            return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          }
          trackEvent("ad_requested", {ad_format: "interstitial", placement});
          const ad = await preparation.run("create", () => sdk.getInterstitialAdAsync!(normalizedPlacement));
          if (!canPresent() || !isPlacementCurrent()) return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          assertPlacement(ad, normalizedPlacement);
          if (!canPresent() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
            return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          }
          await preparation.run("load", () => ad.loadAsync());
          if (!await refreshEligibility("interstitial") || !canPresent() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
            return {status: "unavailable", message: "facebook-interstitial-suppressed"};
          }
          assertPlacement(ad, normalizedPlacement);
          if (!canPresent() || !isPlacementCurrent() || hasAdFreeEntitlement()) {
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
      const presentationIsCurrent = capturePresentation();
      const canPresent = () => isActive() && presentationIsCurrent();
      if (!canPresent() || !rewardedSupported || showingRewarded || showingInterstitial || preparation.isPending() || placement !== "continue") {
        return {status: "unavailable", message: "facebook-rewarded-unavailable"};
      }
      showingRewarded = true;
      try {
        if (!await refreshEligibility("rewarded") || !canPresent() || !isRewardedEnabled()) {
          return {status: "unavailable", message: "facebook-rewarded-unavailable"};
        }
        return await runFacebookSdkDialog(sdk, async () => {
          if (!canPresent() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          /** Provides started at ms behavior. */
          const startedAtMs = now();
          if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) {
            return {status: "unavailable", message: "facebook-rewarded-clock-invalid"};
          }
          trackEvent("ad_requested", {ad_format: "rewarded", placement});
          /** Provides ad behavior. */
          const ad = await preparation.run("create", () => sdk.getRewardedVideoAsync!(normalizedRewardedPlacement));
          if (!canPresent() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          assertPlacement(ad, normalizedRewardedPlacement);
          if (!canPresent() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          await preparation.run("load", () => ad.loadAsync());
          if (!await refreshEligibility("rewarded") || !canPresent() || !isRewardedEnabled()) {
            return {status: "unavailable", message: "facebook-rewarded-unavailable"};
          }
          assertPlacement(ad, normalizedRewardedPlacement);
          if (!canPresent() || !isRewardedEnabled()) return {status: "unavailable", message: "facebook-rewarded-unavailable"};
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

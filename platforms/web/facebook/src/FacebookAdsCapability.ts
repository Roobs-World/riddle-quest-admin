import type {AdsCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "./fbinstant";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {trackEvent} from "../../../../src/observability/analytics/events";
import type {FacebookAdFormat} from "./FacebookAdConfiguration";
import {createFacebookAdPreparation} from "./ads/FacebookAdPreparation";
import {recordFacebookInterstitialError, type FacebookInterstitialTraceLease, type FacebookInterstitialTracePhase} from "./ads/FacebookInterstitialTrace";
import {
  getFacebookInterstitialSuppressionReason,
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
  captureInterstitialTrace,
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
  /** Captures the initiating completion before any asynchronous ad work. */
  captureInterstitialTrace?: () => FacebookInterstitialTraceLease | undefined;
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
      const trace = captureInterstitialTrace?.();
      const deny = (condition: boolean, reason: FacebookInterstitialTracePhase): boolean => {
        if (condition) trace?.record(reason);
        return condition;
      };
      const outcome = (result: PlatformResult<void>): PlatformResult<void> => {
        trace?.record(result.status);
        return result;
      };
      const suppressed = (): PlatformResult<void> => outcome({status: "unavailable", message: "facebook-interstitial-suppressed"});
      trace?.record("admission");
      try {
        const presentationIsCurrent = capturePresentation();
        const canPresent = () => !deny(!isActive(), "account-inactive") &&
          !deny(!presentationIsCurrent(), "foreground-invalid");
        const resultIsCurrent = () => !deny(!isPlacementCurrent(), "result-no-longer-current");
        const adFreeGate = () => deny(hasAdFreeEntitlement(), "ad-free-gate");
        let startedAtMs: number;
        try {
          startedAtMs = now();
        } catch {
          trace?.record("clock-invalid");
          return outcome({status: "unavailable", message: "facebook-interstitial-clock-invalid"});
        }
        if (
          !canPresent() ||
          deny(interstitialsDisabled, "disabled-after-bookkeeping-failure") ||
          deny(!interstitialAvailable, "format-unavailable") ||
          deny(showingInterstitial, "interstitial-busy") ||
          deny(showingRewarded, "rewarded-busy") ||
          deny(preparation.isPending(), "preparation-pending") ||
          deny(placement !== "result", "wrong-placement") ||
          !resultIsCurrent()
        ) return suppressed();
        showingInterstitial = true;
        let impressionDisplayed = false;
        try {
          trace?.record("eligibility-initial");
          const eligible = await refreshEligibility("interstitial");
          trace?.record("eligibility-initial-resolved");
          const frequencySuppressed = () => {
            const reason = getFacebookInterstitialSuppressionReason(
              {...state, adFree: hasAdFreeEntitlement()}, "result", startedAtMs,
            );
            if (reason) trace?.record(reason);
            return reason !== undefined;
          };
          if (deny(!eligible, "eligibility-denied") || !canPresent() || !resultIsCurrent() || frequencySuppressed()) {
            return suppressed();
          }
          trace?.record("dialog-guard");
          const result = await runFacebookSdkDialog(sdk, async () => {
            trace?.record("dialog-operation");
            if (!canPresent() || !resultIsCurrent() || adFreeGate()) return suppressed();
            trackEvent("ad_requested", {ad_format: "interstitial", placement});
            const ad = await preparation.run("create", () => {
              trace?.record("create-invoked");
              return sdk.getInterstitialAdAsync!(normalizedPlacement);
            });
            trace?.record("create-resolved");
            if (!canPresent() || !resultIsCurrent()) return suppressed();
            trace?.record("placement-before-load");
            assertPlacement(ad, normalizedPlacement);
            if (!canPresent() || !resultIsCurrent() || adFreeGate()) return suppressed();
            await preparation.run("load", () => {
              trace?.record("load-invoked");
              return ad.loadAsync();
            });
            trace?.record("load-resolved");
            trace?.record("eligibility-after-load");
            const stillEligible = await refreshEligibility("interstitial");
            trace?.record("eligibility-after-load-resolved");
            if (deny(!stillEligible, "eligibility-denied") || !canPresent() || !resultIsCurrent() || adFreeGate()) {
              return suppressed();
            }
            trace?.record("placement-before-show");
            assertPlacement(ad, normalizedPlacement);
            if (!canPresent() || !resultIsCurrent() || adFreeGate()) return suppressed();
            trace?.record("show-invoked");
            await ad.showAsync();
            trace?.record("show-resolved");
            if (isActive()) trackEvent("ad_completed", {ad_format: "interstitial", placement});
            impressionDisplayed = true;
            let completedAtMs: number;
            try { completedAtMs = now(); }
            catch (error) {
              trace?.record("clock-invalid");
              throw error;
            }
            if (!Number.isSafeInteger(completedAtMs) || completedAtMs < startedAtMs) {
              trace?.record("clock-invalid");
              throw new Error("facebook-interstitial-clock-invalid");
            }
            state = recordFacebookInterstitialShown(state, completedAtMs);
            return {status: "success", value: undefined};
          });
          if (result.status === "unavailable") {
            if (result.message === "facebook-provider-dialog-in-progress") trace?.record("dialog-busy");
            if (result.message === "facebook-provider-surface-not-hidden") trace?.record("surface-not-hidden");
          }
          return outcome(result);
        } catch (error) {
          recordFacebookInterstitialError(trace, error);
          if (isActive()) trackEvent("ad_failed", {ad_format: "interstitial", placement});
          // A displayed impression still counts when local bookkeeping fails.
          if (impressionDisplayed) interstitialsDisabled = true;
          return outcome(failure(error));
        } finally {
          showingInterstitial = false;
        }
      } finally {
        trace?.record("finished");
        trace?.close();
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

/**
 * @fileoverview
 * Hook that encapsulates AppLovin MAX rewarded ad lifecycle for Qwordly.
 *
 * This hook manages loading and showing rewarded ads, subscribes to all
 * relevant AppLovin MAX rewarded callbacks, and reports completed rewards
 * to the backend via the `awardedAdCallback` Firebase Function.
 *
 * It never awards coins directly on the client. The server remains the
 * authority for applying rewards based on AppLovin's S2S callbacks; this
 * hook is responsible only for UX state and telemetry.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import {
  AdInfo,
  RewardedAd,
  AdLoadFailedInfo,
  AdDisplayFailedInfo,
  AdRewardInfo,
} from "react-native-applovin-max";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../contexts/AuthContext";
import Constants from "expo-constants";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";
import { analyticsService } from "../services/AnalyticsService";

/**
 * Extend AdRewardInfo type to include native methods that exist on the
 * underlying native object but are not surfaced in the JS typings.
 */
interface ExtendedAdRewardInfo extends AdRewardInfo {
  getAmount(): number;
  getLabel(): string;
  getAdUnitId(): string;
  getPlacement(): string | null;
  getNetworkName(): string;
}

// Access the Ad Unit ID from app.config.js extras
const REWARDED_AD_UNIT_ID = Constants.expoConfig?.extra
  ?.APPLOVIN_REWARDED_AD_UNIT_ID as string | undefined;

if (!REWARDED_AD_UNIT_ID) {
  logger.error(
    "CRITICAL ERROR: APPLOVIN_REWARDED_AD_UNIT_ID environment variable is not set. Rewarded ads will not function."
  );
}

// AppLovin recommends retrying with exponentially higher delays up to a maximum delay
const MAX_EXPONENTIAL_RETRY_COUNT = 6;

/**
 * Public API returned from the `useRewardedAds` hook.
 */
interface UseRewardedAds {
  isRewardedAdReady: boolean;
  loadRewardedAd: () => void;
  showRewardedAd: () => void;
  // You might want to expose loading state, error state, etc.
  // isLoading: boolean;
  // error: string | null;
}

/**
 * Provides a thin, typed interface around AppLovin MAX rewarded ads.
 *
 * The hook exposes boolean readiness state plus imperative `loadRewardedAd`
 * and `showRewardedAd` helpers to be used from UI components. It automatically
 * wires MAX event listeners, implements a bounded exponential backoff strategy
 * for load failures, and forwards reward completions to the backend.
 *
 * @returns An object describing whether a rewarded ad is ready and helpers
 * to load or show the ad.
 */
const useRewardedAds = (): UseRewardedAds => {
  const [isRewardedAdReady, setIsRewardedAdReady] = useState(false);
  const retryAttempt = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playerData } = useAuth();

  // --- Ad Loading Function (wrapped in useCallback) ---

  const loadRewardedAd = useCallback(() => {
    if (!REWARDED_AD_UNIT_ID) {
      logger.error(
        "Cannot load rewarded ad: APPLOVIN_REWARDED_AD_UNIT_ID is not set."
      );
      return;
    }
    logger.debug("Loading rewarded ad...");
    // Check if SDK is initialized before loading ads, potentially add a state for SDK initialized status
    // if (AppLovinMAX.isInitialized()) { // Check SDK initialization status if available/needed
    RewardedAd.loadAd(REWARDED_AD_UNIT_ID);
    // } else {
    //    logger.warn("AppLovin SDK not initialized. Cannot load rewarded ad.");
    // }
  }, []);

  // --- Event Listeners for Rewarded Ads ---

  const onRewardedAdLoaded = useCallback((adInfo: AdInfo) => {
    logger.debug("Rewarded ad loaded from " + adInfo.networkName);
    setIsRewardedAdReady(true);
    retryAttempt.current = 0; // Reset retry attempt
    void analyticsService.logAdEvent("loaded", { network_name: adInfo.networkName });
  }, []);

  const onRewardedAdLoadFailed = useCallback(
    (errorInfo: AdLoadFailedInfo) => {
      logger.debug(
        "Rewarded ad failed to load with code " +
          errorInfo.code +
          " and message: " +
          errorInfo.message
      );
      setIsRewardedAdReady(false);
      void analyticsService.logAdEvent("load_failed", { error_code: errorInfo.code });

      // AppLovin recommends retrying with exponentially higher delays
      retryAttempt.current++;
      if (retryAttempt.current > MAX_EXPONENTIAL_RETRY_COUNT) {
        logger.warn("Rewarded ad load retry limit reached.");
        return;
      }

      const retryDelay = Math.pow(
        2,
        Math.min(MAX_EXPONENTIAL_RETRY_COUNT, retryAttempt.current)
      );

      logger.debug(
        `Retrying rewarded ad load in ${retryDelay}s (attempt ${retryAttempt.current})...`
      );

      retryTimerRef.current = setTimeout(() => {
        loadRewardedAd();
      }, retryDelay * 1000);
    },
    [loadRewardedAd]
  );

  const onRewardedAdDisplayFailed = useCallback(
    (adInfo: AdDisplayFailedInfo) => {
      logger.debug(
        "Rewarded ad failed to display with code " +
          adInfo.code +
          " and message: " +
          adInfo.message
      );
      setIsRewardedAdReady(false); // Ad failed to display, so it's no longer ready
      // AppLovin recommends loading the next ad if one fails to display
      loadRewardedAd();
    },
    [loadRewardedAd]
  );

  const onRewardedAdDisplayed = useCallback(
    (adInfo: AdInfo) => {
      logger.debug("Rewarded ad displayed");
      void analyticsService.logAdEvent("displayed", { network_name: adInfo.networkName });
    },
    []
  );

  const onRewardedAdClicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      logger.debug("Rewarded ad clicked");
    },
    []
  );

  const onRewardedAdHidden = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      logger.debug("Rewarded ad hidden");
      setIsRewardedAdReady(false); // Ad is hidden, so it's no longer ready
      // Pre-load the next ad
      loadRewardedAd();
    },
    [loadRewardedAd]
  );

  const onUserRewarded = useCallback(
    async (rewardInfo: AdRewardInfo) => {
      // Cast to ExtendedAdRewardInfo to access native methods
      const extendedRewardInfo = rewardInfo as ExtendedAdRewardInfo;

      // Access amount and label using methods based on common patterns in native SDKs
      // The type definition might not reflect these methods directly.
      // Using 'any' and checking for method existence to bypass strict type checking.
      const amount = extendedRewardInfo.getAmount();
      const label = extendedRewardInfo.getLabel();
      logger.debug("User rewarded: " + amount + " " + label);
      void analyticsService.logAdEvent("completed", { reward_amount: amount, reward_label: label });

      // IMPORTANT: Do NOT award coins directly on the client side.
      // The actual coin awarding should happen server-side AFTER AppLovin sends
      // the S2S rewarded callback to your backend and you validate it.
      // The client-side onUserRewarded event can be used for immediate UI feedback,
      // but the server is the authority for awarding the reward based on its S2S callback.

      // Notify the backend that the user was rewarded.
      if (playerData?.userId) {
        try {
          const adUnitId = extendedRewardInfo.getAdUnitId();
          const placement = extendedRewardInfo.getPlacement();
          const networkName = extendedRewardInfo.getNetworkName();

          logger.debug(
            `Calling rewardedAdCallback with userId: ${playerData.userId}, adUnitId: ${adUnitId}, placement: ${placement}, network: ${networkName}`
          );

          // Placement for the Firebase function can be the adUnitId or a custom string
          // Using adUnitId if available, otherwise null or a default string if necessary
          const firebasePlacement =
            adUnitId || placement || networkName || "rewarded_ad";

          await httpsCallable(getFunctions(getApp()), "awardedAdCallback")({
            userId: playerData.userId,
            placement: firebasePlacement, // Send ad unit ID or placement string
            // You could also send amount and label if your backend wants to verify them, though S2S is more reliable
            // amount: amount,
            // label: label,
          });
          logger.debug(
            "Successfully notified server of rewarded ad completion."
          );
        } catch (error) {
          logger.error(
            "Error calling rewardedAdCallback Firebase function:",
            error
          );
          captureException(error);
        }
      } else {
        logger.warn("Cannot notify server: User ID not available.");
      }
    },
    [playerData]
  );

  // --- Hook Lifecycle ---

  // Keep stable refs so listeners registered once always call the latest callback.
  // This prevents listener accumulation: without this pattern, every time `playerData`
  // changes `onUserRewarded` gets a new reference, the effect re-runs, and another
  // set of 7 listeners piles up on top of the previous ones.
  const callbacksRef = useRef({
    onRewardedAdLoaded,
    onRewardedAdLoadFailed,
    onRewardedAdDisplayFailed,
    onRewardedAdDisplayed,
    onRewardedAdClicked,
    onRewardedAdHidden,
    onUserRewarded,
  });

  // Sync refs on every render without triggering re-registration.
  useEffect(() => {
    callbacksRef.current = {
      onRewardedAdLoaded,
      onRewardedAdLoadFailed,
      onRewardedAdDisplayFailed,
      onRewardedAdDisplayed,
      onRewardedAdClicked,
      onRewardedAdHidden,
      onUserRewarded,
    };
  });

  // Register stable wrappers exactly once. Each wrapper delegates to the
  // latest callback via the ref, so state changes are always reflected
  // without adding new listeners.
  useEffect(() => {
    RewardedAd.addAdLoadedEventListener((info: AdInfo) => callbacksRef.current.onRewardedAdLoaded(info));
    RewardedAd.addAdLoadFailedEventListener((info: AdLoadFailedInfo) => callbacksRef.current.onRewardedAdLoadFailed(info));
    RewardedAd.addAdFailedToDisplayEventListener((info: AdDisplayFailedInfo) => callbacksRef.current.onRewardedAdDisplayFailed(info));
    RewardedAd.addAdDisplayedEventListener((info: AdInfo) => callbacksRef.current.onRewardedAdDisplayed(info));
    RewardedAd.addAdClickedEventListener((info: AdInfo) => callbacksRef.current.onRewardedAdClicked(info));
    RewardedAd.addAdHiddenEventListener((info: AdInfo) => callbacksRef.current.onRewardedAdHidden(info));
    RewardedAd.addAdReceivedRewardEventListener((info: AdRewardInfo) => callbacksRef.current.onUserRewarded(info));
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []); // Empty — registers once for the lifetime of the hook

  const showRewardedAd = useCallback(() => {
    if (!REWARDED_AD_UNIT_ID) {
      logger.error(
        "Cannot show rewarded ad: APPLOVIN_REWARDED_AD_UNIT_ID is not set."
      );
      return;
    }
    if (isRewardedAdReady) {
      logger.debug("Showing rewarded ad...");
      RewardedAd.showAd(REWARDED_AD_UNIT_ID);
    } else {
      logger.debug("Rewarded ad is not ready yet.");
      // Optionally, load the ad if it's not ready
      loadRewardedAd();
    }
  }, [isRewardedAdReady, loadRewardedAd]);

  // --- Initial Ad Load ---

  // Removed automatic loading - ads should only load when explicitly requested
  // useEffect(() => {
  //   // Initial load when the hook is first used.
  //   // This will attempt to load the ad assuming the SDK is initialized early in the app lifecycle.
  //   // A more robust approach might involve waiting for the SDK initialization confirmation.
  //   loadRewardedAd();
  // }, [loadRewardedAd]); // Fixed dependency

  return {
    isRewardedAdReady,
    loadRewardedAd,
    showRewardedAd,
  };
};

export default useRewardedAds;

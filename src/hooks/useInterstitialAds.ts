/**
 * @fileoverview
 * Hook that manages AppLovin MAX interstitial ad lifecycle for Qwordly.
 *
 * This hook handles loading, showing, and tracking basic state for
 * interstitial ads. It attaches the required MAX event listeners once per
 * hook instance and exposes a small, typed API that UI components can call
 * when they want to show an interstitial between game flows.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  AdInfo,
  InterstitialAd,
  AdLoadFailedInfo,
  AdDisplayFailedInfo,
} from "react-native-applovin-max";
import Constants from "expo-constants";
import { logger } from "../utils/logger";

const INTERSTITIAL_AD_UNIT_ID =
  Constants.expoConfig?.extra?.APPLOVIN_INTERSTITIAL_AD_UNIT_ID;

/** Delay before retrying interstitial ad load after a failure (ms). */
const INTERSTITIAL_RETRY_DELAY_MS = 5000;

/**
 * Public API returned from the `useInterstitialAds` hook.
 */
interface InterstitialAdHook {
  isAdLoading: boolean;
  isAdShowing: boolean;
  loadInterstitialAd: () => void;
  showInterstitialAd: () => void;
  wasAdDisplayed: boolean;
}

/**
 * Provides imperative helpers and state for working with AppLovin MAX
 * interstitial ads.
 *
 * The hook tracks loading and display state, registers event listeners,
 * and exposes `loadInterstitialAd`/`showInterstitialAd` helpers that can
 * be called from screens or components when an ad break is appropriate.
 *
 * @returns Object with booleans for loading/showing state, a flag
 * indicating if an ad was displayed in the last attempt, and functions
 * to load or show an interstitial.
 */
export const useInterstitialAds = (): InterstitialAdHook => {
  const [isAdLoading, setIsAdLoading] = useState<boolean>(false);
  const [isAdShowing, setIsAdShowing] = useState<boolean>(false);
  const [isAdLoaded, setIsAdLoaded] = useState<boolean>(false);
  const [wasAdDisplayed, setWasAdDisplayed] = useState<boolean>(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Ad Loading Function (wrapped in useCallback) ---

  const loadInterstitialAd = useCallback(() => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      logger.error(
        "Interstitial Ad Unit ID is not configured. Cannot load ad."
      );
      return;
    }
    if (isAdLoading || isAdLoaded) {
      // logger.debug('Interstitial ad is already loading or loaded.');
      return;
    }
    setIsAdLoading(true);
    InterstitialAd.loadAd(INTERSTITIAL_AD_UNIT_ID);
    logger.debug("Attempting to load Interstitial Ad...");
  }, [isAdLoading, isAdLoaded]);

  // --- Event Listeners for Interstitial Ads ---

  const onInterstitialAdLoaded = useCallback((adInfo: AdInfo) => {
    setIsAdLoaded(true);
    setIsAdLoading(false);
    logger.debug("Interstitial ad loaded:", adInfo);
  }, []);

  const onInterstitialAdLoadFailed = useCallback(
    (errorInfo: AdLoadFailedInfo) => {
      setIsAdLoading(false);
      setIsAdLoaded(false);
      logger.error("Interstitial ad failed to load:", errorInfo);
      // Simple retry after delay without exponential backoff to avoid complexity
      retryTimerRef.current = setTimeout(() => loadInterstitialAd(), INTERSTITIAL_RETRY_DELAY_MS);
    },
    [loadInterstitialAd]
  );

  const onInterstitialAdDisplayed = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      setIsAdShowing(true);
      setWasAdDisplayed(true); // Ad was displayed
      logger.debug("Interstitial ad displayed");
    },
    []
  );

  const onInterstitialAdDisplayFailed = useCallback(
    (adInfo: AdDisplayFailedInfo) => {
      setIsAdShowing(false);
      setIsAdLoaded(false); // Ad failed to display, so it's no longer considered loaded
      logger.error("Interstitial ad failed to display:", adInfo);
      // Optionally, try to load a new ad
      loadInterstitialAd();
    },
    [loadInterstitialAd]
  );

  const onInterstitialAdHidden = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      setIsAdShowing(false);
      setIsAdLoaded(false); // Ad is hidden, consider it used, load another one for next time
      logger.debug("Interstitial ad hidden");
      // Pre-load the next ad
      loadInterstitialAd();
    },
    [loadInterstitialAd]
  );

  const onInterstitialAdClicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      logger.debug("Interstitial ad clicked");
    },
    []
  );

  // --- Hook Lifecycle ---

  // Stable refs prevent listener accumulation: re-registering on every callback
  // change would stack duplicate listeners on the global AppLovin event bus.
  const callbacksRef = useRef({
    onInterstitialAdLoaded,
    onInterstitialAdLoadFailed,
    onInterstitialAdDisplayFailed,
    onInterstitialAdDisplayed,
    onInterstitialAdClicked,
    onInterstitialAdHidden,
  });

  useEffect(() => {
    callbacksRef.current = {
      onInterstitialAdLoaded,
      onInterstitialAdLoadFailed,
      onInterstitialAdDisplayFailed,
      onInterstitialAdDisplayed,
      onInterstitialAdClicked,
      onInterstitialAdHidden,
    };
  });

  useEffect(() => {
    // Attach event listeners
    InterstitialAd.addAdLoadedEventListener((info: AdInfo) => callbacksRef.current.onInterstitialAdLoaded(info));
    InterstitialAd.addAdLoadFailedEventListener((info: AdLoadFailedInfo) => callbacksRef.current.onInterstitialAdLoadFailed(info));
    InterstitialAd.addAdFailedToDisplayEventListener((info: AdDisplayFailedInfo) => callbacksRef.current.onInterstitialAdDisplayFailed(info));
    InterstitialAd.addAdDisplayedEventListener((info: AdInfo) => callbacksRef.current.onInterstitialAdDisplayed(info));
    InterstitialAd.addAdClickedEventListener((info: AdInfo) => callbacksRef.current.onInterstitialAdClicked(info));
    InterstitialAd.addAdHiddenEventListener((info: AdInfo) => callbacksRef.current.onInterstitialAdHidden(info));
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []); // Registers once — wrappers always call the latest callback via ref

  const showInterstitialAd = useCallback(() => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      logger.error(
        "Interstitial Ad Unit ID is not configured. Cannot show ad."
      );
      return;
    }
    if (isAdLoaded) {
      setWasAdDisplayed(false); // Reset before showing
      InterstitialAd.showAd(INTERSTITIAL_AD_UNIT_ID);
    } else {
      logger.debug("Interstitial ad not ready to show. Attempting to load.");
      loadInterstitialAd(); // Attempt to load if not ready
    }
  }, [isAdLoaded, loadInterstitialAd]);

  return {
    isAdLoading,
    isAdShowing,
    loadInterstitialAd,
    showInterstitialAd,
    wasAdDisplayed,
  };
};

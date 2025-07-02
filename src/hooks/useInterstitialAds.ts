import { useEffect, useState, useCallback } from "react";
import {
  AdInfo,
  InterstitialAd,
  AdLoadFailedInfo,
  AdDisplayFailedInfo,
} from "react-native-applovin-max";
import Constants from "expo-constants";

const INTERSTITIAL_AD_UNIT_ID =
  Constants.expoConfig?.extra?.APPLOVIN_INTERSTITIAL_AD_UNIT_ID;

interface InterstitialAdHook {
  isAdLoading: boolean;
  isAdShowing: boolean;
  loadInterstitialAd: () => void;
  showInterstitialAd: () => void;
  wasAdDisplayed: boolean;
}

export const useInterstitialAds = (): InterstitialAdHook => {
  const [isAdLoading, setIsAdLoading] = useState<boolean>(false);
  const [isAdShowing, setIsAdShowing] = useState<boolean>(false);
  const [isAdLoaded, setIsAdLoaded] = useState<boolean>(false);
  const [wasAdDisplayed, setWasAdDisplayed] = useState<boolean>(false);

  // --- Ad Loading Function (wrapped in useCallback) ---

  const loadInterstitialAd = useCallback(() => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      console.error(
        "Interstitial Ad Unit ID is not configured. Cannot load ad."
      );
      return;
    }
    if (isAdLoading || isAdLoaded) {
      // console.log('Interstitial ad is already loading or loaded.');
      return;
    }
    setIsAdLoading(true);
    InterstitialAd.loadAd(INTERSTITIAL_AD_UNIT_ID);
    console.log("Attempting to load Interstitial Ad...");
  }, [isAdLoading, isAdLoaded]);

  // --- Event Listeners for Interstitial Ads ---

  const onInterstitialAdLoaded = useCallback((adInfo: AdInfo) => {
    setIsAdLoaded(true);
    setIsAdLoading(false);
    console.log("Interstitial ad loaded:", adInfo);
  }, []);

  const onInterstitialAdLoadFailed = useCallback(
    (errorInfo: AdLoadFailedInfo) => {
      setIsAdLoading(false);
      setIsAdLoaded(false);
      console.error("Interstitial ad failed to load:", errorInfo);
      // Simple retry after delay without exponential backoff to avoid complexity
      setTimeout(() => loadInterstitialAd(), 5000); // Retry after 5 seconds
    },
    [loadInterstitialAd]
  );

  const onInterstitialAdDisplayed = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      setIsAdShowing(true);
      setWasAdDisplayed(true); // Ad was displayed
      console.log("Interstitial ad displayed");
    },
    []
  );

  const onInterstitialAdDisplayFailed = useCallback(
    (adInfo: AdDisplayFailedInfo) => {
      setIsAdShowing(false);
      setIsAdLoaded(false); // Ad failed to display, so it's no longer considered loaded
      console.error("Interstitial ad failed to display:", adInfo);
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
      console.log("Interstitial ad hidden");
      // Pre-load the next ad
      loadInterstitialAd();
    },
    [loadInterstitialAd]
  );

  const onInterstitialAdClicked = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_adInfo: AdInfo) => {
      console.log("Interstitial ad clicked");
    },
    []
  );

  // --- Hook Lifecycle ---

  useEffect(() => {
    // Attach event listeners when the hook mounts
    InterstitialAd.addAdLoadedEventListener(onInterstitialAdLoaded);
    InterstitialAd.addAdLoadFailedEventListener(onInterstitialAdLoadFailed);
    InterstitialAd.addAdFailedToDisplayEventListener(
      onInterstitialAdDisplayFailed
    );
    InterstitialAd.addAdDisplayedEventListener(onInterstitialAdDisplayed);
    InterstitialAd.addAdClickedEventListener(onInterstitialAdClicked);
    InterstitialAd.addAdHiddenEventListener(onInterstitialAdHidden);

    // Removed automatic loading - ads should only load when explicitly requested
    // loadInterstitialAd();

    // No explicit listener removal here based on observed documentation patterns.
    // The listeners will persist for the lifetime of the hook instance.
  }, [
    onInterstitialAdLoaded,
    onInterstitialAdLoadFailed,
    onInterstitialAdDisplayFailed,
    onInterstitialAdDisplayed,
    onInterstitialAdClicked,
    onInterstitialAdHidden,
    // Removed loadInterstitialAd from dependencies to prevent issues
  ]);

  const showInterstitialAd = useCallback(() => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      console.error(
        "Interstitial Ad Unit ID is not configured. Cannot show ad."
      );
      return;
    }
    if (isAdLoaded) {
      setWasAdDisplayed(false); // Reset before showing
      InterstitialAd.showAd(INTERSTITIAL_AD_UNIT_ID);
    } else {
      console.log("Interstitial ad not ready to show. Attempting to load.");
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

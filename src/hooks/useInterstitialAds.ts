import { useEffect, useState, useCallback } from "react";
import applovin, { AppLovinMAX } from "react-native-applovin-max";
import Config from "react-native-dotenv";

const INTERSTITIAL_AD_UNIT_ID = Config.APPLOVIN_INTERSTITIAL_AD_UNIT_ID;

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
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [wasAdDisplayed, setWasAdDisplayed] = useState<boolean>(false); // New state

  const initializeInterstitialAds = useCallback(() => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      console.error("Interstitial Ad Unit ID is not configured.");
      return;
    }
    applovin.createInterstitial(INTERSTITIAL_AD_UNIT_ID);
    console.log("Interstitial Ad created with ID:", INTERSTITIAL_AD_UNIT_ID);
  }, []);

  useEffect(() => {
    initializeInterstitialAds();

    const listeners: AppLovinMAX.InterstitialAdListener[] = [
      {
        onAdLoaded: (adInfo) => {
          setIsAdLoaded(true);
          setIsAdLoading(false);
          setRetryAttempt(0);
          console.log("Interstitial ad loaded:", adInfo);
        },
        onAdLoadFailed: (errorInfo) => {
          setIsAdLoading(false);
          setIsAdLoaded(false);
          console.error("Interstitial ad failed to load:", errorInfo);
          // Exponential backoff retry
          setRetryAttempt((prev) => prev + 1);
          const retryDelay = Math.pow(2, retryAttempt) * 1000;
          setTimeout(() => loadInterstitialAd(), Math.min(retryDelay, 60000)); // Max 60s
        },
        onAdDisplayed: (adInfo) => {
          setIsAdShowing(true);
          setWasAdDisplayed(true); // Ad was displayed
          console.log("Interstitial ad displayed:", adInfo);
        },
        onAdDisplayFailed: (adInfo, errorInfo) => {
          setIsAdShowing(false);
          setIsAdLoaded(false); // Ad failed to display, so it's no longer considered loaded
          console.error(
            "Interstitial ad failed to display:",
            errorInfo,
            adInfo
          );
          // Optionally, try to load a new ad
          loadInterstitialAd();
        },
        onAdHidden: (adInfo) => {
          setIsAdShowing(false);
          setIsAdLoaded(false); // Ad is hidden, consider it used, load another one for next time
          console.log("Interstitial ad hidden:", adInfo);
          // Pre-load the next ad
          loadInterstitialAd();
        },
        onAdClicked: (adInfo) => {
          console.log("Interstitial ad clicked:", adInfo);
        },
      },
    ];

    listeners.forEach((listener) => {
      applovin.addEventListener(
        "OnInterstitialLoadedEvent",
        listener.onAdLoaded!
      );
      applovin.addEventListener(
        "OnInterstitialLoadFailedEvent",
        listener.onAdLoadFailed!
      );
      applovin.addEventListener(
        "OnInterstitialDisplayedEvent",
        listener.onAdDisplayed!
      );
      applovin.addEventListener(
        "OnInterstitialAdFailedToDisplayEvent",
        listener.onAdDisplayFailed!
      );
      applovin.addEventListener(
        "OnInterstitialHiddenEvent",
        listener.onAdHidden!
      );
      applovin.addEventListener(
        "OnInterstitialClickedEvent",
        listener.onAdClicked!
      );
    });

    // Initial load
    loadInterstitialAd();

    return () => {
      listeners.forEach((listener) => {
        applovin.removeEventListener(
          "OnInterstitialLoadedEvent",
          listener.onAdLoaded!
        );
        applovin.removeEventListener(
          "OnInterstitialLoadFailedEvent",
          listener.onAdLoadFailed!
        );
        applovin.removeEventListener(
          "OnInterstitialDisplayedEvent",
          listener.onAdDisplayed!
        );
        applovin.removeEventListener(
          "OnInterstitialAdFailedToDisplayEvent",
          listener.onAdDisplayFailed!
        );
        applovin.removeEventListener(
          "OnInterstitialHiddenEvent",
          listener.onAdHidden!
        );
        applovin.removeEventListener(
          "OnInterstitialClickedEvent",
          listener.onAdClicked!
        );
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeInterstitialAds, retryAttempt]); // Added retryAttempt to dependencies

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
    applovin.loadInterstitial(INTERSTITIAL_AD_UNIT_ID);
    console.log("Attempting to load Interstitial Ad...");
  }, [isAdLoading, isAdLoaded]);

  const showInterstitialAd = useCallback(async () => {
    if (!INTERSTITIAL_AD_UNIT_ID) {
      console.error(
        "Interstitial Ad Unit ID is not configured. Cannot show ad."
      );
      return;
    }
    const isReady = await applovin.isInterstitialReady(INTERSTITIAL_AD_UNIT_ID);
    if (isReady) {
      setWasAdDisplayed(false); // Reset before showing
      applovin.showInterstitial(INTERSTITIAL_AD_UNIT_ID);
    } else {
      console.log("Interstitial ad not ready to show. Attempting to load.");
      loadInterstitialAd(); // Attempt to load if not ready
    }
  }, [loadInterstitialAd]);

  return {
    isAdLoading,
    isAdShowing,
    loadInterstitialAd,
    showInterstitialAd,
    wasAdDisplayed,
  };
};

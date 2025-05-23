import { useEffect, useState, useRef } from "react";
import AppLovinMAX, {
  AdInfo,
  RewardedAd,
  AdLoadFailedInfo,
  AdDisplayFailedInfo,
  AdRewardInfo,
} from "react-native-applovin-max";
import functions from "@react-native-firebase/functions";
import { useAuth } from "../contexts/AuthContext";
import Constants from "expo-constants";

// Access the Ad Unit ID from app.config.js extras
const REWARDED_AD_UNIT_ID = Constants.expoConfig?.extra
  ?.APPLOVIN_REWARDED_AD_UNIT_ID as string | undefined;

if (!REWARDED_AD_UNIT_ID) {
  console.error(
    "CRITICAL ERROR: APPLOVIN_REWARDED_AD_UNIT_ID environment variable is not set. Rewarded ads will not function."
  );
}

// AppLovin recommends retrying with exponentially higher delays up to a maximum delay
const MAX_EXPONENTIAL_RETRY_COUNT = 6;

interface UseRewardedAds {
  isRewardedAdReady: boolean;
  loadRewardedAd: () => void;
  showRewardedAd: () => void;
  // You might want to expose loading state, error state, etc.
  // isLoading: boolean;
  // error: string | null;
}

const useRewardedAds = (): UseRewardedAds => {
  const [isRewardedAdReady, setIsRewardedAdReady] = useState(false);
  const retryAttempt = useRef(0);
  const { playerData } = useAuth();

  // --- Event Listeners for Rewarded Ads ---

  const onRewardedAdLoaded = (adInfo: AdInfo) => {
    console.log("Rewarded ad loaded from " + adInfo.networkName);
    setIsRewardedAdReady(true);
    retryAttempt.current = 0; // Reset retry attempt
  };

  const onRewardedAdLoadFailed = (errorInfo: AdLoadFailedInfo) => {
    console.log(
      "Rewarded ad failed to load with code " +
        errorInfo.code +
        " and message: " +
        errorInfo.message
    );
    setIsRewardedAdReady(false);

    // AppLovin recommends retrying with exponentially higher delays
    retryAttempt.current++;
    if (retryAttempt.current > MAX_EXPONENTIAL_RETRY_COUNT) {
      console.warn("Rewarded ad load retry limit reached.");
      return;
    }

    const retryDelay = Math.pow(
      2,
      Math.min(MAX_EXPONENTIAL_RETRY_COUNT, retryAttempt.current)
    );

    console.log(
      `Retrying rewarded ad load in ${retryDelay}s (attempt ${retryAttempt.current})...`
    );

    setTimeout(() => {
      loadRewardedAd();
    }, retryDelay * 1000);
  };

  const onRewardedAdDisplayFailed = (adInfo: AdDisplayFailedInfo) => {
    console.log(
      "Rewarded ad failed to display with code " +
        adInfo.code +
        " and message: " +
        adInfo.message
    );
    setIsRewardedAdReady(false); // Ad failed to display, so it's no longer ready
    // AppLovin recommends loading the next ad if one fails to display
    loadRewardedAd();
  };

  const onRewardedAdDisplayed = (adInfo: AdInfo) => {
    console.log("Rewarded ad displayed");
  };

  const onRewardedAdClicked = (adInfo: AdInfo) => {
    console.log("Rewarded ad clicked");
  };

  const onRewardedAdHidden = (adInfo: AdInfo) => {
    console.log("Rewarded ad hidden");
    setIsRewardedAdReady(false); // Ad is hidden, so it's no longer ready
    // Pre-load the next ad
    loadRewardedAd();
  };

  const onUserRewarded = async (rewardInfo: AdRewardInfo) => {
    // Access amount and label using methods based on common patterns in native SDKs
    // The type definition might not reflect these methods directly.
    // Using 'any' and checking for method existence to bypass strict type checking.
    const amount = (rewardInfo as any).getAmount
      ? (rewardInfo as any).getAmount()
      : 0;
    const label = (rewardInfo as any).getLabel
      ? (rewardInfo as any).getLabel()
      : "";
    console.log("User rewarded: " + amount + " " + label);

    // IMPORTANT: Do NOT award coins directly on the client side.
    // The actual coin awarding should happen server-side AFTER AppLovin sends
    // the S2S rewarded callback to your backend and you validate it.
    // The client-side onUserRewarded event can be used for immediate UI feedback,
    // but the server is the authority for awarding the reward based on its S2S callback.

    // Notify the backend that the user was rewarded.
    if (playerData?.userId) {
      try {
        const adUnitId = (rewardInfo as any).getAdUnitId
          ? (rewardInfo as any).getAdUnitId()
          : REWARDED_AD_UNIT_ID;
        const placement = (rewardInfo as any).getPlacement
          ? (rewardInfo as any).getPlacement()
          : null;
        const networkName = (rewardInfo as any).getNetworkName
          ? (rewardInfo as any).getNetworkName()
          : null;

        console.log(
          `Calling rewardedAdCallback with userId: ${playerData.userId}, adUnitId: ${adUnitId}, placement: ${placement}, network: ${networkName}`
        );

        // Placement for the Firebase function can be the adUnitId or a custom string
        // Using adUnitId if available, otherwise null or a default string if necessary
        const firebasePlacement =
          adUnitId || placement || networkName || "rewarded_ad";

        await functions().httpsCallable("awardedAdCallback")({
          userId: playerData.userId,
          placement: firebasePlacement, // Send ad unit ID or placement string
          // You could also send amount and label if your backend wants to verify them, though S2S is more reliable
          // amount: amount,
          // label: label,
        });
        console.log("Successfully notified server of rewarded ad completion.");
      } catch (error) {
        console.error(
          "Error calling rewardedAdCallback Firebase function:",
          error
        );
      }
    } else {
      console.warn("Cannot notify server: User ID not available.");
    }
  };

  // --- Hook Lifecycle ---

  useEffect(() => {
    // Attach event listeners when the hook mounts
    // AppLovin documentation examples typically don't show explicit removal of these listeners in a hook cleanup.
    // They are likely intended to be attached once after SDK initialization.
    RewardedAd.addAdLoadedEventListener(onRewardedAdLoaded);
    RewardedAd.addAdLoadFailedEventListener(onRewardedAdLoadFailed);
    RewardedAd.addAdFailedToDisplayEventListener(onRewardedAdDisplayFailed);
    RewardedAd.addAdDisplayedEventListener(onRewardedAdDisplayed);
    RewardedAd.addAdClickedEventListener(onRewardedAdClicked);
    RewardedAd.addAdHiddenEventListener(onRewardedAdHidden);
    RewardedAd.addAdReceivedRewardEventListener(onUserRewarded);

    // No explicit listener removal here based on observed documentation patterns.
    // The listeners will persist for the lifetime of the hook instance.
  }, []); // Empty dependency array means this runs once on mount

  // --- Ad Loading and Showing Functions ---

  const loadRewardedAd = () => {
    if (!REWARDED_AD_UNIT_ID) {
      console.error(
        "Cannot load rewarded ad: APPLOVIN_REWARDED_AD_UNIT_ID is not set."
      );
      return;
    }
    console.log("Loading rewarded ad...");
    // Check if SDK is initialized before loading ads, potentially add a state for SDK initialized status
    // if (AppLovinMAX.isInitialized()) { // Check SDK initialization status if available/needed
    RewardedAd.loadAd(REWARDED_AD_UNIT_ID);
    // } else {
    //    console.warn("AppLovin SDK not initialized. Cannot load rewarded ad.");
    // }
  };

  const showRewardedAd = () => {
    if (!REWARDED_AD_UNIT_ID) {
      console.error(
        "Cannot show rewarded ad: APPLOVIN_REWARDED_AD_UNIT_ID is not set."
      );
      return;
    }
    if (isRewardedAdReady) {
      console.log("Showing rewarded ad...");
      RewardedAd.showAd(REWARDED_AD_UNIT_ID);
    } else {
      console.log("Rewarded ad is not ready yet.");
      // Optionally, load the ad if it's not ready
      loadRewardedAd();
    }
  };

  // --- Initial Ad Load ---

  useEffect(() => {
    // Initial load when the hook is first used.
    // This will attempt to load the ad assuming the SDK is initialized early in the app lifecycle.
    // A more robust approach might involve waiting for the SDK initialization confirmation.
    loadRewardedAd();
  }, []); // Empty dependency array to run only once

  return {
    isRewardedAdReady,
    loadRewardedAd,
    showRewardedAd,
  };
};

export default useRewardedAds;

import { useCallback } from "react";

interface UseRewardedAds {
  isRewardedAdReady: boolean;
  loadRewardedAd: () => void;
  showRewardedAd: () => Promise<boolean>;
}

const useRewardedAds = (): UseRewardedAds => {
  const loadRewardedAd = useCallback(() => {
    // Rewarded ads are disabled.
  }, []);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  return {
    isRewardedAdReady: false,
    loadRewardedAd,
    showRewardedAd,
  };
};

export default useRewardedAds;

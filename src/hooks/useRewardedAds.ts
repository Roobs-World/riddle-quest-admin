import { useCallback, useEffect, useState } from "react";
import {
  getRewardedAdReadiness,
  loadRewardedAd as loadRewardedAdService,
  showRewardedAd as showRewardedAdService,
  subscribeToRewardedAdReadiness,
} from "../services/RewardedAdService";

interface UseRewardedAds {
  isRewardedAdReady: boolean;
  loadRewardedAd: () => void;
  showRewardedAd: () => Promise<boolean>;
}

const useRewardedAds = (): UseRewardedAds => {
  const [isRewardedAdReady, setIsRewardedAdReady] = useState<boolean>(
    getRewardedAdReadiness()
  );

  useEffect(() => {
    return subscribeToRewardedAdReadiness(setIsRewardedAdReady);
  }, []);

  const loadRewardedAd = useCallback(() => {
    loadRewardedAdService();
  }, []);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    return showRewardedAdService();
  }, []);

  return {
    isRewardedAdReady,
    loadRewardedAd,
    showRewardedAd,
  };
};

export default useRewardedAds;

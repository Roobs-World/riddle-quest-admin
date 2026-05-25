import { useCallback, useEffect, useState } from "react";
import type {
  AwardedAdCallbackResponse,
  RewardedAdPlacement,
} from "../services/RewardedAdService";
import {
  getRewardedAdReadiness,
  loadRewardedAd as loadRewardedAdService,
  recordRewardedAdCompletion as recordRewardedAdCompletionService,
  showRewardedAd as showRewardedAdService,
  subscribeToRewardedAdReadiness,
} from "../services/RewardedAdService";

interface UseRewardedAds {
  isRewardedAdReady: boolean;
  loadRewardedAd: () => void;
  showRewardedAd: () => Promise<boolean>;
  recordRewardedAdCompletion: (
    placement: RewardedAdPlacement,
    callbackId?: string
  ) => Promise<AwardedAdCallbackResponse>;
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

  const recordRewardedAdCompletion = useCallback(
    (
      placement: RewardedAdPlacement,
      callbackId?: string
    ): Promise<AwardedAdCallbackResponse> =>
      recordRewardedAdCompletionService(placement, callbackId),
    []
  );

  return {
    isRewardedAdReady,
    loadRewardedAd,
    showRewardedAd,
    recordRewardedAdCompletion,
  };
};

export default useRewardedAds;

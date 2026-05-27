import {useCallback, useEffect, useState} from "react";
import type {InterstitialAdPlacement} from "../services/InterstitialAdService";
import {
  getInterstitialAdReadiness,
  loadInterstitialAd as loadInterstitialAdService,
  showInterstitialAd as showInterstitialAdService,
  subscribeToInterstitialAdReadiness,
} from "../services/InterstitialAdService";

interface UseInterstitialAds {
  isInterstitialAdReady: boolean;
  loadInterstitialAd: () => void;
  showInterstitialAd: (placement?: InterstitialAdPlacement) => Promise<boolean>;
}

const useInterstitialAds = (): UseInterstitialAds => {
  const [isInterstitialAdReady, setIsInterstitialAdReady] = useState<boolean>(getInterstitialAdReadiness());

  useEffect(() => {
    return subscribeToInterstitialAdReadiness(setIsInterstitialAdReady);
  }, []);

  const loadInterstitialAd = useCallback(() => {
    loadInterstitialAdService();
  }, []);

  const showInterstitialAd = useCallback(async (placement?: InterstitialAdPlacement): Promise<boolean> => {
    return showInterstitialAdService(placement);
  }, []);

  return {
    isInterstitialAdReady,
    loadInterstitialAd,
    showInterstitialAd,
  };
};

export default useInterstitialAds;

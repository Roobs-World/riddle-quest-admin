import {Platform} from "react-native";
import mobileAds, {AdEventType, InterstitialAd, TestIds} from "react-native-google-mobile-ads";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";

const MAX_LOAD_RETRY_ATTEMPTS = 3;
const LOAD_RETRY_DELAY_MS = 1500;
const SHOW_WAIT_TIMEOUT_MS = 4000;
const CLOSE_WAIT_TIMEOUT_MS = 60000;

export type InterstitialAdPlacement = "post_victory";

let interstitialAd: InterstitialAd | null = null;
let initializePromise: Promise<void> | null = null;
let isServiceInitialized = false;
let isInterstitialAdReady = false;
let isInterstitialAdLoading = false;
let isInterstitialAdShowing = false;
let loadRetryAttemptCount = 0;
let loadRetryTimeout: ReturnType<typeof setTimeout> | null = null;

const readinessSubscribers = new Set<(isReady: boolean) => void>();

const getInterstitialAdUnitId = (): string => {
  // Prefer platform-specific production IDs, then generic GOOGLE_MOBILE_ADS vars,
  // then any EXPO_PUBLIC_* fallbacks (exposed at build/runtime), then test IDs.
  if (Platform.OS === "android") {
    return (
      process.env.ANDROID_INTERSTITIAL_ID ||
      process.env.GOOGLE_MOBILE_ADS_ANDROID_INTERSTITIAL_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_MOBILE_ADS_INTERSTITIAL_AD_UNIT_ID ||
      process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_AD_UNIT_ID ||
      TestIds.INTERSTITIAL
    );
  }

  return (
    process.env.IOS_INTERSTITIAL_ID ||
    process.env.GOOGLE_MOBILE_ADS_IOS_INTERSTITIAL_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_MOBILE_ADS_INTERSTITIAL_AD_UNIT_ID ||
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_AD_UNIT_ID ||
    TestIds.INTERSTITIAL
  );
};

const isSupportedPlatform = (): boolean => Platform.OS === "android" || Platform.OS === "ios";

const isExpectedAdNoFillError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {code?: unknown; message?: unknown};
  return (
    maybeError.code === "googleMobileAds/no-fill" ||
    (typeof maybeError.message === "string" && maybeError.message.toLowerCase().includes("no fill"))
  );
};

const publishReadiness = (): void => {
  readinessSubscribers.forEach((subscriber) => {
    try {
      subscriber(isInterstitialAdReady);
    } catch (error) {
      logger.warn("Interstitial-ad readiness subscriber failed", error);
      captureException(error);
    }
  });
};

const clearLoadRetryTimeout = (): void => {
  if (!loadRetryTimeout) {
    return;
  }
  clearTimeout(loadRetryTimeout);
  loadRetryTimeout = null;
};

const scheduleLoadRetry = (): void => {
  if (loadRetryTimeout) {
    return;
  }
  if (loadRetryAttemptCount >= MAX_LOAD_RETRY_ATTEMPTS) {
    logger.warn(
      `Interstitial ad load retry limit reached (${MAX_LOAD_RETRY_ATTEMPTS}). Waiting for next manual load trigger.`,
    );
    return;
  }

  loadRetryAttemptCount += 1;
  const retryAttempt = loadRetryAttemptCount;
  loadRetryTimeout = setTimeout(() => {
    loadRetryTimeout = null;
    logger.warn(`Retrying interstitial ad load (attempt ${retryAttempt}/${MAX_LOAD_RETRY_ATTEMPTS})`);
    loadInterstitialAd();
  }, LOAD_RETRY_DELAY_MS);
};

const setReadyState = (isReady: boolean): void => {
  if (isInterstitialAdReady === isReady) {
    return;
  }
  isInterstitialAdReady = isReady;
  publishReadiness();
};

const ensureInterstitialAdInstance = (): void => {
  if (interstitialAd || !isSupportedPlatform()) {
    return;
  }

  interstitialAd = InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    isInterstitialAdLoading = false;
    loadRetryAttemptCount = 0;
    clearLoadRetryTimeout();
    setReadyState(true);
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    isInterstitialAdShowing = false;
    isInterstitialAdLoading = false;
    setReadyState(false);
    loadInterstitialAd();
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    isInterstitialAdShowing = false;
    isInterstitialAdLoading = false;
    setReadyState(false);
    logger.warn("Interstitial ad failed to load or show", error);
    if (!isExpectedAdNoFillError(error)) {
      captureException(error);
    }
    scheduleLoadRetry();
  });
};

const waitForInterstitialAdReady = async (timeoutMs = SHOW_WAIT_TIMEOUT_MS): Promise<boolean> =>
  new Promise((resolve) => {
    if (isInterstitialAdReady) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = subscribeToInterstitialAdReadiness((isReady) => {
      if (!isReady) {
        return;
      }

      clearTimeout(timeout);
      unsubscribe();
      resolve(true);
    });
  });

export const initializeInterstitialAds = async (): Promise<void> => {
  if (!isSupportedPlatform()) {
    return;
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      try {
        await mobileAds().initialize();
        isServiceInitialized = true;
        ensureInterstitialAdInstance();
        loadInterstitialAd();
      } catch (error) {
        initializePromise = null;
        logger.error("Failed to initialize Google Mobile Ads for interstitial ads", error);
        captureException(error);
      }
    })();
  }

  await initializePromise;
};

export const loadInterstitialAd = (): void => {
  if (!isSupportedPlatform()) {
    return;
  }

  clearLoadRetryTimeout();

  void initializeInterstitialAds()
    .then(() => {
      if (
        !isServiceInitialized ||
        !interstitialAd ||
        isInterstitialAdReady ||
        isInterstitialAdLoading ||
        isInterstitialAdShowing
      ) {
        return;
      }

      isInterstitialAdLoading = true;
      interstitialAd.load();
    })
    .catch((error) => {
      logger.error("Failed to start interstitial-ad preload", error);
      captureException(error);
    });
};

export const showInterstitialAd = async (placement: InterstitialAdPlacement = "post_victory"): Promise<boolean> => {
  if (!isSupportedPlatform()) {
    return false;
  }

  await initializeInterstitialAds();

  if (!interstitialAd || isInterstitialAdShowing) {
    loadInterstitialAd();
    return false;
  }

  if (!isInterstitialAdReady) {
    loadInterstitialAd();
    const becameReadyInTime = await waitForInterstitialAdReady();
    if (!becameReadyInTime || !isInterstitialAdReady) {
      return false;
    }
  }

  let resolveClosed: ((didClose: boolean) => void) | null = null;
  const closedConfirmation = new Promise<boolean>((resolve) => {
    resolveClosed = resolve;
  });

  const closeTimeout = setTimeout(() => {
    resolveClosed?.(true);
    resolveClosed = null;
  }, CLOSE_WAIT_TIMEOUT_MS);

  const unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    resolveClosed?.(true);
    resolveClosed = null;
  });

  const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
    logger.warn(`Interstitial ad failed while showing at placement "${placement}"`, error);
    resolveClosed?.(false);
    resolveClosed = null;
  });

  try {
    isInterstitialAdShowing = true;
    await interstitialAd.show();
    return await closedConfirmation;
  } catch (error) {
    logger.error(`Failed to show interstitial ad at placement "${placement}"`, error);
    if (!isExpectedAdNoFillError(error)) {
      captureException(error);
    }
    return false;
  } finally {
    clearTimeout(closeTimeout);
    unsubscribeClosed();
    unsubscribeError();
    isInterstitialAdShowing = false;
    setReadyState(false);
    loadInterstitialAd();
  }
};

export const subscribeToInterstitialAdReadiness = (subscriber: (isReady: boolean) => void): (() => void) => {
  readinessSubscribers.add(subscriber);
  subscriber(isInterstitialAdReady);

  return () => {
    readinessSubscribers.delete(subscriber);
  };
};

export const getInterstitialAdReadiness = (): boolean => isInterstitialAdReady;

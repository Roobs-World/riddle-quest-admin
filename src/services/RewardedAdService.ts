import {Platform} from "react-native";
import mobileAds, {AdEventType, RewardedAd, RewardedAdEventType} from "react-native-google-mobile-ads";
import {getApp} from "@react-native-firebase/app";
import {getAuth} from "@react-native-firebase/auth";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {callValidatedFunction} from "../utils/firebaseFunctions";
import {AwardedAdCallbackInputSchema, AwardedAdCallbackOutputSchema} from "../validation/cloudFunctionsSchemas";

const REWARDED_AD_TEST_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
const MAX_LOAD_RETRY_ATTEMPTS = 3;
const LOAD_RETRY_DELAY_MS = 1500;
const SHOW_WAIT_TIMEOUT_MS = 4000;
const REWARD_CONFIRMATION_TIMEOUT_MS = 1500;

export type RewardedAdPlacement = "loss_continue" | "coin_shop";

export type AwardedAdCallbackResponse = {
  success: boolean;
  placement: RewardedAdPlacement;
  callbackId: string;
  rewardCoins: number;
  newCoins: number;
  alreadyProcessed: boolean;
  message: string;
};

let rewardedAd: RewardedAd | null = null;
let initializePromise: Promise<void> | null = null;
let isServiceInitialized = false;
let isRewardedAdReady = false;
let isRewardedAdLoading = false;
let loadRetryAttemptCount = 0;
let loadRetryTimeout: ReturnType<typeof setTimeout> | null = null;

const readinessSubscribers = new Set<(isReady: boolean) => void>();

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
      subscriber(isRewardedAdReady);
    } catch (error) {
      logger.warn("Rewarded-ad readiness subscriber failed", error);
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
      `Rewarded ad load retry limit reached (${MAX_LOAD_RETRY_ATTEMPTS}). Waiting for next manual load trigger.`,
    );
    return;
  }

  loadRetryAttemptCount += 1;
  const retryAttempt = loadRetryAttemptCount;
  loadRetryTimeout = setTimeout(() => {
    loadRetryTimeout = null;
    logger.warn(`Retrying rewarded ad load (attempt ${retryAttempt}/${MAX_LOAD_RETRY_ATTEMPTS})`);
    loadRewardedAd();
  }, LOAD_RETRY_DELAY_MS);
};

const setReadyState = (isReady: boolean): void => {
  if (isRewardedAdReady === isReady) {
    return;
  }
  isRewardedAdReady = isReady;
  publishReadiness();
};

const getRewardedAdUnitId = (): string => {
  if (Platform.OS === "android") {
    return (
      process.env.ANDROID_REWARD_ID ||
      process.env.GOOGLE_MOBILE_ADS_ANDROID_REWARD_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_MOBILE_ADS_REWARD_AD_UNIT_ID ||
      process.env.EXPO_PUBLIC_ADMOB_REWARD_AD_UNIT_ID ||
      REWARDED_AD_TEST_UNIT_ID
    );
  }

  return (
    process.env.IOS_REWARD_ID ||
    process.env.GOOGLE_MOBILE_ADS_IOS_REWARD_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_MOBILE_ADS_REWARD_AD_UNIT_ID ||
    process.env.EXPO_PUBLIC_ADMOB_REWARD_AD_UNIT_ID ||
    REWARDED_AD_TEST_UNIT_ID
  );
};

const ensureRewardedAdInstance = (): void => {
  if (rewardedAd || !isSupportedPlatform()) {
    return;
  }

  rewardedAd = RewardedAd.createForAdRequest(getRewardedAdUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
    isRewardedAdLoading = false;
    loadRetryAttemptCount = 0;
    clearLoadRetryTimeout();
    setReadyState(true);
  });

  rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
    isRewardedAdLoading = false;
    setReadyState(false);
    loadRewardedAd();
  });

  rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
    isRewardedAdLoading = false;
    setReadyState(false);
    logger.warn("Rewarded ad failed to load or show", error);
    if (!isExpectedAdNoFillError(error)) {
      captureException(error);
    }
    scheduleLoadRetry();
  });
};

const waitForRewardedAdReady = async (timeoutMs = SHOW_WAIT_TIMEOUT_MS): Promise<boolean> =>
  new Promise((resolve) => {
    if (isRewardedAdReady) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = subscribeToRewardedAdReadiness((isReady) => {
      if (!isReady) {
        return;
      }

      clearTimeout(timeout);
      unsubscribe();
      resolve(true);
    });
  });

export const initializeRewardedAds = async (): Promise<void> => {
  if (!isSupportedPlatform()) {
    return;
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      try {
        await mobileAds().initialize();
        isServiceInitialized = true;
        ensureRewardedAdInstance();
        loadRewardedAd();
      } catch (error) {
        initializePromise = null;
        logger.error("Failed to initialize Google Mobile Ads", error);
        captureException(error);
      }
    })();
  }

  await initializePromise;
};

export const loadRewardedAd = (): void => {
  if (!isSupportedPlatform()) {
    return;
  }

  clearLoadRetryTimeout();

  void initializeRewardedAds()
    .then(() => {
      if (!isServiceInitialized || !rewardedAd || isRewardedAdReady || isRewardedAdLoading) {
        return;
      }

      isRewardedAdLoading = true;
      rewardedAd.load();
    })
    .catch((error) => {
      logger.error("Failed to start rewarded-ad preload", error);
      captureException(error);
    });
};

export const showRewardedAd = async (): Promise<boolean> => {
  if (!isSupportedPlatform()) {
    return false;
  }

  await initializeRewardedAds();

  if (!rewardedAd) {
    loadRewardedAd();
    return false;
  }

  if (!isRewardedAdReady) {
    loadRewardedAd();
    const becameReadyInTime = await waitForRewardedAdReady();
    if (!becameReadyInTime || !isRewardedAdReady) {
      return false;
    }
  }

  let didEarnReward = false;
  let resolveRewardConfirmation: ((didEarnReward: boolean) => void) | null = null;
  const rewardConfirmation = new Promise<boolean>((resolve) => {
    resolveRewardConfirmation = resolve;
  });

  const rewardConfirmationTimeout = setTimeout(() => {
    resolveRewardConfirmation?.(didEarnReward);
    resolveRewardConfirmation = null;
  }, REWARD_CONFIRMATION_TIMEOUT_MS);

  const unsubscribeReward = rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    didEarnReward = true;
    resolveRewardConfirmation?.(true);
    resolveRewardConfirmation = null;
  });

  const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
    resolveRewardConfirmation?.(didEarnReward);
    resolveRewardConfirmation = null;
  });

  try {
    await rewardedAd.show();
    return await rewardConfirmation;
  } catch (error) {
    logger.error("Failed to show rewarded ad", error);
    if (!isExpectedAdNoFillError(error)) {
      captureException(error);
    }
    return false;
  } finally {
    clearTimeout(rewardConfirmationTimeout);
    unsubscribeReward();
    unsubscribeClosed();
    setReadyState(false);
    loadRewardedAd();
  }
};

export const subscribeToRewardedAdReadiness = (subscriber: (isReady: boolean) => void): (() => void) => {
  readinessSubscribers.add(subscriber);
  subscriber(isRewardedAdReady);

  return () => {
    readinessSubscribers.delete(subscriber);
  };
};

export const getRewardedAdReadiness = (): boolean => isRewardedAdReady;

export const createRewardedAdCallbackId = (placement: RewardedAdPlacement): string =>
  `${placement}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const recordRewardedAdCompletion = async (
  placement: RewardedAdPlacement,
  callbackId = createRewardedAdCallbackId(placement),
): Promise<AwardedAdCallbackResponse> => {
  const userId = getAuth(getApp()).currentUser?.uid;
  if (!userId) {
    throw new Error("Cannot record rewarded ad completion without an authenticated user.");
  }

  return callValidatedFunction(
    "awardedAdCallback",
    {
      userId,
      placement,
      callbackId,
      provider: "google-mobile-ads",
    },
    AwardedAdCallbackInputSchema,
    AwardedAdCallbackOutputSchema,
  );
};

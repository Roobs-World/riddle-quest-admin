/**
 * @fileoverview
 * Main gameplay screen for Riddle Quest.
 *
 * `GameScreen` composes the core game UI (header, board, controls, bottom
 * navigation) and wires it to `useGameLogic`, ads, IAP, hints, and the
 * modal system. It is responsible for coordinating audio, haptics, riddle
 * progression across modes, and user settings such as sound and haptics.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as RNIap from "react-native-iap";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import useRewardedAds from "../../hooks/useRewardedAds";

import Header from "../../components/game/Header";
import Controls from "../../components/game/Controls";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import GameBoard from "../../components/game/GameBoard";
import { SoundManager } from "../../services/SoundManager";
import useGameLogic from "../../hooks/useGameLogic";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { GameMode } from "../../contexts/AuthContext";

import { useAuth } from "../../contexts/AuthContext";
import {
  APP_LANGUAGE_STORAGE_KEY,
  AppStrings,
  SupportedLanguage,
  getAppLanguage,
  isSupportedLanguage,
  setAppLanguage,
} from "../../constants/AppStrings";
import { isTablet, isLargeTablet, isDesktop } from "../../utils/responsive";
import { safeDelay } from "../../utils/timing";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import {
  SKIP_COST_CLASSIC,
  SKIP_COST_DAILY,
  CONTINUE_COST_COINS,
  CONTINUE_REWARDED_AD_COIN_REWARD,
  LEVEL_UP_COIN_BONUS,
  DAILY_CHALLENGE_COIN_REWARD,
  MODAL_CLOSE_DELAY_MS,
  SOUND_RESUME_DELAY_MS,
  getXpLevel,
} from "../../constants/game";
import {
  LOADING_SPINNER_OPACITY,
  LOADING_SPINNER_SIZE,
} from "../../constants/loading";
import { styles } from "../../styles";
import { GameInput } from "../../components/game/GameInput";
import { useModal } from "../../hooks/useModal";
import { ModalProvider } from "../../components/modals/ModalProvider";
import { IapService } from "../../services/IapService";
import {
  ProductPricing,
  ProductPricingService,
} from "../../services/ProductPricingService";
import ModalTogglePanel from "../../components/development/ModalTogglePanel";
import StarryBackground from "../../components/background/StarryBackground";
import GlobalMuteOverlay from "../../components/overlays/GlobalMuteOverlay";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";
import { computeLetterStates } from "../../utils/letterStates";
import { ACHIEVEMENT_DEFINITIONS } from "../../constants/achievements";
import { useGameSessionController } from "../../features/game-session/useGameSessionController";
import { createGameModalActions } from "../../features/game-session/gameModalActions";
import { isGuestPlayer } from "../../features/auth/sessionBootstrap";
import { loadUserProgressFromFirestore } from "../../services/FirestoreService";
import UpgradeAccountModal from "../../components/modals/settings/UpgradeAccountModal";
import type { Player } from "../../validation/firestoreSchemas";
import {
  SOUND_ENABLED_STORAGE_KEY,
  HAPTICS_ENABLED_STORAGE_KEY,
  readBooleanSetting,
  writeBooleanSetting,
} from "../../utils/settingsStorage";
import type { Feedback } from "../../hooks/types";
import OfflineBlockingModal from "../../components/modals/system/OfflineBlockingModal";

interface GuessResult {
  outcome: "win" | "loss" | "continue" | "attemptLimitReached";
  feedback?: ("green" | "yellow" | "red")[];
  correctAnswer?: string;
  coinsEarned?: number;
  scoreEarned?: number;
  canOfferRewardedAd?: boolean;
  canOfferCoinContinue?: boolean;
  attemptsRemaining?: number;
  newlyUnlockedAchievementIds?: string[];
  newWinStreak?: number;
}

interface GameScreenProps {
  riddleId: string;
  riddleText: string;
  answer: string;
  answerLength: number;
  userCoins: number;
  hintCost: number;
  onGameWin: (
    attempts: number,
    coinsEarned: number,
    scoreEarned: number,
    dailyStreakAfterWin?: number,
    bonusCoinsAwarded?: number
  ) => void;
  onGameLoss: (correctAnswer: string, attempts: number) => void;
  onHintUsed: (cost: number) => void | string[] | Promise<void | string[]>;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
  suppressOnboarding?: boolean;
}

const ONBOARDING_SEEN_STORAGE_KEY_PREFIX = "gameScreenOnboardingSeen";

const getOnboardingSeenStorageKey = (userId?: string): string => {
  if (userId) {
    return `${ONBOARDING_SEEN_STORAGE_KEY_PREFIX}:${userId}`;
  }

  return `${ONBOARDING_SEEN_STORAGE_KEY_PREFIX}:anonymous`;
};

const parseCoinBalance = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    const directParsed = Number(normalized);
    if (Number.isFinite(directParsed)) {
      return Math.max(0, directParsed);
    }

    const numericMatch = normalized.match(/-?\d+(\.\d+)?/);
    if (numericMatch) {
      const parsedMatch = Number(numericMatch[0]);
      if (Number.isFinite(parsedMatch)) {
        return Math.max(0, parsedMatch);
      }
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeValueOf = (value as { valueOf?: () => unknown }).valueOf;
    if (typeof maybeValueOf === "function") {
      const fromValueOf = maybeValueOf.call(value);
      if (fromValueOf !== value) {
        const parsedFromValueOf = parseCoinBalance(fromValueOf);
        if (parsedFromValueOf !== null) {
          return parsedFromValueOf;
        }
      }
    }

    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const asString = maybeToString.call(value);
      if (typeof asString === "string" && asString !== "[object Object]") {
        const parsedFromString = parseCoinBalance(asString);
        if (parsedFromString !== null) {
          return parsedFromString;
        }
      }
    }
  }

  return null;
};

const toNonNegativeStatValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

const LETTER_STATE_PRIORITY: Record<Feedback, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const mergeLetterStates = (
  existing: Record<string, Feedback>,
  incoming: Record<string, Feedback>
): Record<string, Feedback> => {
  if (Object.keys(existing).length === 0) {
    return { ...incoming };
  }
  if (Object.keys(incoming).length === 0) {
    return { ...existing };
  }

  const merged = { ...existing };
  for (const [letter, feedback] of Object.entries(incoming)) {
    const currentFeedback = merged[letter];
    if (
      !currentFeedback ||
      LETTER_STATE_PRIORITY[feedback] > LETTER_STATE_PRIORITY[currentFeedback]
    ) {
      merged[letter] = feedback;
    }
  }
  return merged;
};

const resolveProfileSnapshot = (
  localPlayer: Player | null,
  refreshedPlayer: Player
): Player => {
  if (!localPlayer) {
    return refreshedPlayer;
  }

  const localHighestLevelClassic = Math.max(
    toNonNegativeStatValue(localPlayer.stats?.highestLevelClassic),
    toNonNegativeStatValue(localPlayer.progress?.classicIndex)
  );
  const refreshedHighestLevelClassic = Math.max(
    toNonNegativeStatValue(refreshedPlayer.stats?.highestLevelClassic),
    toNonNegativeStatValue(refreshedPlayer.progress?.classicIndex)
  );
  const mergedHighestLevelClassic = Math.max(
    localHighestLevelClassic,
    refreshedHighestLevelClassic
  );

  const localGamesPlayed = toNonNegativeStatValue(localPlayer.stats?.gamesPlayed);
  const refreshedGamesPlayed = toNonNegativeStatValue(
    refreshedPlayer.stats?.gamesPlayed
  );

  // Prefer in-session local stats when they are ahead of a stale server refresh.
  if (localGamesPlayed > refreshedGamesPlayed) {
    return {
      ...refreshedPlayer,
      stats: {
        ...(refreshedPlayer.stats ?? {}),
        ...(localPlayer.stats ?? {}),
        highestLevelClassic: mergedHighestLevelClassic,
      },
    };
  }

  return {
    ...refreshedPlayer,
    stats: {
      ...(refreshedPlayer.stats ?? {}),
      highestLevelClassic: mergedHighestLevelClassic,
    },
  };
};

const GameScreenInner: React.FC<GameScreenProps> = ({
  riddleId,
  riddleText,
  answer,
  answerLength,
  userCoins,
  hintCost,
  onGameWin,
  onGameLoss,
  onHintUsed,
  onSkipUsed,
  onNextLevel,
  gameMode,
  suppressOnboarding = false,
}) => {
  const {
    playerData,
    logout,
    updatePlayerDataLocally,
    pendingStreakBreak,
    consumePendingStreakBreak,
  } = useAuth();
  const modal = useModal();
  const {
    showWelcomeModal,
    showWelcomeBackModal,
    showInstructionsModal,
    showInfoModal,
  } = modal;
  const isGuestMode = isGuestPlayer(playerData);

  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    getAppLanguage()
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const activeSlotIndexRef = useRef(0);
  const { isLoading, runWithServerLoading } = useGameSessionController();
  const modalActions = useMemo(() => createGameModalActions(modal), [modal]);
  const [isProfileModalLoading, setIsProfileModalLoading] = useState(false);
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
  const [isTransitioningToNextLevel, setIsTransitioningToNextLevel] =
    useState(false);
  const isRunningUnderJest =
    typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);
  const shouldUseDevFirestoreCatalog = __DEV__ && !isRunningUnderJest;

  const gameOverHandledRef = useRef(false);
  const lastSubmittedAttemptRef = useRef<number | null>(null);
  const openShopFromLossRef = useRef<() => void>(() => {});
  const coinAnimationSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasLoadedShopCatalogRef = useRef(false);

  const [iapProducts, setIapProducts] = useState<RNIap.Product[]>([]);
  const [iapLoading, setIapLoading] = useState(false);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [firestoreProducts, setFirestoreProducts] = useState<ProductPricing[]>([]);
  const [productPricingLoading, setProductPricingLoading] = useState(false);
  const [productPricingError, setProductPricingError] = useState<string | null>(null);
  const [preservedLetterStates, setPreservedLetterStates] = useState<
    Record<string, Feedback>
  >({});
  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } = useRewardedAds();
  const setActiveSlotIndexSynced = useCallback(
    (value: React.SetStateAction<number>) => {
      setActiveSlotIndex((prev) => {
        const resolved =
          typeof value === "function"
            ? (value as (previous: number) => number)(prev)
            : value;
        activeSlotIndexRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  const {
    guesses,
    currentGuess,
    gameOver,
    setCurrentGuess,
    processGuess,
    continueGame,
    resetGame,
  } = useGameLogic({
    riddleId,
    answer,
    gameMode: gameMode === "daily" ? "challenge" : "classic",
    isGuestMode,
  });

  const currentUserCoins = useMemo(() => {
    const authCoins = parseCoinBalance(playerData?.coins);
    if (authCoins !== null) {
      return authCoins;
    }

    const propCoins = parseCoinBalance(userCoins);
    if (propCoins !== null) {
      return propCoins;
    }

    return 0;
  }, [playerData?.coins, userCoins]);

  const hintRevealedIndicesRef = useRef<number[]>([]);
  const preserveKeyboardLetterStates = useCallback(() => {
    setPreservedLetterStates((existing) =>
      mergeLetterStates(existing, computeLetterStates(guesses))
    );
  }, [guesses]);
  const resetRoundState = useCallback(() => {
    setPreservedLetterStates({});
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    hintRevealedIndicesRef.current = [];
  }, [riddleId, gameMode]);

  useEffect(() => {
    const updateConnectivity = (nextState: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => {
      const disconnected = nextState.isConnected === false;
      const internetUnavailable = nextState.isInternetReachable === false;
      setIsOffline(disconnected || internetUnavailable);
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      updateConnectivity(state);
    });

    void NetInfo.fetch().then(updateConnectivity).catch(() => {
      // If initial reachability check fails, treat as offline to protect game state.
      setIsOffline(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadRewardedAd();
  }, [loadRewardedAd]);

  useEffect(() => {
    logger.debug(
      `Game session context changed (mode=${gameMode}, riddleId=${riddleId}). Resetting local game state.`
    );
    resetRoundState();
  }, [gameMode, riddleId, answer, resetRoundState]);

  const isAnyModalVisible = modal.modals.length > 0;
  const isInteractionBlocked = isAnyModalVisible || isOffline;
  const [canAnimateCoinIncreases, setCanAnimateCoinIncreases] = useState(
    !isAnyModalVisible
  );
  const [isAwaitingPostSubmitModalClose, setIsAwaitingPostSubmitModalClose] =
    useState(false);
  const currentRoundLetterStates = useMemo(
    () => computeLetterStates(guesses),
    [guesses]
  );
  const letterStates = useMemo(
    () => mergeLetterStates(preservedLetterStates, currentRoundLetterStates),
    [preservedLetterStates, currentRoundLetterStates]
  );

  useEffect(() => {
    return () => {
      if (coinAnimationSettleTimeoutRef.current) {
        clearTimeout(coinAnimationSettleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (coinAnimationSettleTimeoutRef.current) {
      clearTimeout(coinAnimationSettleTimeoutRef.current);
      coinAnimationSettleTimeoutRef.current = null;
    }

    if (isAwaitingPostSubmitModalClose) {
      setCanAnimateCoinIncreases((previous) => (previous ? false : previous));

      if (isAnyModalVisible) {
        return;
      }

      coinAnimationSettleTimeoutRef.current = setTimeout(() => {
        setCanAnimateCoinIncreases((previous) => (previous ? previous : true));
        setIsAwaitingPostSubmitModalClose((previous) =>
          previous ? false : previous
        );
        coinAnimationSettleTimeoutRef.current = null;
      }, MODAL_CLOSE_DELAY_MS);
      return;
    }

    if (isAnyModalVisible) {
      setCanAnimateCoinIncreases((previous) => (previous ? false : previous));
      return;
    }

    // Wait for modal transitions/next queued modal to settle before allowing
    // deferred coin count-up animations to start.
    coinAnimationSettleTimeoutRef.current = setTimeout(() => {
      setCanAnimateCoinIncreases((previous) => (previous ? previous : true));
      coinAnimationSettleTimeoutRef.current = null;
    }, MODAL_CLOSE_DELAY_MS);
  }, [isAnyModalVisible, isAwaitingPostSubmitModalClose]);

  const loadIapProducts = useCallback(async () => {
    if (shouldUseDevFirestoreCatalog) {
      setIapProducts([]);
      setIapError(null);
      setIapLoading(false);
      return {
        products: [] as RNIap.Product[],
        error: null as string | null,
      };
    }

    setIapLoading(true);
    setIapError(null);

    try {
      const products = await IapService.getProducts();
      setIapProducts(products);
      return {
        products,
        error: null as string | null,
      };
    } catch (error) {
      logger.error("Error loading IAP products:", error);
      captureException(error);
      const message =
        error instanceof Error ? error.message : "Failed to load products";
      setIapError(message);
      return {
        products: [] as RNIap.Product[],
        error: message,
      };
    } finally {
      setIapLoading(false);
    }
  }, [shouldUseDevFirestoreCatalog]);

  const loadFirestoreProducts = useCallback(async () => {
    setProductPricingLoading(true);
    setProductPricingError(null);

    try {
      const products = await ProductPricingService.getActiveProducts();
      setFirestoreProducts(products);
      return {
        products,
        error: null as string | null,
      };
    } catch (error) {
      logger.error("Error loading Firestore product pricing:", error);
      captureException(error);
      const message =
        error instanceof Error ? error.message : "Failed to load shop products";
      setProductPricingError(message);
      return {
        products: [] as ProductPricing[],
        error: message,
      };
    } finally {
      setProductPricingLoading(false);
    }
  }, []);

  const ensureShopCatalogLoaded = useCallback(async () => {
    if (hasLoadedShopCatalogRef.current) {
      return {
        iapResult: {
          products: iapProducts,
          error: iapError,
        },
        firestoreResult: {
          products: firestoreProducts,
          error: productPricingError,
        },
      };
    }

    const [iapResult, firestoreResult] = await Promise.all([
      loadIapProducts(),
      loadFirestoreProducts(),
    ]);

    if (!iapResult.error && !firestoreResult.error) {
      hasLoadedShopCatalogRef.current = true;
    }

    return { iapResult, firestoreResult };
  }, [
    iapProducts,
    iapError,
    firestoreProducts,
    productPricingError,
    loadIapProducts,
    loadFirestoreProducts,
  ]);

  const firstTimeCheckDone = useRef(false);
  const streakBreakModalShownRef = useRef(false);

  const deriveDailyStreakAfterWin = useCallback((): number => {
    const currentStreak = playerData?.stats?.winStreak ?? 0;
    const lastCompletedAt = playerData?.lastDailyChallengeCompletedAt;
    if (!lastCompletedAt) return 1;

    const lastCompletedDate = new Date(lastCompletedAt);
    if (Number.isNaN(lastCompletedDate.getTime())) return 1;
    lastCompletedDate.setUTCHours(0, 0, 0, 0);

    const yesterdayUtc = new Date();
    yesterdayUtc.setUTCHours(0, 0, 0, 0);
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);

    return lastCompletedDate.getTime() === yesterdayUtc.getTime()
      ? currentStreak + 1
      : 1;
  }, [playerData]);

  useEffect(() => {
    if (!isGuestMode) {
      setIsUpgradeModalVisible(false);
    }
  }, [isGuestMode]);

  useEffect(() => {
    if (suppressOnboarding || firstTimeCheckDone.current || !playerData) return;
    firstTimeCheckDone.current = true;
    let isCancelled = false;

    const runOnboardingFlow = async () => {
      try {
        if (isCancelled) {
          return;
        }

        // Provider-authenticated users should always see a lightweight welcome-back
        // modal when they enter the game.
        if (!isGuestMode) {
          const username = playerData?.username?.trim() || "";
          showWelcomeBackModal({ username });
          return;
        }

        const onboardingSeenStorageKey = getOnboardingSeenStorageKey(
          playerData?.userId
        );
        const hasSeenOnboarding =
          (await AsyncStorage.getItem(onboardingSeenStorageKey)) === "true";
        if (isCancelled || hasSeenOnboarding) {
          return;
        }

        showWelcomeModal({
          onDismiss: () => {
            if (isGuestMode) {
              showInfoModal({
                title: AppStrings.GameScreenAlerts.GUEST_MODE_NOTICE_TITLE,
                message: AppStrings.GameScreenAlerts.GUEST_MODE_NOTICE_MESSAGE,
                actionButtonText: AppStrings.Profile.UPGRADE_ACCOUNT_BUTTON,
                onAction: () => setIsUpgradeModalVisible(true),
                onConfirm: () => {
                  safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                    showInstructionsModal();
                  });
                },
              });
              return;
            }

            safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
              showInstructionsModal();
            });
          },
        });

        AsyncStorage.setItem(onboardingSeenStorageKey, "true").catch(
          (error: unknown) => {
            logger.error("Error saving onboarding seen state:", error);
            captureException(error);
          }
        );
      } catch (error) {
        logger.error("Error running onboarding flow:", error);
        captureException(error);
      }
    };

    void runOnboardingFlow();

    return () => {
      isCancelled = true;
    };
  }, [
    isGuestMode,
    playerData,
    playerData?.userId,
    showWelcomeModal,
    showWelcomeBackModal,
    showInstructionsModal,
    showInfoModal,
    suppressOnboarding,
  ]);

  useEffect(() => {
    if (!pendingStreakBreak || streakBreakModalShownRef.current || isAnyModalVisible) {
      return;
    }

    let isCancelled = false;
    safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
      if (isCancelled || streakBreakModalShownRef.current || modal.modals.length > 0) {
        return;
      }

      streakBreakModalShownRef.current = true;
      showInfoModal({
        title: "Streak Broken",
        message: `Your streak ended at ${pendingStreakBreak.previousStreak} day${pendingStreakBreak.previousStreak === 1 ? "" : "s"}. Complete today's daily challenge to start a new streak.`,
        onConfirm: consumePendingStreakBreak,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [
    pendingStreakBreak,
    isAnyModalVisible,
    modal.modals.length,
    showInfoModal,
    consumePendingStreakBreak,
  ]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [soundEnabled, hapticsEnabled, language] = await Promise.all([
          readBooleanSetting(SOUND_ENABLED_STORAGE_KEY, true),
          readBooleanSetting(HAPTICS_ENABLED_STORAGE_KEY, true),
          AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY),
        ]);

        setIsSoundEnabled(soundEnabled);
        SoundManager.setSoundEnabled(soundEnabled);
        setIsHapticsEnabled(hapticsEnabled);

        if (language && isSupportedLanguage(language)) {
          setAppLanguage(language);
          setCurrentLanguage(language);
        }
      } catch (error) {
        logger.error("Error loading settings from AsyncStorage:", error);
        captureException(error);
      } finally {
        setHasLoadedSettings(true);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings) {
      return;
    }

    writeBooleanSetting(SOUND_ENABLED_STORAGE_KEY, isSoundEnabled).catch(
      (error: unknown) => {
        logger.error("Error saving sound setting to AsyncStorage:", error);
        captureException(error);
      }
    );
  }, [hasLoadedSettings, isSoundEnabled]);

  useEffect(() => {
    if (!hasLoadedSettings) {
      return;
    }

    writeBooleanSetting(HAPTICS_ENABLED_STORAGE_KEY, isHapticsEnabled).catch(
      (error: unknown) => {
        logger.error("Error saving haptics setting to AsyncStorage:", error);
        captureException(error);
      }
    );
  }, [hasLoadedSettings, isHapticsEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, currentLanguage).catch(
      (error: unknown) => {
        logger.error("Error saving language setting to AsyncStorage:", error);
        captureException(error);
      }
    );
  }, [currentLanguage]);

  useEffect(() => {
    SoundManager.setSoundEnabled(isSoundEnabled);
    if (isSoundEnabled) {
      safeDelay(SOUND_RESUME_DELAY_MS).then(() => {
        SoundManager.playBackgroundMusic();
      });
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!gameOver) {
      gameOverHandledRef.current = false;
    }
  }, [gameOver]);

  useEffect(() => {
    if (answerLength <= 0) {
      setActiveSlotIndexSynced(0);
      return;
    }

    setActiveSlotIndexSynced((prev) => {
      const maxIndex = Math.max(0, answerLength - 1);
      const clampedPrev = Math.min(Math.max(0, prev), maxIndex);

      if (currentGuess.length === 0) {
        return 0;
      }

      if (!currentGuess[clampedPrev]) {
        return clampedPrev;
      }

      const firstEmptyIndex = currentGuess.findIndex((letter) => !letter);
      if (firstEmptyIndex !== -1) {
        return firstEmptyIndex;
      }

      return clampedPrev;
    });
  }, [answerLength, currentGuess, setActiveSlotIndexSynced]);

  const handleCoinContinue = useCallback(async () => {
    const isInsufficientCoinsError = (error: unknown): boolean => {
      if (!error || typeof error !== "object") {
        return false;
      }

      const maybeCode =
        "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? ((error as { code: string }).code || "").toLowerCase()
          : "";
      const maybeMessage =
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? ((error as { message: string }).message || "").toLowerCase()
          : "";

      return (
        maybeCode.includes("failed-precondition") ||
        maybeCode.includes("resource-exhausted") ||
        maybeMessage.includes("insufficient coins")
      );
    };

    if (currentUserCoins < CONTINUE_COST_COINS) {
      modal.showInfoModal({
        title: AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_TITLE,
        message: AppStrings.GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE,
      });
      return false;
    }

    try {
      if (!isGuestMode) {
        await runWithServerLoading(() =>
          httpsCallable(getFunctions(getApp()), "spendCoins")({
            amount: CONTINUE_COST_COINS,
            reason: "continue",
          })
        );
      }

      if (playerData) {
        updatePlayerDataLocally({
          coins: Math.max(0, (playerData.coins ?? 0) - CONTINUE_COST_COINS),
        });
      }
      preserveKeyboardLetterStates();
      continueGame();
      return true;
    } catch (error) {
      if (isInsufficientCoinsError(error)) {
        logger.warn("Insufficient coins for continue attempt");
        modal.showInfoModal({
          title: AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_TITLE,
          message: AppStrings.GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE,
        });
        return false;
      }

      logger.error("Error spending coins for continue:", error);
      captureException(error);
      modal.showInfoModal({
        title: AppStrings.CommonAlerts.ERROR_TITLE,
        message: AppStrings.GameScreenAlerts.SPEND_COINS_ERROR_MESSAGE,
      });
      return false;
    }
  }, [
    modal,
    continueGame,
    preserveKeyboardLetterStates,
    runWithServerLoading,
    isGuestMode,
    playerData,
    updatePlayerDataLocally,
    currentUserCoins,
  ]);

  const runRewardedAdContinueFlow = useCallback(async () => {
    const didCompleteRewardedAd = await showRewardedAd();
    if (didCompleteRewardedAd) {
      if (playerData) {
        updatePlayerDataLocally({
          coins: currentUserCoins + CONTINUE_REWARDED_AD_COIN_REWARD,
        });
      }
      modal.showCoinPurchaseFanfareModal({
        coinsPurchased: CONTINUE_REWARDED_AD_COIN_REWARD,
        totalCoins: currentUserCoins + CONTINUE_REWARDED_AD_COIN_REWARD,
      });
      preserveKeyboardLetterStates();
      continueGame();
      return true;
    }

    modal.showInfoModal({
      title: AppStrings.GameScreenAlerts.AD_NOT_READY_TITLE,
      message: AppStrings.GameScreenAlerts.AD_NOT_READY_MESSAGE,
    });
    return false;
  }, [
    showRewardedAd,
    continueGame,
    preserveKeyboardLetterStates,
    modal,
    playerData,
    updatePlayerDataLocally,
    currentUserCoins,
  ]);

  const handlePurchaseProduct = useCallback(
    async (productId: string) => {
      if (isPurchaseInProgress) {
        logger.debug("Purchase already in progress. Ignoring duplicate request.");
        return;
      }

      logger.debug(`Initiating purchase for product: ${productId}`);
      setIsPurchaseInProgress(true);
      setIapLoading(true);

      try {
        const purchaseResult = await IapService.purchaseProduct(productId);

        if (purchaseResult) {
          logger.debug("Purchase completed successfully:", purchaseResult);
          const coinsPurchased = IapService.getCoinsForProduct(productId) ?? 0;
          const resolvedNewCoins = parseCoinBalance(purchaseResult.newCoins);
          const backendUnlockedAchievementIds = Array.isArray(
            purchaseResult.newlyUnlockedAchievementIds
          )
            ? purchaseResult.newlyUnlockedAchievementIds ?? []
            : [];
          const isAlreadySupporter = Boolean(
            playerData?.unlockedAchievements?.some(
              (achievement) => achievement.achievementId === "first_purchase"
            )
          );
          // Fallback: if backend hasn't returned first_purchase yet, unlock it client-side once
          // after the first successful shop purchase.
          const unlockedAchievementIds = isAlreadySupporter
            ? backendUnlockedAchievementIds
            : Array.from(
                new Set([...backendUnlockedAchievementIds, "first_purchase"])
              );
          const unlockedAchievements = unlockedAchievementIds
            .map((achievementId) =>
              ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === achievementId)
            )
            .filter(
              (
                achievement
              ): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] => Boolean(achievement)
            );
          const totalCoinsAfterPurchase =
            resolvedNewCoins ?? currentUserCoins + coinsPurchased;
          const isLocalDevPurchase =
            typeof purchaseResult.transactionId === "string" &&
            purchaseResult.transactionId.startsWith("dev-local-");

          if (playerData) {
            const existingUnlockedAchievements = Array.isArray(
              playerData.unlockedAchievements
            )
              ? playerData.unlockedAchievements
              : [];
            const existingAchievementIds = new Set(
              existingUnlockedAchievements.map((entry) => entry.achievementId)
            );
            const unlockedAt = Date.now();
            const newlyUnlockedEntries = unlockedAchievements
              .filter((achievement) => !existingAchievementIds.has(achievement.id))
              .map((achievement) => ({
                achievementId: achievement.id,
                unlockedAt,
              }));

            const nextPlayerUpdates: Partial<Player> = {};
            if (resolvedNewCoins !== null) {
              nextPlayerUpdates.coins = resolvedNewCoins;
            } else if (isLocalDevPurchase && coinsPurchased > 0) {
              nextPlayerUpdates.coins = (playerData.coins ?? 0) + coinsPurchased;
            }
            if (newlyUnlockedEntries.length > 0) {
              nextPlayerUpdates.unlockedAchievements = [
                ...existingUnlockedAchievements,
                ...newlyUnlockedEntries,
              ];
            }
            if (playerData.hasPurchasedApp !== true) {
              nextPlayerUpdates.hasPurchasedApp = true;
            }

            if (Object.keys(nextPlayerUpdates).length > 0) {
              updatePlayerDataLocally(nextPlayerUpdates);
            }
          }

          // Close shop immediately after successful purchase.
          modal.closeModalByType("coinShop");

          const showPurchaseAchievementFanfareAtIndex = (index: number): void => {
            if (index >= unlockedAchievements.length) {
              return;
            }

            const achievement = unlockedAchievements[index];
            modal.showAchievementUnlockFanfareModal({
              coinsEarned: 0,
              totalCoins: totalCoinsAfterPurchase,
              achievementNames: [achievement.name],
              achievements: [achievement],
              onContinue: () => {
                void safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                  showPurchaseAchievementFanfareAtIndex(index + 1);
                });
              },
            });
          };

          modal.showCoinPurchaseFanfareModal({
            coinsPurchased,
            totalCoins: totalCoinsAfterPurchase,
            onConfirm: () => {
              if (unlockedAchievements.length > 0) {
                showPurchaseAchievementFanfareAtIndex(0);
              }
            },
          });
        } else {
          logger.debug("Purchase was cancelled or returned null");
        }
      } catch (error) {
        logger.error("Purchase failed:", error);
        captureException(error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : AppStrings.GameScreenAlerts.PURCHASE_FAILED_MESSAGE;
        modal.showInfoModal({
          title: AppStrings.GameScreenAlerts.PURCHASE_FAILED_TITLE,
          message: errorMessage,
        });
      } finally {
        setIapLoading(false);
        setIsPurchaseInProgress(false);
      }
    },
    [isPurchaseInProgress, modal, playerData, updatePlayerDataLocally, currentUserCoins]
  );

  const handlePayAndPlay = useCallback(() => {
    logger.debug("Pay and play button pressed");

    const cheapestProduct = [...iapProducts].sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    )[0];

    if (cheapestProduct) {
      handlePurchaseProduct(cheapestProduct.id);
    } else {
      modalActions.showNoProductsAvailable();
    }
  }, [iapProducts, handlePurchaseProduct, modalActions]);

  const handleWatchAdForCoins = useCallback(async () => {
    logger.debug("Watch ad for coins button pressed");
    modal.closeModalByType("coinShop");

    try {
      const didCompleteRewardedAd = await showRewardedAd();
      if (didCompleteRewardedAd) {
        logger.debug("Rewarded ad for coins shown successfully");
      } else {
        logger.warn("Rewarded ad was not ready to be shown");
        modalActions.showAdNotReady();
      }
    } catch (error) {
      logger.error("Error showing rewarded ad for coins:", error);
      captureException(error);
      modalActions.showAdError();
    }
  }, [modal, showRewardedAd, modalActions]);

  useEffect(() => {
    if (
      gameOver &&
      lastGuessResult &&
      lastGuessResult.outcome !== "continue" &&
      !gameOverHandledRef.current
    ) {
      gameOverHandledRef.current = true;
      const result = lastGuessResult;

      if (result.outcome === "win") {
        const resolvedAttempts = lastSubmittedAttemptRef.current ?? guesses.length;
        const unlockedAchievements = (result.newlyUnlockedAchievementIds ?? [])
          .map((achievementId) =>
            ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievementId)
          )
          .filter(
            (
              achievement
            ): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] =>
              Boolean(achievement)
          );

        const unlockedAchievementNames = unlockedAchievements.map(
          (achievement) => achievement.name
        );

        if (playerData && unlockedAchievements.length > 0) {
          const existingUnlockedAchievements = Array.isArray(
            playerData.unlockedAchievements
          )
            ? playerData.unlockedAchievements
            : [];
          const existingAchievementIds = new Set(
            existingUnlockedAchievements.map((entry) => entry.achievementId)
          );
          const unlockedAt = Date.now();
          const newlyUnlockedEntries = unlockedAchievements
            .filter(
              (achievement) => !existingAchievementIds.has(achievement.id)
            )
            .map((achievement) => ({
              achievementId: achievement.id,
              unlockedAt,
            }));

          if (newlyUnlockedEntries.length > 0) {
            updatePlayerDataLocally(
              {
                unlockedAchievements: [
                  ...existingUnlockedAchievements,
                  ...newlyUnlockedEntries,
                ],
              },
              { syncToFirestore: false }
            );
          }
        }

        if (isHapticsEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          if (unlockedAchievementNames.length > 0) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }

        const unlockedAchievementFanfareItems = unlockedAchievements.map(
          (achievement) => ({
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
          })
        );

        const xpValue = Number(playerData?.stats?.xp ?? 0);
        const totalScoreValue = Number(playerData?.stats?.totalScore ?? 0);
        const currentXp = Math.max(
          Number.isFinite(xpValue) ? xpValue : 0,
          Number.isFinite(totalScoreValue) ? totalScoreValue : 0
        );
        const earnedXp = Math.max(0, Number(result.scoreEarned || 0));
        const previousLevel = getXpLevel(currentXp).level;
        const nextLevel = getXpLevel(currentXp + earnedXp).level;
        const didLevelUp = earnedXp > 0 && nextLevel > previousLevel;
        const levelUpBonusCoins = didLevelUp ? LEVEL_UP_COIN_BONUS : 0;
        const resolvedDailyStreak =
          gameMode === "daily"
            ? (result.newWinStreak ?? deriveDailyStreakAfterWin())
            : undefined;
        const dailyChallengeBonusCoins =
          gameMode === "daily" && resolvedDailyStreak
            ? DAILY_CHALLENGE_COIN_REWARD
            : 0;
        const totalBonusCoinsAwarded = levelUpBonusCoins + dailyChallengeBonusCoins;
        const totalCoinsAfterWin =
          currentUserCoins + (result.coinsEarned || 0) + totalBonusCoinsAwarded;
        const totalCoinsToAnimate =
          (result.coinsEarned || 0) + totalBonusCoinsAwarded;
        const coinCountUpDurationMs =
          Math.min(2500, 400 + Math.sqrt(Math.max(0, totalCoinsToAnimate)) * 180) +
          500;

        const playDeferredCoinAnimation = async () => {
          if (totalCoinsToAnimate <= 0) {
            return;
          }

          if (coinAnimationSettleTimeoutRef.current) {
            clearTimeout(coinAnimationSettleTimeoutRef.current);
            coinAnimationSettleTimeoutRef.current = null;
          }

          // Explicitly resume deferred coin animation after final modal dismissal.
          setIsAwaitingPostSubmitModalClose(false);
          setCanAnimateCoinIncreases(true);
          await safeDelay(coinCountUpDurationMs);
        };

        const showVictoryModal = () => {
          const continueToNextLevel = async () => {
            logger.debug("Victory modal: Next level button pressed");
            resetRoundState();

            try {
              await runWithServerLoading(() => onNextLevel());
            } catch (error) {
              logger.error("Error calling onNextLevel:", error);
              captureException(error);
            } finally {
              setIsTransitioningToNextLevel(false);
            }
          };

          modal.showVictoryModal({
            attempts: resolvedAttempts,
            coinsEarned: result.coinsEarned || 0,
            totalCoins: totalCoinsAfterWin,
            unlockedAchievementNames,
            guesses,
            onNext: async () => {
              modal.closeModalByType("victory");
              if (didLevelUp) {
                await safeDelay(MODAL_CLOSE_DELAY_MS);
                modal.showLevelUpFanfareModal({
                  newLevel: nextLevel,
                  coinsAwarded: LEVEL_UP_COIN_BONUS,
                  totalCoins: totalCoinsAfterWin,
                  onContinue: () => {
                    void (async () => {
                      setIsTransitioningToNextLevel(true);
                      void playDeferredCoinAnimation();
                      await continueToNextLevel();
                    })();
                  },
                });
                return;
              }
              setIsTransitioningToNextLevel(true);
              void playDeferredCoinAnimation();
              await continueToNextLevel();
            },
          });
        };

        const showPostAchievementWinFlow = () => {
          if (gameMode === "daily" && resolvedDailyStreak) {
            modal.showStreakIncreaseFanfareModal({
              streakValue: resolvedDailyStreak,
              coinsAwarded: DAILY_CHALLENGE_COIN_REWARD,
              totalCoins: totalCoinsAfterWin,
              onContinue: showVictoryModal,
            });
            return;
          }

          showVictoryModal();
        };

        const showAchievementFanfareAtIndex = (index: number) => {
          if (index >= unlockedAchievementFanfareItems.length) {
            showPostAchievementWinFlow();
            return;
          }

          const achievement = unlockedAchievementFanfareItems[index];
          modal.showAchievementUnlockFanfareModal({
            coinsEarned: index === 0 ? result.coinsEarned || 0 : 0,
            totalCoins: totalCoinsAfterWin,
            achievementNames: [achievement.name],
            achievements: [achievement],
            onContinue: () => {
              void safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                showAchievementFanfareAtIndex(index + 1);
              });
            },
          });
        };

        if (unlockedAchievementFanfareItems.length > 0) {
          showAchievementFanfareAtIndex(0);
        } else {
          showPostAchievementWinFlow();
        }

        onGameWin(
          resolvedAttempts,
          (result.coinsEarned || 0),
          result.scoreEarned || 0,
          resolvedDailyStreak,
          totalBonusCoinsAwarded
        );
      } else if (result.outcome === "attemptLimitReached") {
        const canAffordCoinContinue = currentUserCoins >= CONTINUE_COST_COINS;
        const skipLevelCost = SKIP_COST_CLASSIC;
        // Cache keyboard hints as soon as the loss modal opens so they survive
        // any continue/close timing differences while the grid resets.
        setPreservedLetterStates((existing) =>
          mergeLetterStates(existing, computeLetterStates(guesses))
        );

        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          totalCoins: currentUserCoins,
          onWatchAdContinue: result.canOfferRewardedAd
            ? () => {
                modal.closeModalByType("loss");
                void runRewardedAdContinueFlow();
                return true;
              }
            : undefined,
          onCoinContinue: result.canOfferCoinContinue
            ? handleCoinContinue
            : undefined,
          coinContinueCost: CONTINUE_COST_COINS,
          skipLevelCost,
          canWatchAd: isRewardedAdReady,
          canUseCoin: canAffordCoinContinue,
          onOpenShop: () => openShopFromLossRef.current(),
          onNext: () => {
            modal.closeModalByType("loss");
            resetRoundState();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after attempt limit:", error);
              captureException(error);
            });
          },
        });
      } else if (result.outcome === "loss") {
        const resolvedAttempts = lastSubmittedAttemptRef.current ?? guesses.length;
        if (isHapticsEnabled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        const skipLevelCost = SKIP_COST_CLASSIC;

        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          totalCoins: currentUserCoins,
          skipLevelCost,
          onOpenShop: () => openShopFromLossRef.current(),
          onNext: () => {
            modal.closeModalByType("loss");
            resetRoundState();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after loss:", error);
              captureException(error);
            });
          },
        });

        if (result.correctAnswer) {
          onGameLoss(result.correctAnswer, resolvedAttempts);
        }
      }
    }
  }, [
    gameOver,
    lastGuessResult,
    modal,
    guesses,
    isHapticsEnabled,
    currentUserCoins,
    gameMode,
    onGameWin,
    onGameLoss,
    onNextLevel,
    resetRoundState,
    deriveDailyStreakAfterWin,
    runRewardedAdContinueFlow,
    handleCoinContinue,
    isRewardedAdReady,
    runWithServerLoading,
    playerData,
    playerData?.stats?.xp,
    playerData?.stats?.totalScore,
    updatePlayerDataLocally,
  ]);

  const toggleSoundEnabled = useCallback((isEnabled: boolean) => {
    setIsSoundEnabled(isEnabled);
    SoundManager.setSoundEnabled(isEnabled);
    if (isEnabled) {
      SoundManager.playBackgroundMusic();
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, []);

  const toggleHapticsEnabled = useCallback((isEnabled: boolean) => {
    setIsHapticsEnabled(isEnabled);
  }, []);

  const handleChangeLanguage = useCallback((language: SupportedLanguage) => {
    setAppLanguage(language);
    setCurrentLanguage(language);
  }, []);

  const handleSubmit = useCallback(async () => {
    const isGuessComplete =
      currentGuess.length === answerLength &&
      currentGuess.every(
        (letter) => typeof letter === "string" && letter.length > 0
      );

    if (isGuessComplete) {
      try {
        // Always allow the next completed guess result to trigger exactly one modal flow.
        gameOverHandledRef.current = false;
        lastSubmittedAttemptRef.current = guesses.length + 1;
        // Pause header coin count-up immediately so modal-driven result flows
        // can decide exactly when deferred animations should resume.
        setCanAnimateCoinIncreases(false);
        const result = (await runWithServerLoading(() =>
          processGuess(currentGuess)
        )) as GuessResult;
        setLastGuessResult(result);
        const willOpenResultModal = result.outcome !== "continue";
        setIsAwaitingPostSubmitModalClose(willOpenResultModal);
        if (!willOpenResultModal) {
          // No win/loss modal sequence is coming, so re-enable right away.
          setCanAnimateCoinIncreases(true);
        }
      } catch (error) {
        logger.error("Error processing guess in GameScreen:", error);
        captureException(error);
        setIsAwaitingPostSubmitModalClose(false);
        setCanAnimateCoinIncreases(true);
        modal.showInfoModal({
          title: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
          message: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE,
        });
      }
    } else if (isHapticsEnabled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [
    currentGuess,
    guesses.length,
    answerLength,
    processGuess,
    isHapticsEnabled,
    modal,
    runWithServerLoading,
  ]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (answerLength <= 0) return;
      const maxIndex = Math.max(0, answerLength - 1);

      const targetIndex = Math.min(
        Math.max(0, activeSlotIndexRef.current),
        maxIndex
      );

      setCurrentGuess((prev: string[]) => {
        const next = [...prev];
        while (next.length <= targetIndex) {
          next.push("");
        }
        next[targetIndex] = key;
        if (next.length > answerLength) {
          next.length = answerLength;
        }
        return next;
      });

      const nextActiveSlotIndex = Math.min(maxIndex, targetIndex + 1);
      setActiveSlotIndexSynced(nextActiveSlotIndex);
    },
    [answerLength, setCurrentGuess, setActiveSlotIndexSynced]
  );

  const handleBackspace = useCallback(() => {
    if (answerLength <= 0) return;
    const maxIndex = Math.max(0, answerLength - 1);

    const clampedActiveIndex = Math.min(
      Math.max(0, activeSlotIndexRef.current),
      maxIndex
    );

    setCurrentGuess((prev: string[]) => {
      if (prev.length === 0) {
        return prev;
      }

      const targetIndex = prev[clampedActiveIndex]
        ? clampedActiveIndex
        : Math.max(0, clampedActiveIndex - 1);

      const next = [...prev];
      next[targetIndex] = "";
      while (next.length > 0 && !next[next.length - 1]) {
        next.pop();
      }
      return next;
    });

    setActiveSlotIndexSynced(Math.max(0, clampedActiveIndex - 1));
  }, [answerLength, setCurrentGuess, setActiveSlotIndexSynced]);

  const handleSelectCurrentGuessSlot = useCallback(
    (slotIndex: number) => {
      if (answerLength <= 0) return;
      if (slotIndex < 0 || slotIndex >= answerLength) return;
      setActiveSlotIndexSynced(slotIndex);
    },
    [answerLength, setActiveSlotIndexSynced]
  );

  const handleShowHint = useCallback(async () => {
    if (!playerData?.userId) return;

    logger.debug("Showing hint modal for riddle:", riddleId);

    modal.showHintModal({
      userCoins: currentUserCoins,
      hintCost,
      onOpenShop: () => openShopFromLossRef.current(),
      onShowHint: () => {
        const answerLetters = answer.toLowerCase().split("");
        const revealIndex = answerLetters.findIndex(
          (_, i) => !hintRevealedIndicesRef.current.includes(i)
        );

        if (revealIndex === -1) {
          modal.showInfoModal({
            title: AppStrings.GameScreenAlerts.HINT_NOT_AVAILABLE_TITLE,
            message: AppStrings.GameScreenAlerts.HINT_NOT_AVAILABLE_MESSAGE,
          });
          return;
        }

        hintRevealedIndicesRef.current = [
          ...hintRevealedIndicesRef.current,
          revealIndex,
        ];

        setCurrentGuess((prev: string[]) => {
          const newGuess = [...prev];
          while (newGuess.length <= revealIndex) {
            newGuess.push("");
          }
          newGuess[revealIndex] = answerLetters[revealIndex];
          return newGuess;
        });

        Promise.resolve(onHintUsed(hintCost))
          .then((newlyUnlockedAchievementIds) => {
            if (!Array.isArray(newlyUnlockedAchievementIds)) {
              return;
            }

            const unlockedAchievements = newlyUnlockedAchievementIds
              .map((achievementId) =>
                ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === achievementId)
              )
              .filter(
                (
                  achievement
                ): achievement is (typeof ACHIEVEMENT_DEFINITIONS)[number] => Boolean(achievement)
              );

            if (unlockedAchievements.length === 0) {
              return;
            }

            const showAchievementFanfareAtIndex = (index: number) => {
              if (index >= unlockedAchievements.length) {
                return;
              }

              const achievement = unlockedAchievements[index];
              modal.showAchievementUnlockFanfareModal({
                coinsEarned: 0,
                totalCoins: currentUserCoins,
                achievementNames: [achievement.name],
                achievements: [
                  {
                    name: achievement.name,
                    description: achievement.description,
                    icon: achievement.icon,
                  },
                ],
                onContinue: () => {
                  void safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                    showAchievementFanfareAtIndex(index + 1);
                  });
                },
              });
            };

            showAchievementFanfareAtIndex(0);
          })
          .catch((error: unknown) => {
            logger.error("Error handling hint achievement unlock fanfare:", error);
            captureException(error);
          });
      },
    });
  }, [
    playerData?.userId,
    riddleId,
    modal,
    currentUserCoins,
    hintCost,
    answer,
    setCurrentGuess,
    onHintUsed,
    currentUserCoins,
  ]);

  const handleCoinsPress = useCallback(async () => {
    let productsForModal = iapProducts;
    let firestoreProductsForModal = firestoreProducts;

    if (!hasLoadedShopCatalogRef.current) {
      const { iapResult, firestoreResult } = await ensureShopCatalogLoaded();
      productsForModal = iapResult.products;
      firestoreProductsForModal = firestoreResult.products;
    }

    const availableStoreProductIds = new Set(
      productsForModal.map((product) => product.id)
    );
    const purchasableFirestoreProducts = shouldUseDevFirestoreCatalog
      ? firestoreProductsForModal
      : firestoreProductsForModal.filter((product) =>
          availableStoreProductIds.has(product.productId)
        );

    if (__DEV__) {
      logger.debug("Opening coin shop modal with:", {
        iapProducts: productsForModal.length,
        firestoreProducts: firestoreProductsForModal.length,
        purchasableFirestoreProducts: purchasableFirestoreProducts.length,
        shouldUseDevFirestoreCatalog,
        iapLoading,
        productPricingLoading,
        iapError,
        productPricingError,
      });
    }

    try {
      modal.showCoinShop({
        products: productsForModal,
        firestoreProducts: purchasableFirestoreProducts,
        currentCoins: currentUserCoins,
        loading: iapLoading || productPricingLoading,
        error: iapError || productPricingError,
        onPurchaseProduct: handlePurchaseProduct,
        onWatchVideo: handleWatchAdForCoins,
        onPayAndPlay: handlePayAndPlay,
      });
    } catch (error) {
      logger.error("Error opening coin shop:", error);
      captureException(error);
      modal.showInfoModal({
        title: AppStrings.CommonAlerts.ERROR_TITLE,
        message: AppStrings.CoinShop.NO_PACKS_AVAILABLE,
      });
    }
  }, [
    ensureShopCatalogLoaded,
    iapProducts,
    firestoreProducts,
    shouldUseDevFirestoreCatalog,
    iapLoading,
    productPricingLoading,
    iapError,
    productPricingError,
    modal,
    currentUserCoins,
    handlePurchaseProduct,
    handleWatchAdForCoins,
    handlePayAndPlay,
  ]);

  const handleOverlayNext = useCallback(() => {
    logger.debug("Next button pressed - opening skip modal");

    const skipCost =
      gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC;

    modal.showSkipModal({
      userCoins: currentUserCoins,
      totalCoins: currentUserCoins,
      skipCost,
      onOpenShop: handleCoinsPress,
      onSkipLevel: async () => {
        try {
          if (!isGuestMode) {
            await runWithServerLoading(() =>
              httpsCallable(getFunctions(getApp()), "spendCoins")({
                amount: skipCost,
                reason: "skip",
              })
            );
          }

          onSkipUsed(skipCost);
          resetRoundState();
          await runWithServerLoading(() => onNextLevel());
        } catch (error) {
          logger.error("Error spending coins for skip:", error);
          captureException(error);
          modalActions.showSpendCoinsError();
        }
      },
    });
  }, [
    gameMode,
    modal,
    currentUserCoins,
    handleCoinsPress,
    resetRoundState,
    onNextLevel,
    onSkipUsed,
    runWithServerLoading,
    modalActions,
    isGuestMode,
  ]);

  const handleSettingsPress = useCallback(() => {
    logger.debug("Settings button pressed - opening settings modal");
    modal.showSettingsModal({
      isSoundEnabled,
      isHapticsEnabled,
      currentLanguage,
      onToggleSound: toggleSoundEnabled,
      onToggleHaptics: toggleHapticsEnabled,
      onChangeLanguage: handleChangeLanguage,
      onPressLogout: logout,
      onPressHelp: () => {
        logger.debug("Help button pressed - opening support email composer");
        void Linking.openURL("mailto:support@adspeq.com").catch((error) => {
          logger.error("Failed to open support email composer:", error);
          captureException(error);
        });
      },
      onPressCredits: () => {
        logger.debug(
          "Credits button pressed - closing settings and opening credits modal"
        );
        modal.closeModalByType("settings");
        setTimeout(() => {
          modal.showCreditsModal();
        }, MODAL_CLOSE_DELAY_MS);
      },
      playerData: playerData ?? null,
    });
  }, [
    modal,
    isSoundEnabled,
    playerData,
    isHapticsEnabled,
    currentLanguage,
    toggleSoundEnabled,
    toggleHapticsEnabled,
    handleChangeLanguage,
    logout,
  ]);

  const handleProfilePress = useCallback(async () => {
    if (isProfileModalLoading) {
      return;
    }

    const loadingStartedAt = Date.now();
    setIsProfileModalLoading(true);
    let latestPlayerData = playerData;

    try {
      if (!isGuestMode && playerData?.userId) {
        try {
          const refreshedProfile = await runWithServerLoading(() =>
            loadUserProgressFromFirestore(playerData.userId)
          );

          if (refreshedProfile) {
            const resolvedProfile = resolveProfileSnapshot(
              playerData,
              refreshedProfile
            );
            latestPlayerData = resolvedProfile;
            updatePlayerDataLocally(resolvedProfile, {
              syncToFirestore: false,
            });
          }
        } catch (error) {
          logger.error("Error loading profile data before opening modal:", error);
          captureException(error);
        }
      }

      const minSpinnerMs = 300;
      const elapsedMs = Date.now() - loadingStartedAt;
      if (elapsedMs < minSpinnerMs) {
        await safeDelay(minSpinnerMs - elapsedMs);
      }

      modal.showFullProfileDetailsModal({
        playerData: latestPlayerData,
      });
    } finally {
      setIsProfileModalLoading(false);
    }
  }, [
    modal,
    playerData,
    isGuestMode,
    runWithServerLoading,
    updatePlayerDataLocally,
    isProfileModalLoading,
  ]);



  useEffect(() => {
    openShopFromLossRef.current = handleCoinsPress;
  }, [handleCoinsPress]);

  const handleDebugCompleteRiddle = useCallback(() => {
    if (gameOver) return;

    const solvedGuess = answer.toUpperCase().split("");
    setCurrentGuess(solvedGuess);
    setActiveSlotIndexSynced(Math.max(0, answerLength - 1));
  }, [gameOver, answer, answerLength, setCurrentGuess, setActiveSlotIndexSynced]);

  const handleDebugGenerateDailyChallenge = useCallback(async () => {
    try {
      const response = await runWithServerLoading(() =>
        httpsCallable<
          { forceGenerate: boolean },
          { success: boolean; message: string; questionsGenerated: number }
        >(getFunctions(getApp()), "generateTodaysDailyChallengeFunction")({
          forceGenerate: true,
        })
      );

      modal.showInfoModal({
        title: "Daily Challenge Generated",
        message:
          response.data?.message ??
          "Successfully generated a new daily challenge in dailyRiddles/current.",
      });
    } catch (error) {
      logger.error("Error generating daily challenge from debug panel:", error);
      captureException(error);

      const errorWithDetails = error as {
        message?: string;
        details?: unknown;
        code?: string;
      };
      const detailsMessage =
        typeof errorWithDetails.details === "string"
          ? errorWithDetails.details
          : typeof errorWithDetails.details === "object" &&
              errorWithDetails.details &&
              "message" in errorWithDetails.details &&
              typeof (errorWithDetails.details as {message?: unknown}).message ===
                "string"
            ? (errorWithDetails.details as {message: string}).message
            : null;

      modal.showInfoModal({
        title: "Daily Challenge Error",
        message: detailsMessage ??
          errorWithDetails.message ??
          "Failed to generate a new daily challenge.",
      });
    }
  }, [runWithServerLoading, modal]);

  const handleDebugClearLocalData = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      await logout();
    } catch (error) {
      logger.error("Error clearing local data from debug panel:", error);
      captureException(error);
      modal.showInfoModal({
        title: "Clear Local Data Error",
        message: "Failed to clear local data.",
      });
    }
  }, [logout, modal]);

  const isSubmitDisabled = useMemo(
    () =>
      currentGuess.length !== answerLength ||
      currentGuess.some(
        (letter) => typeof letter !== "string" || letter.length === 0
      ),
    [currentGuess, answerLength]
  );

  const headerModeLabel =
    gameMode === "daily"
      ? AppStrings.GameScreenAlerts.DAILY_CHALLENGE_LABEL
      : AppStrings.GameScreenAlerts.CLASSIC_LABEL;
  const spinnerSize = isTransitioningToNextLevel ? 120 : LOADING_SPINNER_SIZE;
  const spinnerOpacity = isTransitioningToNextLevel
    ? 0.8
    : LOADING_SPINNER_OPACITY;

  return (
    <View style={{ flex: 1 }}>
      <StarryBackground />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          style={[
            styles.gameContainer,
            isAnyModalVisible && styles.overlayVisible,
            isTablet && styles.gameContainerTablet,
            isLargeTablet && styles.gameContainerLargeTablet,
            isDesktop && styles.gameContainerDesktop,
          ]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Header
            userCoins={currentUserCoins}
            onCoinsPress={handleCoinsPress}
            modeLabel={headerModeLabel}
            shouldAnimateCoins={canAnimateCoinIncreases}
          />

          <GameBoard
            riddleText={riddleText}
            guesses={guesses}
            currentGuess={currentGuess}
            answerLength={answerLength}
            handleKeyPress={handleKeyPress}
            handleBackspace={handleBackspace}
            isAnyOverlayVisible={isInteractionBlocked}
            letterStates={letterStates}
            hintRevealedIndices={hintRevealedIndicesRef.current}
            activeSlotIndex={activeSlotIndex}
            onSelectCurrentGuessSlot={handleSelectCurrentGuessSlot}
          />

          <GameInput
            isSubmitDisabled={isSubmitDisabled}
            gameOver={gameOver}
            handleSubmit={handleSubmit}
            handleHint={handleShowHint}
            handleNext={handleOverlayNext}
          />

          <BottomNavigationBar
            onProfilePress={handleProfilePress}
            onSettingsPress={handleSettingsPress}
          />

          {process.env.NODE_ENV !== "test" && (
            <GlobalMuteOverlay
              isSoundEnabled={isSoundEnabled}
              onToggleSound={toggleSoundEnabled}
            />
          )}
        </KeyboardAvoidingView>

        <PulsingSpinner
          visible={
            isLoading ||
            isProfileModalLoading ||
            isPurchaseInProgress ||
            isTransitioningToNextLevel
          }
          size={spinnerSize}
          opacity={spinnerOpacity}
        />

        <ModalProvider />
        <OfflineBlockingModal isVisible={isOffline} />
        {isGuestMode ? (
          <UpgradeAccountModal
            isVisible={isUpgradeModalVisible}
            onClose={() => setIsUpgradeModalVisible(false)}
          />
        ) : null}

        <Controls
          onNextPress={handleOverlayNext}
          isWin={gameOver && lastGuessResult?.outcome === "win"}
        />

        {__DEV__ && (
          <ModalTogglePanel
            onCompleteRiddle={handleDebugCompleteRiddle}
            onGenerateDailyChallenge={handleDebugGenerateDailyChallenge}
            onClearLocalData={handleDebugClearLocalData}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const GameScreen = React.memo(GameScreenInner);
export default GameScreen;

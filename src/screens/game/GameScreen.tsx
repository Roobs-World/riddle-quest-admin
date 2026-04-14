/**
 * @fileoverview
 * Main gameplay screen for Qwordly.
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
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import useRewardedAds from "../../hooks/useRewardedAds";

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
import {
  SOUND_ENABLED_STORAGE_KEY,
  HAPTICS_ENABLED_STORAGE_KEY,
  readBooleanSetting,
  writeBooleanSetting,
} from "../../utils/settingsStorage";

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

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

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
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
  suppressOnboarding?: boolean;
}

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
  const isGuestMode = isGuestPlayer(playerData);

  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    getAppLanguage()
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const { isLoading, runWithServerLoading } = useGameSessionController();
  const modalActions = useMemo(() => createGameModalActions(modal), [modal]);
  const [isProfileModalLoading, setIsProfileModalLoading] = useState(false);
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
  const isRunningUnderJest =
    typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);
  const shouldUseDevFirestoreCatalog = __DEV__ && !isRunningUnderJest;

  const gameOverHandledRef = useRef(false);
  const openShopFromLossRef = useRef<() => void>(() => {});
  const coinAnimationSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasSeenPostSubmitModalRef = useRef(false);

  const [iapProducts, setIapProducts] = useState<RNIap.Product[]>([]);
  const [iapLoading, setIapLoading] = useState(true);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [firestoreProducts, setFirestoreProducts] = useState<ProductPricing[]>([]);
  const [productPricingLoading, setProductPricingLoading] = useState(true);
  const [productPricingError, setProductPricingError] = useState<string | null>(null);

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

  const hintRevealedIndicesRef = useRef<number[]>([]);

  useEffect(() => {
    hintRevealedIndicesRef.current = [];
  }, [riddleId, gameMode]);

  useEffect(() => {
    logger.debug(
      `Game session context changed (mode=${gameMode}, riddleId=${riddleId}). Resetting local game state.`
    );
    resetGame();
  }, [gameMode, riddleId, answer, resetGame]);

  const isAnyModalVisible = modal.modals.length > 0;
  const [canAnimateCoinIncreases, setCanAnimateCoinIncreases] = useState(
    !isAnyModalVisible
  );
  const [isAwaitingPostSubmitModalClose, setIsAwaitingPostSubmitModalClose] =
    useState(false);
  const letterStates = useMemo(() => computeLetterStates(guesses), [guesses]);

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } = useRewardedAds();

  useEffect(() => {
    loadRewardedAd();
  }, [loadRewardedAd]);

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
      setCanAnimateCoinIncreases(false);

      if (isAnyModalVisible) {
        hasSeenPostSubmitModalRef.current = true;
        return;
      }

      if (!hasSeenPostSubmitModalRef.current) {
        return;
      }

      coinAnimationSettleTimeoutRef.current = setTimeout(() => {
        setCanAnimateCoinIncreases(true);
        setIsAwaitingPostSubmitModalClose(false);
        hasSeenPostSubmitModalRef.current = false;
        coinAnimationSettleTimeoutRef.current = null;
      }, MODAL_CLOSE_DELAY_MS);
      return;
    }

    if (isAnyModalVisible) {
      setCanAnimateCoinIncreases(false);
      return;
    }

    // Wait for modal transitions/next queued modal to settle before allowing
    // deferred coin count-up animations to start.
    coinAnimationSettleTimeoutRef.current = setTimeout(() => {
      setCanAnimateCoinIncreases(true);
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
      const products = await runWithServerLoading(() => IapService.getProducts());
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
  }, [runWithServerLoading, shouldUseDevFirestoreCatalog]);

  const loadFirestoreProducts = useCallback(async () => {
    setProductPricingLoading(true);
    setProductPricingError(null);

    try {
      const products = await runWithServerLoading(() =>
        ProductPricingService.getActiveProducts()
      );
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
  }, [runWithServerLoading]);

  useEffect(() => {
    void loadIapProducts();
  }, [loadIapProducts]);

  useEffect(() => {
    void loadFirestoreProducts();
  }, [loadFirestoreProducts]);

  const firstTimeCheckDone = useRef(false);
  const { showWelcomeModal, showInstructionsModal, showInfoModal } = useModal();
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
    if (suppressOnboarding || firstTimeCheckDone.current) return;
    firstTimeCheckDone.current = true;

    const runOnboardingFlow = async () => {
      try {
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
      } catch (error) {
        logger.error("Error running onboarding flow:", error);
        captureException(error);
      }
    };

    runOnboardingFlow();
  }, [
    isGuestMode,
    showWelcomeModal,
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
      setActiveSlotIndex(0);
      return;
    }

    setActiveSlotIndex((prev) => {
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
  }, [answerLength, currentGuess]);

  const handleWatchAdToContinue = useCallback(async () => {
    const didCompleteRewardedAd = await showRewardedAd();
    if (didCompleteRewardedAd) {
      continueGame();
      return true;
    }

    modal.showInfoModal({
      title: AppStrings.GameScreenAlerts.AD_NOT_READY_TITLE,
      message: AppStrings.GameScreenAlerts.AD_NOT_READY_MESSAGE,
    });
    return false;
  }, [showRewardedAd, continueGame, modal]);

  const handleCoinContinue = useCallback(async () => {
    modal.closeModalByType("loss");
    try {
      if (!isGuestMode) {
        await runWithServerLoading(() =>
          httpsCallable(getFunctions(getApp()), "spendCoins")({
            amount: CONTINUE_COST_COINS,
            reason: "continue",
          })
        );
      } else if (playerData) {
        updatePlayerDataLocally({
          coins: Math.max(0, (playerData.coins ?? 0) - CONTINUE_COST_COINS),
        });
      }
      continueGame();
    } catch (error) {
      logger.error("Error spending coins for continue:", error);
      captureException(error);
      modal.showInfoModal({
        title: AppStrings.CommonAlerts.ERROR_TITLE,
        message: AppStrings.GameScreenAlerts.SPEND_COINS_ERROR_MESSAGE,
      });
    }
  }, [
    modal,
    continueGame,
    runWithServerLoading,
    isGuestMode,
    playerData,
    updatePlayerDataLocally,
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
          const isLocalDevPurchase =
            typeof purchaseResult.transactionId === "string" &&
            purchaseResult.transactionId.startsWith("dev-local-");
          if (isLocalDevPurchase && coinsPurchased > 0 && playerData) {
            updatePlayerDataLocally({
              coins: (playerData.coins ?? 0) + coinsPurchased,
            });
          }
          modal.showCoinPurchaseFanfareModal({
            coinsPurchased,
            onConfirm: () => {
              const openCoinShopModalIds = modal.modals
                .filter((openModal) => openModal.type === "coinShop")
                .map((openModal) => openModal.id);
              openCoinShopModalIds.forEach((modalId) => {
                modal.closeModal(modalId);
              });
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
    [isPurchaseInProgress, modal, playerData, updatePlayerDataLocally]
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
    if (gameOver && lastGuessResult && !gameOverHandledRef.current) {
      gameOverHandledRef.current = true;
      const result = lastGuessResult;

      if (result.outcome === "win") {
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

        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
          if (unlockedAchievementNames.length > 0) {
            ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);
          }
        }

        if (unlockedAchievementNames.length > 0) {
          modal.showAchievementUnlockFanfareModal({
            coinsEarned: result.coinsEarned || 0,
            achievementNames: unlockedAchievementNames,
            achievements: unlockedAchievements.map((achievement) => ({
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
            })),
          });
        }

        const currentXp = playerData?.stats?.xp ?? playerData?.stats?.totalScore ?? 0;
        const previousLevel = getXpLevel(currentXp).level;
        const nextLevel = getXpLevel(currentXp + (result.scoreEarned || 0)).level;
        const didLevelUp = nextLevel > previousLevel;
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

        const showVictoryModal = () => {

          const continueToNextLevel = async () => {
            logger.debug("Victory modal: Next level button pressed");
            resetGame();

            try {
              await runWithServerLoading(() => onNextLevel());
            } catch (error) {
              logger.error("Error calling onNextLevel:", error);
              captureException(error);
            }
          };

          modal.showVictoryModal({
            attempts: guesses.length,
            coinsEarned: result.coinsEarned || 0,
            totalCoins:
              (userCoins ?? 0) + (result.coinsEarned || 0) + totalBonusCoinsAwarded,
            unlockedAchievementNames,
            guesses,
            onNext: async () => {
              modal.closeModalByType("victory");
              if (didLevelUp) {
                await safeDelay(MODAL_CLOSE_DELAY_MS);
                modal.showLevelUpFanfareModal({
                  newLevel: nextLevel,
                  coinsAwarded: levelUpBonusCoins,
                  onContinue: () => {
                    void continueToNextLevel();
                  },
                });
                return;
              }
              await continueToNextLevel();
            },
          });
        };

        if (gameMode === "daily" && resolvedDailyStreak) {
          modal.showStreakIncreaseFanfareModal({
            streakValue: resolvedDailyStreak,
            coinsAwarded: DAILY_CHALLENGE_COIN_REWARD,
            onContinue: showVictoryModal,
          });
        } else {
          showVictoryModal();
        }

        onGameWin(
          guesses.length,
          (result.coinsEarned || 0),
          result.scoreEarned || 0,
          resolvedDailyStreak,
          totalBonusCoinsAwarded
        );
      } else if (result.outcome === "attemptLimitReached") {
        const canAffordCoinContinue = (userCoins ?? 0) >= CONTINUE_COST_COINS;
        const skipLevelCost =
          gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC;

        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          onWatchAdContinue: result.canOfferRewardedAd
            ? handleWatchAdToContinue
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
            resetGame();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after attempt limit:", error);
              captureException(error);
            });
          },
        });
      } else if (result.outcome === "loss") {
        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
        }

        const skipLevelCost =
          gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC;

        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          skipLevelCost,
          onOpenShop: () => openShopFromLossRef.current(),
          onNext: () => {
            modal.closeModalByType("loss");
            resetGame();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after loss:", error);
              captureException(error);
            });
          },
        });

        if (result.correctAnswer) {
          onGameLoss(result.correctAnswer);
        }
      }
    }
  }, [
    gameOver,
    lastGuessResult,
    modal,
    guesses,
    isHapticsEnabled,
    isRewardedAdReady,
    userCoins,
    gameMode,
    onGameWin,
    onGameLoss,
    onNextLevel,
    resetGame,
    deriveDailyStreakAfterWin,
    handleWatchAdToContinue,
    handleCoinContinue,
    runWithServerLoading,
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
        const result = (await runWithServerLoading(() =>
          processGuess(currentGuess)
        )) as GuessResult;
        setLastGuessResult(result);
        const willOpenResultModal = result.outcome !== "continue";
        hasSeenPostSubmitModalRef.current = false;
        setIsAwaitingPostSubmitModalClose(willOpenResultModal);
      } catch (error) {
        logger.error("Error processing guess in GameScreen:", error);
        captureException(error);
        hasSeenPostSubmitModalRef.current = false;
        setIsAwaitingPostSubmitModalClose(false);
        modal.showInfoModal({
          title: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
          message: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE,
        });
      }
    } else if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationWarning", hapticOptions);
    }
  }, [
    currentGuess,
    answerLength,
    processGuess,
    isHapticsEnabled,
    modal,
    runWithServerLoading,
  ]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (answerLength <= 0) return;

      const targetIndex = Math.min(
        Math.max(0, activeSlotIndex),
        Math.max(0, answerLength - 1)
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

      setActiveSlotIndex((prev) =>
        Math.min(Math.max(0, answerLength - 1), prev + 1)
      );
    },
    [activeSlotIndex, answerLength, setCurrentGuess]
  );

  const handleBackspace = useCallback(() => {
    if (answerLength <= 0) return;

    const clampedActiveIndex = Math.min(
      Math.max(0, activeSlotIndex),
      Math.max(0, answerLength - 1)
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

    setActiveSlotIndex((prev) => {
      const clampedPrev = Math.min(
        Math.max(0, prev),
        Math.max(0, answerLength - 1)
      );
      return Math.max(0, clampedPrev - 1);
    });
  }, [activeSlotIndex, answerLength, setCurrentGuess]);

  const handleSelectCurrentGuessSlot = useCallback(
    (slotIndex: number) => {
      if (answerLength <= 0) return;
      if (slotIndex < 0 || slotIndex >= answerLength) return;
      setActiveSlotIndex(slotIndex);
    },
    [answerLength]
  );

  const handleShowHint = useCallback(async () => {
    if (!playerData?.userId) return;

    logger.debug("Showing hint modal for riddle:", riddleId);

    modal.showHintModal({
      userCoins,
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

        onHintUsed(hintCost);
      },
    });
  }, [
    playerData?.userId,
    riddleId,
    modal,
    userCoins,
    hintCost,
    answer,
    setCurrentGuess,
    onHintUsed,
  ]);

  const handleCoinsPress = useCallback(() => {
    const availableStoreProductIds = new Set(iapProducts.map((product) => product.id));
    const purchasableFirestoreProducts = shouldUseDevFirestoreCatalog
      ? firestoreProducts
      : firestoreProducts.filter((product) =>
          availableStoreProductIds.has(product.productId)
        );

    logger.debug("Opening coin shop modal with:", {
      iapProducts: iapProducts.length,
      firestoreProducts: firestoreProducts.length,
      purchasableFirestoreProducts: purchasableFirestoreProducts.length,
      shouldUseDevFirestoreCatalog,
      iapLoading,
      productPricingLoading,
      iapError,
      productPricingError,
    });

    try {
      modal.showCoinShop({
        products: iapProducts,
        firestoreProducts: purchasableFirestoreProducts,
        currentCoins: userCoins,
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
    iapProducts,
    firestoreProducts,
    shouldUseDevFirestoreCatalog,
    iapLoading,
    productPricingLoading,
    iapError,
    productPricingError,
    modal,
    userCoins,
    handlePurchaseProduct,
    handleWatchAdForCoins,
    handlePayAndPlay,
  ]);

  const handleOverlayNext = useCallback(() => {
    logger.debug("Next button pressed - opening skip modal");

    const skipCost =
      gameMode === "daily" ? SKIP_COST_DAILY : SKIP_COST_CLASSIC;

    modal.showSkipModal({
      userCoins,
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
          resetGame();
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
    userCoins,
    handleCoinsPress,
    resetGame,
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
            latestPlayerData = refreshedProfile;
            updatePlayerDataLocally(refreshedProfile, {
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
        playerData: latestPlayerData ?? null,
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
    setActiveSlotIndex(Math.max(0, answerLength - 1));
  }, [gameOver, answer, answerLength, setCurrentGuess]);

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
            userCoins={userCoins}
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
            isAnyOverlayVisible={isAnyModalVisible}
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
          visible={isLoading || isProfileModalLoading || isPurchaseInProgress}
          size={LOADING_SPINNER_SIZE}
          opacity={LOADING_SPINNER_OPACITY}
        />

        <ModalProvider />
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

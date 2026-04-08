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
import { KeyboardAvoidingView, Platform, View } from "react-native";
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
import { AppStrings } from "../../constants/AppStrings";
import { isTablet, isLargeTablet, isDesktop } from "../../utils/responsive";
import { safeDelay } from "../../utils/timing";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import {
  SKIP_COST_CLASSIC,
  SKIP_COST_DAILY,
  SKIP_COST_TUTORIAL,
  CONTINUE_COST_COINS,
  MODAL_CLOSE_DELAY_MS,
  SOUND_RESUME_DELAY_MS,
  WIN_FADE_OUT_DURATION_MS,
  WIN_SUCCESS_DELAY_MS,
  WIN_FADE_IN_DELAY_MS,
  WIN_FADE_IN_DURATION_MS,
  LOSS_NEGATIVE_FADE_DURATION_MS,
} from "../../constants/game";
import {
  LOADING_SPINNER_OPACITY,
  LOADING_SPINNER_SIZE,
} from "../../constants/loading";
import { styles } from "../../styles";
import { GameInput } from "../../components/game/GameInput";
import { useModal } from "../../hooks/useModal";
import { useFirstTimeExperience } from "../../hooks/useFirstTimeExperience";
import { ModalProvider } from "../../components/modals/ModalProvider";
import { IapService } from "../../services/IapService";
import ModalTogglePanel from "../../components/development/ModalTogglePanel";
import StarryBackground from "../../components/background/StarryBackground";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";
import { getHardModeConstraints, validateHardModeGuess } from "../../utils/hardMode";
import { computeLetterStates } from "../../utils/letterStates";
import { getTutorialRiddleCount } from "../../services/FirestoreService";

interface GuessResult {
  outcome: "win" | "loss" | "continue" | "attemptLimitReached";
  feedback?: ("green" | "yellow" | "red")[];
  correctAnswer?: string;
  coinsEarned?: number;
  scoreEarned?: number;
  canOfferRewardedAd?: boolean;
  canOfferCoinContinue?: boolean;
  attemptsRemaining?: number;
  /** Server-returned achievement IDs newly unlocked by this guess. */
  newlyUnlockedAchievementIds?: string[];
}

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";
const HARD_MODE_STORAGE_KEY = "isHardMode";

// Configuration for haptic feedback (optional)
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Props required to render a game session for a particular riddle.
 */
interface GameScreenProps {
  riddleId: string;
  riddleText: string;
  /** The correct answer, cached from Firestore. Used for local feedback computation. */
  answer: string;
  answerLength: number;
  userCoins: number;
  hintCost: number;
  onGameWin: (attempts: number, coinsEarned: number, scoreEarned: number) => void;
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
}

/**
 * Inner implementation of the game screen. Wrapped in `React.memo` below
 * to avoid unnecessary re-renders when parent props are stable.
 *
 * @param props Game configuration and callbacks for win/loss/hint/next level.
 */
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
}) => {
  const { playerData, logout, setGameMode, fetchCurrentRiddle } = useAuth();
  const modal = useModal();
  useFirstTimeExperience();

  // Simplified state - no more massive overlay state object!
  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(
    null
  );
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [isHardMode, setIsHardMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Guard against re-running game-over logic when modal context re-renders.
  // The `modal` object from useModal() gets a new reference every time any
  // modal opens/closes, which would re-trigger the game-over effect and show
  // the victory modal + fire onGameWin multiple times.
  const gameOverHandledRef = useRef(false);

  // IAP state
  const [iapProducts, setIapProducts] = useState<RNIap.Product[]>([]);
  const [iapLoading, setIapLoading] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);

  // Tutorial total steps (for header step indicator when in tutorial mode)
  const [tutorialTotalSteps, setTutorialTotalSteps] = useState<number | null>(
    null
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
    gameMode:
      gameMode === "daily"
        ? "challenge"
        : gameMode === "tutorial"
          ? "tutorial"
          : "classic",
  });

  // Tracks which answer positions have already been revealed by a hint this game.
  // Using a ref so it is readable synchronously inside the hint callback without
  // needing to appear in useCallback dep arrays.
  const hintRevealedIndicesRef = useRef<number[]>([]);

  // Reset hint tracking whenever the riddle or game mode changes.
  useEffect(() => {
    hintRevealedIndicesRef.current = [];
  }, [riddleId, gameMode]);

  // Update useGameLogic when gameMode changes
  useEffect(() => {
    logger.debug(`Game mode changed to: ${gameMode}`);
    // Reset the game when game mode changes
    resetGame();
  }, [gameMode, resetGame]);

  // Fetch tutorial total steps when in tutorial mode (for header step indicator)
  useEffect(() => {
    if (gameMode !== "tutorial") {
      setTutorialTotalSteps(null);
      return;
    }
    getTutorialRiddleCount()
      .then(setTutorialTotalSteps)
      .catch((err) => {
        logger.warn("Could not get tutorial riddle count for header:", err);
      });
  }, [gameMode]);

  // Check if any modal is currently open
  const isAnyModalVisible = modal.modals.length > 0;

  // Derive per-letter feedback state for keyboard colouring
  const letterStates = useMemo(() => computeLetterStates(guesses), [guesses]);

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  // Load IAP products when component mounts
  useEffect(() => {
    const loadProducts = async () => {
      setIapLoading(true);
      setIapError(null);
      try {
        const products = await IapService.getProducts();
        setIapProducts(products);
      } catch (error) {
        logger.error("Error loading IAP products:", error);
        captureException(error);
        setIapError(
          error instanceof Error ? error.message : "Failed to load products"
        );
      } finally {
        setIapLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Initialize first-time user experience — guard with a ref so this only
  // runs once even though modal/playerData deps cause the effect to re-fire.
  const firstTimeCheckDone = useRef(false);
  useEffect(() => {
    if (firstTimeCheckDone.current) return;
    firstTimeCheckDone.current = true;

    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome");
        if (hasSeenWelcome === null) {
          let showStartTutorial = true;
          try {
            const count = await getTutorialRiddleCount();
            showStartTutorial = count > 0;
          } catch (err) {
            logger.warn("Could not get tutorial riddle count, hiding Start Tutorial:", err);
            showStartTutorial = false;
          }
          modal.showWelcomeModal({
            onStartTutorial: () => {
              setGameMode("tutorial");
              if (playerData) {
                fetchCurrentRiddle(playerData, "tutorial");
              }
            },
            showStartTutorial,
          });
          await AsyncStorage.setItem("hasSeenWelcome", "true");
        } else {
          const hasSeenInstructions = await AsyncStorage.getItem(
            "hasSeenInstructions"
          );
          if (hasSeenInstructions === null) {
            modal.showInstructionsModal();
            await AsyncStorage.setItem("hasSeenInstructions", "true");
          }
        }
      } catch (error) {
        logger.error("Error checking AsyncStorage:", error);
        captureException(error);
      }
    };

    checkIfFirstTimeUser();
  }, [modal, playerData, setGameMode, fetchCurrentRiddle]);

  // Load settings — batch all keys in a single AsyncStorage call
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [[, soundEnabled], [, hapticsEnabled], [, hardMode]] =
          await AsyncStorage.multiGet([
            SOUND_ENABLED_STORAGE_KEY,
            HAPTICS_ENABLED_STORAGE_KEY,
            HARD_MODE_STORAGE_KEY,
          ]);
        if (soundEnabled !== null) {
          const parsedSoundEnabled = JSON.parse(soundEnabled);
          setIsSoundEnabled(parsedSoundEnabled);
          SoundManager.setSoundEnabled(parsedSoundEnabled);
        } else {
          SoundManager.setSoundEnabled(true);
        }
        if (hapticsEnabled !== null) {
          setIsHapticsEnabled(JSON.parse(hapticsEnabled));
        }
        if (hardMode !== null) {
          setIsHardMode(JSON.parse(hardMode));
        }
      } catch (error) {
        logger.error("Error loading settings from AsyncStorage:", error);
        captureException(error);
      }
    };

    loadSettings();
  }, []);

  // Save settings
  useEffect(() => {
    AsyncStorage.setItem(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(isSoundEnabled)
    ).catch((error: unknown) => {
      logger.error("Error saving sound setting to AsyncStorage:", error);
      captureException(error);
    });
  }, [isSoundEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HAPTICS_ENABLED_STORAGE_KEY,
      JSON.stringify(isHapticsEnabled)
    ).catch((error: unknown) => {
      logger.error("Error saving haptics setting to AsyncStorage:", error);
      captureException(error);
    });
  }, [isHapticsEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HARD_MODE_STORAGE_KEY,
      JSON.stringify(isHardMode)
    ).catch((error: unknown) => {
      logger.error("Error saving hard mode setting to AsyncStorage:", error);
      captureException(error);
    });
  }, [isHardMode]);

  // Background music management
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

  // Reset the guard whenever a new game starts so the next game-over is handled.
  useEffect(() => {
    if (!gameOver) {
      gameOverHandledRef.current = false;
    }
  }, [gameOver]);

  const handleWatchAdToContinue = useCallback(async () => {
    modal.closeModalByType("loss");
    if (isRewardedAdReady) {
      showRewardedAd();
    }
    continueGame();
  }, [modal, isRewardedAdReady, showRewardedAd, continueGame]);

  const handleCoinContinue = useCallback(async () => {
    modal.closeModalByType("loss");
    try {
      await httpsCallable(getFunctions(getApp()), "spendCoins")({
        amount: CONTINUE_COST_COINS,
        reason: "continue",
      });
      continueGame();
    } catch (error) {
      logger.error("Error spending coins for continue:", error);
      captureException(error);
      modal.showInfoModal({ title: "Error", message: "Could not spend coins. Please try again." });
    }
  }, [modal, continueGame]);

  // Handle game over states
  useEffect(() => {
    if (gameOver && lastGuessResult && !gameOverHandledRef.current) {
      gameOverHandledRef.current = true;
      const result = lastGuessResult;

      if (result.outcome === "win") {
        SoundManager.fadeOutBackgroundMusic({
          duration: WIN_FADE_OUT_DURATION_MS,
          curve: "exponential",
        });

        safeDelay(WIN_SUCCESS_DELAY_MS).then(() => {
          SoundManager.playSuccess();
          safeDelay(WIN_FADE_IN_DELAY_MS).then(() => {
            SoundManager.fadeInBackgroundMusic({
              duration: WIN_FADE_IN_DURATION_MS,
              curve: "linear",
            });
          });
        });

        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
        }

        // Use the new modal system - much cleaner!
        modal.showVictoryModal({
          attempts: guesses.length,
          coinsEarned: result.coinsEarned || 0,
          guesses: guesses,
          onNext: async () => {
            logger.debug("Victory modal: Next level button pressed");
            logger.debug("Closing victory modal...");
            modal.closeModalByType("victory");
            logger.debug("Resetting game...");
            resetGame();
            logger.debug("Calling onNextLevel...");
            try {
              // Make sure we await the async onNextLevel function
              await onNextLevel();
              logger.debug("onNextLevel completed successfully");
            } catch (error) {
              logger.error("Error calling onNextLevel:", error);
              captureException(error);
            }
          },
          onHome: () => {
            logger.debug("Victory modal: Home button pressed");
            modal.closeModalByType("victory");
            resetGame();
            hintRevealedIndicesRef.current = [];
          },
        });

        onGameWin(guesses.length, result.coinsEarned || 0, result.scoreEarned || 0);
      } else if (result.outcome === "attemptLimitReached") {
        const canAffordCoinContinue = (userCoins ?? 0) >= CONTINUE_COST_COINS;
        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          onWatchAdContinue: result.canOfferRewardedAd ? handleWatchAdToContinue : undefined,
          onCoinContinue: (result.canOfferCoinContinue && canAffordCoinContinue) ? handleCoinContinue : undefined,
          coinContinueCost: CONTINUE_COST_COINS,
          canWatchAd: isRewardedAdReady,
          canUseCoin: canAffordCoinContinue,
          onNext: () => {
            modal.closeModalByType("loss");
            resetGame();
            onNextLevel();
          },
          onHome: () => {
            modal.closeModalByType("loss");
            resetGame();
            hintRevealedIndicesRef.current = [];
          },
        });
      } else if (result.outcome === "loss") {
        // Always show loss modal
        SoundManager.playNegativeWithFadeIn({
          duration: LOSS_NEGATIVE_FADE_DURATION_MS,
          curve: "exponential",
        });

        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
        }

        // Show loss modal
        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          onNext: () => {
            modal.closeModalByType("loss");
            resetGame();
            onNextLevel();
          },
          onHome: () => {
            modal.closeModalByType("loss");
            resetGame();
            hintRevealedIndicesRef.current = [];
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
    onGameWin,
    onGameLoss,
    onNextLevel,
    resetGame,
    handleWatchAdToContinue,
    handleCoinContinue,
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

  const toggleHardMode = useCallback((isEnabled: boolean) => {
    setIsHardMode(isEnabled);
  }, []);

  // Game actions
  const handleSubmit = useCallback(async () => {
    if (currentGuess.length === answerLength) {
      if (isHardMode && guesses.length > 0) {
        const constraints = getHardModeConstraints(guesses);
        const violation = validateHardModeGuess(currentGuess, constraints);
        if (violation) {
          if (isHapticsEnabled) {
            ReactNativeHapticFeedback.trigger("notificationWarning", hapticOptions);
          }
          modal.showInfoModal({ title: "Hard Mode", message: violation.message });
          return;
        }
      }
      setIsLoading(true);
      try {
        const result = (await processGuess(currentGuess)) as GuessResult;
        setLastGuessResult(result);
        setIsLoading(false);
      } catch (error) {
        logger.error("Error processing guess in GameScreen:", error);
        captureException(error);
        setIsLoading(false);
        modal.showInfoModal({
          title: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
          message: AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE,
        });
      }
    } else {
      if (isHapticsEnabled) {
        ReactNativeHapticFeedback.trigger("notificationWarning", hapticOptions);
      }
    }
  }, [
    currentGuess,
    answerLength,
    processGuess,
    isHapticsEnabled,
    isHardMode,
    guesses,
    setLastGuessResult,
    setIsLoading,
  ]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (currentGuess.length < answerLength) {
        setCurrentGuess((prev: string[]) => [...prev, key]);
      }
    },
    [answerLength, currentGuess.length, setCurrentGuess]
  );

  const handleBackspace = useCallback(() => {
    setCurrentGuess((prev: string[]) => prev.slice(0, -1));
  }, [setCurrentGuess]);

  const handleChangeGameModePress = useCallback(() => {
    modal.showGameModeModal({
      currentLevel: (playerData?.progress?.classicIndex ?? 0) + 1,
      onSelectMode: (mode) => {
        logger.debug(`Selected game mode: ${mode}`);
        // Handle mode selection here
        if (mode === "classic") {
          // Navigate to classic mode
          resetGame();
          // Logic for switching to classic mode
          setIsLoading(true);
          // Use the setGameMode function from AuthContext
          if (playerData) {
            setGameMode("classic");
            // Fetch the riddle for classic mode
            fetchCurrentRiddle(playerData, "classic").finally(() => {
              setIsLoading(false);
            });
          } else {
            setIsLoading(false);
          }
        } else if (mode === "daily") {
          // Navigate to daily challenge
          resetGame();
          // Logic for switching to daily challenge
          setIsLoading(true);
          // Use the setGameMode function from AuthContext
          if (playerData) {
            setGameMode("daily");
            // Fetch the riddle for daily challenge
            fetchCurrentRiddle(playerData, "daily").finally(() => {
              setIsLoading(false);
            });
          } else {
            setIsLoading(false);
          }
        }
      },
    });
  }, [
    modal,
    resetGame,
    playerData,
    setGameMode,
    fetchCurrentRiddle,
    setIsLoading,
  ]);

  const handleShowHint = useCallback(async () => {
    if (!playerData?.userId) return;

    logger.debug("Showing hint modal for riddle:", riddleId);

    // Show the hint modal using the modal system
    modal.showHintModal({
      userCoins,
      hintCost,
      onShowHint: () => {
        // Find the first position not yet revealed by a hint this game.
        // We deliberately ignore what the user has typed so that every
        // letter in the answer can always be revealed regardless of the
        // player's current input.
        const answerLetters = answer.toLowerCase().split("");
        const revealIndex = answerLetters.findIndex(
          (_, i) => !hintRevealedIndicesRef.current.includes(i)
        );

        if (revealIndex === -1) {
          modal.showInfoModal({
            title: "Hint Not Available",
            message: "No more letters can be revealed.",
          });
          return;
        }

        // Mark this position as revealed before updating state.
        hintRevealedIndicesRef.current = [...hintRevealedIndicesRef.current, revealIndex];

        // Insert the revealed letter at its position in the current guess.
        // Pad with empty strings for any gap so subsequent hints still
        // find untyped positions correctly.
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

  const handleOverlayNext = useCallback(() => {
    logger.debug("Next button pressed - opening skip modal");

    // Determine skip cost based on game mode
    const skipCost =
      gameMode === "daily"
        ? SKIP_COST_DAILY
        : gameMode === "classic"
          ? SKIP_COST_CLASSIC
          : SKIP_COST_TUTORIAL;

    modal.showSkipModal({
      userCoins,
      skipCost,
      onSkipLevel: async () => {
        try {
          await httpsCallable(getFunctions(getApp()), "spendCoins")({
            amount: skipCost,
            reason: "skip",
          });
          onSkipUsed(skipCost);
          resetGame();
          onNextLevel();
        } catch (error) {
          logger.error("Error spending coins for skip:", error);
          captureException(error);
          modal.showInfoModal({ title: "Error", message: "Could not spend coins. Please try again." });
        }
      },
    });
  }, [gameMode, modal, userCoins, resetGame, onNextLevel, onSkipUsed]);

  const handleSettingsPress = useCallback(() => {
    logger.debug("Settings button pressed - opening settings modal");
    modal.showSettingsModal({
      isSoundEnabled,
      isHapticsEnabled,
      isHardMode,
      onToggleSound: toggleSoundEnabled,
      onToggleHaptics: toggleHapticsEnabled,
      onToggleHardMode: toggleHardMode,
      onPressLogout: logout,
      onPressHelp: () => {
        logger.debug(
          "Help button pressed - closing settings and opening instructions modal"
        );
        modal.closeModalByType("settings");
        setTimeout(() => {
          modal.showInstructionsModal();
        }, MODAL_CLOSE_DELAY_MS);
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
    isHardMode,
    toggleSoundEnabled,
    toggleHapticsEnabled,
    toggleHardMode,
    logout,
  ]);

  const handleProfilePress = useCallback(() => {
    modal.showFullProfileDetailsModal({
      playerData: playerData || {},
    });
  }, [modal, playerData]);

  const handlePurchaseProduct = useCallback(
    async (productId: string) => {
      logger.debug(`Initiating purchase for product: ${productId}`);
      setIapLoading(true);

      try {
        const purchaseResult = await IapService.purchaseProduct(productId);

        if (purchaseResult) {
          logger.debug("Purchase completed successfully:", purchaseResult);
          modal.showInfoModal({
            title: "Purchase Successful!",
            message: "Your coins have been added to your account.",
            onConfirm: () => modal.closeModalByType("coinShop"),
          });
        } else {
          logger.debug("Purchase was cancelled or returned null");
          // Don't show an error for cancelled purchases
        }
      } catch (error) {
        logger.error("Purchase failed:", error);
        captureException(error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Purchase failed. Please try again.";
        modal.showInfoModal({ title: "Purchase Failed", message: errorMessage });
      } finally {
        setIapLoading(false);
      }
    },
    [modal]
  );

  const handlePayAndPlay = useCallback(() => {
    logger.debug("Pay and play button pressed");
    // This could trigger the cheapest coin pack purchase or show a specific payment flow
    const cheapestProduct = [...iapProducts].sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    )[0];

    if (cheapestProduct) {
      handlePurchaseProduct(cheapestProduct.id);
    } else {
      modal.showInfoModal({ title: "No Products Available", message: "Please try again later." });
    }
  }, [iapProducts, handlePurchaseProduct, modal]);

  const handleWatchAdForCoins = useCallback(async () => {
    logger.debug("Watch ad for coins button pressed");
    modal.closeModalByType("coinShop");

    try {
      await loadRewardedAd();
      if (isRewardedAdReady) {
        await showRewardedAd();
        logger.debug("Rewarded ad for coins shown successfully");
      } else {
        logger.warn("Rewarded ad was not ready to be shown");
        modal.showInfoModal({
          title: "Ad Not Ready",
          message: "The rewarded ad couldn't be loaded at this time. Please try again later.",
        });
      }
    } catch (error) {
      logger.error("Error showing rewarded ad for coins:", error);
      captureException(error);
      modal.showInfoModal({
        title: "Ad Error",
        message: "An error occurred while trying to show the rewarded ad.",
      });
    }
  }, [modal, loadRewardedAd, isRewardedAdReady, showRewardedAd]);

  const handleCoinsPress = useCallback(() => {
    logger.debug("Opening coin shop modal with:", {
      products: iapProducts.length,
      loading: iapLoading,
      error: iapError,
      hasCallback: typeof handlePurchaseProduct === "function",
    });

    modal.showCoinShopModal({
      products: iapProducts,
      loading: iapLoading,
      error: iapError,
      onPurchaseProduct: handlePurchaseProduct,
      onWatchVideo: handleWatchAdForCoins,
      onPayAndPlay: handlePayAndPlay,
    });
  }, [
    modal,
    iapProducts,
    iapLoading,
    iapError,
    handlePurchaseProduct,
    handleWatchAdForCoins,
    handlePayAndPlay,
  ]);

  const isSubmitDisabled = useMemo(
    () => currentGuess.length !== answerLength,
    [currentGuess.length, answerLength]
  );

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
            isTutorial={gameMode === "tutorial"}
            tutorialStep={(playerData?.progress?.tutorialIndex ?? 0) + 1}
            tutorialTotalSteps={tutorialTotalSteps ?? undefined}
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
            onChangeGameModePress={handleChangeGameModePress}
          />
        </KeyboardAvoidingView>

        {/* The new modal system - no more massive props list! */}
        <ModalProvider />

        <Controls
          onNextPress={handleOverlayNext}
          isWin={gameOver && lastGuessResult?.outcome === "win"}
        />

        <PulsingSpinner
          visible={isLoading}
          size={LOADING_SPINNER_SIZE}
          opacity={LOADING_SPINNER_OPACITY}
        />

        {/* Development Modal Debug Panel - Only visible in development builds */}
        {__DEV__ && <ModalTogglePanel />}
      </SafeAreaView>
    </View>
  );
};

const GameScreen = React.memo(GameScreenInner);
export default GameScreen;

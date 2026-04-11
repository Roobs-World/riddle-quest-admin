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
  MODAL_CLOSE_DELAY_MS,
  SOUND_RESUME_DELAY_MS,

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
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";
import { computeLetterStates } from "../../utils/letterStates";
import { ACHIEVEMENT_DEFINITIONS } from "../../constants/achievements";
import { useGameSessionController } from "../../features/game-session/useGameSessionController";
import { createGameModalActions } from "../../features/game-session/gameModalActions";
import { isGuestPlayer } from "../../features/auth/sessionBootstrap";

interface GuessResult {
  /** High-level result classification returned after guess processing. */
  outcome: "win" | "loss" | "continue" | "attemptLimitReached";
  /** Per-letter feedback for the submitted guess, when available. */
  feedback?: ("green" | "yellow" | "red")[];
  /** Correct answer returned for terminal outcomes. */
  correctAnswer?: string;
  /** Coin reward awarded by backend on win. */
  coinsEarned?: number;
  /** Score reward awarded by backend on win. */
  scoreEarned?: number;
  /** Indicates whether rewarded-ad continue can be offered. */
  canOfferRewardedAd?: boolean;
  /** Indicates whether coin-spend continue can be offered. */
  canOfferCoinContinue?: boolean;
  /** Remaining attempts for non-terminal continue outcomes. */
  attemptsRemaining?: number;
  /** Server-returned achievement IDs newly unlocked by this guess. */
  newlyUnlockedAchievementIds?: string[];
}

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";

// Configuration for haptic feedback (optional)
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Props required to render a game session for a particular riddle.
 */
interface GameScreenProps {
  /** Active riddle document id. */
  riddleId: string;
  /** Localized riddle prompt text shown to the player. */
  riddleText: string;
  /** The correct answer, cached from Firestore. Used for local feedback computation. */
  answer: string;
  /** Number of letters expected in the answer. */
  answerLength: number;
  /** Current player coin balance for hint/skip/shop interactions. */
  userCoins: number;
  /** Cost in coins for a single hint in this session. */
  hintCost: number;
  /** Invoked when a win is finalized. */
  onGameWin: (attempts: number, coinsEarned: number, scoreEarned: number) => void;
  /** Invoked when a loss is finalized with the revealed answer. */
  onGameLoss: (correctAnswer: string) => void;
  /** Invoked after successfully spending coins for a hint. */
  onHintUsed: (cost: number) => void;
  /** Invoked after successfully spending coins to skip. */
  onSkipUsed: (cost: number) => void;
  /** Loads the next playable riddle. */
  onNextLevel: () => void;
  /** Current gameplay mode (classic or daily). */
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
  const { playerData, logout, setGameMode, fetchCurrentRiddle, updatePlayerDataLocally } = useAuth();
  const modal = useModal();
  const isGuestMode = isGuestPlayer(playerData);

  // Simplified state - no more massive overlay state object!
  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(
    null
  );
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    getAppLanguage()
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const { isLoading, runWithServerLoading } = useGameSessionController();
  const modalActions = useMemo(() => createGameModalActions(modal), [modal]);

  // Guard against re-running game-over logic when modal context re-renders.
  // The `modal` object from useModal() gets a new reference every time any
  // modal opens/closes, which would re-trigger the game-over effect and show
  // the victory modal + fire onGameWin multiple times.
  const gameOverHandledRef = useRef(false);

  // IAP state
  const [iapProducts, setIapProducts] = useState<RNIap.Product[]>([]);
  const [iapLoading, setIapLoading] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [firestoreProducts, setFirestoreProducts] = useState<ProductPricing[]>([]);
  const [productPricingLoading, setProductPricingLoading] = useState(false);
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

  // Check if any modal is currently open
  const isAnyModalVisible = modal.modals.length > 0;

  // Derive per-letter feedback state for keyboard colouring
  const letterStates = useMemo(() => computeLetterStates(guesses), [guesses]);

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  useEffect(() => {
    loadRewardedAd();
  }, [loadRewardedAd]);

  // Load IAP products when component mounts
  useEffect(() => {
    const loadProducts = async () => {
      setIapLoading(true);
      setIapError(null);
      try {
        const products = await runWithServerLoading(() => IapService.getProducts());
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
  }, [runWithServerLoading]);

  useEffect(() => {
    const loadFirestoreProducts = async () => {
      setProductPricingLoading(true);
      setProductPricingError(null);
      try {
        const products = await runWithServerLoading(() =>
          ProductPricingService.getActiveProducts()
        );
        setFirestoreProducts(products);
      } catch (error) {
        logger.error("Error loading Firestore product pricing:", error);
        captureException(error);
        setProductPricingError(
          error instanceof Error
            ? error.message
            : "Failed to load shop products"
        );
      } finally {
        setProductPricingLoading(false);
      }
    };

    loadFirestoreProducts();
  }, [runWithServerLoading]);

  // Initialize onboarding flow — always show welcome first, then instructions.
  // Guard with a ref so this only runs once per screen mount.
  const firstTimeCheckDone = useRef(false);
  const { showWelcomeModal, showInstructionsModal, showInfoModal } = useModal();
  useEffect(() => {
    if (firstTimeCheckDone.current) return;
    firstTimeCheckDone.current = true;

    const runOnboardingFlow = async () => {
      try {
        const isGuestUser =
          playerData?.email?.endsWith("@guest.qwordly.com") === true ||
          playerData?.username === "Guest";

        if (isGuestUser) {
          showInfoModal({
            title: "Guest Mode Notice",
            message:
              "Your progress could be lost in guest mode, and some features like the leaderboard are unavailable.",
            onConfirm: () => {
              safeDelay(MODAL_CLOSE_DELAY_MS).then(() => {
                showInstructionsModal();
              });
            },
          });
          return;
        }

        showWelcomeModal({
          onDismiss: () => {
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
    playerData,
    showWelcomeModal,
    showInstructionsModal,
    showInfoModal,
  ]);

  // Load settings — batch all keys in a single AsyncStorage call
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [[, soundEnabled], [, hapticsEnabled], [, language]] =
          await AsyncStorage.multiGet([
            SOUND_ENABLED_STORAGE_KEY,
            HAPTICS_ENABLED_STORAGE_KEY,
            APP_LANGUAGE_STORAGE_KEY,
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
        if (language && isSupportedLanguage(language)) {
          setAppLanguage(language);
          setCurrentLanguage(language);
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
    AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, currentLanguage).catch(
      (error: unknown) => {
        logger.error("Error saving language setting to AsyncStorage:", error);
        captureException(error);
      }
    );
  }, [currentLanguage]);

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
      title: "Ad Not Ready",
      message: "The rewarded ad couldn't be shown at this time. Please try again shortly.",
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
      modal.showInfoModal({ title: "Error", message: "Could not spend coins. Please try again." });
    }
  }, [modal, continueGame, runWithServerLoading, isGuestMode, playerData, updatePlayerDataLocally]);

  // Handle game over states
  useEffect(() => {
    if (gameOver && lastGuessResult && !gameOverHandledRef.current) {
      gameOverHandledRef.current = true;
      const result = lastGuessResult;

      if (result.outcome === "win") {
        const unlockedAchievementNames = (result.newlyUnlockedAchievementIds ?? [])
          .map(
            (achievementId) =>
              ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievementId)?.name
          )
          .filter((name): name is string => typeof name === "string");

    
        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
          if (unlockedAchievementNames.length > 0) {
            ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);
          }
        }

        if (unlockedAchievementNames.length > 0) {
          modal.showAchievementUnlockFanfareModal({
            achievementNames: unlockedAchievementNames,
          });
        }

        // Use the new modal system - much cleaner!
        modal.showVictoryModal({
          attempts: guesses.length,
          coinsEarned: result.coinsEarned || 0,
          unlockedAchievementNames,
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
              await runWithServerLoading(() => onNextLevel());
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
          onCoinContinue: result.canOfferCoinContinue ? handleCoinContinue : undefined,
          coinContinueCost: CONTINUE_COST_COINS,
          canWatchAd: isRewardedAdReady,
          canUseCoin: canAffordCoinContinue,
          onNext: () => {
            modal.closeModalByType("loss");
            resetGame();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after attempt limit:", error);
              captureException(error);
            });
          },
          onHome: () => {
            modal.closeModalByType("loss");
            resetGame();
            hintRevealedIndicesRef.current = [];
          },
        });
      } else if (result.outcome === "loss") {
      
        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
        }

        // Show loss modal
        modal.showLossModal({
          correctAnswer: result.correctAnswer || "",
          onNext: () => {
            modal.closeModalByType("loss");
            resetGame();
            runWithServerLoading(() => onNextLevel()).catch((error) => {
              logger.error("Error loading next level after loss:", error);
              captureException(error);
            });
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

  // Game actions
  const handleSubmit = useCallback(async () => {
    const isGuessComplete =
      currentGuess.length === answerLength &&
      currentGuess.every((letter) => typeof letter === "string" && letter.length > 0);

    if (isGuessComplete) {
      try {
        const result = (await runWithServerLoading(() =>
          processGuess(currentGuess)
        )) as GuessResult;
        setLastGuessResult(result);
      } catch (error) {
        logger.error("Error processing guess in GameScreen:", error);
        captureException(error);
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
    guesses,
    modal,
    modalActions,
    setLastGuessResult,
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

      setActiveSlotIndex((prev) => Math.min(Math.max(0, answerLength - 1), prev + 1));
    },
    [activeSlotIndex, answerLength, setCurrentGuess]
  );

  const handleBackspace = useCallback(() => {
    if (answerLength <= 0) return;

    const targetIndex = Math.min(
      Math.max(0, activeSlotIndex - 1),
      Math.max(0, answerLength - 1)
    );

    setCurrentGuess((prev: string[]) => {
      if (prev.length === 0) {
        return prev;
      }

      const next = [...prev];
      next[targetIndex] = "";
      while (next.length > 0 && !next[next.length - 1]) {
        next.pop();
      }
      return next;
    });

    setActiveSlotIndex((prev) => Math.max(0, prev - 1));
  }, [activeSlotIndex, answerLength, setCurrentGuess]);

  const handleSelectCurrentGuessSlot = useCallback(
    (slotIndex: number) => {
      if (answerLength <= 0) return;
      if (slotIndex < 0 || slotIndex >= answerLength) return;
      setActiveSlotIndex(slotIndex);
    },
    [answerLength]
  );

  const handleChangeGameModePress = useCallback(() => {
    modal.showGameModeModal({
      currentLevel: (playerData?.progress?.classicIndex ?? 0) + 1,
      onSelectMode: (mode) => {
        logger.debug(`Selected game mode: ${mode}`);
        // Handle mode selection here
        if (mode === "classic") {
          // Navigate to classic mode
          resetGame();
          // Use the setGameMode function from AuthContext
          if (playerData) {
            setGameMode("classic");
            // Fetch the riddle for classic mode
            runWithServerLoading(() =>
              fetchCurrentRiddle(playerData, "classic")
            ).catch((error) => {
              logger.error("Error fetching classic riddle:", error);
              captureException(error);
            });
          }
        } else if (mode === "daily") {
          // Navigate to daily challenge
          resetGame();
          // Use the setGameMode function from AuthContext
          if (playerData) {
            setGameMode("daily");
            // Fetch the riddle for daily challenge
            runWithServerLoading(() =>
              fetchCurrentRiddle(playerData, "daily")
            ).catch((error) => {
              logger.error("Error fetching daily riddle:", error);
              captureException(error);
            });
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
    runWithServerLoading,
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
        : SKIP_COST_CLASSIC;

    modal.showSkipModal({
      userCoins,
      skipCost,
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
    currentLanguage,
    toggleSoundEnabled,
    toggleHapticsEnabled,
    handleChangeLanguage,
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
          const coinsPurchased = IapService.getCoinsForProduct(productId) ?? 0;
          modal.closeModalByType("coinShop");
          modal.showCoinPurchaseFanfareModal({
            coinsPurchased,
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

  const handleCoinsPress = useCallback(() => {
    logger.debug("Opening coin shop modal with:", {
      products: iapProducts.length,
      loading: iapLoading,
      error: iapError,
      hasCallback: typeof handlePurchaseProduct === "function",
    });

    modal.showCoinShop({
      products: iapProducts,
      firestoreProducts,
      currentCoins: userCoins,
      loading: iapLoading || productPricingLoading,
      error: iapError || productPricingError,
      onPurchaseProduct: handlePurchaseProduct,
      onWatchVideo: handleWatchAdForCoins,
      onPayAndPlay: handlePayAndPlay,
    });
  }, [
    modal,
    iapProducts,
    firestoreProducts,
    userCoins,
    iapLoading,
    productPricingLoading,
    iapError,
    productPricingError,
    handlePurchaseProduct,
    handleWatchAdForCoins,
    handlePayAndPlay,
  ]);

  const handleDebugCompleteRiddle = useCallback(() => {
    if (gameOver) return;

    const solvedGuess = answer.toUpperCase().split("");
    setCurrentGuess(solvedGuess);
    setActiveSlotIndex(Math.max(0, answerLength - 1));
  }, [
    gameOver,
    answer,
    answerLength,
    setCurrentGuess,
  ]);

  const isSubmitDisabled = useMemo(
    () =>
      currentGuess.length !== answerLength ||
      currentGuess.some((letter) => typeof letter !== "string" || letter.length === 0),
    [currentGuess, answerLength]
  );
  const headerModeLabel = gameMode === "daily" ? "Daily Challenge" : "Classic";

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
            onChangeGameModePress={handleChangeGameModePress}
          />
        </KeyboardAvoidingView>

        {/* The new modal system - no more massive props list! */}
        <PulsingSpinner
          visible={isLoading}
          size={LOADING_SPINNER_SIZE}
          opacity={LOADING_SPINNER_OPACITY}
        />

        <ModalProvider />

        <Controls
          onNextPress={handleOverlayNext}
          isWin={gameOver && lastGuessResult?.outcome === "win"}
        />

        {/* Development Modal Debug Panel - Only visible in development builds */}
        {__DEV__ && <ModalTogglePanel onCompleteRiddle={handleDebugCompleteRiddle} />}
      </SafeAreaView>
    </View>
  );
};

const GameScreen = React.memo(GameScreenInner);
export default GameScreen;

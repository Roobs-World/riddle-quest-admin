import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/game/Header";
import Controls from "../../components/game/Controls";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import GameAnimations from "../../components/game/GameAnimations";
import GameOverlays from "../../components/game/GameOverlays";
import GameBoard from "../../components/game/GameBoard";
import { SoundManager } from "../../services/SoundManager";
import useGameLogic from "../../hooks/useGameLogic";
import { checkAnyOverlayVisible } from "../../utils/overlayUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import functions from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { GameMode } from "../../contexts/AuthContext";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import useRewardedAds from "../../hooks/useRewardedAds";
import { useInterstitialAds } from "../../hooks/useInterstitialAds";
import {
  GetHintInputSchema,
  GetHintOutputSchema,
} from "../../validation/cloudFunctionsSchemas";
import { useTileCapture } from "../../hooks/useTileCapture";
import { useAuth } from "../../contexts/AuthContext";
import { AppStrings } from "../../constants/AppStrings";
import { isTablet } from "../../utils/responsive";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import OutOfAttemptsModal from "../modals/game/OutOfAttemptsModal";
import SolarSystemBackground from "../../components/background/StarryBackground";
import { styles } from "../../styles";

interface GuessResult {
  outcome: "win" | "loss" | "continue" | "attemptLimitReached";
  feedback?: ("green" | "yellow" | "red")[];
  correctAnswer?: string;
  coinsEarned?: number;
  canOfferRewardedAd?: boolean;
  canOfferCoinContinue?: boolean;
  attemptsRemaining?: number;
}

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";
const CONTINUE_COST = 50; // Cost in coins to continue after 3 attempts

// Configuration for haptic feedback (optional)
const hapticOptions = {
  enableVibrateFallback: true, // Use vibration on Android if haptics are not supported
  ignoreAndroidSystemSettings: false,
};

interface GameScreenProps {
  riddleId: string;
  riddleText: string;
  answerLength: number;
  userCoins: number;
  hintCost: number;
  onGameWin: (attempts: number, coinsEarned: number) => void;
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
}

// Separate state interfaces for better organization
interface UIState {
  isInstructionsVisible: boolean;
  isWelcomeOverlayVisible: boolean;
  isHintOverlayVisible: boolean;
  isProfileOverlayVisible: boolean;
  isSettingsOverlayVisible: boolean;
  isFullProfileDetailsOverlayVisible: boolean;
  isCoinShopModalVisible: boolean;
  isWatchAdModalVisible: boolean;
  isOutOfAttemptsModalVisible: boolean;
  isLoading: boolean;
}

interface AnimationState {
  shakeKey: number;
  startShatterAnimation: boolean;
  startTileShatterAnimation: boolean;
}

interface GameResultState {
  lastGuessResult: GuessResult | null;
}

// Type guards for error handling
const isFirebaseError = (
  error: unknown
): error is { code: string; message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  );
};

const isZodError = (error: unknown): error is { issues: unknown[] } => {
  return (
    error !== null &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
};

const GameScreen: React.FC<GameScreenProps> = ({
  riddleId,
  riddleText,
  answerLength,
  userCoins,
  hintCost,
  onGameWin,
  onGameLoss,
  onHintUsed,
  onNextLevel,
  gameMode,
}) => {
  const { playerData, logout } = useAuth();
  const { setTileRef, captureTiles } = useTileCapture();

  // Split state into focused pieces to reduce re-renders
  const [uiState, setUIState] = useState<UIState>({
    isInstructionsVisible: false,
    isWelcomeOverlayVisible: false,
    isHintOverlayVisible: false,
    isProfileOverlayVisible: false,
    isSettingsOverlayVisible: false,
    isFullProfileDetailsOverlayVisible: false,
    isCoinShopModalVisible: false,
    isWatchAdModalVisible: false,
    isOutOfAttemptsModalVisible: false,
    isLoading: false,
  });

  const [animationState, setAnimationState] = useState<AnimationState>({
    shakeKey: 0,
    startShatterAnimation: false,
    startTileShatterAnimation: false,
  });

  const [gameResultState, setGameResultState] = useState<GameResultState>({
    lastGuessResult: null,
  });

  const [tilesData, setTilesData] = useState<
    Array<{
      letter: string | null;
      backgroundColor: string;
      borderColor: string;
      textColor: string;
      x: number;
      y: number;
    }>
  >([]);

  // Animation value for shaking the GuessGrid
  const shakeAnimation = useSharedValue(0);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);

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
    gameMode:
      gameMode === "daily"
        ? "challenge"
        : (gameMode as "challenge" | "classic"),
  });

  // Memoize expensive computations
  const isWin = useMemo(
    () => gameOver && gameResultState.lastGuessResult?.outcome === "win",
    [gameOver, gameResultState.lastGuessResult?.outcome]
  );

  const isAnyOverlayVisible = useMemo(
    () =>
      checkAnyOverlayVisible(
        uiState.isInstructionsVisible,
        uiState.isFullProfileDetailsOverlayVisible,
        uiState.isCoinShopModalVisible,
        uiState.isWatchAdModalVisible,
        uiState.isWelcomeOverlayVisible,
        uiState.isOutOfAttemptsModalVisible
      ),
    [
      uiState.isInstructionsVisible,
      uiState.isFullProfileDetailsOverlayVisible,
      uiState.isCoinShopModalVisible,
      uiState.isWatchAdModalVisible,
      uiState.isWelcomeOverlayVisible,
      uiState.isOutOfAttemptsModalVisible,
    ]
  );

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  const { loadInterstitialAd, showInterstitialAd } = useInterstitialAds();

  // Memoize the animated style to prevent recreation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  }, []);

  // First-time user setup effect - optimized with minimal dependencies
  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome");
        if (hasSeenWelcome === null) {
          setUIState((prev) => ({
            ...prev,
            isWelcomeOverlayVisible: true,
          }));
          await AsyncStorage.setItem("hasSeenWelcome", "true");
        } else {
          const hasSeenInstructions = await AsyncStorage.getItem(
            "hasSeenInstructions"
          );
          if (hasSeenInstructions === null) {
            setUIState((prev) => ({
              ...prev,
              isInstructionsVisible: true,
            }));
            await AsyncStorage.setItem("hasSeenInstructions", "true");
          }
        }
      } catch (error) {
        console.error("Error checking AsyncStorage:", error);
      }
    };

    checkIfFirstTimeUser();
  }, []);

  // Settings loading effect - optimized
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [soundEnabled, hapticsEnabled] = await Promise.all([
          AsyncStorage.getItem(SOUND_ENABLED_STORAGE_KEY),
          AsyncStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY),
        ]);

        if (soundEnabled !== null) {
          setIsSoundEnabled(JSON.parse(soundEnabled));
        }
        if (hapticsEnabled !== null) {
          setIsHapticsEnabled(JSON.parse(hapticsEnabled));
        }
      } catch (error) {
        console.error("Error loading settings from AsyncStorage:", error);
      }
    };

    loadSettings();
  }, []);

  // Settings persistence effects - memoized callbacks
  const persistSoundSetting = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(
        SOUND_ENABLED_STORAGE_KEY,
        JSON.stringify(enabled)
      );
    } catch (error) {
      console.error("Error saving sound setting to AsyncStorage:", error);
    }
  }, []);

  const persistHapticsSetting = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(
        HAPTICS_ENABLED_STORAGE_KEY,
        JSON.stringify(enabled)
      );
    } catch (error) {
      console.error("Error saving haptics setting to AsyncStorage:", error);
    }
  }, []);

  useEffect(() => {
    persistSoundSetting(isSoundEnabled);
  }, [isSoundEnabled, persistSoundSetting]);

  useEffect(() => {
    persistHapticsSetting(isHapticsEnabled);
  }, [isHapticsEnabled, persistHapticsSetting]);

  // Background music effect - optimized with dependency array
  useEffect(() => {
    if (isSoundEnabled) {
      // Add a small delay to ensure SoundManager has time to initialize
      const timer = setTimeout(() => {
        SoundManager.playBackgroundMusic();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      // Pause background music if sound is disabled
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  // Game over effect - optimized with proper dependency array
  useEffect(() => {
    if (gameOver && gameResultState.lastGuessResult) {
      const result = gameResultState.lastGuessResult;

      if (result.outcome === "win") {
        // Capture tiles for shattering animation
        const captureAndShatter = async () => {
          try {
            const tiles = await captureTiles(guesses, answerLength);
            setTilesData(tiles);
            setAnimationState((prev) => ({
              ...prev,
              startTileShatterAnimation: true,
            }));

            // Delay text shattering to let tile animation start
            setTimeout(() => {
              setAnimationState((prev) => ({
                ...prev,
                startShatterAnimation: true,
              }));
            }, 300);
          } catch (error) {
            console.warn("Failed to capture tiles for shattering:", error);
          }
        };

        captureAndShatter();

        // Fade out background music before playing success sound for dramatic effect
        SoundManager.fadeOutBackgroundMusic({
          duration: 500,
          curve: "exponential",
        });

        setTimeout(() => {
          SoundManager.playSuccess();
          // Fade background music back in after success sound
          setTimeout(() => {
            SoundManager.fadeInBackgroundMusic({
              duration: 1000,
              curve: "linear",
            });
          }, 1000);
        }, 500);

        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
        }
        onGameWin(guesses.length, result.coinsEarned || 0);
      } else if (result.outcome === "attemptLimitReached") {
        // User has reached 3 attempts, offer continue options
        setUIState((prev) => ({
          ...prev,
          isOutOfAttemptsModalVisible: true,
        }));
      } else if (result.outcome === "loss") {
        // Final loss after using continue option
        if (result.canOfferRewardedAd) {
          setUIState((prev) => ({
            ...prev,
            isWatchAdModalVisible: true,
          }));
        } else {
          // Use slow fade-in for negative sound on final loss
          SoundManager.playNegativeWithFadeIn({
            duration: 2000,
            curve: "exponential",
          });

          if (isHapticsEnabled) {
            ReactNativeHapticFeedback.trigger(
              "notificationError",
              hapticOptions
            );
          }
          if (result.correctAnswer) {
            onGameLoss(result.correctAnswer);
          }
        }
      }
    }
  }, [
    gameOver,
    gameResultState.lastGuessResult,
    captureTiles,
    guesses,
    answerLength,
    isHapticsEnabled,
    onGameWin,
    onGameLoss,
  ]);

  // Memoized event handlers
  const handleKeyPress = useCallback(
    async (key: string) => {
      if (
        gameOver ||
        isAnyOverlayVisible ||
        uiState.isLoading ||
        (currentGuess.length >= answerLength &&
          key !== "ENTER" &&
          key !== "BACKSPACE")
      )
        return;

      if (key === "ENTER") {
        if (currentGuess.length === answerLength) {
          // Show loading spinner while processing guess
          setUIState((prev) => ({
            ...prev,
            isLoading: true,
          }));

          try {
            const result = (await processGuess(currentGuess)) as GuessResult;
            setGameResultState({
              lastGuessResult: result,
            });
            setUIState((prev) => ({
              ...prev,
              isLoading: false,
            }));
          } catch (error) {
            console.error("Error processing guess in GameScreen:", error);
            setUIState((prev) => ({
              ...prev,
              isLoading: false,
            }));
            Alert.alert(
              AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
              AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE
            );
          }
        } else {
          setAnimationState((prev) => ({
            ...prev,
            shakeKey: prev.shakeKey + 1,
          }));
          if (isHapticsEnabled) {
            ReactNativeHapticFeedback.trigger(
              "notificationWarning",
              hapticOptions
            );
          }
        }
      } else if (key === "BACKSPACE") {
        setCurrentGuess((prev: string[]) => prev.slice(0, -1));
      } else if (currentGuess.length < answerLength) {
        setCurrentGuess((prev: string[]) => [...prev, key]);
      }
    },
    [
      gameOver,
      isAnyOverlayVisible,
      uiState.isLoading,
      currentGuess.length,
      answerLength,
      processGuess,
      setCurrentGuess,
      isHapticsEnabled,
    ]
  );

  const handleHintPress = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isHintOverlayVisible: true,
    }));
  }, []);

  const handleHintClose = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isHintOverlayVisible: false,
    }));
  }, []);

  const handleOverlayNext = useCallback(() => {
    console.log("VictoryLossOverlay Next Level button pressed");
    resetGame();
    onNextLevel();
  }, [resetGame, onNextLevel]);

  const handleProfileClose = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isProfileOverlayVisible: false,
    }));
    // Fade in background music when closing profile overlay
    SoundManager.fadeInBackgroundMusic({ duration: 600, curve: "linear" });
  }, []);

  const handleSettingsPress = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isSettingsOverlayVisible: true,
    }));
    // Fade out background music when opening settings overlay
    SoundManager.fadeOutBackgroundMusic({
      duration: 400,
      curve: "exponential",
    });
  }, []);

  const handleSettingsClose = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isSettingsOverlayVisible: false,
    }));
    // Fade in background music when closing settings overlay
    SoundManager.fadeInBackgroundMusic({ duration: 600, curve: "linear" });
  }, []);

  const handleProfilePress = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isProfileOverlayVisible: true,
    }));
    // Fade out background music when opening profile overlay
    SoundManager.fadeOutBackgroundMusic({
      duration: 400,
      curve: "exponential",
    });
  }, []);

  const handleCloseHomeOverlay = useCallback(() => {
    console.log("VictoryLossOverlay Home button pressed");
    resetGame();
  }, [resetGame]);

  const handleClosePlayOverlay = useCallback(() => {
    console.log("VictoryLossOverlay Play button pressed");
    resetGame();
  }, [resetGame]);

  const handleCloseInstructions = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isInstructionsVisible: false,
    }));
  }, []);

  const handleWelcomeClose = useCallback(async () => {
    setUIState((prev) => ({
      ...prev,
      isWelcomeOverlayVisible: false,
    }));

    // After closing welcome, check if we should show instructions
    try {
      const hasSeenInstructions = await AsyncStorage.getItem(
        "hasSeenInstructions"
      );
      if (hasSeenInstructions === null) {
        setUIState((prev) => ({
          ...prev,
          isInstructionsVisible: true,
        }));
        await AsyncStorage.setItem("hasSeenInstructions", "true");
      }
    } catch (error) {
      console.error("Error checking instructions AsyncStorage:", error);
    }
  }, []);

  const handleShowFullProfileDetails = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isFullProfileDetailsOverlayVisible: true,
    }));
  }, []);

  const handleCloseFullProfileDetailsOverlay = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isFullProfileDetailsOverlayVisible: false,
    }));
  }, []);

  const handleCloseCoinShopModal = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isCoinShopModalVisible: false,
    }));
  }, []);

  const handlePurchaseProduct = useCallback(
    async (productId: string) => {
      // Implementation for purchase logic would go here
      console.log(`Purchasing product: ${productId}`);
      handleCloseCoinShopModal();
    },
    [handleCloseCoinShopModal]
  );

  const toggleSoundEnabled = useCallback((isEnabled: boolean) => {
    setIsSoundEnabled(isEnabled);
    if (isEnabled) {
      SoundManager.playBackgroundMusic();
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, []);

  const toggleHapticsEnabled = useCallback((isEnabled: boolean) => {
    setIsHapticsEnabled(isEnabled);
  }, []);

  const handleShowHint = useCallback(async () => {
    if (!playerData?.userId) return;
    if (userCoins < hintCost) {
      Alert.alert(
        AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_TITLE,
        AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_MESSAGE
      );
      return;
    }
    console.log("Showing hint for riddle:", riddleId);
    resetGame();

    const hintRequestData = {
      currentAttempt: currentGuess,
      riddleId: riddleId,
    };

    try {
      GetHintInputSchema.parse(hintRequestData);

      const getHintCallable = functions(getApp()).httpsCallable("getHint");
      const result = await getHintCallable(hintRequestData);

      const hintData = GetHintOutputSchema.parse(result.data);

      if (hintData) {
        Alert.alert(
          "Hint",
          `The letter '${hintData.revealedLetter}' is at position ${
            hintData.index + 1
          }.`
        );
        onHintUsed(hintData.coinsCost);
      } else {
        Alert.alert(
          "Hint Not Available",
          "No more hints can be revealed for this riddle."
        );
      }
    } catch (error: unknown) {
      console.error("Error getting hint:", error);
      let errorMessage = "An error occurred while getting a hint.";
      if (isFirebaseError(error)) {
        errorMessage = error.message;
      } else if (isZodError(error)) {
        errorMessage = "Received invalid data from server after getting hint.";
        console.error("Zod validation error for getHint output:", error.issues);
      }
      Alert.alert("Error", errorMessage);
    }
  }, [
    playerData?.userId,
    userCoins,
    hintCost,
    riddleId,
    resetGame,
    currentGuess,
    onHintUsed,
  ]);

  const handleWatchAdAccepted = useCallback(async () => {
    setUIState((prev) => ({
      ...prev,
      isWatchAdModalVisible: false,
    }));
    try {
      await loadRewardedAd();
      if (isRewardedAdReady) {
        await showRewardedAd();
        console.log("Rewarded ad shown (or attempt to show finished).");
      } else {
        console.warn("Rewarded ad was not ready to be shown.");
        Alert.alert(
          "Ad Not Ready",
          "The rewarded ad couldn't be loaded at this time. Please try again later."
        );
      }
    } catch (adError: unknown) {
      console.error("Error showing rewarded ad:", adError);
      Alert.alert(
        "Ad Error",
        "An error occurred while trying to show the rewarded ad."
      );
    }
    // Use slow fade-in for negative sound on ad error
    SoundManager.playNegativeWithFadeIn({
      duration: 1500, // 1.5 seconds for error scenarios
      curve: "exponential",
    });
    if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    }
    setUIState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));
  }, [loadRewardedAd, isRewardedAdReady, showRewardedAd, isHapticsEnabled]);

  const handleWatchAdDeclined = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isWatchAdModalVisible: false,
    }));
    // Use slow fade-in for negative sound on ad error
    SoundManager.playNegativeWithFadeIn({
      duration: 1500, // 1.5 seconds for error scenarios
      curve: "exponential",
    });
    if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    }
    setUIState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));
  }, [isHapticsEnabled]);

  // Handler for when user chooses to watch interstitial ad to continue
  const handleWatchAdToContinue = useCallback(async () => {
    setUIState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));

    try {
      await loadInterstitialAd();
      showInterstitialAd();

      // Continue the game after ad (assuming ad was shown successfully)
      continueGame();
      console.log("User continued game after watching interstitial ad");
    } catch (error) {
      console.error("Error showing interstitial ad:", error);
      Alert.alert(
        "Ad Error",
        "An error occurred while trying to show the ad. You can try spending coins instead."
      );
      // Reopen the attempts modal since ad failed
      setUIState((prev) => ({
        ...prev,
        isOutOfAttemptsModalVisible: true,
      }));
    }
  }, [loadInterstitialAd, showInterstitialAd, continueGame]);

  // Handler for when user chooses to spend coins to continue
  const handleSpendCoinsToContinue = useCallback(async () => {
    if (userCoins < CONTINUE_COST) {
      Alert.alert(
        "Not Enough Coins",
        `You need ${CONTINUE_COST} coins to continue. You have ${userCoins} coins.`
      );
      return;
    }

    setUIState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));

    try {
      // Call backend to spend coins
      const spendCoinsCallable = functions(getApp()).httpsCallable(
        "spendCoins"
      );
      await spendCoinsCallable({
        amount: CONTINUE_COST,
        reason: "continue_attempts",
      });

      // Continue the game
      continueGame();
      console.log(`User spent ${CONTINUE_COST} coins to continue game`);
    } catch (error) {
      console.error("Error spending coins:", error);
      Alert.alert("Error", "Failed to spend coins. Please try again.");
      // Reopen the attempts modal since coin spending failed
      setUIState((prev) => ({
        ...prev,
        isOutOfAttemptsModalVisible: true,
      }));
    }
  }, [userCoins, continueGame]);

  // Handler for when user chooses to give up
  const handleGiveUpAttempts = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));

    // Play negative sound for giving up
    SoundManager.playNegativeWithFadeIn({
      duration: 1500,
      curve: "exponential",
    });

    if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    }

    if (gameResultState.lastGuessResult?.correctAnswer) {
      onGameLoss(gameResultState.lastGuessResult.correctAnswer);
    }
  }, [
    isHapticsEnabled,
    gameResultState.lastGuessResult?.correctAnswer,
    onGameLoss,
  ]);

  // Handler for opening coin shop when coins are pressed
  const handleCoinsPress = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isCoinShopModalVisible: true,
    }));
  }, []);

  const handlePressLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handlePressHelp = useCallback(() => {
    setUIState((prev) => ({
      ...prev,
      isInstructionsVisible: true,
    }));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream-light">
      <SolarSystemBackground />
      <KeyboardAvoidingView
        style={[
          styles.gameContainer,
          isAnyOverlayVisible && styles.overlayVisible,
          isTablet && styles.gameContainerTablet,
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Header
          userCoins={userCoins}
          onHintPress={handleHintPress}
          onCoinsPress={handleCoinsPress}
        />

        <GameAnimations
          isWin={isWin}
          tilesData={tilesData}
          startShatterAnimation={animationState.startShatterAnimation}
          startTileShatterAnimation={animationState.startTileShatterAnimation}
        />

        <GameBoard
          riddleText={riddleText}
          guesses={guesses}
          currentGuess={currentGuess}
          answerLength={answerLength}
          shakeKey={animationState.shakeKey}
          setTileRef={setTileRef}
          animatedStyle={animatedStyle}
          onKeyPress={handleKeyPress}
          isAnyOverlayVisible={isAnyOverlayVisible}
        />

        <BottomNavigationBar
          onProfilePress={handleProfilePress}
          onSettingsPress={handleSettingsPress}
          onSubmitPress={() => handleKeyPress("ENTER")}
          currentGuess={currentGuess}
          answerLength={answerLength}
          gameOver={gameOver}
        />
      </KeyboardAvoidingView>

      <GameOverlays
        // Hint Overlay
        isHintOverlayVisible={uiState.isHintOverlayVisible}
        onHintClose={handleHintClose}
        onShowHint={handleShowHint}
        hintCost={hintCost}
        userCoins={userCoins}
        // Profile Overlay
        isProfileOverlayVisible={uiState.isProfileOverlayVisible}
        onProfileClose={handleProfileClose}
        playerData={playerData}
        onFullProfilePress={handleShowFullProfileDetails}
        // Settings Overlay
        isSettingsOverlayVisible={uiState.isSettingsOverlayVisible}
        onSettingsClose={handleSettingsClose}
        isSoundEnabled={isSoundEnabled}
        isHapticsEnabled={isHapticsEnabled}
        onToggleSound={toggleSoundEnabled}
        onToggleHaptics={toggleHapticsEnabled}
        onPressLogout={handlePressLogout}
        onPressHelp={handlePressHelp}
        // Instructions Overlay
        isInstructionsVisible={uiState.isInstructionsVisible}
        onCloseInstructions={handleCloseInstructions}
        // Welcome Overlay
        isWelcomeOverlayVisible={uiState.isWelcomeOverlayVisible}
        onWelcomeClose={handleWelcomeClose}
        // Full Profile Details Overlay
        isFullProfileDetailsOverlayVisible={
          uiState.isFullProfileDetailsOverlayVisible
        }
        onCloseFullProfileDetailsOverlay={handleCloseFullProfileDetailsOverlay}
        // Coin Shop Modal
        isCoinShopModalVisible={uiState.isCoinShopModalVisible}
        onCloseCoinShopModal={handleCloseCoinShopModal}
        onPurchaseProduct={handlePurchaseProduct}
        // Watch Ad Modal
        isWatchAdModalVisible={uiState.isWatchAdModalVisible}
        onWatchAdAccepted={handleWatchAdAccepted}
        onWatchAdDeclined={handleWatchAdDeclined}
        // Home/Play Overlays
        onCloseHomeOverlay={handleCloseHomeOverlay}
        onClosePlayOverlay={handleClosePlayOverlay}
      />

      {/* Out of Attempts Modal */}
      <OutOfAttemptsModal
        isVisible={uiState.isOutOfAttemptsModalVisible}
        userCoins={userCoins}
        continueCost={CONTINUE_COST}
        onWatchAd={handleWatchAdToContinue}
        onSpendCoins={handleSpendCoinsToContinue}
        onClose={handleGiveUpAttempts}
      />

      <Controls
        onNextPress={handleOverlayNext}
        isWin={gameOver && gameResultState.lastGuessResult?.outcome === "win"}
      />

      <PulsingSpinner visible={uiState.isLoading} size={120} opacity={0.7} />
    </SafeAreaView>
  );
};

export default GameScreen;

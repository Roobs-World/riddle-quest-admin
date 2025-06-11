import React, { useState, useEffect } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/game/Header";
import Controls from "../../components/game/Controls";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
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

import { useAuth } from "../../contexts/AuthContext";
import { AppStrings } from "../../constants/AppStrings";
import { isTablet } from "../../utils/responsive";
import { safeDelay } from "../../utils/timing";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import OutOfAttemptsModal from "../../components/modals/game/OutOfAttemptsModal";
import { styles } from "../../styles";
import StarryBackground from "../../components/background/StarryBackground";

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

interface GameScreenState {
  isInstructionsVisible: boolean;
  shakeKey: number;
  isFullProfileDetailsOverlayVisible: boolean;
  isCoinShopModalVisible: boolean;
  isWatchAdModalVisible: boolean;
  isOutOfAttemptsModalVisible: boolean;
  lastGuessResult: GuessResult | null;
  startShatterAnimation: boolean;
  isHintOverlayVisible: boolean;
  isProfileOverlayVisible: boolean;
  isSettingsOverlayVisible: boolean;
  isCreditsOverlayVisible: boolean;
  isWelcomeOverlayVisible: boolean;
  isLoading: boolean;
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

  const [overlayState, setOverlayState] = useState<GameScreenState>({
    isInstructionsVisible: false,
    shakeKey: 0,
    isFullProfileDetailsOverlayVisible: false,
    isCoinShopModalVisible: false,
    isWatchAdModalVisible: false,
    isOutOfAttemptsModalVisible: false,
    lastGuessResult: null,
    startShatterAnimation: false,
    isHintOverlayVisible: false,
    isProfileOverlayVisible: false,
    isSettingsOverlayVisible: false,
    isCreditsOverlayVisible: false,
    isWelcomeOverlayVisible: false,
    isLoading: false,
  });

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

  const isAnyOverlayVisible = checkAnyOverlayVisible(
    overlayState.isInstructionsVisible,
    overlayState.isFullProfileDetailsOverlayVisible,
    overlayState.isCoinShopModalVisible,
    overlayState.isWatchAdModalVisible,
    overlayState.isWelcomeOverlayVisible,
    overlayState.isOutOfAttemptsModalVisible,
    overlayState.isCreditsOverlayVisible
  );

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  const { loadInterstitialAd, showInterstitialAd } = useInterstitialAds();

  // Constants for continue system
  const CONTINUE_COST = 50; // Cost in coins to continue after 3 attempts

  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome");
        if (hasSeenWelcome === null) {
          setOverlayState((prev) => ({
            ...prev,
            isWelcomeOverlayVisible: true,
          }));
          await AsyncStorage.setItem("hasSeenWelcome", "true");
        } else {
          const hasSeenInstructions = await AsyncStorage.getItem(
            "hasSeenInstructions"
          );
          if (hasSeenInstructions === null) {
            setOverlayState((prev) => ({
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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const soundEnabled = await AsyncStorage.getItem(
          SOUND_ENABLED_STORAGE_KEY
        );
        if (soundEnabled !== null) {
          setIsSoundEnabled(JSON.parse(soundEnabled));
        }

        const hapticsEnabled = await AsyncStorage.getItem(
          HAPTICS_ENABLED_STORAGE_KEY
        );
        if (hapticsEnabled !== null) {
          setIsHapticsEnabled(JSON.parse(hapticsEnabled));
        }
      } catch (error) {
        console.error("Error loading settings from AsyncStorage:", error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(isSoundEnabled)
    ).catch((error: unknown) =>
      console.error("Error saving sound setting to AsyncStorage:", error)
    );
  }, [isSoundEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HAPTICS_ENABLED_STORAGE_KEY,
      JSON.stringify(isHapticsEnabled)
    ).catch((error: unknown) =>
      console.error("Error saving haptics setting to AsyncStorage:", error)
    );
  }, [isHapticsEnabled]);

  // Start background music automatically if sound is enabled
  useEffect(() => {
    if (isSoundEnabled) {
      // Add a small delay to ensure SoundManager has time to initialize
      let cleanup: (() => void) | undefined;

      safeDelay(500).then(() => {
        SoundManager.playBackgroundMusic();
      });

      return cleanup;
    } else {
      // Pause background music if sound is disabled
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    if (gameOver && overlayState.lastGuessResult) {
      const result = overlayState.lastGuessResult;

      if (result.outcome === "win") {
        // Start text shattering animation
        setOverlayState((prev) => ({
          ...prev,
          startShatterAnimation: true,
        }));

        // Fade out background music before playing success sound for dramatic effect
        SoundManager.fadeOutBackgroundMusic({
          duration: 500,
          curve: "exponential",
        });

        safeDelay(500).then(() => {
          SoundManager.playSuccess();
          // Fade background music back in after success sound
          safeDelay(1000).then(() => {
            SoundManager.fadeInBackgroundMusic({
              duration: 1000,
              curve: "linear",
            });
          });
        });

        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
        }
        setOverlayState((prev) => ({
          ...prev,
          lastGuessResult: result,
          startShatterAnimation: true,
        }));
        onGameWin(guesses.length, result.coinsEarned || 0);
      } else if (result.outcome === "attemptLimitReached") {
        // User has reached 3 attempts, offer continue options
        // Ensure music stays in neutral mode when showing modal
        setOverlayState((prev) => ({
          ...prev,
          isOutOfAttemptsModalVisible: true,
        }));
      } else if (result.outcome === "loss") {
        // Final loss after using continue option
        if (result.canOfferRewardedAd) {
          setOverlayState((prev) => ({
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
          setOverlayState((prev) => ({
            ...prev,
            lastGuessResult: result,
          }));
          if (result.correctAnswer) {
            onGameLoss(result.correctAnswer);
          }
        }
      } else if (result.outcome === "continue") {
        // Wrong guess but game continues - no audio feedback to keep music neutral
        // Just update the UI state (guesses are already updated by useGameLogic)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, overlayState.lastGuessResult]);

  const handleKeyPress = async (key: string) => {
    if (
      gameOver ||
      isAnyOverlayVisible ||
      overlayState.isLoading ||
      (currentGuess.length >= answerLength &&
        key !== "ENTER" &&
        key !== "BACKSPACE")
    )
      return;

    if (key === "ENTER") {
      if (currentGuess.length === answerLength) {
        // Show loading spinner while processing guess
        setOverlayState((prev) => ({
          ...prev,
          isLoading: true,
        }));

        try {
          const result = (await processGuess(currentGuess)) as GuessResult;
          setOverlayState((prev) => ({
            ...prev,
            lastGuessResult: result,
            isLoading: false,
          }));
        } catch (error) {
          console.error("Error processing guess in GameScreen:", error);
          setOverlayState((prev) => ({
            ...prev,
            isLoading: false,
          }));
          Alert.alert(
            AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
            AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE
          );
        }
      } else {
        setOverlayState((prev) => ({
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
  };

  const handleHintPress = () => {
    setOverlayState((prev) => ({
      ...prev,
      isHintOverlayVisible: true,
    }));
  };

  const handleHintClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      isHintOverlayVisible: false,
    }));
  };

  const handleOverlayNext = () => {
    console.log("VictoryLossOverlay Next Level button pressed");
    resetGame();
    onNextLevel();
  };

  const handleProfileClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      isProfileOverlayVisible: false,
    }));
  };

  const handleSettingsPress = () => {
    setOverlayState((prev) => ({
      ...prev,
      isSettingsOverlayVisible: true,
    }));
  };

  const handleSettingsClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      isSettingsOverlayVisible: false,
    }));
  };

  const handleCreditsPress = () => {
    setOverlayState((prev) => ({
      ...prev,
      isCreditsOverlayVisible: true,
    }));
  };

  const handleCreditsClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      isCreditsOverlayVisible: false,
    }));
  };

  const handleProfilePress = () => {
    setOverlayState((prev) => ({
      ...prev,
      isProfileOverlayVisible: true,
    }));
  };

  const handleCloseHomeOverlay = () => {
    console.log("VictoryLossOverlay Home button pressed");
    resetGame();
  };

  const handleClosePlayOverlay = () => {
    console.log("VictoryLossOverlay Play button pressed");
    resetGame();
  };

  const handleCloseInstructions = () => {
    setOverlayState((prev) => ({
      ...prev,
      isInstructionsVisible: false,
    }));
  };

  const handleWelcomeClose = async () => {
    setOverlayState((prev) => ({
      ...prev,
      isWelcomeOverlayVisible: false,
    }));

    // After closing welcome, check if we should show instructions
    try {
      const hasSeenInstructions = await AsyncStorage.getItem(
        "hasSeenInstructions"
      );
      if (hasSeenInstructions === null) {
        setOverlayState((prev) => ({
          ...prev,
          isInstructionsVisible: true,
        }));
        await AsyncStorage.setItem("hasSeenInstructions", "true");
      }
    } catch (error) {
      console.error("Error checking instructions AsyncStorage:", error);
    }
  };

  const handleShowFullProfileDetails = () => {
    setOverlayState((prev) => ({
      ...prev,
      isFullProfileDetailsOverlayVisible: true,
    }));
  };

  const handleCloseFullProfileDetailsOverlay = () => {
    setOverlayState((prev) => ({
      ...prev,
      isFullProfileDetailsOverlayVisible: false,
    }));
  };

  const handleCloseCoinShopModal = () => {
    setOverlayState((prev) => ({
      ...prev,
      isCoinShopModalVisible: false,
    }));
  };

  const handlePurchaseProduct = async (productId: string) => {
    // Implementation for purchase logic would go here
    console.log(`Purchasing product: ${productId}`);
    handleCloseCoinShopModal();
  };

  const toggleSoundEnabled = (isEnabled: boolean) => {
    setIsSoundEnabled(isEnabled);
    if (isEnabled) {
      SoundManager.playBackgroundMusic();
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  };

  const toggleHapticsEnabled = (isEnabled: boolean) => {
    setIsHapticsEnabled(isEnabled);
  };

  const handleShowHint = async () => {
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
  };

  const handleWatchAdAccepted = async () => {
    setOverlayState((prev) => ({
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
    setOverlayState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));
  };

  const handleWatchAdDeclined = () => {
    setOverlayState((prev) => ({
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
    setOverlayState((prev) => ({
      ...prev,
      isOutOfAttemptsModalVisible: false,
    }));
  };

  // Handler for when user chooses to watch interstitial ad to continue
  const handleWatchAdToContinue = async () => {
    setOverlayState((prev) => ({
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
      setOverlayState((prev) => ({
        ...prev,
        isOutOfAttemptsModalVisible: true,
      }));
    }
  };

  // Handler for when user chooses to spend coins to continue
  const handleSpendCoinsToContinue = async () => {
    if (userCoins < CONTINUE_COST) {
      Alert.alert(
        "Not Enough Coins",
        `You need ${CONTINUE_COST} coins to continue. You have ${userCoins} coins.`
      );
      return;
    }

    setOverlayState((prev) => ({
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
      setOverlayState((prev) => ({
        ...prev,
        isOutOfAttemptsModalVisible: true,
      }));
    }
  };

  // Handler for when user chooses to give up
  const handleGiveUpAttempts = () => {
    setOverlayState((prev) => ({
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

    if (overlayState.lastGuessResult?.correctAnswer) {
      onGameLoss(overlayState.lastGuessResult.correctAnswer);
    }
  };

  // Handler for opening coin shop when coins are pressed
  const handleCoinsPress = () => {
    setOverlayState((prev) => ({
      ...prev,
      isCoinShopModalVisible: true,
    }));
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  });

  return (
    <SafeAreaView className="flex-1">
      <StarryBackground />
      <KeyboardAvoidingView
        style={[
          styles.gameContainer,
          isAnyOverlayVisible && styles.overlayVisible,
          isTablet && styles.gameContainerTablet,
          { paddingBottom: 120 }, // Add padding to prevent content being hidden by bottom bar
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Header
          userCoins={userCoins}
          onHintPress={handleHintPress}
          onCoinsPress={handleCoinsPress}
        />

        <GameBoard
          riddleText={riddleText}
          guesses={guesses}
          currentGuess={currentGuess}
          answerLength={answerLength}
          shakeKey={overlayState.shakeKey}
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
        isHintOverlayVisible={overlayState.isHintOverlayVisible}
        onHintClose={handleHintClose}
        onShowHint={handleShowHint}
        hintCost={hintCost}
        userCoins={userCoins}
        // Profile Overlay
        isProfileOverlayVisible={overlayState.isProfileOverlayVisible}
        onProfileClose={handleProfileClose}
        playerData={playerData}
        onFullProfilePress={handleShowFullProfileDetails}
        // Settings Overlay
        isSettingsOverlayVisible={overlayState.isSettingsOverlayVisible}
        onSettingsClose={handleSettingsClose}
        isSoundEnabled={isSoundEnabled}
        isHapticsEnabled={isHapticsEnabled}
        onToggleSound={toggleSoundEnabled}
        onToggleHaptics={toggleHapticsEnabled}
        onPressLogout={logout}
        onPressHelp={() => {
          setOverlayState((prev) => ({
            ...prev,
            isInstructionsVisible: true,
          }));
        }}
        onPressCredits={handleCreditsPress}
        // Instructions Overlay
        isInstructionsVisible={overlayState.isInstructionsVisible}
        onCloseInstructions={handleCloseInstructions}
        // Welcome Overlay
        isWelcomeOverlayVisible={overlayState.isWelcomeOverlayVisible}
        onWelcomeClose={handleWelcomeClose}
        // Full Profile Details Overlay
        isFullProfileDetailsOverlayVisible={
          overlayState.isFullProfileDetailsOverlayVisible
        }
        onCloseFullProfileDetailsOverlay={handleCloseFullProfileDetailsOverlay}
        // Coin Shop Modal
        isCoinShopModalVisible={overlayState.isCoinShopModalVisible}
        onCloseCoinShopModal={handleCloseCoinShopModal}
        onPurchaseProduct={handlePurchaseProduct}
        // Watch Ad Modal
        isWatchAdModalVisible={overlayState.isWatchAdModalVisible}
        onWatchAdAccepted={handleWatchAdAccepted}
        onWatchAdDeclined={handleWatchAdDeclined}
        // Home/Play Overlays
        onCloseHomeOverlay={handleCloseHomeOverlay}
        onClosePlayOverlay={handleClosePlayOverlay}
        // Credits Overlay
        isCreditsOverlayVisible={overlayState.isCreditsOverlayVisible}
        onCreditsClose={handleCreditsClose}
      />

      {/* Out of Attempts Modal */}
      <OutOfAttemptsModal
        isVisible={overlayState.isOutOfAttemptsModalVisible}
        userCoins={userCoins}
        continueCost={CONTINUE_COST}
        onWatchAd={handleWatchAdToContinue}
        onSpendCoins={handleSpendCoinsToContinue}
        onClose={handleGiveUpAttempts}
      />

      <Controls
        onNextPress={handleOverlayNext}
        isWin={gameOver && overlayState.lastGuessResult?.outcome === "win"}
      />

      <PulsingSpinner
        visible={overlayState.isLoading}
        size={120}
        opacity={0.7}
      />
    </SafeAreaView>
  );
};

export default GameScreen;

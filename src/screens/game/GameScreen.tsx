import React, { useState, useEffect } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Header from "../../components/game/Header";
import Controls from "../../components/game/Controls";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import GameBoard from "../../components/game/GameBoard";
import { SoundManager } from "../../services/SoundManager";
import useGameLogic from "../../hooks/useGameLogic";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions } from "@react-native-firebase/functions";
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
import { styles } from "../../styles";
import { GameInput } from "src/components/game/GameInput";
import { useModal } from "../../hooks/useModal";
import { ModalProvider } from "../../components/modals/ModalProvider";

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
  enableVibrateFallback: true,
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
  const navigation = useNavigation();
  const modal = useModal();

  // Simplified state - no more massive overlay state object!
  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(
    null
  );
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

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

  // Check if any modal is currently open
  const isAnyModalVisible = modal.modals.length > 0;

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();
  const { loadInterstitialAd, showInterstitialAd } = useInterstitialAds();

  const CONTINUE_COST = 50;

  // Initialize first-time user experience
  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome");
        if (hasSeenWelcome === null) {
          modal.showWelcomeModal();
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
        console.error("Error checking AsyncStorage:", error);
      }
    };

    checkIfFirstTimeUser();
  }, [modal]);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const soundEnabled = await AsyncStorage.getItem(
          SOUND_ENABLED_STORAGE_KEY
        );
        if (soundEnabled !== null) {
          const parsedSoundEnabled = JSON.parse(soundEnabled);
          setIsSoundEnabled(parsedSoundEnabled);
          SoundManager.setSoundEnabled(parsedSoundEnabled);
        } else {
          SoundManager.setSoundEnabled(true);
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

  // Save settings
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

  // Background music management
  useEffect(() => {
    SoundManager.setSoundEnabled(isSoundEnabled);
    if (isSoundEnabled) {
      safeDelay(500).then(() => {
        SoundManager.playBackgroundMusic();
      });
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  // Handle game over states
  useEffect(() => {
    if (gameOver && lastGuessResult) {
      const result = lastGuessResult;

      if (result.outcome === "win") {
        SoundManager.fadeOutBackgroundMusic({
          duration: 500,
          curve: "exponential",
        });

        safeDelay(500).then(() => {
          SoundManager.playSuccess();
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

        // Use the new modal system - much cleaner!
        modal.showVictoryModal({
          attempts: guesses.length,
          coinsEarned: result.coinsEarned || 0,
          onNext: () => {
            modal.closeModalByType("victory");
            resetGame();
            onNextLevel();
          },
          onHome: () => {
            modal.closeModalByType("victory");
            resetGame();
          },
        });

        onGameWin(guesses.length, result.coinsEarned || 0);
      } else if (result.outcome === "attemptLimitReached") {
        // Show out of attempts modal
        modal.showOutOfAttemptsModal({
          userCoins,
          continueCost: CONTINUE_COST,
          onWatchAd: handleWatchAdToContinue,
          onSpendCoins: handleSpendCoinsToContinue,
        });
      } else if (result.outcome === "loss") {
        if (result.canOfferRewardedAd) {
          modal.showWatchAdForChanceModal({
            onWatchAd: handleWatchAdAccepted,
          });
        } else {
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
            },
          });

          if (result.correctAnswer) {
            onGameLoss(result.correctAnswer);
          }
        }
      }
    }
  }, [
    gameOver,
    lastGuessResult,
    modal,
    guesses.length,
    userCoins,
    isHapticsEnabled,
    onGameWin,
    onGameLoss,
    onNextLevel,
    resetGame,
  ]);

  // Game actions
  const handleSubmit = async () => {
    if (currentGuess.length === answerLength) {
      setIsLoading(true);
      try {
        const result = (await processGuess(currentGuess)) as GuessResult;
        setLastGuessResult(result);
        setIsLoading(false);
      } catch (error) {
        console.error("Error processing guess in GameScreen:", error);
        setIsLoading(false);
        Alert.alert(
          AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE,
          AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE
        );
      }
    } else {
      if (isHapticsEnabled) {
        ReactNativeHapticFeedback.trigger("notificationWarning", hapticOptions);
      }
    }
  };

  const handleKeyPress = (key: string) => {
    if (currentGuess.length < answerLength) {
      setCurrentGuess((prev: string[]) => [...prev, key]);
    }
  };

  const handleBackspace = () => {
    setCurrentGuess((prev: string[]) => prev.slice(0, -1));
  };

  const handleHintPress = () => {
    modal.showHintModal({
      hintCost,
      userCoins,
      onShowHint: handleShowHint,
    });
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
      const getHintCallable = getFunctions(getApp()).httpsCallable("getHint");
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
      Alert.alert("Error", "An error occurred while getting a hint.");
    }
  };

  const handleOverlayNext = () => {
    console.log("Next button pressed - opening skip modal");
    modal.showSkipModal({
      userCoins,
      skipCost: hintCost,
      onShowHint: () => {
        modal.closeModalByType("skip");
        resetGame();
        onNextLevel();
      },
    });
  };

  const handleSettingsPress = () => {
    modal.showSettingsModal({
      isSoundEnabled,
      isHapticsEnabled,
      onToggleSound: toggleSoundEnabled,
      onToggleHaptics: toggleHapticsEnabled,
      onPressLogout: logout,
      onPressHelp: () => modal.showInstructionsModal(),
      onPressCredits: () =>
        navigation.navigate(AppStrings.Navigation.CREDITS as never),
    });
  };

  const handleProfilePress = () => {
    modal.showFullProfileDetailsModal({
      playerData: playerData || {},
    });
  };

  const handleCoinsPress = () => {
    modal.showCoinShopModal({
      onPurchaseProduct: (productId: string) => {
        console.log(`Purchasing product: ${productId}`);
        modal.closeModalByType("coinShop");
      },
    });
  };

  const toggleSoundEnabled = (isEnabled: boolean) => {
    setIsSoundEnabled(isEnabled);
    SoundManager.setSoundEnabled(isEnabled);
    if (isEnabled) {
      SoundManager.playBackgroundMusic();
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  };

  const toggleHapticsEnabled = (isEnabled: boolean) => {
    setIsHapticsEnabled(isEnabled);
  };

  const handleWatchAdAccepted = async () => {
    modal.closeModalByType("watchAdForChance");
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
  };

  const handleWatchAdToContinue = async () => {
    modal.closeModalByType("outOfAttempts");
    try {
      await loadInterstitialAd();
      showInterstitialAd();
      continueGame();
      console.log("User continued game after watching interstitial ad");
    } catch (error) {
      console.error("Error showing interstitial ad:", error);
      Alert.alert(
        "Ad Error",
        "An error occurred while trying to show the ad. You can try spending coins instead."
      );
    }
  };

  const handleSpendCoinsToContinue = async () => {
    if (userCoins < CONTINUE_COST) {
      Alert.alert(
        "Not Enough Coins",
        `You need ${CONTINUE_COST} coins to continue. You have ${userCoins} coins.`
      );
      return;
    }

    modal.closeModalByType("outOfAttempts");
    try {
      const spendCoinsCallable = getFunctions(getApp()).httpsCallable(
        "spendCoins"
      );
      await spendCoinsCallable({
        amount: CONTINUE_COST,
        reason: "continue_attempts",
      });
      continueGame();
      console.log(`User spent ${CONTINUE_COST} coins to continue game`);
    } catch (error) {
      console.error("Error spending coins:", error);
      Alert.alert("Error", "Failed to spend coins. Please try again.");
    }
  };

  const isSubmitDisabled = currentGuess.length !== answerLength;

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        style={[
          styles.gameContainer,
          isAnyModalVisible && styles.overlayVisible,
          isTablet && styles.gameContainerTablet,
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Header userCoins={userCoins} onCoinsPress={handleCoinsPress} />

        <GameBoard
          riddleText={riddleText}
          guesses={guesses}
          currentGuess={currentGuess}
          answerLength={answerLength}
          handleKeyPress={handleKeyPress}
          handleBackspace={handleBackspace}
          isAnyOverlayVisible={isAnyModalVisible}
        />

        <GameInput
          isSubmitDisabled={isSubmitDisabled}
          gameOver={gameOver}
          handleSubmit={handleSubmit}
          handleHint={handleHintPress}
          handleNext={handleOverlayNext}
        />

        <BottomNavigationBar
          onProfilePress={handleProfilePress}
          onSettingsPress={handleSettingsPress}
          onHintPress={handleShowHint}
        />
      </KeyboardAvoidingView>

      {/* The new modal system - no more massive props list! */}
      <ModalProvider />

      <Controls
        onNextPress={handleOverlayNext}
        isWin={gameOver && lastGuessResult?.outcome === "win"}
      />

      <PulsingSpinner visible={isLoading} size={120} opacity={0.7} />
    </SafeAreaView>
  );
};

export default GameScreen;

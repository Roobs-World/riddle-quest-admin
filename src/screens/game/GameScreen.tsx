import React, { useState, useEffect } from "react";
import { View, SafeAreaView, Alert, Button } from "react-native";
import Keyboard from "../../components/game/Keyboard";
import Header from "../../components/game/Header";
import RiddleText from "../../components/game/RiddleText";
import GuessGrid from "../../components/game/GuessGrid";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import HintOverlay from "../../components/game/HintOverlay";
import SkipOverlay from "../../components/game/SkipOverlay";
import PlayOverlay from "../../components/game/PlayOverlay";
import ProfileOverlay from "../../components/game/ProfileOverlay";
import SettingsOverlay from "../../components/game/SettingsOverlay";
import InstructionsOverlay from "../../components/game/InstructionsOverlay";
import HomeOverlay from "../../components/game/HomeOverlay";
import Controls from "../../components/game/Controls";
import { SoundManager } from "../../services/SoundManager";
import useGameLogic from "../../hooks/useGameLogic";
import { checkAnyOverlayVisible } from "../../utils/overlayUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import functions from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import VictoryLossOverlay from "../../components/game/VictoryLossOverlay";
import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../../types/OverlayTypes";
import { useAuth } from "../../contexts/AuthContext";
import FullProfileDetailsOverlay from "../../screens/main/FullProfileDetailsOverlay";
import CoinShopModal from "../../components/shop/CoinShopModal";
import { GameMode } from "../../contexts/AuthContext";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { IapService } from "../../services/IapService";
import * as RNIap from "react-native-iap";
import { useInterstitialAds } from "../../hooks/useInterstitialAds";
import WatchAdForChanceModal from "../../components/modals/WatchAdForChanceModal";
import useRewardedAds from "../../hooks/useRewardedAds";
import {
  GetHintInputSchema,
  GetHintOutputSchema,
  SkipRiddleInputSchema,
  SkipRiddleOutputSchema,
  ResetStatsOutputSchema,
} from "../../validation/cloudFunctionsSchemas";
import ShatteringTitle from "../../components/animations/ShatteringTitle";

interface GuessResult {
  outcome: "win" | "loss" | string;
  coinsEarned?: number;
  correctAnswer?: string;
  canOfferRewardedAd?: boolean;
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
  skipCost: number;
  onGameWin: (attempts: number, coinsEarned: number) => void;
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void;
  onRetry: () => void;
  overlayState: GameScreenOverlayState;
  overlayActions: GameScreenOverlayActions;
  gameMode: GameMode;
}

// Define proper error interfaces for Firebase and Zod errors
interface FirebaseError extends Error {
  code?: string;
  name: "FirebaseFunctionsError";
}

interface ZodError extends Error {
  name: "ZodError";
  issues: Array<{ message: string; path: string[] }>;
}

// Type guard functions
const isFirebaseError = (error: unknown): error is FirebaseError => {
  return (error as FirebaseError)?.name === "FirebaseFunctionsError";
};

const isZodError = (error: unknown): error is ZodError => {
  return (error as ZodError)?.name === "ZodError";
};

const GameScreen: React.FC<GameScreenProps> = ({
  riddleId,
  riddleText,
  answerLength,
  userCoins,
  hintCost,
  skipCost,
  onGameWin,
  onGameLoss,
  onHintUsed,
  onSkipUsed,
  onNextLevel,
  onRetry,
  overlayState,
  overlayActions,
  gameMode,
}) => {
  const { updatePlayerData, playerData, logout } = useAuth();
  const [isVictoryLossOverlayVisible, setIsVictoryLossOverlayVisible] =
    useState(false);
  const [overlayOutcome, setOverlayOutcome] = useState<"win" | "loss" | null>(
    null
  );
  const [overlayAttempts, setOverlayAttempts] = useState(0);
  const [overlayCorrectAnswer, setOverlayCorrectAnswer] = useState<
    string | null
  >(null);
  const [overlayCoinsEarned, setOverlayCoinsEarned] = useState<number | null>(
    null
  );
  const [isInstructionsVisible, setIsInstructionsVisible] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [
    isFullProfileDetailsOverlayVisible,
    setIsFullProfileDetailsOverlayVisible,
  ] = useState(false);
  const [isCoinShopModalVisible, setIsCoinShopModalVisible] = useState(false);
  const [isWatchAdModalVisible, setIsWatchAdModalVisible] = useState(false);
  const [lastGuessResult, setLastGuessResult] = useState<GuessResult | null>(
    null
  );
  const [startShatterAnimation, setStartShatterAnimation] = useState(false);

  // Animation value for shaking the GuessGrid
  const shakeAnimation = useSharedValue(0);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);

  const [coinProducts, setCoinProducts] = useState<RNIap.Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const {
    guesses,
    currentGuess,
    gameOver,
    setCurrentGuess,
    processGuess,
    resetGame,
  } = useGameLogic({
    riddleId,
    gameMode:
      gameMode === "daily"
        ? "challenge"
        : (gameMode as "challenge" | "classic"),
  });

  const isWin = gameOver && overlayOutcome === "win";

  const isAnyOverlayVisible = checkAnyOverlayVisible(
    isVictoryLossOverlayVisible,
    overlayState.isHintOverlayVisible,
    overlayState.isSkipOverlayVisible,
    overlayState.isHomeOverlayVisible,
    overlayState.isPlayOverlayVisible,
    overlayState.isProfileOverlayVisible,
    overlayState.isSettingsOverlayVisible,
    isInstructionsVisible,
    isFullProfileDetailsOverlayVisible,
    isCoinShopModalVisible,
    isWatchAdModalVisible
  );

  const { playerData: authPlayerData } = useAuth();
  const userHasPurchasedApp = authPlayerData?.hasPurchasedApp || false;

  const { showInterstitialAd } = useInterstitialAds();

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenInstructions = await AsyncStorage.getItem(
          "hasSeenInstructions"
        );
        if (hasSeenInstructions === null) {
          setIsInstructionsVisible(true);
          await AsyncStorage.setItem("hasSeenInstructions", "true");
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

  useEffect(() => {
    if (gameOver && lastGuessResult) {
      if (lastGuessResult.outcome === "win") {
        SoundManager.playSuccess();
        if (isHapticsEnabled) {
          ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
        }
        setOverlayOutcome("win");
        setOverlayAttempts(guesses.length);
        setOverlayCoinsEarned(lastGuessResult.coinsEarned || 0);
        setIsVictoryLossOverlayVisible(true);
        onGameWin(guesses.length, lastGuessResult.coinsEarned || 0);
        setStartShatterAnimation(true);
      } else if (lastGuessResult.outcome === "loss") {
        if (lastGuessResult.canOfferRewardedAd) {
          setIsWatchAdModalVisible(true);
        } else {
          SoundManager.playNegative();
          if (isHapticsEnabled) {
            ReactNativeHapticFeedback.trigger(
              "notificationError",
              hapticOptions
            );
          }
          setOverlayOutcome("loss");
          setOverlayCorrectAnswer(lastGuessResult.correctAnswer || null);
          setIsVictoryLossOverlayVisible(true);
          if (lastGuessResult.correctAnswer) {
            onGameLoss(lastGuessResult.correctAnswer);
          }
        }
      }
    }
  }, [
    gameOver,
    lastGuessResult,
    guesses.length,
    onGameWin,
    onGameLoss,
    isHapticsEnabled,
  ]);

  const handleKeyPress = async (key: string) => {
    if (
      gameOver ||
      isAnyOverlayVisible ||
      (currentGuess.length >= answerLength &&
        key !== "ENTER" &&
        key !== "BACKSPACE")
    )
      return;

    if (key === "ENTER") {
      if (currentGuess.length === answerLength) {
        try {
          const result = await processGuess(currentGuess);
          setLastGuessResult(result);
        } catch (error) {
          console.error("Error processing guess in GameScreen:", error);
          Alert.alert("Error", "Could not submit guess. Please try again.");
        }
      } else {
        setShakeKey((prev: number) => prev + 1);
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
    if (gameOver || isAnyOverlayVisible || isInstructionsVisible) return;
    console.log("Hint button pressed");
    overlayActions.setIsHintOverlayVisible(true);
  };

  const handleSkipPress = () => {
    if (gameOver || isAnyOverlayVisible || isInstructionsVisible) return;
    console.log("Skip button pressed");
    overlayActions.setIsSkipOverlayVisible(true);
  };

  const handleOverlayNext = () => {
    console.log("VictoryLossOverlay Next Level button pressed");
    setIsVictoryLossOverlayVisible(false);
    resetGame();
    onNextLevel();
  };

  const handleOverlayRetry = () => {
    console.log("VictoryLossOverlay Retry button pressed");
    setIsVictoryLossOverlayVisible(false);
    resetGame();
    onRetry();
  };

  const handleOverlayHome = () => {
    console.log("VictoryLossOverlay Home button pressed");
    setIsVictoryLossOverlayVisible(false);
    resetGame();
  };

  const handlePlayPress = () => {
    console.log("Play button pressed");
    overlayActions.setIsPlayOverlayVisible(true);
  };

  const handleProfilePress = () => {
    console.log("Profile button pressed");
    overlayActions.setIsProfileOverlayVisible(true);
  };

  const handleSettingsPress = () => {
    console.log("Settings button pressed");
    overlayActions.setIsSettingsOverlayVisible(true);
  };

  const handleCloseHomeOverlay = () => {
    overlayActions.setIsHomeOverlayVisible(false);
  };

  const handleClosePlayOverlay = () => {
    overlayActions.setIsPlayOverlayVisible(false);
  };

  const handleCloseProfileOverlay = () => {
    overlayActions.setIsProfileOverlayVisible(false);
  };

  const handleCloseSettingsOverlay = () => {
    overlayActions.setIsSettingsOverlayVisible(false);
  };

  const handleCloseInstructions = () => {
    setIsInstructionsVisible(false);
  };

  const handleCloseHintOverlay = () => {
    overlayActions.setIsHintOverlayVisible(false);
  };

  const handleCloseSkipOverlay = () => {
    overlayActions.setIsSkipOverlayVisible(false);
  };

  const handleHomeNavigationPress = () => {
    overlayActions.setIsHomeOverlayVisible(true);
  };

  const handleShowFullProfileDetails = () => {
    overlayActions.setIsProfileOverlayVisible(false);
    setIsFullProfileDetailsOverlayVisible(true);
  };

  const handleCloseFullProfileDetailsOverlay = () => {
    setIsFullProfileDetailsOverlayVisible(false);
  };

  const handleCloseCoinShopModal = () => {
    setIsCoinShopModalVisible(false);
    setCoinProducts([]);
    setProductError(null);
  };

  const handlePurchaseProduct = async (productId: string) => {
    setLoadingProducts(true);
    setProductError(null);
    try {
      console.log(`Attempting to purchase product: ${productId}`);
      const purchase = await IapService.purchaseProduct(productId);

      if (purchase) {
        console.log("Purchase successful and validated.");
        Alert.alert(
          "Purchase Successful",
          "Coins have been added to your account!"
        );
      } else {
        console.warn("Purchase did not return a purchase object.");
        setProductError("Purchase process did not complete.");
      }
    } catch (error: unknown) {
      console.error("Error during purchase:", error);
      setProductError(
        (error as Error).message ||
          "An unexpected error occurred during purchase."
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleResetStats = async () => {
    try {
      console.log("Calling backend to reset stats...");
      const resetStatsCallable = functions(getApp()).httpsCallable(
        "resetStats"
      );
      const result = await resetStatsCallable();
      const responseData = ResetStatsOutputSchema.parse(result.data);

      if (responseData.success) {
        console.log("Stats reset successfully on backend.");
        updatePlayerData({
          stats: {
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            winRate: 0,
            averageGuesses: 0,
            totalScore: 0,
            highestLevelClassic: 0,
            gamesPlayed: 0,
            wins: 0,
            challengeWins: 0,
            winStreak: 0,
            totalWins: 0,
            totalGuessesInWins: 0,
          },
        });
        Alert.alert(
          "Success",
          responseData.message || "Your stats have been reset."
        );
      } else {
        console.error(
          "Backend reported failure resetting stats:",
          responseData.message
        );
        Alert.alert("Error", responseData.message || "Failed to reset stats.");
      }
    } catch (error: unknown) {
      console.error("Error calling resetStats backend function:", error);
      let errorMessage = "An error occurred while resetting stats.";
      if (isFirebaseError(error)) {
        errorMessage = error.message;
      } else if (isZodError(error)) {
        errorMessage =
          "Received invalid data from server after resetting stats.";
        console.error(
          "Zod validation error for resetStats output:",
          error.issues
        );
      }
      Alert.alert("Error", errorMessage);
    }
    overlayActions.setIsSettingsOverlayVisible(false);
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

  const handleLevelComplete = () => {
    console.log("Level Completed!");

    if (!userHasPurchasedApp) {
      showInterstitialAd();
    } else {
      console.log("User has purchased, no interstitial ad.");
      onNextLevel();
    }
  };

  const handleShowHint = async () => {
    if (!playerData?.userId) return;
    if (userCoins < hintCost) {
      Alert.alert("Not enough coins", "You need more coins to use a hint.");
      return;
    }
    console.log("Showing hint for riddle:", riddleId);
    overlayActions.setIsHintOverlayVisible(false);

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

  const handleConfirmSkip = async () => {
    if (!playerData?.userId) return;
    if (userCoins < skipCost) {
      Alert.alert(
        "Not enough coins",
        "You need more coins to skip this riddle."
      );
      return;
    }
    console.log("Confirm skipping riddle:", riddleId);
    overlayActions.setIsSkipOverlayVisible(false);

    const skipRequestData = {
      gameMode: gameMode,
      riddleId: riddleId,
    };

    try {
      SkipRiddleInputSchema.parse(skipRequestData);

      const skipRiddleCallable = functions(getApp()).httpsCallable(
        "skipRiddle"
      );
      const result = await skipRiddleCallable(skipRequestData);

      const skipData = SkipRiddleOutputSchema.parse(result.data);

      Alert.alert("Skipped", "Riddle skipped successfully.");
      onSkipUsed(skipData.coinsCost);
    } catch (error: unknown) {
      console.error("Error skipping riddle:", error);
      let errorMessage = "An error occurred while skipping the riddle.";
      if (isFirebaseError(error)) {
        errorMessage = error.message;
      } else if (isZodError(error)) {
        errorMessage = "Received invalid data from server after skipping.";
        console.error(
          "Zod validation error for skipRiddle output:",
          error.issues
        );
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const handleWatchAdAccepted = async () => {
    setIsWatchAdModalVisible(false);
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
    SoundManager.playNegative();
    if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    }
    setOverlayOutcome("loss");
    setOverlayCorrectAnswer(lastGuessResult?.correctAnswer || null);
    setIsVictoryLossOverlayVisible(true);
    if (lastGuessResult?.correctAnswer) {
      onGameLoss(lastGuessResult.correctAnswer);
    }
  };

  const handleWatchAdDeclined = () => {
    setIsWatchAdModalVisible(false);
    SoundManager.playNegative();
    if (isHapticsEnabled) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
    }
    setOverlayOutcome("loss");
    setOverlayCorrectAnswer(lastGuessResult?.correctAnswer || null);
    setIsVictoryLossOverlayVisible(true);
    if (lastGuessResult?.correctAnswer) {
      onGameLoss(lastGuessResult.correctAnswer);
    }
  };

  // Trigger shake animation when shakeKey changes
  useEffect(() => {
    if (shakeKey > 0) {
      shakeAnimation.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [shakeKey, shakeAnimation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  });

  return (
    <SafeAreaView className="flex-1 bg-cream-light">
      <View className="flex-1 p-4">
        <Header
          level={playerData?.progress?.classicIndex ?? 0}
          userCoins={userCoins}
        />

        <View style={{ flex: 1, opacity: isAnyOverlayVisible ? 0.3 : 1 }}>
          <Header
            level={playerData?.progress?.classicIndex ?? 0}
            userCoins={userCoins}
          />
          {isWin && (
            <ShatteringTitle
              title="YOU WON!"
              startAnimation={startShatterAnimation}
            />
          )}
          <RiddleText riddleText={riddleText} />
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Animated.View style={animatedStyle}>
              <GuessGrid
                guesses={guesses}
                currentGuess={currentGuess}
                answerLength={answerLength}
                shakeKey={shakeKey}
              />
            </Animated.View>
          </View>
          {!isAnyOverlayVisible && <Keyboard onKeyPress={handleKeyPress} />}
        </View>

        {isVictoryLossOverlayVisible && (
          <VictoryLossOverlay
            isVisible={isVictoryLossOverlayVisible}
            outcome={overlayOutcome}
            attempts={overlayAttempts}
            correctAnswer={overlayCorrectAnswer}
            coinsEarned={overlayCoinsEarned}
            onNext={handleOverlayNext}
            onRetry={handleOverlayRetry}
            onHome={handleOverlayHome}
            guesses={guesses}
          />
        )}

        <HintOverlay
          isVisible={overlayState.isHintOverlayVisible}
          onClose={handleCloseHintOverlay}
          onShowHint={handleShowHint}
          hintCost={hintCost}
          userCoins={userCoins}
        />

        <SkipOverlay
          isVisible={overlayState.isSkipOverlayVisible}
          onClose={handleCloseSkipOverlay}
          onConfirmSkip={handleConfirmSkip}
          skipCost={skipCost}
          userCoins={userCoins}
        />

        <HomeOverlay
          isVisible={overlayState.isHomeOverlayVisible}
          onClose={handleCloseHomeOverlay}
        />
        <PlayOverlay
          isVisible={overlayState.isPlayOverlayVisible}
          onClose={handleClosePlayOverlay}
        />
        <ProfileOverlay
          isVisible={overlayState.isProfileOverlayVisible}
          onClose={handleCloseProfileOverlay}
          playerData={playerData}
          onFullProfilePress={handleShowFullProfileDetails}
        />
        <SettingsOverlay
          isVisible={overlayState.isSettingsOverlayVisible}
          onClose={handleCloseSettingsOverlay}
          isSoundEnabled={isSoundEnabled}
          isHapticsEnabled={isHapticsEnabled}
          onToggleSound={toggleSoundEnabled}
          onToggleHaptics={toggleHapticsEnabled}
          onPressResetStats={handleResetStats}
          onPressLogout={logout}
          onPressHelp={() => {
            overlayActions.setIsSettingsOverlayVisible(false);
            setIsInstructionsVisible(true);
          }}
        />

        <InstructionsOverlay
          isVisible={isInstructionsVisible}
          onClose={handleCloseInstructions}
        />

        <FullProfileDetailsOverlay
          isVisible={isFullProfileDetailsOverlayVisible}
          onClose={handleCloseFullProfileDetailsOverlay}
          playerData={playerData}
        />

        <CoinShopModal
          isVisible={isCoinShopModalVisible}
          onClose={handleCloseCoinShopModal}
          products={coinProducts}
          loading={loadingProducts}
          error={productError}
          onPurchaseProduct={handlePurchaseProduct}
        />

        <Controls
          onHintPress={handleHintPress}
          onSkipPress={handleSkipPress}
          onSubmitPress={() => handleKeyPress("ENTER")}
          onNextPress={handleOverlayNext}
          currentGuess={currentGuess}
          answerLength={answerLength}
          gameOver={gameOver}
          isWin={isWin}
        />

        <BottomNavigationBar
          onHomePress={handleHomeNavigationPress}
          onPlayPress={handlePlayPress}
          onProfilePress={handleProfilePress}
          onSettingsPress={handleSettingsPress}
          activeOverlay={
            Object.keys(overlayState).find(
              (key: string) => overlayState[key as keyof GameScreenOverlayState]
            ) as keyof GameScreenOverlayState | undefined
          }
        />

        <Button title="Complete Level" onPress={handleLevelComplete} />

        {isWatchAdModalVisible && (
          <WatchAdForChanceModal
            visible={isWatchAdModalVisible}
            onWatchAd={handleWatchAdAccepted}
            onClose={handleWatchAdDeclined}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default GameScreen;

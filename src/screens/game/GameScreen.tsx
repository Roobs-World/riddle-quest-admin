import React, { useState, useEffect } from "react";
import { View, SafeAreaView, Alert, StyleSheet } from "react-native";
import Keyboard from "../../components/game/Keyboard";
import Header from "../../components/game/Header";
import RiddleText from "../../components/game/RiddleText";
import GuessGrid from "../../components/game/GuessGrid";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import HintOverlay from "../../components/game/HintOverlay";
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
import { GameMode } from "../../contexts/AuthContext";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import WatchAdForChanceModal from "../../components/modals/WatchAdForChanceModal";
import useRewardedAds from "../../hooks/useRewardedAds";
import {
  GetHintInputSchema,
  GetHintOutputSchema,
} from "../../validation/cloudFunctionsSchemas";
import ShatteringTitle from "../../components/animations/ShatteringTitle";
import ShatteringTiles from "../../components/animations/ShatteringTiles";
import { useTileCapture } from "../../hooks/useTileCapture";
import { useAuth } from "../../contexts/AuthContext";
import FullProfileDetailsOverlay from "../../screens/main/FullProfileDetailsOverlay";
import CoinShopModal from "../../components/shop/CoinShopModal";
import { AppStrings } from "../../constants/AppStrings";

interface GuessResult {
  outcome: "win" | "loss" | "continue";
  feedback?: ("green" | "yellow" | "red")[];
  correctAnswer?: string;
  coinsEarned?: number;
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
  onGameWin: (attempts: number, coinsEarned: number) => void;
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onNextLevel: () => void;
  gameMode: GameMode;
}

interface GameScreenState {
  victoryLossOverlayVisible: boolean;
  overlayOutcome: "win" | "loss" | null;
  overlayAttempts: number;
  overlayCorrectAnswer: string | null;
  overlayCoinsEarned: number | null;
  isInstructionsVisible: boolean;
  shakeKey: number;
  isFullProfileDetailsOverlayVisible: boolean;
  isCoinShopModalVisible: boolean;
  isWatchAdModalVisible: boolean;
  lastGuessResult: GuessResult | null;
  startShatterAnimation: boolean;
  startTileShatterAnimation: boolean;
  isHintOverlayVisible: boolean;
  isProfileOverlayVisible: boolean;
  isSettingsOverlayVisible: boolean;
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

  const [overlayState, setOverlayState] = useState<GameScreenState>({
    victoryLossOverlayVisible: false,
    overlayOutcome: null,
    overlayAttempts: 0,
    overlayCorrectAnswer: null,
    overlayCoinsEarned: null,
    isInstructionsVisible: false,
    shakeKey: 0,
    isFullProfileDetailsOverlayVisible: false,
    isCoinShopModalVisible: false,
    isWatchAdModalVisible: false,
    lastGuessResult: null,
    startShatterAnimation: false,
    startTileShatterAnimation: false,
    isHintOverlayVisible: false,
    isProfileOverlayVisible: false,
    isSettingsOverlayVisible: false,
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
    resetGame,
  } = useGameLogic({
    riddleId,
    gameMode:
      gameMode === "daily"
        ? "challenge"
        : (gameMode as "challenge" | "classic"),
  });

  const isWin = gameOver && overlayState.overlayOutcome === "win";

  const isAnyOverlayVisible = checkAnyOverlayVisible(
    overlayState.victoryLossOverlayVisible,
    overlayState.isInstructionsVisible,
    overlayState.isFullProfileDetailsOverlayVisible,
    overlayState.isCoinShopModalVisible,
    overlayState.isWatchAdModalVisible
  );

  const { isRewardedAdReady, loadRewardedAd, showRewardedAd } =
    useRewardedAds();

  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
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
      const timer = setTimeout(() => {
        SoundManager.playBackgroundMusic();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      // Pause background music if sound is disabled
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    if (gameOver && overlayState.lastGuessResult) {
      if (overlayState.lastGuessResult.outcome === "win") {
        // Capture tiles before starting animations
        captureTiles(guesses, currentGuess, answerLength).then(
          (capturedTiles) => {
            setTilesData(capturedTiles);

            // Start tile shattering animation first
            setOverlayState((prev) => ({
              ...prev,
              startTileShatterAnimation: true,
            }));

            // Delay text shattering to let tile animation start
            setTimeout(() => {
              setOverlayState((prev) => ({
                ...prev,
                startShatterAnimation: true,
              }));
            }, 300);
          }
        );

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
        setOverlayState((prev) => ({
          ...prev,
          overlayOutcome: "win",
          overlayAttempts: guesses.length,
          overlayCoinsEarned: overlayState.lastGuessResult?.coinsEarned || 0,
          victoryLossOverlayVisible: true,
        }));
        onGameWin(
          guesses.length,
          overlayState.lastGuessResult?.coinsEarned || 0
        );
      } else if (overlayState.lastGuessResult.outcome === "loss") {
        if (overlayState.lastGuessResult.canOfferRewardedAd) {
          setOverlayState((prev) => ({
            ...prev,
            isWatchAdModalVisible: true,
          }));
        } else {
          // Fade out background music before playing negative sound with slow fade-in
          SoundManager.fadeOutBackgroundMusic({
            duration: 300,
            curve: "exponential",
          });

          setTimeout(() => {
            // Use slow fade-in for negative sound on wrong guesses
            SoundManager.playNegativeWithFadeIn({
              duration: 2000, // 2 seconds for a slow, dramatic fade-in
              curve: "exponential",
            });
          }, 300);

          if (isHapticsEnabled) {
            ReactNativeHapticFeedback.trigger(
              "notificationError",
              hapticOptions
            );
          }
          setOverlayState((prev) => ({
            ...prev,
            overlayOutcome: "loss",
            overlayCorrectAnswer:
              overlayState.lastGuessResult?.correctAnswer || null,
            victoryLossOverlayVisible: true,
          }));
          if (overlayState.lastGuessResult?.correctAnswer) {
            onGameLoss(overlayState.lastGuessResult.correctAnswer);
          }
        }
      }
    }
  }, [
    gameOver,
    overlayState.lastGuessResult,
    guesses.length,
    currentGuess,
    answerLength,
    captureTiles,
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
          setOverlayState((prev) => ({
            ...prev,
            lastGuessResult: result,
          }));
        } catch (error) {
          console.error("Error processing guess in GameScreen:", error);
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
    // Slightly fade background music when opening hint overlay
    SoundManager.fadeOutBackgroundMusic({ duration: 300, curve: "linear" });
  };

  const handleHintClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      isHintOverlayVisible: false,
    }));
    // Restore background music when closing hint overlay
    SoundManager.fadeInBackgroundMusic({ duration: 400, curve: "linear" });
  };

  const handleOverlayNext = () => {
    console.log("VictoryLossOverlay Next Level button pressed");
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));

    // Fade in background music when returning to gameplay
    SoundManager.fadeInBackgroundMusic({ duration: 800, curve: "linear" });

    resetGame();
    onNextLevel();
  };

  const handleOverlayRetry = () => {
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));

    // Fade in background music when returning to gameplay
    SoundManager.fadeInBackgroundMusic({ duration: 800, curve: "linear" });

    resetGame();
  };

  const handleProfileClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      profileOverlayVisible: false,
    }));
    // Fade in background music when closing profile overlay
    SoundManager.fadeInBackgroundMusic({ duration: 600, curve: "linear" });
  };

  const handleSettingsPress = () => {
    setOverlayState((prev) => ({
      ...prev,
      settingsOverlayVisible: true,
    }));
    // Fade out background music when opening settings overlay
    SoundManager.fadeOutBackgroundMusic({
      duration: 400,
      curve: "exponential",
    });
  };

  const handleSettingsClose = () => {
    setOverlayState((prev) => ({
      ...prev,
      settingsOverlayVisible: false,
    }));
    // Fade in background music when closing settings overlay
    SoundManager.fadeInBackgroundMusic({ duration: 600, curve: "linear" });
  };

  const handlePlayPress = () => {
    console.log("Play button pressed");
  };

  const handleProfilePress = () => {
    setOverlayState((prev) => ({
      ...prev,
      profileOverlayVisible: true,
    }));
    // Fade out background music when opening profile overlay
    SoundManager.fadeOutBackgroundMusic({
      duration: 400,
      curve: "exponential",
    });
  };

  const handleCloseHomeOverlay = () => {
    console.log("VictoryLossOverlay Home button pressed");
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));
    resetGame();
  };

  const handleClosePlayOverlay = () => {
    console.log("VictoryLossOverlay Play button pressed");
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));
    resetGame();
  };

  const handleCloseInstructions = () => {
    setOverlayState((prev) => ({
      ...prev,
      isInstructionsVisible: false,
    }));
  };

  const handleHomeNavigationPress = () => {
    console.log("VictoryLossOverlay Home button pressed");
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));
    resetGame();
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
    setOverlayState((prev) => ({
      ...prev,
      victoryLossOverlayVisible: false,
    }));
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
      overlayOutcome: "loss",
      overlayCorrectAnswer: overlayState.lastGuessResult?.correctAnswer || null,
      victoryLossOverlayVisible: true,
    }));
    if (overlayState.lastGuessResult?.correctAnswer) {
      onGameLoss(overlayState.lastGuessResult.correctAnswer);
    }
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
      overlayOutcome: "loss",
      overlayCorrectAnswer: overlayState.lastGuessResult?.correctAnswer || null,
      victoryLossOverlayVisible: true,
    }));
    if (overlayState.lastGuessResult?.correctAnswer) {
      onGameLoss(overlayState.lastGuessResult.correctAnswer);
    }
  };

  // Trigger shake animation when shakeKey changes
  useEffect(() => {
    if (overlayState.shakeKey > 0) {
      shakeAnimation.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [overlayState.shakeKey, shakeAnimation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  });

  return (
    <SafeAreaView className="flex-1 bg-cream-light">
      <View
        style={[
          styles.gameContainer,
          isAnyOverlayVisible && styles.overlayVisible,
        ]}
      >
        <Header
          level={playerData?.progress?.classicIndex ?? 0}
          userCoins={userCoins}
        />
        {isWin && (
          <ShatteringTitle
            title="YOU WON!"
            startAnimation={overlayState.startShatterAnimation}
          />
        )}
        {isWin && tilesData.length > 0 && (
          <ShatteringTiles
            tiles={tilesData}
            startAnimation={overlayState.startTileShatterAnimation}
            onAnimationComplete={() => {
              console.log("Tile shattering animation completed");
            }}
          />
        )}
        <RiddleText riddleText={riddleText} />
        <View style={styles.centerContainer}>
          <Animated.View style={animatedStyle}>
            <GuessGrid
              guesses={guesses}
              currentGuess={currentGuess}
              answerLength={answerLength}
              shakeKey={overlayState.shakeKey}
              setTileRef={setTileRef}
            />
          </Animated.View>
        </View>
        {!isAnyOverlayVisible && <Keyboard onKeyPress={handleKeyPress} />}
      </View>

      {gameOver && overlayState.overlayOutcome === "win" && (
        <View style={styles.overlayContainer}>
          <VictoryLossOverlay
            isVisible={gameOver && overlayState.overlayOutcome === "win"}
            outcome="win"
            attempts={overlayState.overlayAttempts}
            correctAnswer={overlayState.overlayCorrectAnswer}
            coinsEarned={overlayState.overlayCoinsEarned || 0}
            guesses={guesses}
            onNext={handleOverlayNext}
            onRetry={handleOverlayRetry}
            onHome={() => {}}
          />
        </View>
      )}

      {gameOver && overlayState.overlayOutcome === "loss" && (
        <View style={styles.overlayContainer}>
          <VictoryLossOverlay
            isVisible={gameOver && overlayState.overlayOutcome === "loss"}
            outcome="loss"
            attempts={overlayState.overlayAttempts}
            correctAnswer={overlayState.overlayCorrectAnswer}
            coinsEarned={0}
            guesses={guesses}
            onNext={handleOverlayNext}
            onRetry={handleOverlayRetry}
            onHome={() => {}}
          />
        </View>
      )}

      <HintOverlay
        isVisible={overlayState.isHintOverlayVisible}
        onClose={handleHintClose}
        onShowHint={handleShowHint}
        hintCost={hintCost}
        userCoins={userCoins}
      />

      <HomeOverlay isVisible={false} onClose={handleCloseHomeOverlay} />
      <PlayOverlay isVisible={false} onClose={handleClosePlayOverlay} />
      <ProfileOverlay
        isVisible={overlayState.isProfileOverlayVisible}
        onClose={handleProfileClose}
        playerData={playerData}
        onFullProfilePress={handleShowFullProfileDetails}
      />
      <SettingsOverlay
        isVisible={overlayState.isSettingsOverlayVisible}
        onClose={handleSettingsClose}
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
      />

      <InstructionsOverlay
        isVisible={overlayState.isInstructionsVisible}
        onClose={handleCloseInstructions}
      />

      <FullProfileDetailsOverlay
        isVisible={overlayState.isFullProfileDetailsOverlayVisible}
        onClose={handleCloseFullProfileDetailsOverlay}
        playerData={playerData}
      />

      <CoinShopModal
        isVisible={overlayState.isCoinShopModalVisible}
        onClose={handleCloseCoinShopModal}
        products={[]}
        loading={false}
        error={null}
        onPurchaseProduct={handlePurchaseProduct}
      />

      <Controls
        onHintPress={handleHintPress}
        onSubmitPress={() => handleKeyPress("ENTER")}
        onNextPress={handleOverlayNext}
        currentGuess={currentGuess}
        gameOver={gameOver}
        isWin={gameOver && overlayState.overlayOutcome === "win"}
        answerLength={answerLength}
      />

      <BottomNavigationBar
        onHomePress={handleHomeNavigationPress}
        onPlayPress={handlePlayPress}
        onProfilePress={handleProfilePress}
        onSettingsPress={handleSettingsPress}
      />

      {overlayState.isWatchAdModalVisible && (
        <WatchAdForChanceModal
          visible={overlayState.isWatchAdModalVisible}
          onWatchAd={handleWatchAdAccepted}
          onClose={handleWatchAdDeclined}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
  },
  gameContainer: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: "center",
  },
  overlayVisible: {
    opacity: 0.3,
  },
});

export default GameScreen;

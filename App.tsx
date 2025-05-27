import "./global.css";
import React, { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import GameScreen from "./src/screens/game/GameScreen";
import { loadFonts } from "./src/utils/fontLoader";
import DottedSpinner from "./src/components/DottedSpinner";
import { SoundManager } from "./src/services/SoundManager";
import Constants from "expo-constants";
import { Settings } from "react-native-fbsdk-next";

import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "./src/types/OverlayTypes";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import {
  updateLastDailyChallengeCompletedAt,
  fetchClassicRiddleFromFirestore,
  fetchDailyRiddleForDate,
} from "./src/services/FirestoreService";

import { getFunctions } from "@react-native-firebase/functions";
import AppLovinMAX, { Configuration } from "react-native-applovin-max";

function AppContent() {
  const {
    isAuthenticated,
    playerData,
    isLoading,
    currentRiddle,
    isDailyChallengeAvailable,
    gameMode,
    setGameMode,
    updatePlayerClassicIndex,
    setCurrentRiddle,
  } = useAuth();
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  // State for managing GameScreen overlays
  const [overlayState, setOverlayState] = useState<GameScreenOverlayState>({
    isVictoryModalVisible: false,
    isLossModalVisible: false,
    isHintOverlayVisible: false,
    isSkipOverlayVisible: false,
    isHomeOverlayVisible: false,
    isPlayOverlayVisible: false,
    isProfileOverlayVisible: false,
    isSettingsOverlayVisible: false,
  });

  // State to hold the correct answer when a level is skipped
  const [skippedRiddleAnswer, setSkippedRiddleAnswer] = useState<string | null>(
    null
  );

  // Actions to update overlay state
  const overlayActions: GameScreenOverlayActions = {
    setIsVictoryModalVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isVictoryModalVisible: isVisible,
      })),
    setIsLossModalVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isLossModalVisible: isVisible,
      })),
    setIsHintOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isHintOverlayVisible: isVisible,
      })),
    setIsSkipOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isSkipOverlayVisible: isVisible,
      })),
    setIsHomeOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isHomeOverlayVisible: isVisible,
      })),
    setIsPlayOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isPlayOverlayVisible: isVisible,
      })),
    setIsProfileOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isProfileOverlayVisible: isVisible,
      })),
    setIsSettingsOverlayVisible: (isVisible) =>
      setOverlayState((prevState) => ({
        ...prevState,
        isSettingsOverlayVisible: isVisible,
      })),
  };

  // Effect to load static resources like fonts
  useEffect(() => {
    async function loadStaticResources() {
      try {
        await loadFonts();
        setResourcesLoaded(true);
      } catch (e: any) {
        console.error("App load error:", e);
      }
    }

    loadStaticResources();
  }, []);

  // Effect to initialize and clean up SoundManager
  useEffect(() => {
    SoundManager.init();

    return () => {
      SoundManager.unload();
    };
  }, []);

  // Effect to initialize AppLovin SDK
  useEffect(() => {
    const initializeAppLovin = async () => {
      const applovinSdkKey = Constants.expoConfig?.extra?.APPLOVIN_SDK_KEY;

      if (!applovinSdkKey || applovinSdkKey === "YOUR_APPLOVIN_SDK_KEY") {
        console.error("AppLovin SDK Key not set. Ads will not initialize.");
        return;
      }

      console.log("Initializing AppLovin SDK...");

      try {
        const configuration: Configuration = await AppLovinMAX.initialize(
          applovinSdkKey
        );
        console.log("AppLovin SDK initialized successfully!");
        console.log("AppLovin Configuration:", configuration);
      } catch (error) {
        console.error("AppLovin SDK failed to initialize:", error);
      }
    };

    initializeAppLovin();
  }, []);

  // Effect to initialize Facebook SDK
  useEffect(() => {
    const initializeFacebookSDK = async () => {
      const facebookAppId = Constants.expoConfig?.extra?.FACEBOOK_APP_ID;

      if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID") {
        console.error(
          "Facebook App ID not set. Facebook features will not work."
        );
        return;
      }

      console.log("Initializing Facebook SDK...");

      try {
        // Set the Facebook App ID
        Settings.setAppID(facebookAppId);

        // Initialize the Facebook SDK
        Settings.initializeSDK();

        console.log("Facebook SDK initialized successfully!");
      } catch (error) {
        console.error("Facebook SDK failed to initialize:", error);
      }
    };

    initializeFacebookSDK();
  }, []);

  // Effect to load the initial riddle based on game mode when authenticated and player data is available
  useEffect(() => {
    const loadRiddle = async () => {
      if (!isAuthenticated || !playerData) {
        setCurrentRiddle(null);
        return;
      }

      try {
        if (gameMode === "classic") {
          console.log("Loading Classic Mode riddle...");
          const classicIndex = playerData.progress?.classicIndex || 0;
          const riddle = await fetchClassicRiddleFromFirestore(classicIndex);
          setCurrentRiddle(riddle);
        } else if (gameMode === "challenge") {
          console.log("Loading Daily Challenge riddle...");
          if (isDailyChallengeAvailable) {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, "0");
            const day = today.getDate().toString().padStart(2, "0");
            const dateString = `${year}-${month}-${day}`;

            const dailyRiddle = await fetchDailyRiddleForDate(dateString);

            if (dailyRiddle) {
              setCurrentRiddle(dailyRiddle);
            } else {
              console.warn(`No daily riddle found for date: ${dateString}`);
              setCurrentRiddle(null);
            }
          } else {
            console.log("Daily Challenge already completed for today.");
            setCurrentRiddle(null);
          }
        }
      } catch (error) {
        console.error("Error loading riddle based on game mode:", error);
        setCurrentRiddle(null);
      }
    };

    loadRiddle();
  }, [
    isAuthenticated,
    playerData,
    gameMode,
    isDailyChallengeAvailable,
    setCurrentRiddle,
    fetchClassicRiddleFromFirestore,
    fetchDailyRiddleForDate,
  ]);

  // Show loading spinner while auth status, static resources, player data, and current riddle are loading
  if (
    isLoading ||
    !resourcesLoaded ||
    (isAuthenticated &&
      (!playerData ||
        !currentRiddle ||
        isDailyChallengeAvailable === undefined))
  ) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FAF3E0",
        }}
      >
        <DottedSpinner size={150} color="#FDBA74" />
      </View>
    );
  }

  // Simple function to calculate coin rewards based on attempts
  const calculateCoinReward = (attempts: number): number => {
    switch (attempts) {
      case 1:
        return 50;
      case 2:
        return 40;
      case 3:
        return 30;
      case 4:
        return 20;
      case 5:
        return 10;
      case 6:
        return 5;
      default:
        return 0;
    }
  };

  const handleNextLevel = async () => {
    if (!playerData) return;

    const nextClassicIndex = (playerData.progress?.classicIndex || 0) + 1;

    try {
      const nextRiddle = await fetchClassicRiddleFromFirestore(
        nextClassicIndex
      );

      if (nextRiddle) {
        setCurrentRiddle(nextRiddle);
      } else {
        console.log(
          "End of available classic riddles, triggering generation..."
        );
        const generateRiddlesCallable = getFunctions().httpsCallable(
          "generateClassicRiddles"
        );
        await generateRiddlesCallable();

        // Note: Riddles are now stored directly in Firestore (no Google Sheets sync needed)

        await new Promise((resolve) => setTimeout(resolve, 5000));
        const refetchedRiddle = await fetchClassicRiddleFromFirestore(
          nextClassicIndex
        );

        if (refetchedRiddle) {
          setCurrentRiddle(refetchedRiddle);
          console.log(
            `Refetched and set new classic riddle at index ${nextClassicIndex}.`
          );
        } else {
          console.warn(
            `Could not refetch new classic riddle at index ${nextClassicIndex} after generation.`
          );
          // TODO: Handle this case in the UI - maybe inform the user to try again later.
        }
      }
    } catch (error) {
      console.error(
        "Error loading next classic riddle or generating new ones:",
        error
      );
      Alert.alert("Error", "An error occurred while loading the next riddle.");
    }
  };

  // Placeholder for actual onGameWin implementation
  const handleGameWin = (attempts: number, coinsEarned: number) => {
    console.log(
      `Game won in ${attempts} attempts! Coins earned: ${coinsEarned}`
    );
  };

  // Placeholder for actual onGameLoss implementation
  const handleGameLoss = (correctAnswer: string) => {
    console.log(`Game lost. Correct answer was: ${correctAnswer}`);
  };

  const handleHintUsed = (cost: number) => {
    console.log(`Hint used! Cost: ${cost} coins.`);
  };

  const handleSkipUsed = (cost: number) => {
    console.log(`Riddle skipped! Cost: ${cost} coins.`);
    handleNextLevel();
  };

  const handleRetry = () => {
    console.log("Retrying current riddle...");
  };

  // Determine which screen to render based on authentication state, player data, current riddle, game mode, and daily challenge availability
  const renderContent = () => {
    // If not authenticated, or auth/player data is still loading, render AuthNavigator
    // If authenticated but player data or current riddle is loading, render loading spinner (handled by the check at the top)
    if (!isAuthenticated || !playerData) {
      return null;
    }

    // If currentRiddle is null and not loading, this might indicate an issue or that the daily challenge is complete
    if (!currentRiddle && !isLoading) {
      if (gameMode === "challenge" && !isDailyChallengeAvailable) {
        // If in daily mode and the daily challenge is not available
        return (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text>
              You have already completed today's daily challenge. Check back
              tomorrow!
            </Text>
          </View>
        );
      } else if (gameMode === "classic") {
        // If in classic mode and no current riddle, this is an unexpected state after loading.
        // It might indicate an error fetching the first classic riddle.
        console.error("Classic mode started but no riddle loaded.");
        return (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text>Error loading Classic mode riddle.</Text>
          </View>
        );
      }
      // If currentRiddle is null for other reasons (e.g., error during fetch), you might show a generic error message.
      return (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text>Error loading riddle.</Text>
        </View>
      );
    }

    // If the daily challenge is available (and in challenge mode), or in classic mode (and a riddle is loaded), render the GameScreen
    // The loading check at the top ensures currentRiddle is available before this point, unless daily challenge is complete.
    if (currentRiddle) {
      return (
        <GameScreen
          riddleId={currentRiddle.riddleId}
          riddleText={currentRiddle.text}
          answerLength={currentRiddle.answer.length}
          userCoins={playerData.coins || 0}
          hintCost={10}
          skipCost={50}
          onGameWin={(attempts, coinsEarned) => {
            console.log(
              `Game Won: Attempts - ${attempts} in ${gameMode} mode.`
            );
            console.log(`Coins Earned: ${coinsEarned}`);

            if (playerData?.userId) {
              const newTotalCoins = (playerData.coins || 0) + coinsEarned;

              if (gameMode === "challenge") {
                updateLastDailyChallengeCompletedAt(playerData.userId);
              } else if (gameMode === "classic") {
              }
            }

            // TODO: Implement actual game win logic (e.g., show victory UI)
            overlayActions.setIsVictoryModalVisible(true);
          }}
          onGameLoss={(correctAnswer) => {
            console.log(`Game Lost: Correct Answer - ${correctAnswer}`);
            overlayActions.setIsLossModalVisible(true);
          }}
          onHintUsed={async (cost) => {
            console.log(`Hint Used: Cost - ${cost}`);
          }}
          onSkipUsed={async (cost) => {
            console.log(`Skip Used: Cost - ${cost}`);
          }}
          onNextLevel={handleNextLevel}
          onRetry={() => {
            console.log("Retry button pressed");
          }}
          overlayState={overlayState}
          overlayActions={overlayActions}
          skippedAnswer={skippedRiddleAnswer}
          gameMode={gameMode}
        />
      );
    }

    // Default case, should not be reached if loading check is comprehensive and riddle is loaded or daily challenge is complete
    return null;
  };

  return renderContent();
}

// Wrap the AppContent with AuthProvider and NavigationContainer
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>{<AppContent />}</NavigationContainer>
    </AuthProvider>
  );
}

import * as React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, Alert } from "react-native";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import { AppStrings } from "../constants/AppStrings";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import { useAuth } from "../contexts/AuthContext";
import PulsingSpinner from "../components/PulsingSpinner";
import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../types/OverlayTypes";
import {
  updateLastDailyChallengeCompletedAt,
  fetchClassicRiddleFromFirestore,
  fetchDailyRiddleForDate,
} from "../services/FirestoreService";
import { FirestoreRiddle } from "../validation/firestoreSchemas";
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { useState, useEffect } from "react";

const Stack = createNativeStackNavigator();

// GameScreen wrapper that handles authentication and provides necessary props
const GameScreenWrapper = () => {
  const {
    isAuthenticated,
    playerData,
    isLoading,
    currentRiddle,
    isDailyChallengeAvailable,
    gameMode,
    setCurrentRiddle,
  } = useAuth();

  console.log("🎮 GameScreenWrapper rendering:", {
    isAuthenticated,
    hasPlayerData: !!playerData,
    isLoading,
    hasCurrentRiddle: !!currentRiddle,
    isDailyChallengeAvailable,
    gameMode,
  });

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

  // Effect to load the initial riddle based on game mode when authenticated and player data is available
  useEffect(() => {
    const loadRiddle = async () => {
      if (!isAuthenticated || !playerData) {
        setCurrentRiddle(null);
        return;
      }

      try {
        let fetchedRiddle: FirestoreRiddle | null = null;

        if (gameMode === "classic") {
          console.log("Loading Classic Mode riddle...");
          const classicIndex = playerData.progress?.classicIndex || 0;
          fetchedRiddle = await fetchClassicRiddleFromFirestore(classicIndex);
        } else if (gameMode === "challenge" || gameMode === "daily") {
          console.log("Loading Daily Challenge riddle...");
          if (isDailyChallengeAvailable) {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, "0");
            const day = today.getDate().toString().padStart(2, "0");
            const dateString = `${year}-${month}-${day}`;

            fetchedRiddle = await fetchDailyRiddleForDate(dateString);

            if (!fetchedRiddle) {
              console.warn(`No daily riddle found for date: ${dateString}`);
            }
          } else {
            console.log("Daily Challenge already completed for today.");
          }

          // If no daily riddle available, fall back to classic mode
          if (!fetchedRiddle) {
            console.log("Falling back to classic mode riddle...");
            const classicIndex = playerData.progress?.classicIndex || 0;
            fetchedRiddle = await fetchClassicRiddleFromFirestore(classicIndex);
          }
        }

        setCurrentRiddle(fetchedRiddle);
      } catch (error) {
        console.error("Error loading riddle based on game mode:", error);
        // Even on error, try to load a classic riddle as fallback
        try {
          console.log(
            "Error occurred, attempting to load classic riddle as fallback..."
          );
          const classicIndex = playerData.progress?.classicIndex || 0;
          const fallbackRiddle = await fetchClassicRiddleFromFirestore(
            classicIndex
          );
          setCurrentRiddle(fallbackRiddle);
        } catch (fallbackError) {
          console.error(
            "Failed to load fallback classic riddle:",
            fallbackError
          );
          setCurrentRiddle(null);
        }
      }
    };

    loadRiddle();
  }, [
    isAuthenticated,
    playerData,
    gameMode,
    isDailyChallengeAvailable,
    setCurrentRiddle,
  ]);

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
        const generateRiddlesCallable = getFunctions(getApp()).httpsCallable(
          "generateClassicRiddles"
        );
        await generateRiddlesCallable();

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

  // Show loading overlay while auth status, player data, and daily challenge availability are loading
  if (
    isLoading ||
    (isAuthenticated &&
      (!playerData || isDailyChallengeAvailable === undefined))
  ) {
    console.log("🎮 GameScreenWrapper showing loading spinner:", {
      isLoading,
      isAuthenticated,
      hasPlayerData: !!playerData,
      isDailyChallengeAvailable,
    });
    return <PulsingSpinner visible={true} size={150} />;
  }

  // If not authenticated, this should not render (handled by navigation)
  if (!isAuthenticated || !playerData) {
    return null;
  }

  // Since we now always fall back to classic riddles, we should always have a riddle
  // Only show error if riddle is truly null after all fallback attempts
  if (!currentRiddle && !isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontSize: 16,
            lineHeight: 24,
            color: "#333",
          }}
        >
          Unable to load any riddles. Please check your connection and try
          again.
        </Text>
      </View>
    );
  }

  // Render GameScreen with all necessary props
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
          console.log(`Game Won: Attempts - ${attempts} in ${gameMode} mode.`);
          console.log(`Coins Earned: ${coinsEarned}`);

          if (playerData?.userId) {
            if (gameMode === "challenge") {
              updateLastDailyChallengeCompletedAt(playerData.userId);
            }
          }

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
        gameMode={gameMode}
      />
    );
  }

  return null;
};

/**
 * Component responsible for setting up the main application navigation stack.
 * It defines the different screens available in the authentication and main application flows.
 */
export const Navigation = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log(
    "🧭 Navigation rendering - isAuthenticated:",
    isAuthenticated,
    "isLoading:",
    isLoading,
    "timestamp:",
    new Date().toISOString()
  );

  // Show loading overlay while authentication state is being determined
  if (isLoading) {
    console.log(
      "⏳ Showing loading spinner - authentication state being determined",
      "timestamp:",
      new Date().toISOString()
    );
    return <PulsingSpinner visible={true} size={150} />;
  }

  console.log(
    "🎯 Showing navigation stack - initialRoute:",
    isAuthenticated ? "GAME" : "LANDING",
    "timestamp:",
    new Date().toISOString()
  );

  return (
    <Stack.Navigator
      initialRouteName={
        isAuthenticated
          ? AppStrings.Navigation.GAME
          : AppStrings.Navigation.LANDING
      }
    >
      <Stack.Screen
        name={AppStrings.Navigation.LANDING}
        component={LandingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={AppStrings.Navigation.LOGIN}
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={AppStrings.Navigation.SIGN_UP}
        component={SignUpScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.NEW_PASSWORD}
        component={NewPasswordScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.GAME}
        component={GameScreenWrapper}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

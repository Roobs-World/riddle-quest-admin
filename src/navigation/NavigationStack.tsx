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
import DottedSpinner from "../components/DottedSpinner";
import { useAuth } from "../contexts/AuthContext";
import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../types/OverlayTypes";
import {
  updateLastDailyChallengeCompletedAt,
  fetchClassicRiddleFromFirestore,
  fetchDailyRiddleForDate,
} from "../services/FirestoreService";
import { getFunctions } from "@react-native-firebase/functions";
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

  // Show loading spinner while auth status, player data, and current riddle are loading
  if (
    isLoading ||
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

  // If not authenticated, this should not render (handled by navigation)
  if (!isAuthenticated || !playerData) {
    return null;
  }

  // If currentRiddle is null and not loading, handle different scenarios
  if (!currentRiddle && !isLoading) {
    if (gameMode === "challenge" && !isDailyChallengeAvailable) {
      return (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text>
            You have already completed today&apos;s daily challenge. Check back
            tomorrow!
          </Text>
        </View>
      );
    } else if (gameMode === "classic") {
      console.error("Classic mode started but no riddle loaded.");
      return (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text>Error loading Classic mode riddle.</Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error loading riddle.</Text>
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
        skippedAnswer={null}
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

  console.log("Navigation component rendering...");

  // Show loading while authentication state is being determined
  if (isLoading) {
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

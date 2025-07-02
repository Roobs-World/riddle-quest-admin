import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import CreditsScreen from "../screens/CreditsScreen";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { AppStrings } from "../constants/AppStrings";
import { View, Text, TouchableOpacity } from "react-native";
import { fetchClassicRiddleFromFirestore } from "../services/FirestoreService";
import { styles } from "../styles";
import { RiddleInitializationService } from "../services/RiddleInitializationService";

const Stack = createNativeStackNavigator();

// Wrapper component to handle authentication and data loading for the GameScreen
const GameScreenWrapper = () => {
  const {
    isAuthenticated,
    isLoading,
    isRiddlesInitializing,
    playerData,
    currentRiddle,
    gameMode,
    isDailyChallengeAvailable,
    setCurrentRiddle,
    fetchCurrentRiddle,
  } = useAuth();

  // Effect to load riddle when dependencies change
  useEffect(() => {
    const loadRiddle = async () => {
      if (isAuthenticated && playerData) {
        // This logic is now handled within fetchCurrentRiddle based on gameMode
        await fetchCurrentRiddle(playerData, gameMode);
      }
    };

    loadRiddle();
  }, [
    playerData,
    gameMode,
    isDailyChallengeAvailable,
    setCurrentRiddle,
    fetchCurrentRiddle,
    isAuthenticated,
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
          AppStrings.NavigationMessages.NO_CLASSIC_RIDDLE_FOUND +
            nextClassicIndex +
            AppStrings.NavigationMessages.SERVER_GENERATES_RIDDLES
        );
        setCurrentRiddle(null);
      }
    } catch (error) {
      console.error("Error loading next classic riddle:", error);
      setCurrentRiddle(null);
    }
  };

  const handleRetryInitialization = async () => {
    console.log("🔄 Retrying riddle initialization...");
    RiddleInitializationService.resetInitializationFlags();
    await RiddleInitializationService.checkAndInitializeRiddles();

    // Try to fetch riddles again
    if (isAuthenticated && playerData) {
      await fetchCurrentRiddle(playerData, gameMode);
    }
  };

  // Always render something to avoid conditional returns that can cause hooks violations
  // Show loading spinner while authentication is in progress, riddles are being initialized,
  // or we don't have a riddle yet (unless there's a confirmed error)
  if (isLoading || isRiddlesInitializing) {
    console.log(
      AppStrings.LogMessages.SHOWING_LOADING_SPINNER_USER_DATA,
      "isLoading:",
      isLoading,
      "isRiddlesInitializing:",
      isRiddlesInitializing,
      AppStrings.LogMessages.TIMESTAMP,
      new Date().toISOString()
    );
    return <PulsingSpinner visible={true} size={120} opacity={0.7} />;
  }

  // If not authenticated, this should not render (handled by navigation)
  if (!isAuthenticated || !playerData) {
    return <View style={styles.errorContainer} />;
  }

  // Check if riddle initialization failed
  const initStatus = RiddleInitializationService.getInitializationStatus();

  // Show spinner if we don't have a riddle yet and initialization hasn't failed
  if (!currentRiddle && !initStatus.initializationFailed) {
    console.log("⏳ No riddle loaded yet, showing spinner...");
    return <PulsingSpinner visible={true} size={120} opacity={0.7} />;
  }

  // Only show error messages when we truly don't have a riddle AND there's a confirmed problem
  if (!currentRiddle) {
    if (initStatus.initializationFailed) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>
            Failed to initialize the riddle database. This might be your first
            time using the app.
          </Text>
          <Text style={[styles.errorMessage, { fontSize: 14, marginTop: 10 }]}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={[
              styles.keyButton,
              { marginTop: 20, paddingHorizontal: 30, paddingVertical: 12 },
            ]}
            onPress={handleRetryInitialization}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>
            {AppStrings.ErrorMessages.UNABLE_TO_LOAD_RIDDLES}
          </Text>
          <TouchableOpacity
            style={[
              styles.keyButton,
              { marginTop: 20, paddingHorizontal: 30, paddingVertical: 12 },
            ]}
            onPress={handleRetryInitialization}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  // Render GameScreen with all necessary props only when we have current riddle
  if (currentRiddle) {
    return (
      <GameScreen
        riddleId={currentRiddle.riddleId}
        riddleText={currentRiddle.text}
        answerLength={currentRiddle.answer.length}
        userCoins={playerData.coins || 0}
        hintCost={10}
        onGameWin={(attempts: number, coinsEarned: number) => {
          console.log(
            AppStrings.GameMessages.GAME_WON +
              attempts +
              AppStrings.GameMessages.IN_MODE +
              gameMode +
              AppStrings.GameMessages.MODE_SUFFIX
          );
          console.log(AppStrings.GameMessages.COINS_EARNED + coinsEarned);
        }}
        onGameLoss={(correctAnswer: string) => {
          console.log(AppStrings.GameMessages.GAME_LOST + correctAnswer);
        }}
        onHintUsed={async (cost: number) => {
          console.log(AppStrings.GameMessages.HINT_USED + cost);
        }}
        onNextLevel={handleNextLevel}
        gameMode={gameMode}
      />
    );
  }

  // Fallback - return an empty view instead of null to maintain consistent rendering
  return <View style={styles.errorContainer} />;
};

/**
 * Component responsible for setting up the main application navigation stack.
 * It defines the different screens available in the authentication and main application flows.
 */
export const Navigation = () => {
  const { isAuthenticated, isLoading, isRiddlesInitializing } = useAuth();

  console.log(
    AppStrings.LogMessages.NAVIGATION_RENDERING,
    isAuthenticated,
    AppStrings.LogMessages.IS_LOADING,
    isLoading,
    "isRiddlesInitializing:",
    isRiddlesInitializing,
    AppStrings.LogMessages.TIMESTAMP,
    new Date().toISOString()
  );

  // Show loading overlay while authentication state is being determined or riddles are being initialized
  if (isLoading || isRiddlesInitializing) {
    console.log(
      AppStrings.LogMessages.SHOWING_LOADING_SPINNER_AUTH,
      "isLoading:",
      isLoading,
      "isRiddlesInitializing:",
      isRiddlesInitializing,
      AppStrings.LogMessages.TIMESTAMP,
      new Date().toISOString()
    );
    return <PulsingSpinner visible={true} size={120} opacity={0.8} />;
  }

  console.log(
    AppStrings.LogMessages.SHOWING_NAVIGATION_STACK,
    isAuthenticated ? "GAME" : "LANDING",
    AppStrings.LogMessages.TIMESTAMP,
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

      <Stack.Screen
        name={AppStrings.Navigation.CREDITS}
        component={CreditsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default Navigation;

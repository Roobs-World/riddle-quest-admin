/**
 * @fileoverview
 * Application navigation stack and game screen wrapper for Qwordly.
 *
 * This module defines the authenticated and unauthenticated navigation flows,
 * wires the `GameScreen` into `AuthContext` state via `GameScreenWrapper`,
 * and centralizes riddle progression behavior for daily and classic
 * modes.
 */
import React, { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import { HINT_COST_COINS, getXpLevel } from "../constants/game";
import {
  LOADING_SPINNER_OPACITY,
  LOADING_SPINNER_OPACITY_OVERLAY,
  LOADING_SPINNER_SIZE,
} from "../constants/loading";
import { useAuth } from "../contexts/AuthContext";
import { AppStrings } from "../constants/AppStrings";
import { View, Text, TouchableOpacity } from "react-native";
import {
  fetchClassicRiddleFromFirestore,
} from "../services/FirestoreService";
import { styles, TYPOGRAPHY, SPACING } from "../styles";
import { scale } from "../utils/responsive";
import { RiddleInitializationService } from "../services/RiddleInitializationService";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { logger } from "../utils/logger";
import { captureException, addBreadcrumb } from "../utils/sentry";
import { analyticsService } from "../services/AnalyticsService";
import { isGuestPlayer } from "../features/auth/sessionBootstrap";

const Stack = createNativeStackNavigator();

/**
 * Wrapper component that connects `GameScreen` to authentication and riddle
 * state from `AuthContext`.
 *
 * It is responsible for:
 * - Ensuring the user is authenticated before rendering gameplay.
 * - Driving level progression across daily and classic modes.
 * - Handling riddle initialization failures and retry flows.
 */
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
    setGameMode,
    fetchCurrentRiddle,
    updatePlayerDataLocally,
  } = useAuth();
  const isGuestMode = isGuestPlayer(playerData);

  const lastFetchedModeRef = useRef<typeof gameMode | null>(null);

  // Effect to load riddle when dependencies change
  useEffect(() => {
    const loadRiddle = async () => {
      if (isAuthenticated && playerData) {
        if (lastFetchedModeRef.current === gameMode && currentRiddle) {
          return;
        }
        await fetchCurrentRiddle(playerData, gameMode);
        lastFetchedModeRef.current = gameMode;
      }
    };

    void loadRiddle();
  }, [
    playerData,
    gameMode,
    currentRiddle,
    isDailyChallengeAvailable,
    setCurrentRiddle,
    fetchCurrentRiddle,
    isAuthenticated,
  ]);

  // Function to check if user completed today's single daily challenge
  const checkDailyChallengeCompletion = async () => {
    if (!playerData || gameMode !== "daily") return false;
    if (isGuestMode) {
      const lastCompletedDate = playerData.lastDailyChallengeCompletedAt
        ? new Date(playerData.lastDailyChallengeCompletedAt)
        : null;
      if (!lastCompletedDate) return false;
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const lastCompletedUtc = new Date(lastCompletedDate);
      lastCompletedUtc.setUTCHours(0, 0, 0, 0);
      return todayUtc.getTime() <= lastCompletedUtc.getTime();
    }

    try {
      const getCurrentDailyChallengeCallable = httpsCallable(
        getFunctions(getApp()),
        "getCurrentDailyChallenge"
      );
      const result = await getCurrentDailyChallengeCallable();
      const data = result.data as { hasCompletedToday: boolean };
      const { hasCompletedToday } = data;
      return hasCompletedToday;
    } catch (error) {
      logger.error("Error checking daily challenge completion:", error);
      captureException(error);
      return false;
    }
  };

  const switchToClassicModeAtCurrentIndex = async () => {
    logger.debug("NavigationStack: switching to classic mode at current index");
    setGameMode("classic");
    await fetchCurrentRiddle(playerData, "classic");
  };

  const handleNextLevel = async () => {
    logger.debug("NavigationStack: handleNextLevel called");

    if (!playerData) {
      logger.warn(
        "NavigationStack: handleNextLevel - No player data available"
      );
      return;
    }

    // For daily challenge mode, switch back to classic after completion
    if (gameMode === "daily") {
      logger.debug(
        "NavigationStack: handleNextLevel - Daily challenge mode detected"
      );
      const isCompleted = await checkDailyChallengeCompletion();
      if (isCompleted) {
        logger.debug("Daily challenge completed. Switching to classic mode.");
        await switchToClassicModeAtCurrentIndex();
        return;
      }
      logger.debug("Daily challenge mode active and not completed yet.");
      await fetchCurrentRiddle(playerData, "daily");
      return;
    }

    // For classic mode, advance to next level
    logger.debug("NavigationStack: handleNextLevel - Classic mode detected");
    const nextClassicIndex = (playerData.progress?.classicIndex || 0) + 1;
    logger.debug(
      `NavigationStack: handleNextLevel - Moving to classic index: ${nextClassicIndex}`
    );

    try {
      logger.debug(
        `NavigationStack: handleNextLevel - Fetching classic riddle with index: ${nextClassicIndex}`
      );
      const nextRiddle = await fetchClassicRiddleFromFirestore(
        nextClassicIndex
      );

      if (nextRiddle) {
        logger.debug(
          "NavigationStack: handleNextLevel - Next riddle fetched successfully:",
          nextRiddle.riddleId
        );
        setCurrentRiddle(nextRiddle);
        if (isGuestMode) {
          updatePlayerDataLocally({
            progress: {
              ...playerData.progress,
              classicIndex: nextClassicIndex,
            },
          });
        }
      } else {
        logger.debug(
          AppStrings.NavigationMessages.NO_CLASSIC_RIDDLE_FOUND +
            nextClassicIndex +
            AppStrings.NavigationMessages.SERVER_GENERATES_RIDDLES
        );
        setCurrentRiddle(null);
      }
    } catch (error) {
      logger.error("Error loading next classic riddle:", error);
      captureException(error);
      setCurrentRiddle(null);
    }
  };

  const handleRetryInitialization = async () => {
    logger.debug("🔄 Retrying riddle initialization...");
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
    logger.debug(
      AppStrings.LogMessages.SHOWING_LOADING_SPINNER_USER_DATA,
      "isLoading:",
      isLoading,
      "isRiddlesInitializing:",
      isRiddlesInitializing,
      AppStrings.LogMessages.TIMESTAMP,
      new Date().toISOString()
    );
    return (
      <PulsingSpinner
        visible={true}
        size={LOADING_SPINNER_SIZE}
        opacity={LOADING_SPINNER_OPACITY}
      />
    );
  }

  // If not authenticated, this should not render (handled by navigation)
  if (!isAuthenticated) {
    return <View style={styles.errorContainer} />;
  }

  // Authenticated but playerData not yet loaded — onAuthStateChanged is still processing
  if (!playerData) {
    return (
      <PulsingSpinner
        visible={true}
        size={LOADING_SPINNER_SIZE}
        opacity={LOADING_SPINNER_OPACITY}
      />
    );
  }

  // Check if riddle initialization failed
  const initStatus = RiddleInitializationService.getInitializationStatus();

  // Show spinner if we don't have a riddle yet and initialization hasn't failed
  if (!currentRiddle && !initStatus.initializationFailed) {
    logger.debug("⏳ No riddle loaded yet, showing spinner...");
    return (
      <PulsingSpinner
        visible={true}
        size={LOADING_SPINNER_SIZE}
        opacity={LOADING_SPINNER_OPACITY}
      />
    );
  }

  // Only show error messages when we truly don't have a riddle AND there's a confirmed problem
  if (!currentRiddle) {
    if (initStatus.initializationFailed) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>
            {AppStrings.ErrorMessages.FAILED_TO_INITIALIZE_RIDDLE_DATABASE}
          </Text>
          <Text style={[styles.errorMessage, { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.sm }]}>
            {AppStrings.ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN}
          </Text>
          <TouchableOpacity
            style={[
              styles.keyButton,
              { marginTop: SPACING.md, paddingHorizontal: scale(30), paddingVertical: scale(12) },
            ]}
            onPress={handleRetryInitialization}
          >
            <Text style={styles.buttonText}>{AppStrings.CommonButtons.RETRY}</Text>
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
              { marginTop: SPACING.md, paddingHorizontal: scale(30), paddingVertical: scale(12) },
            ]}
            onPress={handleRetryInitialization}
          >
            <Text style={styles.buttonText}>{AppStrings.CommonButtons.RETRY}</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  // Modal handlers
  const handleContinueAfterCompletion = async () => {
    await switchToClassicModeAtCurrentIndex();
  };

  // Render GameScreen with all necessary props only when we have current riddle
  if (currentRiddle) {
    return (
      <>
        <GameScreen
          riddleId={currentRiddle.riddleId}
          riddleText={currentRiddle.text}
          answer={currentRiddle.answer}
          answerLength={currentRiddle.answer.length}
          userCoins={playerData.coins || 0}
          hintCost={HINT_COST_COINS}
          onGameWin={async (
            attempts: number,
            coinsEarned: number,
            scoreEarned: number,
            dailyStreakAfterWin?: number
          ) => {
            logger.debug(
              AppStrings.GameMessages.GAME_WON +
                attempts +
                AppStrings.GameMessages.IN_MODE +
                gameMode +
                AppStrings.GameMessages.MODE_SUFFIX
            );
            logger.debug(AppStrings.GameMessages.COINS_EARNED + coinsEarned);
            const newTotalXp = (playerData.stats?.xp ?? playerData.stats?.totalScore ?? 0) + scoreEarned;
            const derivedLevel = getXpLevel(newTotalXp).level;
            const updatedWinStreak =
              gameMode === "daily" && typeof dailyStreakAfterWin === "number"
                ? dailyStreakAfterWin
                : (playerData.stats?.winStreak ?? 0);
            const updatedBestStreak = Math.max(
              playerData.stats?.bestStreak ?? 0,
              updatedWinStreak
            );
            const updatedDailyChallengeIndex =
              gameMode === "daily" && isGuestMode
                ? (playerData.progress?.dailyChallengeIndex ?? 0) + 1
                : (playerData.progress?.dailyChallengeIndex ?? 0);
            const updatedDailyPuzzlesCompleted =
              gameMode === "daily"
                ? (playerData.stats?.dailyPuzzlesCompleted ?? 0) + 1
                : (playerData.stats?.dailyPuzzlesCompleted ?? 0);

            updatePlayerDataLocally({
              coins: (playerData.coins ?? 0) + coinsEarned,
              progress: {
                ...playerData.progress,
                dailyChallengeIndex: updatedDailyChallengeIndex,
              },
              stats: {
                ...playerData.stats,
                xp: newTotalXp,
                level: Math.max(playerData.stats?.level ?? 1, derivedLevel),
                wins: (playerData.stats?.wins ?? 0) + 1,
                totalWins: (playerData.stats?.totalWins ?? 0) + 1,
                winStreak: updatedWinStreak,
                bestStreak: updatedBestStreak,
                dailyPuzzlesCompleted: updatedDailyPuzzlesCompleted,
              },
              lastDailyChallengeCompletedAt:
                gameMode === "daily" ? Date.now() : playerData.lastDailyChallengeCompletedAt,
            });

            // Check if user completed today's daily challenge
            if (gameMode === "daily") {
              if (isGuestMode) {
                await handleContinueAfterCompletion();
                return;
              }
              const isCompleted = await checkDailyChallengeCompletion();
              if (isCompleted) {
                await handleContinueAfterCompletion();
              }
            }
          }}
          onGameLoss={(correctAnswer: string) => {
            logger.debug(AppStrings.GameMessages.GAME_LOST + correctAnswer);
          }}
          onHintUsed={async (cost: number) => {
            logger.debug(AppStrings.GameMessages.HINT_USED + cost);
            if (cost > 0) {
              updatePlayerDataLocally({ coins: Math.max(0, (playerData.coins ?? 0) - cost) });
            }
          }}
          onSkipUsed={(cost: number) => {
            if (cost > 0) {
              updatePlayerDataLocally({ coins: Math.max(0, (playerData.coins ?? 0) - cost) });
            }
          }}
          onNextLevel={handleNextLevel}
          gameMode={gameMode}
        />

      </>
    );
  }

  // Fallback - return an empty view instead of null to maintain consistent rendering
  return <View style={styles.errorContainer} />;
};

/**
 * Root navigation component that declares the main authentication and app
 * stacks for Qwordly.
 *
 * It routes between landing/auth flows and the main `GameScreenWrapper`
 * based on the authentication state exposed by `AuthContext` and shows
 * loading overlays while auth or riddle initialization are in progress.
 */
export const Navigation = () => {
  const { isAuthenticated, isLoading } = useAuth();

  logger.debug(
    AppStrings.LogMessages.NAVIGATION_RENDERING,
    isAuthenticated,
    AppStrings.LogMessages.IS_LOADING,
    isLoading,
    AppStrings.LogMessages.TIMESTAMP,
    new Date().toISOString()
  );

  // Show loading overlay only while the initial authentication state is being determined.
  // isRiddlesInitializing is intentionally excluded — GameScreenWrapper handles that
  // spinner internally, so we never unmount the Stack.Navigator mid-flow (which would
  // reset the navigation stack back to Landing).
  if (isLoading) {
    logger.debug(
      AppStrings.LogMessages.SHOWING_LOADING_SPINNER_AUTH,
      "isLoading:",
      isLoading,
      AppStrings.LogMessages.TIMESTAMP,
      new Date().toISOString()
    );
    return (
      <PulsingSpinner
        visible={true}
        size={LOADING_SPINNER_SIZE}
        opacity={LOADING_SPINNER_OPACITY_OVERLAY}
      />
    );
  }

  logger.debug(
    AppStrings.LogMessages.SHOWING_NAVIGATION_STACK,
    isAuthenticated ? "GAME" : "LANDING",
    AppStrings.LogMessages.TIMESTAMP,
    new Date().toISOString()
  );

  // Use React Navigation's auth-conditioned stack pattern.
  // When isAuthenticated changes the correct screen is shown automatically —
  // no explicit navigation.navigate() calls are needed after sign-in or sign-out.
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      screenListeners={{
        focus: (e) => {
          const screenName = e.target?.split("-")[0] ?? "Unknown";
          addBreadcrumb("navigation", `Screen focused: ${screenName}`, { screen: screenName });
          void analyticsService.logScreenView(screenName);
        },
      }}
    >
      {isAuthenticated ? (
        <Stack.Screen
          name={AppStrings.Navigation.GAME}
          component={GameScreenWrapper}
        />
      ) : (
        <>
          <Stack.Screen
            name={AppStrings.Navigation.LANDING}
            component={LandingScreen}
          />
          <Stack.Screen
            name={AppStrings.Navigation.LOGIN}
            component={LoginScreen}
          />
          <Stack.Screen
            name={AppStrings.Navigation.FORGOT_PASSWORD}
            component={ForgotPasswordScreen}
          />
          <Stack.Screen
            name={AppStrings.Navigation.NEW_PASSWORD}
            component={NewPasswordScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default Navigation;

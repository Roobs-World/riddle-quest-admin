/**
 * @fileoverview
 * Application navigation stack and game screen wrapper for Riddle Quest.
 *
 * This module defines the authenticated and unauthenticated navigation flows,
 * wires the `GameScreen` into `AuthContext` state via `GameScreenWrapper`,
 * and centralizes riddle progression behavior for daily and classic
 * modes.
 */
import React, {useEffect, useRef} from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import {HINT_COST_COINS, getXpLevel} from "../constants/game";
import {LOADING_SPINNER_OPACITY, LOADING_SPINNER_OPACITY_OVERLAY, LOADING_SPINNER_SIZE} from "../constants/loading";
import {useAuth} from "../contexts/AuthContext";
import {AppStrings} from "../constants/AppStrings";
import {View, Text, TouchableOpacity} from "react-native";
import {styles, TYPOGRAPHY, SPACING} from "../styles";
import {scale} from "../utils/responsive";
import {RiddleInitializationService} from "../services/RiddleInitializationService";
import {logger} from "../utils/logger";
import {captureException, addBreadcrumb} from "../utils/sentry";
import {analyticsService} from "../services/AnalyticsService";
import {isGuestPlayer} from "../features/auth/sessionBootstrap";
import {loadUserProgressFromFirestore} from "../services/FirestoreService";
import {Player} from "../validation/firestoreSchemas";
import {callValidatedFunction} from "../utils/firebaseFunctions";
import {CurrentDailyChallengeOutputSchema, EmptyInputSchema} from "../validation/cloudFunctionsSchemas";

const GUEST_CLASSIC_START_INDEX = 1;

const toNonNegativeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
};

const roundToTwo = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const useIsAuthenticatedNavigationGroup = (): boolean => useAuth().isAuthenticated;
const useIsUnauthenticatedNavigationGroup = (): boolean => !useAuth().isAuthenticated;

const screenListeners = {
  focus: (e: {target?: string}) => {
    const screenName = e.target?.split("-")[0] ?? "Unknown";
    addBreadcrumb("navigation", `Screen focused: ${screenName}`, {screen: screenName});
    void analyticsService.logScreenView(screenName);
  },
};

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
    updatePlayerData,
    updatePlayerDataLocally,
    updatePlayerClassicIndex,
  } = useAuth();
  const isGuestMode = isGuestPlayer(playerData);
  const isDailyChallengeMode = gameMode === "daily" || gameMode === "challenge";

  const lastFetchedModeRef = useRef<typeof gameMode | null>(null);
  const onboardingUserIdRef = useRef<string | null>(null);
  const suppressOnboardingRef = useRef(false);

  useEffect(() => {
    const userId = playerData?.userId ?? null;
    if (onboardingUserIdRef.current !== userId) {
      onboardingUserIdRef.current = userId;
      suppressOnboardingRef.current = false;
    }
  }, [playerData?.userId]);

  useEffect(() => {
    if (!playerData || !currentRiddle) {
      return;
    }

    // Show onboarding/welcome once per signed-in session. Subsequent GameScreen
    // remounts (for example, after completing a riddle) should suppress it.
    suppressOnboardingRef.current = true;
  }, [playerData, currentRiddle]);

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
    if (!playerData || !isDailyChallengeMode) return false;
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
      const data = await callValidatedFunction(
        "getCurrentDailyChallenge",
        {},
        EmptyInputSchema,
        CurrentDailyChallengeOutputSchema,
      );
      return data.hasCompletedToday === true;
    } catch (error) {
      logger.error("Error checking daily challenge completion:", error);
      captureException(error);
      return false;
    }
  };

  const switchToClassicModeAtCurrentIndex = async (playerSnapshot?: typeof playerData) => {
    logger.debug("NavigationStack: switching to classic mode");
    const sourcePlayer = playerSnapshot ?? playerData;
    if (!sourcePlayer) {
      logger.warn("NavigationStack: unable to switch to classic mode because player data is missing");
      return;
    }

    const sourceIsGuest = isGuestPlayer(sourcePlayer);
    let nextPlayerForClassic = sourcePlayer;

    if (!sourceIsGuest && sourcePlayer.userId) {
      try {
        const latestServerPlayer = await loadUserProgressFromFirestore(sourcePlayer.userId);
        if (latestServerPlayer) {
          nextPlayerForClassic = latestServerPlayer;
        }
      } catch (error) {
        logger.warn("NavigationStack: failed to refresh classic index from Firestore before switching mode.", error);
      }
    } else {
      nextPlayerForClassic = {
        ...sourcePlayer,
        progress: {
          ...sourcePlayer.progress,
          classicIndex: sourcePlayer.progress?.classicIndex ?? GUEST_CLASSIC_START_INDEX,
        },
      };
    }

    setCurrentRiddle(null);
    setGameMode("classic");
    await fetchCurrentRiddle(nextPlayerForClassic, "classic");
  };

  const persistPlayerUpdate = async (updates: Parameters<typeof updatePlayerData>[0]) => {
    if (isGuestMode) {
      updatePlayerDataLocally(updates);
      return;
    }
    await updatePlayerData(updates);
  };

  const buildPostGameStatsUpdate = (
    basePlayer: Player,
    options: {
      attempts: number;
      scoreEarned: number;
      won: boolean;
      resolvedDailyStreak?: number;
    },
  ): Player["stats"] => {
    const previousStats = basePlayer.stats;
    const attempts = Math.max(0, Math.floor(options.attempts));
    const previousTotalWins = toNonNegativeNumber(previousStats?.totalWins);
    const previousGamesPlayed = toNonNegativeNumber(previousStats?.gamesPlayed);
    const previousTotalGuessesInWins = toNonNegativeNumber(previousStats?.totalGuessesInWins);
    const nextTotalWins = previousTotalWins + (options.won ? 1 : 0);
    const nextGamesPlayed = previousGamesPlayed + 1;
    const nextTotalGuessesInWins = previousTotalGuessesInWins + (options.won ? attempts : 0);
    const nextXp =
      toNonNegativeNumber(previousStats?.xp ?? previousStats?.totalScore) + Math.max(0, options.scoreEarned);
    const combinedWinStreakFromStats = toNonNegativeNumber(
      (previousStats as {combinedWinStreak?: unknown} | undefined)?.combinedWinStreak,
      -1,
    );
    const previousCombinedWinStreak =
      combinedWinStreakFromStats >= 0 ? combinedWinStreakFromStats : toNonNegativeNumber(previousStats?.winStreak);
    const nextCombinedWinStreak = options.won ? previousCombinedWinStreak + 1 : 0;

    const nextWinStreak = isDailyChallengeMode
      ? options.won
        ? toNonNegativeNumber(options.resolvedDailyStreak, toNonNegativeNumber(previousStats?.winStreak) + 1)
        : toNonNegativeNumber(previousStats?.winStreak)
      : toNonNegativeNumber(previousStats?.winStreak);

    return {
      ...previousStats,
      xp: nextXp,
      totalScore: nextXp,
      level: Math.max(toNonNegativeNumber(previousStats?.level, 1), getXpLevel(nextXp).level),
      gamesPlayed: nextGamesPlayed,
      totalWordsGuessed: toNonNegativeNumber(previousStats?.totalWordsGuessed) + attempts,
      wins: toNonNegativeNumber(previousStats?.wins) + (options.won ? 1 : 0),
      totalWins: nextTotalWins,
      totalGuessesInWins: nextTotalGuessesInWins,
      averageGuesses: nextTotalWins > 0 ? roundToTwo(nextTotalGuessesInWins / nextTotalWins) : 0,
      winRate: nextGamesPlayed > 0 ? roundToTwo((nextTotalWins / nextGamesPlayed) * 100) : 0,
      challengeWins: isDailyChallengeMode
        ? toNonNegativeNumber(previousStats?.challengeWins) + (options.won ? 1 : 0)
        : toNonNegativeNumber(previousStats?.challengeWins),
      dailyPuzzlesCompleted: isDailyChallengeMode
        ? toNonNegativeNumber(previousStats?.dailyPuzzlesCompleted) + 1
        : toNonNegativeNumber(previousStats?.dailyPuzzlesCompleted),
      winStreak: nextWinStreak,
      bestStreak: Math.max(toNonNegativeNumber(previousStats?.bestStreak), nextCombinedWinStreak),
      ...({
        combinedWinStreak: nextCombinedWinStreak,
      } as Record<string, number>),
      highestLevelClassic:
        gameMode === "classic" && options.won
          ? Math.max(
              toNonNegativeNumber(previousStats?.highestLevelClassic),
              toNonNegativeNumber(basePlayer.progress?.classicIndex),
            )
          : toNonNegativeNumber(previousStats?.highestLevelClassic),
    };
  };

  const persistAuthenticatedBonusCoins = async (bonusCoins: number) => {
    if (!playerData || isGuestMode || bonusCoins <= 0) {
      return;
    }

    try {
      const latestServerPlayer = await loadUserProgressFromFirestore(playerData.userId);
      const serverCoins = toNonNegativeNumber(latestServerPlayer?.coins, toNonNegativeNumber(playerData.coins));
      await updatePlayerData({coins: serverCoins + bonusCoins});
    } catch (error) {
      logger.error("Failed to persist authenticated bonus coins:", error);
      captureException(error);
    }
  };

  const handleNextLevel = async () => {
    logger.debug("NavigationStack: handleNextLevel called");

    if (!playerData) {
      logger.warn("NavigationStack: handleNextLevel - No player data available");
      return;
    }

    // For daily challenge mode, switch back to classic after completion
    if (isDailyChallengeMode) {
      logger.debug("NavigationStack: handleNextLevel - Daily challenge mode detected");
      if (isGuestMode) {
        logger.debug("NavigationStack: guest daily flow, forcing transition to classic mode.");
        await switchToClassicModeAtCurrentIndex(playerData);
        return;
      }
      const isCompleted = await checkDailyChallengeCompletion();
      if (isCompleted) {
        logger.debug("Daily challenge completed. Switching to classic mode.");
        await switchToClassicModeAtCurrentIndex();
        return;
      }
      logger.debug("Daily challenge mode active and not completed yet.");
      await fetchCurrentRiddle(playerData, gameMode);
      return;
    }

    // For classic mode, advance to next level
    logger.debug("NavigationStack: handleNextLevel - Classic mode detected");
    let resolvedClassicIndex = toNonNegativeNumber(playerData.progress?.classicIndex);
    if (!isGuestMode && playerData.userId) {
      try {
        const latestServerPlayer = await loadUserProgressFromFirestore(playerData.userId);
        resolvedClassicIndex = toNonNegativeNumber(latestServerPlayer?.progress?.classicIndex, resolvedClassicIndex);
      } catch (error) {
        logger.warn("NavigationStack: failed to refresh classic index from Firestore before advancing level.", error);
      }
    }
    const nextClassicIndex = resolvedClassicIndex + 1;
    logger.debug(`NavigationStack: handleNextLevel - Moving to classic index: ${nextClassicIndex}`);

    try {
      // Clear the currently rendered riddle before fetching the next one so
      // GameScreenWrapper immediately switches to its loading spinner.
      setCurrentRiddle(null);
      await updatePlayerClassicIndex(nextClassicIndex);
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
      new Date().toISOString(),
    );
    return <PulsingSpinner visible={true} size={LOADING_SPINNER_SIZE} opacity={LOADING_SPINNER_OPACITY} />;
  }

  // If not authenticated, this should not render (handled by navigation)
  if (!isAuthenticated) {
    return <View style={styles.errorContainer} />;
  }

  // Authenticated but playerData not yet loaded — onAuthStateChanged is still processing
  if (!playerData) {
    return <PulsingSpinner visible={true} size={LOADING_SPINNER_SIZE} opacity={LOADING_SPINNER_OPACITY} />;
  }

  // Check if riddle initialization failed
  const initStatus = RiddleInitializationService.getInitializationStatus();

  // Show spinner if we don't have a riddle yet and initialization hasn't failed
  if (!currentRiddle && !initStatus.initializationFailed) {
    logger.debug("⏳ No riddle loaded yet, showing spinner...");
    return <PulsingSpinner visible={true} size={LOADING_SPINNER_SIZE} opacity={LOADING_SPINNER_OPACITY} />;
  }

  // Only show error messages when we truly don't have a riddle AND there's a confirmed problem
  if (!currentRiddle) {
    if (initStatus.initializationFailed) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{AppStrings.ErrorMessages.FAILED_TO_INITIALIZE_RIDDLE_DATABASE}</Text>
          <Text style={[styles.errorMessage, {fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.sm}]}>
            {AppStrings.ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN}
          </Text>
          <TouchableOpacity
            style={[
              styles.keyButton,
              {marginTop: SPACING.md, paddingHorizontal: scale(30), paddingVertical: scale(12)},
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
          <Text style={styles.errorMessage}>{AppStrings.ErrorMessages.UNABLE_TO_LOAD_RIDDLES}</Text>
          <TouchableOpacity
            style={[
              styles.keyButton,
              {marginTop: SPACING.md, paddingHorizontal: scale(30), paddingVertical: scale(12)},
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
  const handleContinueAfterCompletion = async (playerSnapshot?: typeof playerData) => {
    await switchToClassicModeAtCurrentIndex(playerSnapshot);
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
            dailyStreakAfterWin?: number,
            bonusCoinsAwarded: number = 0,
          ) => {
            if (!playerData) {
              return;
            }

            logger.debug(
              AppStrings.GameMessages.GAME_WON +
                attempts +
                AppStrings.GameMessages.IN_MODE +
                gameMode +
                AppStrings.GameMessages.MODE_SUFFIX,
            );
            logger.debug(AppStrings.GameMessages.COINS_EARNED + coinsEarned);

            const resolvedDailyStreak = isDailyChallengeMode
              ? toNonNegativeNumber(dailyStreakAfterWin, toNonNegativeNumber(playerData.stats?.winStreak) + 1)
              : undefined;

            const nextStats = buildPostGameStatsUpdate(playerData, {
              attempts,
              scoreEarned,
              won: true,
              resolvedDailyStreak,
            });

            const nextLocalCoins =
              toNonNegativeNumber(playerData.coins) + Math.max(0, coinsEarned) + Math.max(0, bonusCoinsAwarded);

            const baseProgress = {
              ...playerData.progress,
              classicIndex: toNonNegativeNumber(playerData.progress?.classicIndex, GUEST_CLASSIC_START_INDEX),
              dailyChallengeIndex: toNonNegativeNumber(playerData.progress?.dailyChallengeIndex),
            };

            const nextProgress =
              isDailyChallengeMode && isGuestMode
                ? {
                    ...baseProgress,
                    dailyChallengeIndex: baseProgress.dailyChallengeIndex + 1,
                  }
                : baseProgress;

            const nextPlayerSnapshot: Player = {
              ...playerData,
              coins: nextLocalCoins,
              progress: nextProgress,
              stats: nextStats,
              lastDailyChallengeCompletedAt: isDailyChallengeMode
                ? Date.now()
                : playerData.lastDailyChallengeCompletedAt,
            };

            if (isGuestMode) {
              await persistPlayerUpdate({
                coins: nextPlayerSnapshot.coins,
                progress: nextPlayerSnapshot.progress,
                stats: nextPlayerSnapshot.stats,
                lastDailyChallengeCompletedAt: nextPlayerSnapshot.lastDailyChallengeCompletedAt,
              });
            } else {
              updatePlayerDataLocally(
                {
                  coins: nextPlayerSnapshot.coins,
                  stats: nextPlayerSnapshot.stats,
                  lastDailyChallengeCompletedAt: nextPlayerSnapshot.lastDailyChallengeCompletedAt,
                },
                {syncToFirestore: false},
              );
              await persistPlayerUpdate({
                stats: nextPlayerSnapshot.stats,
                lastDailyChallengeCompletedAt: nextPlayerSnapshot.lastDailyChallengeCompletedAt,
              });
              await persistAuthenticatedBonusCoins(Math.max(0, bonusCoinsAwarded));
            }

            // Check if user completed today's daily challenge
            if (isDailyChallengeMode) {
              if (isGuestMode) {
                await handleContinueAfterCompletion(nextPlayerSnapshot);
                return;
              }
              const isCompleted = await checkDailyChallengeCompletion();
              if (isCompleted) {
                await handleContinueAfterCompletion(nextPlayerSnapshot);
              }
            }
          }}
          onGameLoss={(correctAnswer: string, attempts: number) => {
            if (!playerData) {
              return;
            }
            logger.debug(AppStrings.GameMessages.GAME_LOST + correctAnswer);

            const nextStats = buildPostGameStatsUpdate(playerData, {
              attempts,
              scoreEarned: 0,
              won: false,
            });

            if (isGuestMode) {
              void persistPlayerUpdate({
                stats: nextStats,
              });
            } else {
              updatePlayerDataLocally(
                {
                  stats: nextStats,
                },
                {syncToFirestore: false},
              );
              void persistPlayerUpdate({
                stats: nextStats,
              });
            }
          }}
          onHintUsed={async (cost: number) => {
            if (!playerData) {
              return [];
            }

            logger.debug(AppStrings.GameMessages.HINT_USED + cost);
            if (cost > 0) {
              const nextUnlockedAchievements = [...(playerData.unlockedAchievements ?? [])];
              const newlyUnlockedAchievementIds: string[] = [];
              const nextStats: Player["stats"] = {
                ...playerData.stats,
                totalHintsUsed: toNonNegativeNumber(playerData.stats?.totalHintsUsed) + 1,
              };

              const hasHintUserAchievement = nextUnlockedAchievements.some(
                (achievement) => achievement.achievementId === "hint_user",
              );
              if (!hasHintUserAchievement && nextStats.totalHintsUsed >= 1) {
                nextUnlockedAchievements.push({
                  achievementId: "hint_user",
                  unlockedAt: Date.now(),
                });
                newlyUnlockedAchievementIds.push("hint_user");
              }

              await persistPlayerUpdate({
                coins: Math.max(0, toNonNegativeNumber(playerData.coins) - cost),
                stats: nextStats,
                unlockedAchievements: nextUnlockedAchievements,
              });
              return newlyUnlockedAchievementIds;
            }
            return [];
          }}
          onSkipUsed={(cost: number) => {
            if (cost > 0) {
              void persistPlayerUpdate({
                coins: Math.max(0, (playerData.coins ?? 0) - cost),
              });
            }
          }}
          onNextLevel={handleNextLevel}
          gameMode={gameMode}
          // eslint-disable-next-line react-hooks/refs
          suppressOnboarding={suppressOnboardingRef.current}
        />
      </>
    );
  }

  // Fallback - return an empty view instead of null to maintain consistent rendering
  return <View style={styles.errorContainer} />;
};

const RootStack = createNativeStackNavigator({
  screenOptions: {headerShown: false},
  screenListeners,
  groups: {
    App: {
      if: useIsAuthenticatedNavigationGroup,
      screens: {
        [AppStrings.Navigation.GAME]: GameScreenWrapper,
      },
    },
    Auth: {
      if: useIsUnauthenticatedNavigationGroup,
      screens: {
        [AppStrings.Navigation.LANDING]: LandingScreen,
        [AppStrings.Navigation.LOGIN]: LoginScreen,
        [AppStrings.Navigation.SIGN_UP]: SignUpScreen,
        [AppStrings.Navigation.FORGOT_PASSWORD]: ForgotPasswordScreen,
        [AppStrings.Navigation.NEW_PASSWORD]: NewPasswordScreen,
      },
    },
  },
});

const StaticRootStack = RootStack.getComponent();

/**
 * Root navigation component that declares the main authentication and app
 * stacks for Riddle Quest.
 *
 * It routes between landing/auth flows and the main `GameScreenWrapper`
 * based on the authentication state exposed by `AuthContext` and shows
 * loading overlays while auth or riddle initialization are in progress.
 */
export const Navigation = () => {
  const {isAuthenticated, isLoading} = useAuth();

  logger.debug(
    AppStrings.LogMessages.NAVIGATION_RENDERING,
    isAuthenticated,
    AppStrings.LogMessages.IS_LOADING,
    isLoading,
    AppStrings.LogMessages.TIMESTAMP,
    new Date().toISOString(),
  );

  // Show loading overlay only while the initial authentication state is being determined.
  // isRiddlesInitializing is intentionally excluded — GameScreenWrapper handles that
  // spinner internally, so we never unmount the static root stack mid-flow (which would
  // reset the navigation stack back to Landing).
  if (isLoading) {
    logger.debug(
      AppStrings.LogMessages.SHOWING_LOADING_SPINNER_AUTH,
      "isLoading:",
      isLoading,
      AppStrings.LogMessages.TIMESTAMP,
      new Date().toISOString(),
    );
    return <PulsingSpinner visible={true} size={LOADING_SPINNER_SIZE} opacity={LOADING_SPINNER_OPACITY_OVERLAY} />;
  }

  logger.debug(
    AppStrings.LogMessages.SHOWING_NAVIGATION_STACK,
    isAuthenticated ? "GAME" : "LANDING",
    AppStrings.LogMessages.TIMESTAMP,
    new Date().toISOString(),
  );

  // Use React Navigation's static auth-conditioned group pattern.
  // When isAuthenticated changes the correct screen is shown automatically —
  // no explicit navigation.navigate() calls are needed after sign-in or sign-out.
  return <StaticRootStack />;
};

export default Navigation;

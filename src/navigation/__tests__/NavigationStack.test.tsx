import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { Navigation } from "../NavigationStack";
import { useAuth } from "../../contexts/AuthContext";
import { RiddleInitializationService } from "../../services/RiddleInitializationService";
import { captureException } from "../../utils/sentry";
import { analyticsService } from "../../services/AnalyticsService";
import { logger } from "../../utils/logger";

let mockDailyCallable = jest.fn();

jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => mockDailyCallable),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../services/RiddleInitializationService", () => ({
  RiddleInitializationService: {
    resetInitializationFlags: jest.fn(),
    checkAndInitializeRiddles: jest.fn().mockResolvedValue(undefined),
    getInitializationStatus: jest.fn(() => ({ initializationFailed: false })),
  },
}));

jest.mock("../../services/AnalyticsService", () => ({
  analyticsService: {
    logScreenView: jest.fn().mockResolvedValue(undefined),
    logShare: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../utils/sentry", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../constants/game", () => ({
  HINT_COST_COINS: 25,
  getXpLevel: jest.fn(() => ({ level: 2 })),
}));

jest.mock("../../screens/LandingScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockLandingScreen() {
    return <View testID="landing-screen" />;
  };
});

jest.mock("../../screens/auth/LoginScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockLoginScreen() {
    return <View testID="login-screen" />;
  };
});

jest.mock("../../screens/auth/ForgotPasswordScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockForgotPasswordScreen() {
    return <View testID="forgot-password-screen" />;
  };
});

jest.mock("../../screens/auth/NewPasswordScreen", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockNewPasswordScreen() {
    return <View testID="new-password-screen" />;
  };
});

let latestGameScreenProps: any = null;
jest.mock("../../screens/game/GameScreen", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return function MockGameScreen(props: any) {
    latestGameScreenProps = props;
    return (
      <View testID="game-screen">
        <Pressable testID="trigger-next-level" onPress={() => props.onNextLevel?.()}>
          <Text>Next</Text>
        </Pressable>
        <Pressable
          testID="trigger-win"
          onPress={() => props.onGameWin?.(3, 20, 15)}
        >
          <Text>Win</Text>
        </Pressable>
        <Pressable
          testID="trigger-hint"
          onPress={() => props.onHintUsed?.(5)}
        >
          <Text>Hint</Text>
        </Pressable>
        <Pressable
          testID="trigger-skip"
          onPress={() => props.onSkipUsed?.(7)}
        >
          <Text>Skip</Text>
        </Pressable>
        <Pressable
          testID="trigger-loss"
          onPress={() => props.onGameLoss?.("ANSWER", 2)}
        >
          <Text>Loss</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock("../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockPulsingSpinner() {
    return <View testID="pulsing-spinner" />;
  };
});

jest.mock("../../components/modals", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    VictoryModal: ({ isVisible, onNextLevel, onClose }: any) =>
      isVisible ? (
        <View testID="victory-modal">
          <Pressable testID="victory-next" onPress={onNextLevel}>
            <Text>Continue</Text>
          </Pressable>
          <Pressable testID="victory-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => {
    const React = require("react");
    const { View } = require("react-native");

    const renderScreens = (nodes: any): any[] =>
      React.Children.toArray(nodes).flatMap((child: any) => {
        if (!React.isValidElement(child)) return [];
        if (child.type === React.Fragment) {
          return renderScreens(child.props?.children);
        }
        return [child];
      });

    return {
      Navigator: ({ children, screenListeners }: any) => {
        const screens = renderScreens(children);

        React.useEffect(() => {
          const firstName = String(screens?.[0]?.props?.name ?? "Unknown");
          screenListeners?.focus?.({ target: `${firstName}-1` });
        }, [screenListeners, screens]);

        return (
          <View testID="stack-navigator">
            {screens.map((screen: any) => {
              const Component = screen.props.component;
              const key = String(screen.props.name);
              const slug = key.toLowerCase().replace(/[^a-z0-9]/g, "");
              return (
                <View key={key} testID={`stack-screen-${slug}`}>
                  <Component />
                </View>
              );
            })}
          </View>
        );
      },
      Screen: ({ name, component, options }: any) =>
        React.createElement("mock-screen", { name, component, options }),
    };
  },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedRiddleInitService = RiddleInitializationService as jest.Mocked<
  typeof RiddleInitializationService
>;
const mockedCaptureException = captureException as jest.MockedFunction<
  typeof captureException
>;
const mockedAnalytics = analyticsService as jest.Mocked<typeof analyticsService>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const createAuthState = (overrides: Partial<any> = {}) => ({
  isAuthenticated: false,
  isLoading: false,
  isRiddlesInitializing: false,
  playerData: null,
  currentRiddle: null,
  gameMode: "daily",
  isDailyChallengeAvailable: true,
  login: jest.fn(),
  logout: jest.fn(),
  updatePlayerClassicIndex: jest.fn(),
  updatePlayerData: jest.fn(),
  updatePlayerDataLocally: jest.fn(),
  setGameMode: jest.fn(),
  setCurrentRiddle: jest.fn(),
  fetchCurrentRiddle: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("NavigationStack", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestGameScreenProps = null;
    mockDailyCallable = jest
      .fn()
      .mockResolvedValue({ data: { hasCompletedToday: false } });
    mockedRiddleInitService.getInitializationStatus.mockReturnValue({
      isInitializing: false,
      hasInitialized: true,
      initializationFailed: false,
    });
  });

  it("shows loading overlay while auth state is loading", () => {
    mockedUseAuth.mockReturnValue(createAuthState({ isLoading: true }) as any);
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId("pulsing-spinner")).toBeTruthy();
  });

  it("renders unauthenticated stack screens", () => {
    mockedUseAuth.mockReturnValue(createAuthState() as any);
    const { getByTestId, queryByTestId } = render(<Navigation />);

    expect(getByTestId("stack-screen-landing")).toBeTruthy();
    expect(getByTestId("stack-screen-login")).toBeTruthy();
    expect(getByTestId("stack-screen-forgotpassword")).toBeTruthy();
    expect(getByTestId("stack-screen-newpassword")).toBeTruthy();
    expect(queryByTestId("stack-screen-game")).toBeNull();
  });

  it("renders authenticated game flow and fetches riddle on mount", async () => {
    const playerData = { userId: "u1", coins: 100, stats: { level: 1, xp: 0 } };
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        playerData,
        currentRiddle: { riddleId: "r1", text: "R", answer: "WORD" },
        gameMode: "classic",
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    expect(getByTestId("stack-screen-game")).toBeTruthy();
    expect(getByTestId("game-screen")).toBeTruthy();

    await waitFor(() =>
      expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "classic")
    );
    expect(mockedAnalytics.logScreenView).toHaveBeenCalled();
  });

  it("suppresses onboarding on remount after first game screen mount in-session", () => {
    let authState = createAuthState({
      isAuthenticated: true,
      playerData: { userId: "u-onboarding", coins: 100, stats: { level: 1, xp: 0 } },
      currentRiddle: { riddleId: "r1", text: "R1", answer: "WORD" },
      gameMode: "classic",
    });
    mockedUseAuth.mockImplementation(() => authState as any);

    const { rerender } = render(<Navigation />);
    expect(latestGameScreenProps?.suppressOnboarding).toBe(false);

    authState = createAuthState({
      ...authState,
      currentRiddle: null,
    });
    rerender(<Navigation />);

    authState = createAuthState({
      ...authState,
      currentRiddle: { riddleId: "r2", text: "R2", answer: "WORDS" },
    });
    rerender(<Navigation />);

    expect(latestGameScreenProps?.suppressOnboarding).toBe(true);
  });

  it("shows spinner in wrapper when authenticated but player data is missing", () => {
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        playerData: null,
        currentRiddle: null,
      }) as any
    );
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId("pulsing-spinner")).toBeTruthy();
  });

  it("shows wrapper loading spinner when riddles are initializing", () => {
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        isRiddlesInitializing: true,
        playerData: { userId: "u-init", stats: { level: 1, xp: 0 } },
      }) as any
    );
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId("pulsing-spinner")).toBeTruthy();
  });

  it("shows initialization error and retries when retry is pressed", async () => {
    const playerData = { userId: "u2", coins: 10, stats: { level: 1, xp: 0 } };
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedRiddleInitService.getInitializationStatus.mockReturnValue({
      isInitializing: false,
      hasInitialized: false,
      initializationFailed: true,
    });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        playerData,
        currentRiddle: null,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByText } = render(<Navigation />);
    fireEvent.press(getByText("Retry"));

    await waitFor(() =>
      expect(mockedRiddleInitService.resetInitializationFlags).toHaveBeenCalled()
    );
    expect(mockedRiddleInitService.checkAndInitializeRiddles).toHaveBeenCalled();
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily");
  });

  it("shows spinner when no riddle exists and initialization has not failed", () => {
    mockedRiddleInitService.getInitializationStatus.mockReturnValue({
      isInitializing: false,
      hasInitialized: false,
      initializationFailed: false,
    });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        playerData: { userId: "u3", stats: { level: 1, xp: 0 } },
        currentRiddle: null,
      }) as any
    );
    const { getByTestId } = render(<Navigation />);
    expect(getByTestId("pulsing-spinner")).toBeTruthy();
  });

  it("handles next level in daily mode when challenge completed", async () => {
    const playerData = { userId: "u4", progress: {}, coins: 30, stats: { xp: 0, level: 1 } };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockDailyCallable.mockResolvedValue({ data: { hasCompletedToday: true } });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "r2", text: "R", answer: "WORD" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("classic"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "classic");
  });

  it("handles next level in daily mode when challenge is not completed", async () => {
    const playerData = { userId: "u4b", progress: {}, coins: 30, stats: { xp: 0, level: 1 } };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockDailyCallable.mockResolvedValue({ data: { hasCompletedToday: false } });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "r2", text: "R", answer: "WORD" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily"));
    expect(setGameMode).not.toHaveBeenCalledWith("classic");
  });

  // Notification-driven deep link navigation is handled elsewhere; the previous
  // test depended on a removed `useNotificationNavigation` hook.

  it("does not switch to classic from local completion state for provider users when remote says not completed", async () => {
    const playerData = {
      userId: "u4b-local",
      progress: {},
      coins: 30,
      stats: { xp: 0, level: 1 },
      lastDailyChallengeCompletedAt: Date.now(),
    };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockDailyCallable.mockResolvedValue({ data: { hasCompletedToday: false } });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "r2", text: "R", answer: "WORD" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily"));
    expect(setGameMode).not.toHaveBeenCalledWith("classic");
    expect(mockDailyCallable).toHaveBeenCalled();
  });

  it("falls back safely when checking daily completion throws", async () => {
    const playerData = { userId: "u4c", progress: {}, coins: 30, stats: { xp: 0, level: 1 } };
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockDailyCallable.mockRejectedValue(new Error("daily-call-failed"));
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "r2", text: "R", answer: "WORD" },
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(mockedCaptureException).toHaveBeenCalled());
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily");
  });

  it("handles next level in classic mode with a next riddle", async () => {
    const playerData = {
      userId: "u6a",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const updatePlayerClassicIndex = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        updatePlayerClassicIndex,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(updatePlayerClassicIndex).toHaveBeenCalledWith(3));
  });

  it("sets current riddle to null when classic progression update fails", async () => {
    const playerData = {
      userId: "u6b",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    const updatePlayerClassicIndex = jest
      .fn()
      .mockRejectedValue(new Error("classic-progression-failed"));
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        setCurrentRiddle,
        updatePlayerClassicIndex,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(updatePlayerClassicIndex).toHaveBeenCalledWith(3));
    expect(setCurrentRiddle).toHaveBeenCalledWith(null);
  });

  it("handles next level in classic mode and captures update errors", async () => {
    const playerData = {
      userId: "u6",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    const updatePlayerClassicIndex = jest
      .fn()
      .mockRejectedValue(new Error("classic-failure"));
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        setCurrentRiddle,
        updatePlayerClassicIndex,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(updatePlayerClassicIndex).toHaveBeenCalledWith(3));
    expect(setCurrentRiddle).toHaveBeenCalledWith(null);
    expect(mockedCaptureException).toHaveBeenCalled();
  });

  it("handles hint/skip deductions and auto-switches to classic after daily win completion", async () => {
    const playerData = {
      userId: "u7",
      progress: {},
      coins: 100,
      stats: { xp: 10, totalScore: 10, level: 1, wins: 0, totalWins: 0 },
    };
    const updatePlayerDataLocally = jest.fn();
    const updatePlayerData = jest.fn().mockResolvedValue(undefined);
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockDailyCallable.mockResolvedValue({ data: { hasCompletedToday: true } });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "daily-1", text: "D1", answer: "WORD" },
        updatePlayerData,
        updatePlayerDataLocally,
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId, queryByTestId } = render(<Navigation />);

    fireEvent.press(getByTestId("trigger-hint"));
    fireEvent.press(getByTestId("trigger-skip"));
    fireEvent.press(getByTestId("trigger-loss"));
    fireEvent.press(getByTestId("trigger-win"));

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("classic"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        coins: 120,
      }),
      "classic"
    );
    expect(queryByTestId("victory-modal")).toBeNull();
    expect(updatePlayerData).toHaveBeenCalledWith(
      expect.objectContaining({ coins: 95 })
    );
    expect(updatePlayerData).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({
          totalHintsUsed: 1,
        }),
      })
    );
    expect(updatePlayerData).toHaveBeenCalledWith({ coins: 93 });
    expect(updatePlayerDataLocally).toHaveBeenCalledWith(
      expect.objectContaining({ coins: 120 }),
      { syncToFirestore: false }
    );
  });

  it("keeps daily win streak unchanged on loss for authenticated users", async () => {
    const playerData = {
      userId: "u-loss",
      progress: {},
      coins: 50,
      stats: {
        xp: 100,
        totalScore: 100,
        level: 2,
        wins: 4,
        totalWins: 4,
        gamesPlayed: 7,
        totalWordsGuessed: 21,
        totalGuessesInWins: 14,
        challengeWins: 2,
        dailyPuzzlesCompleted: 2,
        winStreak: 5,
        bestStreak: 8,
      },
    };
    const updatePlayerDataLocally = jest.fn();
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "daily-loss", text: "D", answer: "WORD" },
        updatePlayerDataLocally,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-loss"));

    await waitFor(() =>
      expect(updatePlayerDataLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            winStreak: 5,
            gamesPlayed: 8,
            totalWordsGuessed: 23,
            challengeWins: 2,
            dailyPuzzlesCompleted: 3,
          }),
        }),
        { syncToFirestore: false }
      )
    );
  });

  it("increments best streak after a classic win", async () => {
    const playerData = {
      userId: "u-classic-win",
      progress: { classicIndex: 4 },
      coins: 40,
      stats: {
        xp: 70,
        totalScore: 70,
        level: 2,
        wins: 3,
        totalWins: 3,
        gamesPlayed: 5,
        totalWordsGuessed: 14,
        totalGuessesInWins: 9,
        challengeWins: 1,
        dailyPuzzlesCompleted: 1,
        winStreak: 1,
        bestStreak: 1,
      },
    };
    const updatePlayerDataLocally = jest.fn();
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-win", text: "R", answer: "WORD" },
        updatePlayerDataLocally,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-win"));

    await waitFor(() =>
      expect(updatePlayerDataLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            bestStreak: 2,
          }),
        }),
        { syncToFirestore: false }
      )
    );
  });

  it("increments challenge wins in challenge mode", async () => {
    const playerData = {
      userId: "u-challenge-win",
      progress: { dailyChallengeIndex: 10, classicIndex: 4 },
      coins: 40,
      stats: {
        xp: 70,
        totalScore: 70,
        level: 2,
        wins: 3,
        totalWins: 3,
        gamesPlayed: 5,
        totalWordsGuessed: 14,
        totalGuessesInWins: 9,
        challengeWins: 1,
        dailyPuzzlesCompleted: 1,
        winStreak: 1,
        bestStreak: 1,
      },
    };
    const updatePlayerDataLocally = jest.fn();
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "challenge",
        playerData,
        currentRiddle: { riddleId: "challenge-win", text: "R", answer: "WORD" },
        updatePlayerDataLocally,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-win"));

    await waitFor(() =>
      expect(updatePlayerDataLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            challengeWins: 2,
            dailyPuzzlesCompleted: 2,
          }),
        }),
        { syncToFirestore: false }
      )
    );
  });

  it("updates guest daily progress on win and switches to classic without remote completion check", async () => {
    const playerData = {
      userId: "guest-1",
      email: "guest_1@guest.Riddle Quest.com",
      username: "Guest",
      progress: { dailyChallengeIndex: 4, classicIndex: 2 },
      coins: 100,
      stats: {
        xp: 10,
        totalScore: 10,
        level: 1,
        wins: 0,
        totalWins: 0,
        dailyPuzzlesCompleted: 2,
      },
    };
    const updatePlayerDataLocally = jest.fn();
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "daily-guest", text: "D1", answer: "WORD" },
        updatePlayerDataLocally,
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-win"));

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("classic"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.objectContaining({
          classicIndex: 2,
        }),
      }),
      "classic"
    );
    expect(mockDailyCallable).not.toHaveBeenCalled();
    expect(updatePlayerDataLocally).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.objectContaining({
          dailyChallengeIndex: 5,
        }),
        stats: expect.objectContaining({
          dailyPuzzlesCompleted: 3,
        }),
        lastDailyChallengeCompletedAt: expect.any(Number),
      })
    );
  });

  it("does not increment guest daily challenge index again in next-level handler", async () => {
    const playerData = {
      userId: "guest-2",
      email: "guest_2@guest.Riddle Quest.com",
      username: "Guest",
      progress: { dailyChallengeIndex: 9, classicIndex: 3 },
      coins: 30,
      stats: { xp: 0, level: 1, dailyPuzzlesCompleted: 0 },
      lastDailyChallengeCompletedAt: Date.now(),
    };
    const updatePlayerDataLocally = jest.fn();
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "daily-2", text: "R", answer: "WORD" },
        updatePlayerDataLocally,
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("classic"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.objectContaining({
          classicIndex: 3,
        }),
      }),
      "classic"
    );
    expect(updatePlayerDataLocally).not.toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.objectContaining({
          dailyChallengeIndex: 10,
        }),
      })
    );
  });

  it("does not refetch riddle when mode is unchanged and current riddle already exists", async () => {
    const playerData = { userId: "u9", progress: {}, coins: 1, stats: { xp: 0, level: 1 } };
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        isDailyChallengeAvailable: false,
        playerData,
        currentRiddle: { riddleId: "classic", text: "R", answer: "WORD" },
        fetchCurrentRiddle,
      }) as any
    );

    const { rerender } = render(<Navigation />);
    await waitFor(() =>
      expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "classic")
    );
    expect(fetchCurrentRiddle).toHaveBeenCalledTimes(1);

    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        isDailyChallengeAvailable: true,
        playerData,
        currentRiddle: { riddleId: "classic", text: "R", answer: "WORD" },
        fetchCurrentRiddle,
      }) as any
    );
    rerender(<Navigation />);
    await waitFor(() => expect(fetchCurrentRiddle).toHaveBeenCalledTimes(1));
  });
});

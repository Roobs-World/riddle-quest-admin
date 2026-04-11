import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { Navigation } from "../NavigationStack";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchClassicRiddleFromFirestore,
  fetchTutorialRiddleFromFirestore,
  updateTutorialIndexInFirestore,
} from "../../services/FirestoreService";
import { RiddleInitializationService } from "../../services/RiddleInitializationService";
import { useNotificationNavigation } from "../../hooks/useNotificationNavigation";
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

jest.mock("../../services/FirestoreService", () => ({
  fetchClassicRiddleFromFirestore: jest.fn(),
  fetchTutorialRiddleFromFirestore: jest.fn(),
  updateTutorialIndexInFirestore: jest.fn(),
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

jest.mock("../../hooks/useNotificationNavigation", () => ({
  useNotificationNavigation: jest.fn(),
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
          onPress={() => props.onGameLoss?.("ANSWER")}
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
const mockedFetchClassic = fetchClassicRiddleFromFirestore as jest.MockedFunction<
  typeof fetchClassicRiddleFromFirestore
>;
const mockedFetchTutorial =
  fetchTutorialRiddleFromFirestore as jest.MockedFunction<
    typeof fetchTutorialRiddleFromFirestore
  >;
const mockedUpdateTutorial =
  updateTutorialIndexInFirestore as jest.MockedFunction<
    typeof updateTutorialIndexInFirestore
  >;
const mockedRiddleInitService = RiddleInitializationService as jest.Mocked<
  typeof RiddleInitializationService
>;
const mockedUseNotificationNavigation =
  useNotificationNavigation as jest.MockedFunction<
    typeof useNotificationNavigation
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
      initializationFailed: false,
    });
    mockedUseNotificationNavigation.mockImplementation(() => undefined);
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

  it("handles next level in tutorial mode with successful next tutorial riddle", async () => {
    const playerData = {
      userId: "u5",
      progress: { tutorialIndex: 0 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    mockedUpdateTutorial.mockResolvedValue(undefined as any);
    mockedFetchTutorial.mockResolvedValue({
      riddleId: "tutorial-2",
      text: "Tutorial 2",
      answer: "TEST",
    } as any);

    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "tutorial",
        playerData,
        currentRiddle: { riddleId: "tutorial-1", text: "T1", answer: "ONE" },
        setCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() =>
      expect(mockedUpdateTutorial).toHaveBeenCalledWith("u5", 1)
    );
    expect(mockedFetchTutorial).toHaveBeenCalledWith(1);
    expect(setCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({ riddleId: "tutorial-2" })
    );
  });

  it("switches tutorial mode to daily when no next tutorial riddle exists", async () => {
    const playerData = {
      userId: "u5b",
      progress: { tutorialIndex: 1 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUpdateTutorial.mockResolvedValue(undefined as any);
    mockedFetchTutorial.mockResolvedValue(null as any);

    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "tutorial",
        playerData,
        currentRiddle: { riddleId: "tutorial-1", text: "T1", answer: "ONE" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("daily"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily");
  });

  it("switches tutorial mode to daily when tutorial fetch throws", async () => {
    const playerData = {
      userId: "u5c",
      progress: { tutorialIndex: 1 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUpdateTutorial.mockRejectedValue(new Error("tutorial-update-failed"));

    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "tutorial",
        playerData,
        currentRiddle: { riddleId: "tutorial-1", text: "T1", answer: "ONE" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(mockedCaptureException).toHaveBeenCalled());
    expect(setGameMode).toHaveBeenCalledWith("daily");
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily");
  });

  it("handles next level in classic mode with a next riddle", async () => {
    const playerData = {
      userId: "u6a",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    mockedFetchClassic.mockResolvedValue({
      riddleId: "classic-3",
      text: "C3",
      answer: "NEXT",
    } as any);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        setCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(mockedFetchClassic).toHaveBeenCalledWith(3));
    expect(setCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({ riddleId: "classic-3" })
    );
  });

  it("handles next level in classic mode when no riddle is returned", async () => {
    const playerData = {
      userId: "u6b",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    mockedFetchClassic.mockResolvedValue(null as any);
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        setCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(mockedFetchClassic).toHaveBeenCalledWith(3));
    expect(setCurrentRiddle).toHaveBeenCalledWith(null);
  });

  it("handles next level in classic mode and captures fetch errors", async () => {
    const playerData = {
      userId: "u6",
      progress: { classicIndex: 2 },
      coins: 30,
      stats: { xp: 0, level: 1 },
    };
    const setCurrentRiddle = jest.fn();
    mockedFetchClassic.mockRejectedValue(new Error("classic-failure"));
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic-2", text: "C2", answer: "WORD" },
        setCurrentRiddle,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);
    fireEvent.press(getByTestId("trigger-next-level"));

    await waitFor(() => expect(mockedFetchClassic).toHaveBeenCalledWith(3));
    expect(setCurrentRiddle).toHaveBeenCalledWith(null);
    expect(mockedCaptureException).toHaveBeenCalled();
  });

  it("handles hint/skip deductions and win completion modal flow", async () => {
    const playerData = {
      userId: "u7",
      progress: {},
      coins: 100,
      stats: { xp: 10, totalScore: 10, level: 1, wins: 0, totalWins: 0 },
    };
    const updatePlayerDataLocally = jest.fn();
    mockDailyCallable.mockResolvedValue({ data: { hasCompletedToday: true } });
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "daily",
        playerData,
        currentRiddle: { riddleId: "daily-1", text: "D1", answer: "WORD" },
        updatePlayerDataLocally,
      }) as any
    );

    const { getByTestId } = render(<Navigation />);

    fireEvent.press(getByTestId("trigger-hint"));
    fireEvent.press(getByTestId("trigger-skip"));
    fireEvent.press(getByTestId("trigger-loss"));
    fireEvent.press(getByTestId("trigger-win"));

    await waitFor(() => expect(getByTestId("victory-modal")).toBeTruthy());
    expect(updatePlayerDataLocally).toHaveBeenCalledWith({ coins: 95 });
    expect(updatePlayerDataLocally).toHaveBeenCalledWith({ coins: 93 });
    expect(updatePlayerDataLocally).toHaveBeenCalledWith(
      expect.objectContaining({ coins: 120 })
    );

    fireEvent.press(getByTestId("victory-next"));
    await waitFor(() =>
      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("continue with Classic Mode")
      )
    );
  });

  it("handles notification deep-link navigation to daily challenge", async () => {
    const playerData = { userId: "u8", progress: {}, coins: 1, stats: { xp: 0, level: 1 } };
    const setGameMode = jest.fn();
    const fetchCurrentRiddle = jest.fn().mockResolvedValue(undefined);
    mockedUseNotificationNavigation.mockImplementation(
      ({ enabled, onNavigate }: any) => {
        if (enabled) {
          onNavigate({ destination: "daily" });
        }
      }
    );
    mockedUseAuth.mockReturnValue(
      createAuthState({
        isAuthenticated: true,
        gameMode: "classic",
        playerData,
        currentRiddle: { riddleId: "classic", text: "R", answer: "WORD" },
        setGameMode,
        fetchCurrentRiddle,
      }) as any
    );

    render(<Navigation />);

    await waitFor(() => expect(setGameMode).toHaveBeenCalledWith("daily"));
    expect(fetchCurrentRiddle).toHaveBeenCalledWith(playerData, "daily");
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

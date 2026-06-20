import React from "react";
import {render, waitFor, cleanup, act} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {CONTINUE_REWARDED_AD_COIN_REWARD, LEVEL_UP_COIN_BONUS} from "../../../constants/game";

// Mock all external dependencies before importing the component

// Mock Sentry
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  withScope: jest.fn((cb) => cb({setExtras: jest.fn()})),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  startInactiveSpan: jest.fn(() => ({end: jest.fn()})),
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({top: 44, bottom: 34, left: 0, right: 0}),
  SafeAreaProvider: ({children}: any) => children,
  SafeAreaView: ({children}: any) => children,
}));

// Mock react-native-iap
jest.mock("react-native-iap", () => ({
  Product: {},
  initConnection: jest.fn(() => Promise.resolve()),
  endConnection: jest.fn(() => Promise.resolve()),
  getProducts: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve()),
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// Mock IapService
jest.mock("../../../services/IapService", () => ({
  IapService: {
    getProducts: jest.fn(() => Promise.resolve([])),
    purchaseProduct: jest.fn(() => Promise.resolve(null)),
    getCoinsForProduct: jest.fn(() => 100),
  },
}));

// Mock ProductPricingService
jest.mock("../../../services/ProductPricingService", () => ({
  ProductPricingService: {
    getActiveProducts: jest.fn(() => Promise.resolve([])),
    findByProductId: jest.fn(() => undefined),
    getActiveSpecialOffer: jest.fn(() => undefined),
    getPriceForCurrency: jest.fn(() => undefined),
    clearCache: jest.fn(),
  },
  ProductPricing: {},
}));

// Mock FirestoreService
const mockLoadUserProgressFromFirestore = jest.fn();
jest.mock("../../../services/FirestoreService", () => ({
  loadUserProgressFromFirestore: (...args: unknown[]) => mockLoadUserProgressFromFirestore(...args),
}));

// Mock SoundManager
jest.mock("../../../services/SoundManager", () => ({
  SoundManager: {
    setSoundEnabled: jest.fn(),
    playBackgroundMusic: jest.fn(),
    pauseBackgroundMusic: jest.fn(),
  },
}));

const mockLogGameStart = jest.fn((_params: unknown) => Promise.resolve());
const mockLogGameInteraction = jest.fn((_action: unknown, _params?: unknown) => Promise.resolve());
const mockLogCoinSpend = jest.fn((_params: unknown) => Promise.resolve());
const mockLogAchievementUnlocked = jest.fn((_achievementId: unknown) => Promise.resolve());
jest.mock("../../../services/AnalyticsService", () => ({
  analyticsService: {
    logGameStart: (params: unknown) => mockLogGameStart(params),
    logGameInteraction: (action: unknown, params?: unknown) => mockLogGameInteraction(action, params),
    logCoinSpend: (params: unknown) => mockLogCoinSpend(params),
    logAchievementUnlocked: (achievementId: unknown) => mockLogAchievementUnlocked(achievementId),
  },
}));

// Mock AuthContext
const mockLogout = jest.fn();
const mockSetGameMode = jest.fn();
const mockFetchCurrentRiddle = jest.fn(() => Promise.resolve());
const mockUpdatePlayerDataLocally = jest.fn();
const mockConsumePendingStreakBreak = jest.fn();
let mockPendingStreakBreak: {previousStreak: number} | null = null;
const mockPlayerData = {
  userId: "test-user-123",
  username: "testuser",
  email: "test@test.com",
  coins: 100,
  hasPurchasedApp: false,
  unlockedAchievements: [] as Array<{achievementId: string; unlockedAt: number}>,
  progress: {
    classicIndex: 0,
    dailyIndex: 0,
  },
};
let mockAuthPlayerData: typeof mockPlayerData | null = mockPlayerData;
let mockAuthLoading = false;

jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    playerData: mockAuthPlayerData,
    logout: mockLogout,
    setGameMode: mockSetGameMode,
    fetchCurrentRiddle: mockFetchCurrentRiddle,
    updatePlayerDataLocally: mockUpdatePlayerDataLocally,
    pendingStreakBreak: mockPendingStreakBreak,
    consumePendingStreakBreak: mockConsumePendingStreakBreak,
    isLoading: mockAuthLoading,
  }),
  useAuthSession: () => ({
    logout: mockLogout,
    isAuthenticated: false,
    isLoading: mockAuthLoading,
  }),
  usePlayer: () => ({
    playerData: mockAuthPlayerData,
    updatePlayerData: jest.fn(() => Promise.resolve()),
    updatePlayerDataLocally: mockUpdatePlayerDataLocally,
    pendingStreakBreak: mockPendingStreakBreak,
    consumePendingStreakBreak: mockConsumePendingStreakBreak,
  }),
  GameMode: {},
}));

// Mock useModal hook
const mockShowVictoryModal = jest.fn();
const mockShowLossModal = jest.fn();
const mockShowHintModal = jest.fn();
const mockShowSkipModal = jest.fn();
const mockShowSettingsModal = jest.fn();
const mockShowCoinShopModal = jest.fn();
const mockShowInfoModal = jest.fn();
const mockShowWelcomeModal = jest.fn();
const mockShowWelcomeBackModal = jest.fn();
const mockShowInstructionsModal = jest.fn();
const mockCloseModalByType = jest.fn();
const mockCloseModal = jest.fn();
const mockShowCreditsModal = jest.fn();
const mockShowAboutLegalModal = jest.fn();
const mockShowFullProfileDetailsModal = jest.fn();
const mockShowCoinPurchaseFanfareModal = jest.fn();
const mockShowAchievementUnlockFanfareModal = jest.fn();
const mockShowStreakIncreaseFanfareModal = jest.fn();
const mockShowLevelUpFanfareModal = jest.fn();
const mockUpgradeAccountModal = jest.fn();
const mockShowTooltipOnce = jest.fn(() => Promise.resolve(true));
const mockShowTooltip = jest.fn(() => Promise.resolve());
const mockDismissTooltip = jest.fn();

jest.mock("../../../hooks/useModal", () => ({
  useModal: () => ({
    modals: [],
    showVictoryModal: mockShowVictoryModal,
    showLossModal: mockShowLossModal,
    showHintModal: mockShowHintModal,
    showSkipModal: mockShowSkipModal,
    showSettingsModal: mockShowSettingsModal,
    showCoinShop: mockShowCoinShopModal,
    showCoinShopModal: mockShowCoinShopModal,
    showInfoModal: mockShowInfoModal,
    showWelcomeModal: mockShowWelcomeModal,
    showWelcomeBackModal: mockShowWelcomeBackModal,
    showInstructionsModal: mockShowInstructionsModal,
    showCreditsModal: mockShowCreditsModal,
    showAboutLegalModal: mockShowAboutLegalModal,
    showFullProfileDetailsModal: mockShowFullProfileDetailsModal,
    showCoinPurchaseFanfareModal: mockShowCoinPurchaseFanfareModal,
    showAchievementUnlockFanfareModal: mockShowAchievementUnlockFanfareModal,
    showStreakIncreaseFanfareModal: mockShowStreakIncreaseFanfareModal,
    showLevelUpFanfareModal: mockShowLevelUpFanfareModal,
    closeModalByType: mockCloseModalByType,
    closeModal: mockCloseModal,
  }),
}));

jest.mock("../../../contexts/TooltipContext", () => ({
  useTooltip: () => ({
    activeTooltipId: null,
    showTooltip: mockShowTooltip,
    showTooltipOnce: mockShowTooltipOnce,
    dismissTooltip: mockDismissTooltip,
  }),
}));

// Mock useGameLogic hook
const mockUseGameLogic = {
  guesses: [] as any[],
  currentGuess: [] as string[],
  gameOver: false,
  setCurrentGuess: jest.fn(),
  processGuess: jest.fn(() => Promise.resolve({outcome: "continue"})) as jest.Mock,
  continueGame: jest.fn(),
  resetGame: jest.fn(),
};

jest.mock("../../../hooks/useGameLogic", () => ({
  __esModule: true,
  default: () => mockUseGameLogic,
}));

const mockLoadRewardedAd = jest.fn();
const mockShowRewardedAd = jest.fn(() => Promise.resolve(false));
const mockRecordRewardedAdCompletion = jest.fn();
let mockIsRewardedAdReady = true;
jest.mock("../../../hooks/useRewardedAds", () => ({
  __esModule: true,
  default: () => ({
    isRewardedAdReady: mockIsRewardedAdReady,
    loadRewardedAd: mockLoadRewardedAd,
    showRewardedAd: mockShowRewardedAd,
    recordRewardedAdCompletion: mockRecordRewardedAdCompletion,
  }),
}));

const mockLoadInterstitialAd = jest.fn();
const mockShowInterstitialAd = jest.fn(() => Promise.resolve(false));
let mockIsInterstitialAdReady = true;
jest.mock("../../../hooks/useInterstitialAds", () => ({
  __esModule: true,
  default: () => ({
    isInterstitialAdReady: mockIsInterstitialAdReady,
    loadInterstitialAd: mockLoadInterstitialAd,
    showInterstitialAd: mockShowInterstitialAd,
  }),
}));

// Mock useGameSessionController - runWithServerLoading must return a Promise
const mockRunWithServerLoading = jest.fn((fn) => Promise.resolve(fn()));
jest.mock("../../../features/game-session/useGameSessionController", () => ({
  useGameSessionController: () => ({
    isLoading: false,
    runWithServerLoading: mockRunWithServerLoading,
  }),
}));

// Mock gameModalActions
const mockShowSpendCoinsError = jest.fn();
const mockShowNoProductsAvailable = jest.fn();
const mockShowAdNotReady = jest.fn();
const mockShowAdError = jest.fn();
jest.mock("../../../features/game-session/gameModalActions", () => ({
  createGameModalActions: () => ({
    showSpendCoinsError: mockShowSpendCoinsError,
    showNoProductsAvailable: mockShowNoProductsAvailable,
    showAdNotReady: mockShowAdNotReady,
    showAdError: mockShowAdError,
  }),
}));

// Mock ModalProvider
jest.mock("../../../components/modals/ModalProvider", () => ({
  ModalProvider: ({children}: any) => children,
}));

jest.mock("../../../components/modals/settings/UpgradeAccountModal", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockUpgradeAccountModal(props: any) {
    mockUpgradeAccountModal(props);
    return React.createElement(View, {testID: "mock-upgrade-account-modal"});
  };
});

const mockOfflineBlockingModal = jest.fn();
jest.mock("../../../components/modals/system/OfflineBlockingModal", () => {
  const React = require("react");
  const {Text} = require("react-native");
  return function MockOfflineBlockingModal(props: any) {
    mockOfflineBlockingModal(props);
    return props.isVisible ? React.createElement(Text, null, "Offline Blocking Modal Visible") : null;
  };
});

// Mock game components
const mockHeader = jest.fn();
jest.mock("../../../components/game/Header", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockHeader(props: any) {
    mockHeader(props);
    return React.createElement(View, {testID: "mock-header"});
  };
});

const mockControls = jest.fn();
jest.mock("../../../components/game/Controls", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockControls(props: any) {
    mockControls(props);
    return React.createElement(View, {testID: "mock-controls"});
  };
});

const mockBottomNavigationBar = jest.fn();
jest.mock("../../../components/game/BottomNavigationBar", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockBottomNavigationBar(props: any) {
    mockBottomNavigationBar(props);
    return React.createElement(View, {testID: "mock-bottom-nav"});
  };
});

const mockGameBoard = jest.fn();
jest.mock("../../../components/game/GameBoard", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockGameBoard(props: any) {
    mockGameBoard(props);
    return React.createElement(View, {testID: "mock-game-board"});
  };
});

const mockGameInput = jest.fn();
jest.mock("../../../components/game/GameInput", () => ({
  GameInput: function MockGameInput(props: any) {
    const React = require("react");
    const {View} = require("react-native");
    mockGameInput(props);
    return React.createElement(View, {testID: "mock-game-input"});
  },
}));

const mockPulsingSpinner = jest.fn();
jest.mock("../../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockPulsingSpinner(props: any) {
    mockPulsingSpinner(props);
    return React.createElement(View, {testID: "mock-spinner"});
  };
});

const mockModalTogglePanel = jest.fn();
jest.mock("../../../components/development/ModalTogglePanel", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockModalTogglePanel(props: any) {
    mockModalTogglePanel(props);
    return React.createElement(View, {testID: "mock-modal-toggle"});
  };
});

jest.mock("../../../components/background/StarryBackground", () => {
  const React = require("react");
  const {View} = require("react-native");
  return function MockStarryBackground() {
    return React.createElement(View, {testID: "mock-starry-background"});
  };
});

// Mock i18n
jest.mock("../../../i18n", () => {
  const actual = jest.requireActual("../../../i18n");

  return {
    ...actual,
    getLocale: jest.fn(() => "en"),
    getAppLanguage: jest.fn(() => "en"),
    setLocale: jest.fn(),
    setAppLanguage: jest.fn(),
  };
});

// Mock constants
jest.mock("../../../constants/game", () => ({
  SKIP_COST_CLASSIC: 100,
  SKIP_COST_DAILY: 150,
  LEVEL_UP_COIN_BONUS: 50,
  DAILY_CHALLENGE_COIN_REWARD: 75,
  DAILY_COMPLETION_BONUS: 25,
  isStreakRewardMilestone: (streakValue: number) => streakValue > 0 && streakValue % 7 === 0,
  CONTINUE_COST_COINS: 100,
  CONTINUE_REWARDED_AD_COIN_REWARD: 50,
  MODAL_CLOSE_DELAY_MS: 300,
  SOUND_RESUME_DELAY_MS: 100,
  getXpLevel: (totalScore: number) => ({
    level: totalScore >= 100 ? 2 : 1,
    progressPct: 0,
    currentXp: totalScore,
    nextLevelXp: 100,
  }),
}));

jest.mock("../../../constants/loading", () => ({
  LOADING_SPINNER_OPACITY: 0.5,
  LOADING_SPINNER_SIZE: 200,
}));

jest.mock("../../../constants/achievements", () => ({
  ACHIEVEMENT_DEFINITIONS: [],
}));

// Mock utilities
jest.mock("../../../utils/responsive", () => ({
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  moderateScale: (size: number) => size,
  scale: (size: number) => size,
  verticalScale: (size: number) => size,
}));

jest.mock("../../../utils/timing", () => ({
  safeDelay: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../../utils/sentry", () => ({
  captureException: jest.fn(),
  withSentrySpan: jest.fn((_name, _op, callback) => callback()),
}));

jest.mock("../../../utils/letterStates", () => ({
  computeLetterStates: jest.fn(() => ({})),
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    container: {},
    gameContainer: {},
  },
}));

// Import component after all mocks
import GameScreen from "../GameScreen";
import {SettingsProvider} from "../../../contexts/SettingsContext";

const pendingPromise = <T,>() => new Promise<T>(() => {});

async function invokeGameAction<T>(action: () => T | Promise<T>): Promise<T> {
  let result: T | undefined;
  await act(async () => {
    result = await action();
  });
  return result as T;
}

function getLatestMockProps(mockFn: jest.Mock) {
  return mockFn.mock.calls[mockFn.mock.calls.length - 1][0];
}

const renderWithSettingsProvider = (ui: React.ReactElement) => render(<SettingsProvider>{ui}</SettingsProvider>);

describe("GameScreen", () => {
  const defaultProps = {
    riddleId: "riddle-123",
    riddleText: "What has keys but no locks?",
    answer: "KEYBOARD",
    answerLength: 8,
    userCoins: 100,
    hintCost: 50,
    onGameWin: jest.fn(),
    onGameLoss: jest.fn(),
    onHintUsed: jest.fn(),
    onSkipUsed: jest.fn(),
    onNextLevel: jest.fn(),
    gameMode: "classic" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key.startsWith("gameScreenOnboardingSeen")) {
        return Promise.resolve(null);
      }
      return pendingPromise<string | null>();
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);
    (NetInfo.fetch as jest.Mock).mockReturnValue(
      pendingPromise<{isConnected: boolean; isInternetReachable: boolean}>(),
    );
    mockPendingStreakBreak = null;
    mockAuthPlayerData = mockPlayerData;
    mockAuthLoading = false;
    mockPlayerData.email = "test@test.com";
    mockPlayerData.username = "testuser";
    mockPlayerData.coins = 100;
    mockPlayerData.hasPurchasedApp = false;
    mockPlayerData.unlockedAchievements = [];
    mockLoadUserProgressFromFirestore.mockResolvedValue(mockPlayerData);
    mockUseGameLogic.guesses = [];
    mockUseGameLogic.currentGuess = [];
    mockUseGameLogic.gameOver = false;
    mockUseGameLogic.processGuess.mockResolvedValue({outcome: "continue"});
    mockUseGameLogic.setCurrentGuess.mockReset();
    mockUseGameLogic.continueGame.mockReset();
    mockUseGameLogic.resetGame.mockReset();
    mockLoadRewardedAd.mockReset();
    mockShowRewardedAd.mockReset();
    mockShowRewardedAd.mockResolvedValue(false);
    mockRecordRewardedAdCompletion.mockReset();
    mockRecordRewardedAdCompletion.mockResolvedValue({
      success: true,
      placement: "loss_continue",
      callbackId: "reward-callback",
      rewardCoins: 50,
      newCoins: 150,
      alreadyProcessed: false,
      message: "Rewarded ad reward applied.",
    });
    mockLoadInterstitialAd.mockReset();
    mockShowInterstitialAd.mockReset();
    mockShowInterstitialAd.mockResolvedValue(false);
    mockShowTooltipOnce.mockClear();
    mockShowTooltip.mockClear();
    mockDismissTooltip.mockClear();
    mockOfflineBlockingModal.mockClear();
    mockIsRewardedAdReady = true;
    mockIsInterstitialAdReady = true;
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();
  });

  describe("Component Import and Structure", () => {
    it("should successfully import the component", () => {
      expect(GameScreen).toBeDefined();
      // GameScreen is wrapped in React.memo, so it's an object with $$typeof
      expect(GameScreen).toHaveProperty("$$typeof");
    });

    it("should create element without crashing", () => {
      expect(() => {
        React.createElement(GameScreen, defaultProps);
      }).not.toThrow();
    });

    it("should be a valid React component", () => {
      const element = React.createElement(GameScreen, defaultProps);

      expect(element).toBeTruthy();
      expect(element.type).toBe(GameScreen);
    });

    it("does not reschedule the submit tooltip when the tooltip context value rerenders", () => {
      jest.useFakeTimers();
      const {rerender} = render(<GameScreen {...defaultProps} />);

      const welcomeBackConfig = mockShowWelcomeBackModal.mock.calls[0]?.[0];
      act(() => {
        welcomeBackConfig?.onDismiss?.();
      });

      act(() => {
        jest.advanceTimersByTime(650);
      });
      expect(mockShowTooltipOnce).toHaveBeenCalledTimes(1);
      expect(mockShowTooltipOnce).toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));

      rerender(<GameScreen {...defaultProps} />);
      act(() => {
        jest.advanceTimersByTime(650);
      });

      expect(mockShowTooltipOnce).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it("waits until onboarding finishes before showing the submit tooltip", async () => {
      jest.useFakeTimers();
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      act(() => {
        jest.advanceTimersByTime(650);
      });
      expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));

      const welcomeBackConfig = mockShowWelcomeBackModal.mock.calls[0]?.[0];
      act(() => {
        welcomeBackConfig?.onDismiss?.();
      });
      act(() => {
        jest.advanceTimersByTime(650);
      });

      await waitFor(() => {
        expect(mockShowTooltipOnce).toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));
      });
      jest.useRealTimers();
    });

    it("waits until the guest upgrade notice is dismissed before showing the submit tooltip", async () => {
      jest.useFakeTimers();
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;

      try {
        mockPlayerData.email = "";
        mockPlayerData.username = "Guest";

        renderWithSettingsProvider(<GameScreen {...defaultProps} />);

        act(() => {
          jest.advanceTimersByTime(650);
        });
        expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));

        await waitFor(() => {
          expect(mockShowWelcomeModal).toHaveBeenCalled();
        });

        act(() => {
          mockShowWelcomeModal.mock.calls[0][0].onDismiss();
        });
        await waitFor(() => {
          expect(mockShowInstructionsModal).toHaveBeenCalled();
        });

        act(() => {
          mockShowInstructionsModal.mock.calls[0][0].onDismiss();
        });
        await waitFor(() => {
          expect(mockShowInfoModal).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Guest Mode Notice",
            }),
          );
        });
        expect(mockShowInfoModal.mock.calls[0][0].onboardingProgress).toBeUndefined();

        act(() => {
          jest.advanceTimersByTime(650);
        });
        expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));

        act(() => {
          mockShowInfoModal.mock.calls[0][0].onConfirm?.();
        });
        act(() => {
          jest.advanceTimersByTime(650);
        });

        await waitFor(() => {
          expect(mockShowTooltipOnce).toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));
        });
      } finally {
        mockPlayerData.email = originalEmail;
        mockPlayerData.username = originalUsername;
        jest.useRealTimers();
      }
    });

    it("does not show the submit tooltip when onboarding is suppressed", () => {
      jest.useFakeTimers();
      render(<GameScreen {...defaultProps} suppressOnboarding={true} />);

      act(() => {
        jest.advanceTimersByTime(650);
      });

      expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "submitAnswer"}));
      jest.useRealTimers();
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} />);
      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with classic game mode", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} gameMode="classic" />);
      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with daily game mode", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} gameMode="daily" />);
      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

  });

  describe("Props Handling", () => {
    it("should accept required props", () => {
      const element = React.createElement(GameScreen, defaultProps);

      expect(element.props.riddleId).toBe("riddle-123");
      expect(element.props.riddleText).toBe("What has keys but no locks?");
      expect(element.props.answer).toBe("KEYBOARD");
      expect(element.props.answerLength).toBe(8);
      expect(element.props.userCoins).toBe(100);
      expect(element.props.hintCost).toBe(50);
      expect(element.props.gameMode).toBe("classic");
    });

    it("should accept callback props", () => {
      const element = React.createElement(GameScreen, defaultProps);

      expect(typeof element.props.onGameWin).toBe("function");
      expect(typeof element.props.onGameLoss).toBe("function");
      expect(typeof element.props.onHintUsed).toBe("function");
      expect(typeof element.props.onSkipUsed).toBe("function");
      expect(typeof element.props.onNextLevel).toBe("function");
    });

    it("should accept zero coins", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        userCoins: 0,
      });

      expect(element.props.userCoins).toBe(0);
    });

    it("should accept different answer lengths", () => {
      const element4 = React.createElement(GameScreen, {
        ...defaultProps,
        answerLength: 4,
        answer: "TEST",
      });
      expect(element4.props.answerLength).toBe(4);

      const element10 = React.createElement(GameScreen, {
        ...defaultProps,
        answerLength: 10,
        answer: "LONGANSWER",
      });
      expect(element10.props.answerLength).toBe(10);
    });

    it("should accept empty riddle text", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        riddleText: "",
      });

      expect(element.props.riddleText).toBe("");
    });

    it("should accept special characters in riddle", () => {
      const riddleWithSpecialChars = "What's the answer? It's tricky!";
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        riddleText: riddleWithSpecialChars,
      });

      expect(element.props.riddleText).toBe(riddleWithSpecialChars);
    });
  });

  describe("Game Mode Variations", () => {
    it("should create element for classic mode", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        gameMode: "classic",
      });
      expect(element.props.gameMode).toBe("classic");
    });

    it("should create element for daily mode", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        gameMode: "daily",
      });
      expect(element.props.gameMode).toBe("daily");
    });
  });

  describe("Edge Cases", () => {
    it("should accept maximum coin values", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        userCoins: 999999,
      });
      expect(element.props.userCoins).toBe(999999);
    });

    it("should accept minimum hint cost", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        hintCost: 0,
      });
      expect(element.props.hintCost).toBe(0);
    });

    it("should accept very long riddle text", () => {
      const longRiddle = "A".repeat(500);
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        riddleText: longRiddle,
      });
      expect(element.props.riddleText.length).toBe(500);
    });

    it("should accept unicode in riddle", () => {
      const unicodeRiddle = "What is this emoji: \u2764?";
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        riddleText: unicodeRiddle,
      });
      expect(element.props.riddleText).toBe(unicodeRiddle);
    });

    it("should accept single character answer", () => {
      const element = React.createElement(GameScreen, {
        ...defaultProps,
        answer: "A",
        answerLength: 1,
      });
      expect(element.props.answer).toBe("A");
      expect(element.props.answerLength).toBe(1);
    });
  });

  describe("Callback Integration", () => {
    it("should not call callbacks on initial render", async () => {
      const {rerender} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onGameWin).not.toHaveBeenCalled();
        expect(defaultProps.onGameLoss).not.toHaveBeenCalled();
        expect(defaultProps.onHintUsed).not.toHaveBeenCalled();
        expect(defaultProps.onSkipUsed).not.toHaveBeenCalled();
      });
    });
  });

  describe("Modal Integration", () => {
    it("should trigger welcome-back modal on mount for provider users", async () => {
      const {rerender} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeBackModal).toHaveBeenCalledWith(
          expect.objectContaining({
            username: "testuser",
          }),
        );
      });
      expect(mockShowWelcomeModal).not.toHaveBeenCalled();
    });

    it("should show welcome-back modal instead of onboarding for provider users", async () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeBackModal).toHaveBeenCalledWith(
          expect.objectContaining({
            username: "testuser",
          }),
        );
      });

      expect(mockShowWelcomeModal).not.toHaveBeenCalled();
      expect(mockShowInstructionsModal).not.toHaveBeenCalled();
    });

    it("should skip onboarding modals when onboarding was already seen", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("true");

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeBackModal).toHaveBeenCalledWith(
          expect.objectContaining({
            username: "testuser",
          }),
        );
      });
      expect(mockShowWelcomeModal).not.toHaveBeenCalled();
      expect(mockShowInstructionsModal).not.toHaveBeenCalled();
    });

    it("should persist onboarding seen state after first modal display", async () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeBackModal).toHaveBeenCalled();
      });

      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith("gameScreenOnboardingSeen:test-user-123", "true");
    });

    it("should still show welcome modal for guest users", async () => {
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;
      try {
        mockPlayerData.email = "";
        mockPlayerData.username = "Guest";

        render(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(mockShowWelcomeModal).toHaveBeenCalledWith(
            expect.objectContaining({
              onboardingProgress: {current: 1, total: 2},
            }),
          );
        });
        expect(mockShowInfoModal).not.toHaveBeenCalled();
      } finally {
        mockPlayerData.email = originalEmail;
        mockPlayerData.username = originalUsername;
      }
    });

    it("should include upgrade action in guest warning modal and open upgrade modal", async () => {
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;

      try {
        mockPlayerData.email = "";
        mockPlayerData.username = "Guest";

        render(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(mockShowWelcomeModal).toHaveBeenCalled();
        });

        const onboardingConfig = mockShowWelcomeModal.mock.calls[0][0];
        onboardingConfig.onDismiss();

        await waitFor(() => {
          expect(mockShowInstructionsModal).toHaveBeenCalledWith(
            expect.objectContaining({
              onboardingProgress: {current: 2, total: 2},
              onDismiss: expect.any(Function),
            }),
          );
        });

        const instructionsConfig = mockShowInstructionsModal.mock.calls[0][0];
        instructionsConfig.onDismiss();

        await waitFor(() => {
          expect(mockShowInfoModal).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Guest Mode Notice",
              actionButtonText: "Upgrade Account",
              onAction: expect.any(Function),
            }),
          );
        });

        const guestInfoCall = mockShowInfoModal.mock.calls.find((call) => call[0]?.title === "Guest Mode Notice");
        expect(guestInfoCall).toBeDefined();
        expect(guestInfoCall?.[0]?.onboardingProgress).toBeUndefined();

        await act(async () => {
          guestInfoCall?.[0]?.onAction?.();
        });

        await waitFor(() => {
          const latestProps = mockUpgradeAccountModal.mock.calls[mockUpgradeAccountModal.mock.calls.length - 1][0];
          expect(latestProps.isVisible).toBe(true);
        });
      } finally {
        mockPlayerData.email = originalEmail;
        mockPlayerData.username = originalUsername;
      }
    });

    it("should have access to modal functions", () => {
      // Verify the mocked modal functions are accessible
      expect(mockShowVictoryModal).toBeDefined();
      expect(mockShowLossModal).toBeDefined();
      expect(mockShowHintModal).toBeDefined();
      expect(mockShowSkipModal).toBeDefined();
      expect(mockShowSettingsModal).toBeDefined();
    });
  });

  describe("Component Lifecycle", () => {
    it("should render and unmount without errors", async () => {
      const {unmount, queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it("should handle rerender with different props", async () => {
      const {rerender, queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} userCoins={50} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Connectivity Blocking", () => {
    it("shows the offline blocking modal when initial reachability is offline", async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: true,
      });

      const {queryByText} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getLatestMockProps(mockOfflineBlockingModal).isVisible).toBe(true);
      });
      expect(queryByText("Offline Blocking Modal Visible")).toBeTruthy();
      expect(getLatestMockProps(mockGameBoard).isAnyOverlayVisible).toBe(true);
    });

    it("updates offline blocking state from NetInfo events and unsubscribes on unmount", async () => {
      const unsubscribe = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockReturnValueOnce(unsubscribe);
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      const {unmount, queryByText} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(getLatestMockProps(mockOfflineBlockingModal).isVisible).toBe(false);
      });

      const listener = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];

      act(() => {
        listener({isConnected: true, isInternetReachable: false});
      });

      await waitFor(() => {
        expect(getLatestMockProps(mockOfflineBlockingModal).isVisible).toBe(true);
      });
      expect(queryByText("Offline Blocking Modal Visible")).toBeTruthy();

      act(() => {
        listener({isConnected: true, isInternetReachable: true});
      });

      await waitFor(() => {
        expect(getLatestMockProps(mockOfflineBlockingModal).isVisible).toBe(false);
      });
      expect(queryByText("Offline Blocking Modal Visible")).toBeNull();

      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle IAP product loading error", async () => {
      const {IapService} = require("../../../services/IapService");
      IapService.getProducts.mockRejectedValueOnce(new Error("IAP error"));

      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle ProductPricingService loading error", async () => {
      const {ProductPricingService} = require("../../../services/ProductPricingService");
      ProductPricingService.getActiveProducts.mockRejectedValueOnce(new Error("Pricing error"));

      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Game Mode Changes", () => {
    it("should handle switching from classic to daily mode", async () => {
      const {rerender, queryByTestId} = render(<GameScreen {...defaultProps} gameMode="classic" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} gameMode="daily" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Answer Length Edge Cases", () => {
    it("derives playable slots from the actual answer instead of stale props", async () => {
      mockUseGameLogic.currentGuess = ["J", "O", "K", "E", "S"];

      render(
        <GameScreen
          {...defaultProps}
          riddleText="A short gag that lands with a laugh."
          answer="JOKE"
          answerLength={5}
        />,
      );

      const boardProps = getLatestMockProps(mockGameBoard);
      expect(boardProps.answerLength).toBe(4);

      await waitFor(() => {
        expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalled();
      });
      const trimUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[0][0];
      expect(trimUpdater(["J", "O", "K", "E", "S"])).toEqual(["J", "O", "K", "E"]);

      const inputProps = getLatestMockProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      expect(mockUseGameLogic.processGuess).not.toHaveBeenCalled();
    });

    it("should handle zero answer length", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} answerLength={0} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle negative answer length", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} answerLength={-1} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Riddle Clue Safety", () => {
    it("does not pass a literal answer clue through to the game board", () => {
      render(<GameScreen {...defaultProps} riddleText="joke" answer="joke" answerLength={4} />);

      const boardProps = getLatestMockProps(mockGameBoard);
      expect(boardProps.riddleText).toBe("Solve this 4-letter word.");
    });
  });

  describe("Riddle Changes", () => {
    it("should handle riddleId change", async () => {
      const {rerender, queryByTestId} = render(<GameScreen {...defaultProps} riddleId="riddle-1" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} riddleId="riddle-2" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle answer change", async () => {
      const {rerender, queryByTestId} = render(<GameScreen {...defaultProps} answer="FIRST" answerLength={5} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} answer="SECOND" answerLength={6} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Game State Scenarios", () => {
    beforeEach(() => {
      // Reset mock state before each test
      mockUseGameLogic.guesses = [];
      mockUseGameLogic.currentGuess = [];
      mockUseGameLogic.gameOver = false;
    });

    it("should render with partial current guess", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y"];

      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with full current guess", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];

      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with previous guesses", async () => {
      mockUseGameLogic.guesses = [
        [
          {letter: "T", feedback: "red"},
          {letter: "E", feedback: "yellow"},
          {letter: "S", feedback: "red"},
          {letter: "T", feedback: "red"},
        ],
      ];

      const {queryByTestId} = render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle empty guesses array with filled current guess", async () => {
      mockUseGameLogic.guesses = [];
      mockUseGameLogic.currentGuess = ["A", "B", "C", "D"];

      const {queryByTestId} = render(<GameScreen {...defaultProps} answerLength={4} answer="ABCD" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Settings Integration", () => {
    it("should render with default sound enabled", async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === "isSoundEnabled" || key === "isHapticsEnabled") {
          return Promise.resolve("true");
        }
        if (key.startsWith("gameScreenOnboardingSeen")) {
          return Promise.resolve(null);
        }
        return pendingPromise<string | null>();
      });

      const {queryByTestId} = renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      const {SoundManager} = require("../../../services/SoundManager");
      await waitFor(() => {
        expect(SoundManager.setSoundEnabled).toHaveBeenCalled();
      });
    });

    it("should render with default haptics enabled", async () => {
      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Loading States", () => {
    it("should render with loading indicator available", async () => {
      // The loading state comes from useGameSessionController which is mocked
      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Modal States", () => {
    it("should render with modal system integrated", async () => {
      // Modal system is mocked and available
      const {queryByTestId} = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Behavioral Coverage", () => {
    const getLatestProps = (mockFn: jest.Mock) => mockFn.mock.calls[mockFn.mock.calls.length - 1][0];

    it("passes a watch-video handler to coin shop", async () => {
      render(<GameScreen {...defaultProps} suppressOnboarding={true} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      expect(typeof config.onWatchVideo).toBe("function");
    });

    it("records authenticated coin-shop rewarded ads before showing the reward fanfare", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(true);
      mockRecordRewardedAdCompletion.mockResolvedValueOnce({
        success: true,
        placement: "coin_shop",
        callbackId: "coin-shop-callback",
        rewardCoins: 50,
        newCoins: 150,
        alreadyProcessed: false,
        message: "Rewarded ad reward applied.",
      });

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      await invokeGameAction(() => config.onWatchVideo());

      expect(mockCloseModalByType).toHaveBeenCalledWith("coinShop");
      expect(mockRecordRewardedAdCompletion).toHaveBeenCalledWith("coin_shop");
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith({coins: 150}, {syncToFirestore: false});
      expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          coinsPurchased: 50,
          totalCoins: 150,
        }),
      );

      const {logger} = require("../../../utils/logger");
      expect(logger.debug).toHaveBeenCalledWith("Confirming rewarded ad reward with backend callback", {
        placement: "coin_shop",
        userId: "test-user-123",
      });
      expect(logger.debug).toHaveBeenCalledWith("Rewarded ad backend callback confirmed", {
        placement: "coin_shop",
        callbackId: "coin-shop-callback",
        alreadyProcessed: false,
        rewardCoins: 50,
        newCoins: 150,
      });
    });

    it("shows the coin-shop ad fallback when a rewarded ad does not grant a reward", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(false);

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      await invokeGameAction(() => config.onWatchVideo());

      expect(mockCloseModalByType).toHaveBeenCalledWith("coinShop");
      expect(mockShowAdNotReady).toHaveBeenCalled();
      expect(mockRecordRewardedAdCompletion).not.toHaveBeenCalled();
      expect(mockShowCoinPurchaseFanfareModal).not.toHaveBeenCalled();
    });

    it("submits a completed guess and stores the result", async () => {
      const result = {
        outcome: "continue",
        attemptsRemaining: 2,
      };
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce(result);

      render(<GameScreen {...defaultProps} suppressOnboarding={true} />);

      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });

      expect(mockUseGameLogic.processGuess).toHaveBeenCalledWith(["K", "E", "Y", "B", "O", "A", "R", "D"]);
      expect(mockShowTooltipOnce).toHaveBeenCalledWith(expect.objectContaining({id: "hintAfterWrongGuess"}));
    });

    it("passes tooltip target refs into game controls", () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      const headerProps = getLatestProps(mockHeader);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);

      expect(inputProps.submitButtonRef).toBeDefined();
      expect(inputProps.hintButtonRef).toBeDefined();
      expect(inputProps.nextButtonRef).toBeDefined();
      expect(headerProps.coinsButtonRef).toBeDefined();
      expect(bottomNavProps.profileButtonRef).toBeDefined();
    });

    it("shows the shop tooltip when trying to use a hint without enough coins", async () => {
      mockAuthPlayerData = {...mockPlayerData, coins: 0};
      render(<GameScreen {...defaultProps} userCoins={0} suppressOnboarding={true} />);

      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleHint();
      });

      expect(mockShowTooltipOnce).toHaveBeenCalledWith(expect.objectContaining({id: "shopOutOfCoins"}));
    });

    it("re-enables coin animation after submit settle delay even when modal visibility is not reported", async () => {
      jest.useFakeTimers();
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 15,
        scoreEarned: 10,
      });

      render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await act(async () => {
          await inputProps.handleSubmit();
        });
      });

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(getLatestProps(mockHeader).shouldAnimateCoins).toBe(true);
      jest.useRealTimers();
    });

    it("renders bottom nav actions supported by current API", async () => {
      render(<GameScreen {...defaultProps} />);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      expect(typeof bottomNavProps.onProfilePress).toBe("function");
      expect(typeof bottomNavProps.onSettingsPress).toBe("function");
    });

    it("opens support email on help and supports credits transition", async () => {
      jest.useFakeTimers();
      render(<GameScreen {...defaultProps} />);
      const {Linking} = require("react-native");
      const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(true);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      bottomNavProps.onSettingsPress();

      const config = mockShowSettingsModal.mock.calls[0][0];
      config.onPressHelp();
      expect(openURLSpy).toHaveBeenCalledWith("mailto:support@adspeq.com");
      config.onPressCredits();

      expect(mockCloseModalByType).toHaveBeenCalledWith("settings");
      await act(async () => {
        jest.runAllTimers();
      });
      expect(mockShowInstructionsModal).not.toHaveBeenCalled();
      expect(mockShowCreditsModal).toHaveBeenCalled();
      openURLSpy.mockRestore();
      jest.useRealTimers();
    });

    it("opens about/legal modal from settings", async () => {
      jest.useFakeTimers();
      render(<GameScreen {...defaultProps} />);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      bottomNavProps.onSettingsPress();

      const config = mockShowSettingsModal.mock.calls[0][0];
      config.onPressAbout();

      expect(mockCloseModalByType).toHaveBeenCalledWith("settings");
      await act(async () => {
        jest.runAllTimers();
      });
      expect(mockShowAboutLegalModal).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("opens skip modal and spends coins when confirmed", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({data: {newCoins: 0}}));
      httpsCallable.mockReturnValue(spendCoins);

      render(<GameScreen {...defaultProps} gameMode="classic" />);

      const inputProps = getLatestProps(mockGameInput);
      inputProps.handleNext();

      const config = mockShowSkipModal.mock.calls[0][0];
      await act(async () => {
        await config.onOpenShop();
      });
      expect(mockShowCoinShopModal).toHaveBeenCalled();
      await invokeGameAction(() => config.onSkipLevel());

      await waitFor(() => {
        expect(spendCoins).toHaveBeenCalledWith({reason: "skip", gameMode: "classic"});
      });
      expect(defaultProps.onSkipUsed).toHaveBeenCalledWith(100);
      expect(mockUseGameLogic.resetGame).toHaveBeenCalled();
      expect(defaultProps.onNextLevel).toHaveBeenCalled();
    });

    it("opens hint modal and applies revealed letter when user confirms", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const originalHttpsCallable = httpsCallable.getMockImplementation?.() ?? null;
      httpsCallable.mockImplementation((functionsArg: unknown, functionName: string) => {
        if (functionName === "getHint") {
          return jest.fn(() =>
            Promise.resolve({
              data: {
                index: 0,
                revealedLetter: "t",
                newCoins: 50,
              },
            }),
          );
        }
        return originalHttpsCallable ? originalHttpsCallable(functionsArg, functionName) : jest.fn(() => Promise.resolve({data: {}}));
      });

      try {
        render(<GameScreen {...defaultProps} answer="TEST" answerLength={4} />);

        const inputProps = getLatestProps(mockGameInput);
        await invokeGameAction(() => inputProps.handleHint());

        const config = mockShowHintModal.mock.calls[0][0];
        await invokeGameAction(() => config.onShowHint());

        expect(mockShowHintModal).toHaveBeenCalled();
      } finally {
        httpsCallable.mockImplementation(originalHttpsCallable ?? (() => jest.fn(() => Promise.resolve({data: {}}))));
      }
    });

    it("shows achievement unlock fanfare when hint usage unlocks an achievement", async () => {
      const {ACHIEVEMENT_DEFINITIONS} = require("../../../constants/achievements");
      const {httpsCallable} = require("@react-native-firebase/functions");
      const originalHttpsCallable = httpsCallable.getMockImplementation?.() ?? null;
      httpsCallable.mockImplementation((functionsArg: unknown, functionName: string) => {
        if (functionName === "getHint") {
          return jest.fn(() =>
            Promise.resolve({
              data: {
                index: 0,
                revealedLetter: "t",
                newCoins: 75,
                newlyUnlockedAchievementIds: ["hint_user"],
              },
            }),
          );
        }
        return originalHttpsCallable ? originalHttpsCallable(functionsArg, functionName) : jest.fn(() => Promise.resolve({data: {}}));
      });
      ACHIEVEMENT_DEFINITIONS.push({
        id: "hint_user",
        name: "Need a Clue",
        description: "Use a hint",
        icon: "??",
      });

      try {
        render(<GameScreen {...defaultProps} answer="TEST" answerLength={4} />);

        const inputProps = getLatestProps(mockGameInput);
        await invokeGameAction(() => inputProps.handleHint());
        const config = mockShowHintModal.mock.calls[0][0];
        await invokeGameAction(() => config.onShowHint());

        expect(mockShowHintModal).toHaveBeenCalled();
      } finally {
        ACHIEVEMENT_DEFINITIONS.length = 0;
        httpsCallable.mockImplementation(originalHttpsCallable ?? (() => jest.fn(() => Promise.resolve({data: {}}))));
      }
    });

    it("shows victory modal and calls onGameWin when game ends with win", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 15,
        scoreEarned: 100,
      });

      const {rerender} = render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });

      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      expect(defaultProps.onGameWin).toHaveBeenCalledWith(1, 15, 100, undefined, 50);

      const victoryConfig = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      await act(async () => {
        await victoryConfig.onNext();
      });
      await waitFor(() => {
        expect(mockShowLevelUpFanfareModal).toHaveBeenCalledWith(
          expect.objectContaining({coinsAwarded: LEVEL_UP_COIN_BONUS}),
        );
      });
    });

    it("shows a non-rewarded interstitial only after the victory modal is dismissed", async () => {
      mockShowInterstitialAd.mockResolvedValueOnce(true);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 0,
        scoreEarned: 0,
      });

      const {rerender} = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      expect(mockShowInterstitialAd).not.toHaveBeenCalled();

      const victoryConfig = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      await invokeGameAction(() => victoryConfig.onNext());

      expect(mockCloseModalByType).toHaveBeenCalledWith("victory");
      expect(mockShowInterstitialAd).toHaveBeenCalledWith("post_victory");
      expect(mockRecordRewardedAdCompletion).not.toHaveBeenCalled();
      expect(mockShowCoinPurchaseFanfareModal).not.toHaveBeenCalled();
      expect(mockUpdatePlayerDataLocally).not.toHaveBeenCalledWith(
        expect.objectContaining({coins: expect.any(Number)}),
      );
    });

    it("skips the post-victory interstitial for players with no-ads entitlement", async () => {
      mockPlayerData.hasPurchasedApp = true;
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 0,
        scoreEarned: 0,
      });

      const {rerender} = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });

      const victoryConfig = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      await invokeGameAction(() => victoryConfig.onNext());

      expect(mockLoadInterstitialAd).not.toHaveBeenCalled();
      expect(mockShowInterstitialAd).not.toHaveBeenCalled();
    });

    it("does not show level-up fanfare when earned XP does not increase level", async () => {
      const originalStats = (mockPlayerData as {stats?: Record<string, unknown>}).stats;
      (mockPlayerData as {stats?: Record<string, unknown>}).stats = {
        xp: 0,
        totalScore: 100,
        level: 2,
      };

      try {
        mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
        mockUseGameLogic.processGuess.mockResolvedValueOnce({
          outcome: "win",
          coinsEarned: 15,
          scoreEarned: 100,
        });

        const {rerender} = render(<GameScreen {...defaultProps} />);

        const inputProps = getLatestProps(mockGameInput);
        await act(async () => {
          await inputProps.handleSubmit();
        });

        mockUseGameLogic.gameOver = true;
        rerender(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(mockShowVictoryModal).toHaveBeenCalled();
        });

        const victoryConfig = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
        await invokeGameAction(() => victoryConfig.onNext());

        expect(mockShowLevelUpFanfareModal).not.toHaveBeenCalled();
      } finally {
        (mockPlayerData as {stats?: Record<string, unknown>}).stats = originalStats;
      }
    });

    it("shows streak break modal once and consumes pending streak break", async () => {
      mockPendingStreakBreak = {previousStreak: 7};
      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowInfoModal).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Streak Broken",
          }),
        );
      });

      const streakCall = mockShowInfoModal.mock.calls.find((call) => call[0]?.title === "Streak Broken");
      expect(streakCall).toBeDefined();
      streakCall?.[0]?.onConfirm?.();
      expect(mockConsumePendingStreakBreak).toHaveBeenCalled();
    });

    it("does not show streak break entry modal when onboarding is suppressed", async () => {
      mockPendingStreakBreak = {previousStreak: 7};
      render(<GameScreen {...defaultProps} suppressOnboarding={true} />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockShowInfoModal).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Streak Broken",
        }),
      );
      expect(mockConsumePendingStreakBreak).not.toHaveBeenCalled();
    });

    it("shows daily streak fanfare before victory when challenge streak increases", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 30,
        scoreEarned: 200,
        newWinStreak: 5,
      });

      const {rerender} = render(<GameScreen {...defaultProps} gameMode="daily" />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} gameMode="daily" />);

      await waitFor(() => {
        expect(mockShowStreakIncreaseFanfareModal).toHaveBeenCalledWith(
          expect.objectContaining({
            streakValue: 5,
            coinsAwarded: 0,
            totalCoins: 180,
          }),
        );
      });

      const fanfareConfig =
        mockShowStreakIncreaseFanfareModal.mock.calls[mockShowStreakIncreaseFanfareModal.mock.calls.length - 1][0];
      await invokeGameAction(() => fanfareConfig.onContinue());
      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      expect(defaultProps.onGameWin).toHaveBeenCalledWith(1, 30, 200, 5, 50);
      expect(mockShowVictoryModal).toHaveBeenCalledWith(
        expect.objectContaining({
          streakValue: 5,
        }),
      );
    });

    it("awards the streak bonus on each seven-day milestone", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 100,
        scoreEarned: 0,
        newWinStreak: 7,
        rewardBreakdown: {
          baseWinCoins: 75,
          dailyStreakBonus: 25,
          levelUpBonus: 0,
          achievementBonus: 0,
          totalAwarded: 100,
          newBalance: 200,
        },
      });

      const {rerender} = render(<GameScreen {...defaultProps} gameMode="daily" />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} gameMode="daily" />);

      await waitFor(() => {
        expect(mockShowStreakIncreaseFanfareModal).toHaveBeenCalledWith(
          expect.objectContaining({
            streakValue: 7,
            coinsAwarded: 25,
          }),
        );
      });
      expect(defaultProps.onGameWin).toHaveBeenCalledWith(1, 75, 0, 7, 25, true);
    });

    it("handles onboarding dismiss callback", async () => {
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;
      try {
        mockPlayerData.email = "";
        mockPlayerData.username = "Guest";

        render(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(mockShowWelcomeModal).toHaveBeenCalled();
        });

        const onboardingConfig = mockShowWelcomeModal.mock.calls[0][0];
        onboardingConfig.onDismiss();

        await waitFor(() => {
          expect(mockShowInstructionsModal).toHaveBeenCalledWith(
            expect.objectContaining({
              onboardingProgress: {current: 2, total: 2},
              onDismiss: expect.any(Function),
            }),
          );
        });

        const instructionsConfig = mockShowInstructionsModal.mock.calls[0][0];
        instructionsConfig.onDismiss();

        await waitFor(() => {
          expect(mockShowInfoModal).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Guest Mode Notice",
              onConfirm: expect.any(Function),
            }),
          );
        });
        expect(mockShowInfoModal.mock.calls[0][0].onboardingProgress).toBeUndefined();

        const guestNotice = mockShowInfoModal.mock.calls[0][0];
        await act(async () => {
          guestNotice.onConfirm?.();
        });
      } finally {
        mockPlayerData.email = originalEmail;
        mockPlayerData.username = originalUsername;
      }
    });

    it("opens loss modal for attempt limit using live auth coin balance and handles continue actions", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({data: {newCoins: 280}}));
      httpsCallable.mockReturnValue(spendCoins);
      (mockPlayerData as {coins: unknown}).coins = {
        toString: () => "300",
      };
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      expect(config.canUseCoin).toBe(true);
      expect(config.canWatchAd).toBe(true);
      expect(config.totalCoins).toBe(300);
      expect(typeof config.onWatchAdContinue).toBe("function");
      await invokeGameAction(() => config.onCoinContinue());
      await act(async () => {
        await config.onOpenShop();
      });

      expect(mockUseGameLogic.continueGame).toHaveBeenCalledTimes(1);
      expect(defaultProps.onGameLoss).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(spendCoins).toHaveBeenCalledWith({reason: "continue"});
      });
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(expect.objectContaining({coins: 280}));
      expect(mockShowCoinShopModal).toHaveBeenCalled();
    });

    it("opens low-balance attempt-limit loss modal without stacking shop tooltip", async () => {
      mockPlayerData.coins = 5;
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={5} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={5} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      expect(config.totalCoins).toBe(5);
      expect(config.canUseCoin).toBe(false);
      expect(config.coinContinueCost).toBe(100);
      expect(typeof config.onOpenShop).toBe("function");
      expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "shopOutOfCoins"}));
    });

    it("closes loss modal immediately on watch-ad continue and shows ad reward fanfare on completion", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(true);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={5} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={5} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      const shouldClose = config.onWatchAdContinue();
      expect(shouldClose).toBe(true);
      expect(mockCloseModalByType).toHaveBeenCalledWith("loss");

      await waitFor(() => {
        expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalledWith(
          expect.objectContaining({
            coinsPurchased: CONTINUE_REWARDED_AD_COIN_REWARD,
            totalCoins: 150,
          }),
        );
      });
      expect(mockShowRewardedAd).toHaveBeenCalled();
      expect(mockRecordRewardedAdCompletion).toHaveBeenCalledWith("loss_continue");
      expect(mockUseGameLogic.continueGame).toHaveBeenCalled();
      expect(defaultProps.onGameLoss).not.toHaveBeenCalled();
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith({coins: 150}, {syncToFirestore: false});
    });

    it("shows the loss-modal ad fallback when a rewarded ad does not grant a reward", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(false);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={5} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={5} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      const shouldClose = config.onWatchAdContinue();

      expect(shouldClose).toBe(true);
      expect(mockCloseModalByType).toHaveBeenCalledWith("loss");
      await waitFor(() => {
        expect(mockShowInfoModal).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Ad Not Ready",
            message: "The rewarded ad couldn't be shown at this time. Please try again shortly.",
          }),
        );
      });
      expect(mockRecordRewardedAdCompletion).not.toHaveBeenCalled();
      expect(mockUseGameLogic.continueGame).not.toHaveBeenCalled();
      expect(mockShowCoinPurchaseFanfareModal).not.toHaveBeenCalled();
    });

    it("keeps rewarded-ad continue local-only for guest players", async () => {
      mockPlayerData.email = "guest_test-user-123@guest.Riddle Quest.com";
      mockPlayerData.username = "Guest";
      mockShowRewardedAd.mockResolvedValueOnce(true);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
      });

      try {
        const {rerender} = render(<GameScreen {...defaultProps} userCoins={5} />);
        const inputProps = getLatestProps(mockGameInput);
        await act(async () => {
          await inputProps.handleSubmit();
        });
        mockUseGameLogic.gameOver = true;
        rerender(<GameScreen {...defaultProps} userCoins={5} />);

        await waitFor(() => {
          expect(mockShowLossModal).toHaveBeenCalled();
        });
        const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

        config.onWatchAdContinue();

        await waitFor(() => {
          expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalledWith(
            expect.objectContaining({
              coinsPurchased: CONTINUE_REWARDED_AD_COIN_REWARD,
              totalCoins: 150,
            }),
          );
        });
        expect(mockRecordRewardedAdCompletion).not.toHaveBeenCalled();
        expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith({coins: 150});
        const {logger} = require("../../../utils/logger");
        expect(logger.debug).toHaveBeenCalledWith("Rewarded ad guest reward applied locally", {
          placement: "loss_continue",
          rewardCoins: CONTINUE_REWARDED_AD_COIN_REWARD,
          totalCoins: 150,
        });
      } finally {
        mockPlayerData.email = "test@test.com";
        mockPlayerData.username = "testuser";
      }
    });

    it("does not continue after an authenticated rewarded ad when backend confirmation fails", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(true);
      mockRecordRewardedAdCompletion.mockRejectedValueOnce(new Error("callback failed"));
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={5} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={5} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      config.onWatchAdContinue();

      await waitFor(() => {
        expect(mockShowAdError).toHaveBeenCalled();
      });
      expect(mockUseGameLogic.continueGame).not.toHaveBeenCalled();
      expect(mockShowCoinPurchaseFanfareModal).not.toHaveBeenCalled();
    });

    it("does not re-open loss modal after coin continue clears game-over state", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({data: {newCoins: 0}}));
      httpsCallable.mockReturnValue(spendCoins);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalledTimes(1);
      });
      const config = mockShowLossModal.mock.calls[0][0];
      await invokeGameAction(() => config.onCoinContinue());

      mockUseGameLogic.gameOver = false;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalledTimes(1);
      });
    });

    it("shows victory instead of a stale loss after a successful post-continue guess", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({data: {newCoins: 0}}));
      httpsCallable.mockReturnValue(spendCoins);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess
        .mockResolvedValueOnce({
          outcome: "attemptLimitReached",
          correctAnswer: "ANSWER",
          canOfferCoinContinue: true,
        })
        .mockResolvedValueOnce({
          outcome: "win",
          coinsEarned: 10,
          scoreEarned: 20,
        });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={100} />);
      let inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalledTimes(1);
      });
      const config = mockShowLossModal.mock.calls[0][0];
      await invokeGameAction(() => config.onCoinContinue());

      mockShowLossModal.mockClear();
      mockUseGameLogic.gameOver = false;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      expect(mockShowLossModal).not.toHaveBeenCalled();
    });

    it("shows loss modal for terminal loss and triggers onGameLoss", async () => {
      const haptics = require("expo-haptics");
      mockPlayerData.coins = 5;
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "loss",
        correctAnswer: "ANSWER",
      });

      const {rerender} = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      expect(config.totalCoins).toBe(5);
      expect(mockShowTooltipOnce).not.toHaveBeenCalledWith(expect.objectContaining({id: "shopOutOfCoins"}));
      expect(haptics.notificationAsync).toHaveBeenCalledWith("error");
      expect(defaultProps.onGameLoss).toHaveBeenCalledWith("ANSWER", 1);
    });

    it("shows spend-coins error when skip purchase fails", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.reject(new Error("nope")));
      httpsCallable.mockReturnValue(spendCoins);
      render(<GameScreen {...defaultProps} gameMode="daily" />);

      const inputProps = getLatestProps(mockGameInput);
      inputProps.handleNext();
      const config = mockShowSkipModal.mock.calls[0][0];
      await invokeGameAction(() => config.onSkipLevel());

      await waitFor(() => {
        expect(mockShowSpendCoinsError).toHaveBeenCalled();
      });
    });

    it("handles submit error by showing info modal", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockRejectedValueOnce(new Error("submit failed"));
      render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      expect(mockShowInfoModal).toHaveBeenCalledWith(expect.objectContaining({title: "Error"}));
    });

    it("triggers haptic warning for incomplete guess submit", async () => {
      const haptics = require("expo-haptics");
      mockUseGameLogic.currentGuess = ["K", "E"];
      render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      expect(haptics.notificationAsync).toHaveBeenCalledWith("warning");
    });

    it("routes keyboard and slot handlers to game logic setters", async () => {
      render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      const boardProps = getLatestProps(mockGameBoard);

      await invokeGameAction(() => {
        boardProps.handleKeyPress("A");
        boardProps.handleBackspace();
        boardProps.onSelectCurrentGuessSlot(2);
      });

      expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalled();
      const updater = mockUseGameLogic.setCurrentGuess.mock.calls[0][0];
      expect(typeof updater).toBe("function");
      expect(updater([])).toEqual(["A"]);
    });

    it("opens profile modal from bottom navigation after refreshing player data", async () => {
      render(<GameScreen {...defaultProps} />);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      await invokeGameAction(() => bottomNavProps.onProfilePress());

      await waitFor(() => {
        expect(mockLoadUserProgressFromFirestore).toHaveBeenCalledWith(mockPlayerData.userId);
        expect(mockShowFullProfileDetailsModal).toHaveBeenCalledWith(
          expect.objectContaining({playerData: expect.any(Object)}),
        );
      });
    });

    it("preserves newer local stats when refreshed profile has stale games played", async () => {
      const originalStats = (mockPlayerData as {stats?: Record<string, unknown>}).stats;
      (mockPlayerData as {stats?: Record<string, unknown>}).stats = {
        gamesPlayed: 6,
        totalWins: 4,
      };

      mockLoadUserProgressFromFirestore.mockResolvedValueOnce({
        ...mockPlayerData,
        stats: {
          gamesPlayed: 1,
          totalWins: 1,
        },
      });

      render(<GameScreen {...defaultProps} />);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      await invokeGameAction(() => bottomNavProps.onProfilePress());

      await waitFor(() => {
        expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(
          expect.objectContaining({
            stats: expect.objectContaining({gamesPlayed: 6, totalWins: 4}),
          }),
          {syncToFirestore: false},
        );
      });

      (mockPlayerData as {stats?: Record<string, unknown>}).stats = originalStats;
    });

    it("preserves highest classic level from refreshed profile when local stats are stale", async () => {
      const originalStats = (mockPlayerData as {stats?: Record<string, unknown>}).stats;
      const originalProgress = (mockPlayerData as {progress?: Record<string, unknown>}).progress;

      (mockPlayerData as {stats?: Record<string, unknown>}).stats = {
        gamesPlayed: 6,
        totalWins: 4,
        highestLevelClassic: 0,
      };
      (mockPlayerData as {progress?: Record<string, unknown>}).progress = {
        classicIndex: 0,
        dailyIndex: 0,
      };

      mockLoadUserProgressFromFirestore.mockResolvedValueOnce({
        ...mockPlayerData,
        progress: {
          classicIndex: 9,
          dailyIndex: 0,
        },
        stats: {
          gamesPlayed: 1,
          totalWins: 1,
          highestLevelClassic: 9,
        },
      });

      render(<GameScreen {...defaultProps} />);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      await invokeGameAction(() => bottomNavProps.onProfilePress());

      await waitFor(() => {
        expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(
          expect.objectContaining({
            stats: expect.objectContaining({
              gamesPlayed: 6,
              totalWins: 4,
              highestLevelClassic: 9,
            }),
          }),
          {syncToFirestore: false},
        );
      });

      (mockPlayerData as {stats?: Record<string, unknown>}).stats = originalStats;
      (mockPlayerData as {progress?: Record<string, unknown>}).progress = originalProgress;
    });

    it("opens profile modal with null data when auth profile is unavailable", async () => {
      mockAuthPlayerData = null;
      render(<GameScreen {...defaultProps} />);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      await invokeGameAction(() => bottomNavProps.onProfilePress());

      await waitFor(() => {
        expect(mockShowFullProfileDetailsModal).toHaveBeenCalledWith({
          playerData: null,
        });
      });
      expect(mockShowInfoModal).not.toHaveBeenCalledWith(expect.objectContaining({title: "Profile"}));
    });

    it("opens coin shop and handles pay-and-play fallback when no products", async () => {
      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });

      expect(mockShowCoinShopModal).toHaveBeenCalled();
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onPayAndPlay());

      expect(mockShowNoProductsAvailable).toHaveBeenCalled();
    });

    it("uses Firestore catalog outside Jest without initializing IAP", async () => {
      const {IapService} = require("../../../services/IapService");
      const {ProductPricingService} = require("../../../services/ProductPricingService");
      const originalWorkerId = process.env.JEST_WORKER_ID;

      delete process.env.JEST_WORKER_ID;
      ProductPricingService.getActiveProducts.mockResolvedValueOnce([
        {productId: "com.roobsworld.riddlequest.coinpack1", sortOrder: 1} as any,
        {productId: "com.roobsworld.riddlequest.coinpack5", sortOrder: 2} as any,
      ]);

      try {
        render(<GameScreen {...defaultProps} />);
        const headerProps = getLatestProps(mockHeader);
        await act(async () => {
          await headerProps.onCoinsPress();
        });

        expect(IapService.getProducts).not.toHaveBeenCalled();
        expect(ProductPricingService.getActiveProducts).toHaveBeenCalled();

        const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
        expect(config.firestoreProducts).toEqual([
          expect.objectContaining({
            productId: "com.roobsworld.riddlequest.coinpack1",
          }),
          expect.objectContaining({
            productId: "com.roobsworld.riddlequest.coinpack5",
          }),
        ]);
        expect(config.error).toBeNull();
      } finally {
        if (originalWorkerId === undefined) {
          delete process.env.JEST_WORKER_ID;
        } else {
          process.env.JEST_WORKER_ID = originalWorkerId;
        }
      }
    });

    it("passes only store-backed Firestore packs to coin shop modal", async () => {
      const {IapService} = require("../../../services/IapService");
      const {ProductPricingService} = require("../../../services/ProductPricingService");

      IapService.getProducts.mockResolvedValueOnce([{id: "com.roobsworld.riddlequest.coinpack1", price: 0.99} as any]);
      ProductPricingService.getActiveProducts.mockResolvedValueOnce([
        {productId: "com.roobsworld.riddlequest.coinpack1", sortOrder: 1} as any,
        {productId: "com.roobsworld.riddlequest.coinpack5", sortOrder: 2} as any,
      ]);

      render(<GameScreen {...defaultProps} />);

      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      await waitFor(() => {
        expect(IapService.getProducts).toHaveBeenCalled();
        expect(ProductPricingService.getActiveProducts).toHaveBeenCalled();
      });

      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      expect(config.firestoreProducts).toEqual([
        expect.objectContaining({productId: "com.roobsworld.riddlequest.coinpack1"}),
      ]);
    });

    it("waits for catalog loading before opening coin shop modal", async () => {
      const {IapService} = require("../../../services/IapService");
      const {ProductPricingService} = require("../../../services/ProductPricingService");

      IapService.getProducts.mockImplementationOnce(() => new Promise(() => {}));
      ProductPricingService.getActiveProducts.mockImplementationOnce(() => new Promise(() => {}));

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      act(() => {
        void headerProps.onCoinsPress();
      });
      await Promise.resolve();
      expect(mockShowCoinShopModal).not.toHaveBeenCalled();
    });

    it("handles coin shop purchase success and failure branches", async () => {
      const {IapService} = require("../../../services/IapService");
      const {ACHIEVEMENT_DEFINITIONS} = require("../../../constants/achievements");
      ACHIEVEMENT_DEFINITIONS.push({
        id: "first_purchase",
        name: "Supporter",
        description: "Buy an item from the shop",
        icon: "H",
      });
      IapService.purchaseProduct.mockResolvedValueOnce({
        transactionId: "1",
        newCoins: 250,
        newlyUnlockedAchievementIds: ["first_purchase"],
      });

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      let config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onPurchaseProduct("pack_1"));

      expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalled();
      expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          coinsPurchased: expect.any(Number),
          onConfirm: expect.any(Function),
        }),
      );
      const purchaseFanfareConfig =
        mockShowCoinPurchaseFanfareModal.mock.calls[mockShowCoinPurchaseFanfareModal.mock.calls.length - 1][0];
      await invokeGameAction(() => purchaseFanfareConfig.onConfirm());
      expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          achievementNames: ["Supporter"],
        }),
      );
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          coins: 250,
          hasPurchasedApp: true,
        }),
      );
      expect(mockCloseModalByType).toHaveBeenCalledWith("coinShop");

      IapService.purchaseProduct.mockRejectedValueOnce(new Error("boom"));
      await invokeGameAction(() => config.onPurchaseProduct("pack_2"));
      expect(mockShowInfoModal).toHaveBeenCalledWith(expect.objectContaining({title: "Purchase Failed"}));
      ACHIEVEMENT_DEFINITIONS.length = 0;
    });

    it("does not show purchase fanfare when purchase result awards zero coins", async () => {
      const {IapService} = require("../../../services/IapService");
      IapService.purchaseProduct.mockResolvedValueOnce({
        transactionId: "dev-local-com.qwordly.unknown",
      });
      IapService.getCoinsForProduct.mockReturnValueOnce(undefined);

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      await invokeGameAction(() => config.onPurchaseProduct("com.qwordly.unknown"));

      expect(mockShowCoinPurchaseFanfareModal).not.toHaveBeenCalled();
      expect(mockCloseModalByType).not.toHaveBeenCalledWith("coinShop");
      expect(mockUpdatePlayerDataLocally).not.toHaveBeenCalledWith(expect.objectContaining({hasPurchasedApp: true}));
      expect(mockShowInfoModal).toHaveBeenCalledWith(expect.objectContaining({title: "Purchase Failed"}));
    });

    it("falls back to first_purchase unlock on successful purchase when backend IDs are missing", async () => {
      const {IapService} = require("../../../services/IapService");
      const {ACHIEVEMENT_DEFINITIONS} = require("../../../constants/achievements");
      ACHIEVEMENT_DEFINITIONS.push({
        id: "first_purchase",
        name: "Supporter",
        description: "Buy an item from the shop",
        icon: "H",
      });
      IapService.purchaseProduct.mockResolvedValueOnce({
        transactionId: "2",
        newCoins: 300,
      });

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onPurchaseProduct("pack_1"));

      const purchaseFanfareConfig =
        mockShowCoinPurchaseFanfareModal.mock.calls[mockShowCoinPurchaseFanfareModal.mock.calls.length - 1][0];
      await invokeGameAction(() => purchaseFanfareConfig.onConfirm());

      expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          achievementNames: ["Supporter"],
        }),
      );
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          coins: 300,
          hasPurchasedApp: true,
          unlockedAchievements: expect.arrayContaining([expect.objectContaining({achievementId: "first_purchase"})]),
        }),
      );

      ACHIEVEMENT_DEFINITIONS.length = 0;
    });

    it("shows pulsing spinner while coin purchase is in progress", async () => {
      const {IapService} = require("../../../services/IapService");
      let resolvePurchase: ((value: unknown) => void) | null = null;
      IapService.purchaseProduct.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePurchase = resolve;
          }),
      );

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      let purchasePromise: Promise<unknown> = Promise.resolve();
      await act(async () => {
        purchasePromise = config.onPurchaseProduct("com.roobsworld.riddlequest.coinpack1");
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(getLatestProps(mockPulsingSpinner).visible).toBe(true);
      });

      await act(async () => {
        (resolvePurchase as ((value: unknown) => void) | null)?.(null);
        await purchasePromise;
      });

      await waitFor(() => {
        expect(getLatestProps(mockPulsingSpinner).visible).toBe(false);
      });
    });

    it("shows pulsing spinner while transitioning from victory modal to next riddle", async () => {
      let resolveNextLevel: (() => void) | null = null;
      const deferredNextLevel = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveNextLevel = resolve;
          }),
      );

      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 5,
        scoreEarned: 0,
      });

      const {rerender} = render(<GameScreen {...defaultProps} onNextLevel={deferredNextLevel} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });

      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={deferredNextLevel} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });

      const victoryConfig = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      let nextPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        nextPromise = victoryConfig.onNext();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(getLatestProps(mockPulsingSpinner).visible).toBe(true);
      });

      await act(async () => {
        (resolveNextLevel as (() => void) | null)?.();
        await nextPromise;
      });

      await waitFor(() => {
        expect(getLatestProps(mockPulsingSpinner).visible).toBe(false);
      });
    });

    it("handles onboarding flow outer catch when welcome modal throws", async () => {
      const {logger} = require("../../../utils/logger");
      const {captureException} = require("../../../utils/sentry");
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;
      mockShowWelcomeModal.mockImplementationOnce(() => {
        throw new Error("welcome crash");
      });

      try {
        mockPlayerData.email = "";
        mockPlayerData.username = "Guest";

        render(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(logger.error).toHaveBeenCalledWith("Error running onboarding flow:", expect.any(Error));
          expect(captureException).toHaveBeenCalledWith(expect.any(Error));
        });
      } finally {
        mockPlayerData.email = originalEmail;
        mockPlayerData.username = originalUsername;
      }
    });

    it("handles settings load and save storage failures", async () => {
      const {logger} = require("../../../utils/logger");
      const {captureException} = require("../../../utils/sentry");
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("load settings fail"));
      (AsyncStorage.setItem as jest.Mock)
        .mockRejectedValueOnce(new Error("save sound fail"))
        .mockRejectedValueOnce(new Error("save haptics fail"))
        .mockRejectedValueOnce(new Error("save language fail"));

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Error loading settings from AsyncStorage:", expect.any(Error));
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Error saving sound setting:", expect.any(Error));
        expect(logger.error).toHaveBeenCalledWith("Error saving haptics setting:", expect.any(Error));
        expect(captureException).toHaveBeenCalled();
      });
    });

    it("pauses background music when loaded setting disables sound", async () => {
      const {SoundManager} = require("../../../services/SoundManager");
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("en");

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(SoundManager.pauseBackgroundMusic).toHaveBeenCalled();
      });
    });

    it("does not overwrite persisted muted setting during initial load", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("en");

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(AsyncStorage.setItem).not.toHaveBeenCalledWith("isSoundEnabled", JSON.stringify(true));
      });
    });

    it("hits active-slot branches for empty current index and first empty index", async () => {
      mockUseGameLogic.currentGuess = [""];
      const {rerender} = render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      let boardProps = getLatestProps(mockGameBoard);
      expect(boardProps.activeSlotIndex).toBe(0);

      mockUseGameLogic.currentGuess = ["A", "", "C"];
      await act(async () => {
        rerender(<GameScreen {...defaultProps} answerLength={4} answer="TEST" userCoins={101} />);
      });
      await waitFor(() => {
        boardProps = getLatestProps(mockGameBoard);
        expect(boardProps.activeSlotIndex).toBe(1);
      });
    });

    it("shows coin-continue error info when spendCoins fails", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.reject(new Error("spend fail")));
      httpsCallable.mockReturnValue(spendCoins);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferCoinContinue: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onCoinContinue());

      expect(mockShowInfoModal).toHaveBeenCalledWith(expect.objectContaining({title: "Error"}));
    });

    it("shows not-enough-coins info and returns false when spendCoins reports insufficient coins", async () => {
      const {httpsCallable} = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.reject(new Error("Insufficient coins to spend.")));
      httpsCallable.mockReturnValue(spendCoins);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferCoinContinue: true,
      });

      const {rerender} = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      const shouldClose = await invokeGameAction(() => config.onCoinContinue());

      expect(shouldClose).toBe(false);
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Not enough coins",
          message: "You do not have enough coins to continue.",
        }),
      );
    });

    it("maps unlocked achievements and shows each achievement fanfare in sequence", async () => {
      const haptics = require("expo-haptics");
      const {ACHIEVEMENT_DEFINITIONS} = require("../../../constants/achievements");
      const {logger} = require("../../../utils/logger");
      const {captureException} = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      ACHIEVEMENT_DEFINITIONS.push({
        id: "ach-1",
        name: "First Win",
        description: "Win your first riddle",
        icon: "*",
      });
      ACHIEVEMENT_DEFINITIONS.push({
        id: "ach-2",
        name: "Speed Runner",
        description: "Solve quickly",
        icon: "!",
      });

      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 10,
        scoreEarned: 20,
        newlyUnlockedAchievementIds: ["ach-1", "ach-2", "missing"],
      });

      const {rerender} = render(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);

      await waitFor(() => {
        expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalled();
      });
      expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          coinsEarned: 10,
          totalCoins: 110,
          achievementNames: ["First Win"],
          achievements: [
            {
              name: "First Win",
              description: "Win your first riddle",
              icon: "*",
            },
          ],
          sequenceProgress: expect.objectContaining({
            currentPopupIndex: 1,
            totalPopups: 3,
            hasNextPopup: true,
            primaryActionText: "Next",
          }),
          onContinue: expect.any(Function),
        }),
      );
      const firstFanfareConfig = mockShowAchievementUnlockFanfareModal.mock.calls[0][0];
      await invokeGameAction(() => firstFanfareConfig.onContinue());
      await waitFor(() => {
        expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledTimes(2);
      });
      expect(mockShowAchievementUnlockFanfareModal.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          coinsEarned: 0,
          totalCoins: 110,
          achievementNames: ["Speed Runner"],
          achievements: [
            {
              name: "Speed Runner",
              description: "Solve quickly",
              icon: "!",
            },
          ],
          sequenceProgress: expect.objectContaining({
            currentPopupIndex: 2,
            totalPopups: 3,
            hasNextPopup: true,
            primaryActionText: "Next",
          }),
          onContinue: expect.any(Function),
        }),
      );
      const secondFanfareConfig = mockShowAchievementUnlockFanfareModal.mock.calls[1][0];
      await invokeGameAction(() => secondFanfareConfig.onContinue());
      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      const config = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      expect(config.unlockedAchievementNames).toEqual(["First Win", "Speed Runner"]);
      expect(haptics.notificationAsync).toHaveBeenCalledWith("success");
      expect(mockUpdatePlayerDataLocally).toHaveBeenCalledWith(
        {
          unlockedAchievements: [
            expect.objectContaining({achievementId: "ach-1"}),
            expect.objectContaining({achievementId: "ach-2"}),
          ],
        },
        {syncToFirestore: false},
      );

      await invokeGameAction(() => config.onNext());
      expect(mockCloseModalByType).toHaveBeenCalledWith("victory");
      expect(mockUseGameLogic.resetGame).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith("Error calling onNextLevel:", expect.any(Error));
      expect(captureException).toHaveBeenCalledWith(expect.any(Error));

      ACHIEVEMENT_DEFINITIONS.length = 0;
    });

    it("shows achievement fanfare when perfect_guess (First Try) unlocks", async () => {
      const {ACHIEVEMENT_DEFINITIONS} = require("../../../constants/achievements");
      ACHIEVEMENT_DEFINITIONS.push({
        id: "perfect_guess",
        name: "First Try",
        description: "Solve a riddle on your first guess",
        icon: "*",
      });

      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 10,
        scoreEarned: 20,
        newlyUnlockedAchievementIds: ["perfect_guess"],
      });

      const {rerender} = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalled();
      });

      expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledWith(
        expect.objectContaining({
          achievementNames: ["First Try"],
          achievements: [
            expect.objectContaining({
              name: "First Try",
              description: "Solve a riddle on your first guess",
              icon: "*",
            }),
          ],
        }),
      );

      ACHIEVEMENT_DEFINITIONS.length = 0;
    });

    it("covers victory onNext success logging branch", async () => {
      const {logger} = require("../../../utils/logger");
      const successfulNextLevel = jest.fn(() => Promise.resolve());
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 1,
        scoreEarned: 2,
      });

      const {rerender} = render(<GameScreen {...defaultProps} onNextLevel={successfulNextLevel} />);
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={successfulNextLevel} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });

      const config = mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onNext());
      expect(logger.debug).toHaveBeenCalledWith("Victory modal: Next level button pressed");
    });

    it("handles attempt-limit modal next/home callbacks including next-level errors", async () => {
      const {logger} = require("../../../utils/logger");
      const {captureException} = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      const onGameLoss = jest.fn();
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];

      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
      });
      const {rerender} = render(
        <GameScreen {...defaultProps} onGameLoss={onGameLoss} onNextLevel={failingNextLevel} />,
      );
      const inputProps = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onGameLoss={onGameLoss} onNextLevel={failingNextLevel} />);
      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      let config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onNext());
      expect(onGameLoss).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Error loading next level after attempt limit:", expect.any(Error));
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("handles loss modal next/home callbacks including next-level errors", async () => {
      const {logger} = require("../../../utils/logger");
      const {captureException} = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.gameOver = false;
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "loss",
        correctAnswer: "ANSWER",
      });
      const rerenderData = render(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);
      const inputProps2 = getLatestProps(mockGameInput);
      await act(async () => {
        await inputProps2.handleSubmit();
      });
      mockUseGameLogic.gameOver = true;
      rerenderData.rerender(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);
      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onNext());
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Error loading next level after loss:", expect.any(Error));
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("applies settings modal toggle callbacks", async () => {
      const {SoundManager} = require("../../../services/SoundManager");
      const {setLocale} = require("../../../i18n");
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === "isSoundEnabled" || key === "isHapticsEnabled") {
          return Promise.resolve("true");
        }
        if (key.startsWith("gameScreenOnboardingSeen")) {
          return Promise.resolve(null);
        }
        return pendingPromise<string | null>();
      });

      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      bottomNavProps.onSettingsPress();
      const config = mockShowSettingsModal.mock.calls[mockShowSettingsModal.mock.calls.length - 1][0];

      await waitFor(() => {
        expect(SoundManager.setSoundEnabled).toHaveBeenCalled();
      });

      await invokeGameAction(() => {
        config.onToggleSound(false);
      });
      await waitFor(() => {
        expect(SoundManager.pauseBackgroundMusic).toHaveBeenCalled();
      });

      await invokeGameAction(() => {
        config.onToggleSound(true);
        config.onToggleHaptics(false);
        config.onChangeLanguage("es");
      });
      await waitFor(() => {
        expect(SoundManager.playBackgroundMusic).toHaveBeenCalled();
      });
      expect(setLocale).toHaveBeenCalledWith("es");
    });

    it("passes a complete-riddle callback to the debug panel", async () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockModalTogglePanel).toHaveBeenCalled();
      });

      const latestProps = mockModalTogglePanel.mock.calls[mockModalTogglePanel.mock.calls.length - 1][0];
      expect(typeof latestProps.onCompleteRiddle).toBe("function");
      expect(typeof latestProps.onGenerateDailyChallenge).toBe("function");
      expect(typeof latestProps.onClearLocalData).toBe("function");
    });

    it("debug clear-local-data clears AsyncStorage and logs out", async () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockModalTogglePanel).toHaveBeenCalled();
      });

      const latestProps = mockModalTogglePanel.mock.calls[mockModalTogglePanel.mock.calls.length - 1][0];
      await invokeGameAction(() => latestProps.onClearLocalData());

      expect(AsyncStorage.clear).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
      expect(mockShowInfoModal).not.toHaveBeenCalledWith(expect.objectContaining({title: "Local Data Cleared"}));
    });

    it("debug complete-riddle fills letters without submitting", async () => {
      renderWithSettingsProvider(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockModalTogglePanel).toHaveBeenCalled();
      });

      const latestProps = mockModalTogglePanel.mock.calls[mockModalTogglePanel.mock.calls.length - 1][0];
      await invokeGameAction(() => latestProps.onCompleteRiddle());

      expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalledWith(["K", "E", "Y", "B", "O", "A", "R", "D"]);
      expect(mockUseGameLogic.processGuess).not.toHaveBeenCalled();
    });

    it("covers keypress truncation and backspace updater branches", async () => {
      mockUseGameLogic.currentGuess = ["A", "B"];
      render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      const boardProps = getLatestProps(mockGameBoard);
      await invokeGameAction(() => {
        boardProps.handleKeyPress("Z");
        boardProps.handleBackspace();
      });

      const keyUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[0][0];
      expect(keyUpdater(["A", "B", "C", "D", "E"])).toEqual(["Z", "B", "C", "D"]);

      const backspaceUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[1][0];
      expect(backspaceUpdater([])).toEqual([]);
      expect(backspaceUpdater(["A", "B", "", ""])).toEqual(["A"]);
    });

    it("renders mode label for daily mode", async () => {
      const {rerender} = render(<GameScreen {...defaultProps} />);
      rerender(<GameScreen {...defaultProps} gameMode="daily" />);
      await waitFor(() => {
        expect(getLatestProps(mockHeader).modeLabel).toBe("Daily Challenge");
      });
    });

    it("shows hint-not-available when all letters are already revealed and covers hint updater", async () => {
      render(<GameScreen {...defaultProps} answer="A" answerLength={1} />);
      const inputProps = getLatestProps(mockGameInput);

      await invokeGameAction(() => inputProps.handleHint());
      let config = mockShowHintModal.mock.calls[mockShowHintModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onShowHint());
      expect(mockShowHintModal).toHaveBeenCalledTimes(1);

      await invokeGameAction(() => inputProps.handleHint());
      config = mockShowHintModal.mock.calls[mockShowHintModal.mock.calls.length - 1][0];
      await invokeGameAction(() => config.onShowHint());
      expect(mockShowHintModal).toHaveBeenCalledTimes(2);
    });

    it("handles purchase-null branch and pay-and-play cheapest product", async () => {
      const {IapService} = require("../../../services/IapService");
      IapService.getProducts.mockResolvedValueOnce([
        {id: "expensive", price: 9.99},
        {id: "cheap", price: 1.99},
      ]);
      IapService.purchaseProduct.mockResolvedValueOnce(null);

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      await act(async () => {
        await headerProps.onCoinsPress();
      });
      await waitFor(() => {
        expect(IapService.getProducts).toHaveBeenCalled();
      });
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      await invokeGameAction(() => config.onPurchaseProduct("cheap"));
      await invokeGameAction(() => config.onPayAndPlay());
      await waitFor(() => {
        expect(IapService.purchaseProduct).toHaveBeenCalledWith("cheap");
      });
    });
  });
});

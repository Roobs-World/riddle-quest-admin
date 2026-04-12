import React from "react";
import { render, waitFor, cleanup } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock all external dependencies before importing the component

// Mock Sentry
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  withScope: jest.fn((cb) => cb({ setExtras: jest.fn() })),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  startInactiveSpan: jest.fn(() => ({ end: jest.fn() })),
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

// Mock react-native-iap
jest.mock("react-native-iap", () => ({
  Product: {},
  initConnection: jest.fn(() => Promise.resolve()),
  endConnection: jest.fn(() => Promise.resolve()),
  getProducts: jest.fn(() => Promise.resolve([])),
  requestPurchase: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-haptic-feedback
jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
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
  loadUserProgressFromFirestore: (...args: unknown[]) =>
    mockLoadUserProgressFromFirestore(...args),
}));

// Mock SoundManager
jest.mock("../../../services/SoundManager", () => ({
  SoundManager: {
    setSoundEnabled: jest.fn(),
    playBackgroundMusic: jest.fn(),
    pauseBackgroundMusic: jest.fn(),
  },
}));

// Mock AuthContext
const mockLogout = jest.fn();
const mockSetGameMode = jest.fn();
const mockFetchCurrentRiddle = jest.fn(() => Promise.resolve());
const mockUpdatePlayerDataLocally = jest.fn();
const mockConsumePendingStreakBreak = jest.fn();
let mockPendingStreakBreak: { previousStreak: number } | null = null;
const mockPlayerData = {
  userId: "test-user-123",
  username: "testuser",
  email: "test@test.com",
  coins: 100,
  progress: {
    classicIndex: 0,
    dailyIndex: 0,
  },
};

jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    playerData: mockPlayerData,
    logout: mockLogout,
    setGameMode: mockSetGameMode,
    fetchCurrentRiddle: mockFetchCurrentRiddle,
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
const mockShowInstructionsModal = jest.fn();
const mockCloseModalByType = jest.fn();
const mockShowCreditsModal = jest.fn();
const mockShowFullProfileDetailsModal = jest.fn();
const mockShowCoinPurchaseFanfareModal = jest.fn();
const mockShowAchievementUnlockFanfareModal = jest.fn();
const mockShowStreakIncreaseFanfareModal = jest.fn();

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
    showInstructionsModal: mockShowInstructionsModal,
    showCreditsModal: mockShowCreditsModal,
    showFullProfileDetailsModal: mockShowFullProfileDetailsModal,
    showCoinPurchaseFanfareModal: mockShowCoinPurchaseFanfareModal,
    showAchievementUnlockFanfareModal: mockShowAchievementUnlockFanfareModal,
    showStreakIncreaseFanfareModal: mockShowStreakIncreaseFanfareModal,
    closeModalByType: mockCloseModalByType,
  }),
}));

// Mock useGameLogic hook
const mockUseGameLogic = {
  guesses: [] as any[],
  currentGuess: [] as string[],
  gameOver: false,
  setCurrentGuess: jest.fn(),
  processGuess: jest.fn(() => Promise.resolve({ outcome: "continue" })) as jest.Mock,
  continueGame: jest.fn(),
  resetGame: jest.fn(),
};

jest.mock("../../../hooks/useGameLogic", () => ({
  __esModule: true,
  default: () => mockUseGameLogic,
}));

// Mock useRewardedAds hook
const mockLoadRewardedAd = jest.fn();
const mockShowRewardedAd = jest.fn(() => Promise.resolve(false));
jest.mock("../../../hooks/useRewardedAds", () => ({
  __esModule: true,
  default: () => ({
    isRewardedAdReady: false,
    loadRewardedAd: mockLoadRewardedAd,
    showRewardedAd: mockShowRewardedAd,
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
  ModalProvider: ({ children }: any) => children,
}));

// Mock game components
const mockHeader = jest.fn();
jest.mock("../../../components/game/Header", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockHeader(props: any) {
    mockHeader(props);
    return React.createElement(View, { testID: "mock-header" });
  };
});

const mockControls = jest.fn();
jest.mock("../../../components/game/Controls", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockControls(props: any) {
    mockControls(props);
    return React.createElement(View, { testID: "mock-controls" });
  };
});

const mockBottomNavigationBar = jest.fn();
jest.mock("../../../components/game/BottomNavigationBar", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockBottomNavigationBar(props: any) {
    mockBottomNavigationBar(props);
    return React.createElement(View, { testID: "mock-bottom-nav" });
  };
});

const mockGameBoard = jest.fn();
jest.mock("../../../components/game/GameBoard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockGameBoard(props: any) {
    mockGameBoard(props);
    return React.createElement(View, { testID: "mock-game-board" });
  };
});

const mockGameInput = jest.fn();
jest.mock("../../../components/game/GameInput", () => ({
  GameInput: function MockGameInput(props: any) {
    const React = require("react");
    const { View } = require("react-native");
    mockGameInput(props);
    return React.createElement(View, { testID: "mock-game-input" });
  },
}));

const mockPulsingSpinner = jest.fn();
jest.mock("../../../components/loading/PulsingSpinner", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockPulsingSpinner(props: any) {
    mockPulsingSpinner(props);
    return React.createElement(View, { testID: "mock-spinner" });
  };
});

const mockModalTogglePanel = jest.fn();
jest.mock("../../../components/development/ModalTogglePanel", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockModalTogglePanel(props: any) {
    mockModalTogglePanel(props);
    return React.createElement(View, { testID: "mock-modal-toggle" });
  };
});

jest.mock("../../../components/background/StarryBackground", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockStarryBackground() {
    return React.createElement(View, { testID: "mock-starry-background" });
  };
});

// Mock AppStrings
jest.mock("../../../constants/AppStrings", () => ({
  APP_LANGUAGE_STORAGE_KEY: "appLanguage",
  AppStrings: {
    CommonAlerts: {
      ERROR_TITLE: "Error",
    },
    CoinShop: {
      NO_PACKS_AVAILABLE: "No packs available",
    },
    StreakFanfare: {
      TITLE: "Streak Increased!",
      STREAK_SUFFIX: "day streak",
      CONTINUE_BUTTON: "Continue",
    },
    GameScreenAlerts: {
      SUBMIT_GUESS_ERROR_TITLE: "Error",
      SUBMIT_GUESS_ERROR_MESSAGE: "Could not submit guess",
      GUEST_MODE_NOTICE_TITLE: "Guest Mode",
      GUEST_MODE_NOTICE_MESSAGE: "Progress is local only.",
      AD_NOT_READY_TITLE: "Ad Not Ready",
      AD_NOT_READY_MESSAGE: "Please try again soon.",
      HINT_NOT_AVAILABLE_TITLE: "Hint Not Available",
      HINT_NOT_AVAILABLE_MESSAGE: "All letters are already revealed.",
      PURCHASE_FAILED_TITLE: "Purchase Failed",
      PURCHASE_FAILED_MESSAGE: "Purchase failed. Please try again.",
      SPEND_COINS_ERROR_MESSAGE: "Unable to spend coins.",
      DAILY_CHALLENGE_LABEL: "Daily Challenge",
      CLASSIC_LABEL: "Classic",
    },
  },
  SupportedLanguage: {},
  getAppLanguage: () => "en",
  isSupportedLanguage: jest.fn(() => true),
  setAppLanguage: jest.fn(),
}));

// Mock constants
jest.mock("../../../constants/game", () => ({
  SKIP_COST_CLASSIC: 10,
  SKIP_COST_DAILY: 15,
  CONTINUE_COST_COINS: 20,
  MODAL_CLOSE_DELAY_MS: 300,
  SOUND_RESUME_DELAY_MS: 100,
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
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
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

describe("GameScreen", () => {
  const defaultProps = {
    riddleId: "riddle-123",
    riddleText: "What has keys but no locks?",
    answer: "KEYBOARD",
    answerLength: 8,
    userCoins: 100,
    hintCost: 10,
    onGameWin: jest.fn(),
    onGameLoss: jest.fn(),
    onHintUsed: jest.fn(),
    onSkipUsed: jest.fn(),
    onNextLevel: jest.fn(),
    gameMode: "classic" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingStreakBreak = null;
    mockPlayerData.email = "test@test.com";
    mockPlayerData.username = "testuser";
    mockLoadUserProgressFromFirestore.mockResolvedValue(mockPlayerData);
    mockUseGameLogic.guesses = [];
    mockUseGameLogic.currentGuess = [];
    mockUseGameLogic.gameOver = false;
    mockUseGameLogic.processGuess.mockResolvedValue({ outcome: "continue" });
    mockUseGameLogic.setCurrentGuess.mockReset();
    mockUseGameLogic.continueGame.mockReset();
    mockUseGameLogic.resetGame.mockReset();
  });

  afterEach(() => {
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
  });

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);
      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with classic game mode", async () => {
      const { queryByTestId } = render(
        <GameScreen {...defaultProps} gameMode="classic" />
      );
      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with daily game mode", async () => {
      const { queryByTestId } = render(
        <GameScreen {...defaultProps} gameMode="daily" />
      );
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
      expect(element.props.hintCost).toBe(10);
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
      const { rerender } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onGameWin).not.toHaveBeenCalled();
        expect(defaultProps.onGameLoss).not.toHaveBeenCalled();
        expect(defaultProps.onHintUsed).not.toHaveBeenCalled();
        expect(defaultProps.onSkipUsed).not.toHaveBeenCalled();
      });
    });
  });

  describe("Modal Integration", () => {
    it("should trigger welcome modal on mount", async () => {
      const { rerender } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeModal).toHaveBeenCalled();
      });
    });

    it("should show guest warning modal instead of welcome modal for guest users", async () => {
      const originalEmail = mockPlayerData.email;
      const originalUsername = mockPlayerData.username;
      try {
        mockPlayerData.email = "guest_test-user-123@guest.qwordly.com";
        mockPlayerData.username = "Guest";

        render(<GameScreen {...defaultProps} />);

        await waitFor(() => {
          expect(mockShowInfoModal).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Guest Mode",
              message: "Progress is local only.",
            })
          );
        });
        expect(mockShowWelcomeModal).not.toHaveBeenCalled();
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
      const { unmount, queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it("should handle rerender with different props", async () => {
      const { rerender, queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} userCoins={50} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle IAP product loading error", async () => {
      const { IapService } = require("../../../services/IapService");
      IapService.getProducts.mockRejectedValueOnce(new Error("IAP error"));

      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle ProductPricingService loading error", async () => {
      const { ProductPricingService } = require("../../../services/ProductPricingService");
      ProductPricingService.getActiveProducts.mockRejectedValueOnce(
        new Error("Pricing error")
      );

      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

  });

  describe("Game Mode Changes", () => {
    it("should handle switching from classic to daily mode", async () => {
      const { rerender, queryByTestId } = render(
        <GameScreen {...defaultProps} gameMode="classic" />
      );

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
    it("should handle zero answer length", async () => {
      const { queryByTestId } = render(
        <GameScreen {...defaultProps} answerLength={0} />
      );

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle negative answer length", async () => {
      const { queryByTestId } = render(
        <GameScreen {...defaultProps} answerLength={-1} />
      );

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Riddle Changes", () => {
    it("should handle riddleId change", async () => {
      const { rerender, queryByTestId } = render(
        <GameScreen {...defaultProps} riddleId="riddle-1" />
      );

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      rerender(<GameScreen {...defaultProps} riddleId="riddle-2" />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle answer change", async () => {
      const { rerender, queryByTestId } = render(
        <GameScreen {...defaultProps} answer="FIRST" answerLength={5} />
      );

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

      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with full current guess", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];

      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should render with previous guesses", async () => {
      mockUseGameLogic.guesses = [
        [
          { letter: "T", feedback: "red" },
          { letter: "E", feedback: "yellow" },
          { letter: "S", feedback: "red" },
          { letter: "T", feedback: "red" },
        ],
      ];

      const { queryByTestId } = render(
        <GameScreen {...defaultProps} answerLength={4} answer="TEST" />
      );

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });

    it("should handle empty guesses array with filled current guess", async () => {
      mockUseGameLogic.guesses = [];
      mockUseGameLogic.currentGuess = ["A", "B", "C", "D"];

      const { queryByTestId } = render(
        <GameScreen {...defaultProps} answerLength={4} answer="ABCD" />
      );

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Settings Integration", () => {
    it("should render with default sound enabled", async () => {
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });

      const { SoundManager } = require("../../../services/SoundManager");
      expect(SoundManager.setSoundEnabled).toHaveBeenCalled();
    });

    it("should render with default haptics enabled", async () => {
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Rewarded Ads Integration", () => {
    it("should work with rewarded ads hook", async () => {
      // The hook is already mocked in the test setup
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Loading States", () => {
    it("should render with loading indicator available", async () => {
      // The loading state comes from useGameSessionController which is mocked
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Modal States", () => {
    it("should render with modal system integrated", async () => {
      // Modal system is mocked and available
      const { queryByTestId } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(queryByTestId("mock-header")).toBeTruthy();
      });
    });
  });

  describe("Behavioral Coverage", () => {
    const getLatestProps = (mockFn: jest.Mock) =>
      mockFn.mock.calls[mockFn.mock.calls.length - 1][0];

    it("loads rewarded ads on mount", async () => {
      const { rerender } = render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockLoadRewardedAd).toHaveBeenCalledTimes(1);
      });
    });

    it("submits a completed guess and stores the result", async () => {
      const result = {
        outcome: "continue",
        attemptsRemaining: 2,
      };
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce(result);

      render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();

      expect(mockUseGameLogic.processGuess).toHaveBeenCalledWith([
        "K",
        "E",
        "Y",
        "B",
        "O",
        "A",
        "R",
        "D",
      ]);
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
      const { Linking } = require("react-native");
      const openURLSpy = jest
        .spyOn(Linking, "openURL")
        .mockResolvedValueOnce(true);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      bottomNavProps.onSettingsPress();

      const config = mockShowSettingsModal.mock.calls[0][0];
      config.onPressHelp();
      expect(openURLSpy).toHaveBeenCalledWith("mailto:support@adspeq.com");
      config.onPressCredits();

      expect(mockCloseModalByType).toHaveBeenCalledWith("settings");
      jest.runAllTimers();
      expect(mockShowInstructionsModal).not.toHaveBeenCalled();
      expect(mockShowCreditsModal).toHaveBeenCalled();
      openURLSpy.mockRestore();
      jest.useRealTimers();
    });

    it("opens skip modal and spends coins when confirmed", async () => {
      const { httpsCallable } = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({ data: {} }));
      httpsCallable.mockReturnValue(spendCoins);

      render(<GameScreen {...defaultProps} gameMode="classic" />);

      const inputProps = getLatestProps(mockGameInput);
      inputProps.handleNext();

      const config = mockShowSkipModal.mock.calls[0][0];
      await config.onSkipLevel();

      await waitFor(() => {
        expect(spendCoins).toHaveBeenCalledWith({ amount: 10, reason: "skip" });
      });
      expect(defaultProps.onSkipUsed).toHaveBeenCalledWith(10);
      expect(mockUseGameLogic.resetGame).toHaveBeenCalled();
      expect(defaultProps.onNextLevel).toHaveBeenCalled();
    });

    it("opens hint modal and applies revealed letter when user confirms", async () => {
      render(<GameScreen {...defaultProps} answer="TEST" answerLength={4} />);

      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleHint();

      const config = mockShowHintModal.mock.calls[0][0];
      config.onShowHint();

      expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalled();
      expect(defaultProps.onHintUsed).toHaveBeenCalledWith(10);
    });

    it("shows victory modal and calls onGameWin when game ends with win", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 25,
        scoreEarned: 100,
      });

      const { rerender } = render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();

      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });
      expect(defaultProps.onGameWin).toHaveBeenCalledWith(0, 25, 100, undefined);
    });

    it("shows streak break modal once and consumes pending streak break", async () => {
      mockPendingStreakBreak = { previousStreak: 7 };
      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowInfoModal).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Streak Broken",
          })
        );
      });

      const streakCall = mockShowInfoModal.mock.calls.find(
        (call) => call[0]?.title === "Streak Broken"
      );
      expect(streakCall).toBeDefined();
      streakCall?.[0]?.onConfirm?.();
      expect(mockConsumePendingStreakBreak).toHaveBeenCalled();
    });

    it("shows daily streak fanfare before victory when challenge streak increases", async () => {
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 30,
        scoreEarned: 200,
        newWinStreak: 5,
      });

      const { rerender } = render(<GameScreen {...defaultProps} gameMode="daily" />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} gameMode="daily" />);

      await waitFor(() => {
        expect(mockShowStreakIncreaseFanfareModal).toHaveBeenCalledWith(
          expect.objectContaining({ streakValue: 5 })
        );
      });

      const fanfareConfig =
        mockShowStreakIncreaseFanfareModal.mock.calls[
          mockShowStreakIncreaseFanfareModal.mock.calls.length - 1
        ][0];
      fanfareConfig.onContinue();
      expect(mockShowVictoryModal).toHaveBeenCalled();
      expect(defaultProps.onGameWin).toHaveBeenCalledWith(0, 30, 200, 5);
    });

    it("handles onboarding dismiss callback", async () => {
      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowWelcomeModal).toHaveBeenCalled();
      });

      const onboardingConfig = mockShowWelcomeModal.mock.calls[0][0];
      onboardingConfig.onDismiss();

      await waitFor(() => {
        expect(mockShowInstructionsModal).toHaveBeenCalled();
      });
    });

    it("opens loss modal for attempt limit and handles continue actions", async () => {
      const { httpsCallable } = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.resolve({ data: {} }));
      httpsCallable.mockReturnValue(spendCoins);
      mockShowRewardedAd.mockResolvedValueOnce(true);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });

      const { rerender } = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];

      expect(config.canUseCoin).toBe(true);
      expect(config.canWatchAd).toBe(false);

      await config.onWatchAdContinue();
      await config.onCoinContinue();
      config.onOpenShop();

      expect(mockUseGameLogic.continueGame).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(spendCoins).toHaveBeenCalledWith({ amount: 20, reason: "continue" });
      });
      expect(mockShowCoinShopModal).toHaveBeenCalled();
    });

    it("shows ad-not-ready info when continue ad does not complete", async () => {
      mockShowRewardedAd.mockResolvedValueOnce(false);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferRewardedAd: true,
      });

      const { rerender } = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });

      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      await config.onWatchAdContinue();
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Ad Not Ready" })
      );
    });

    it("shows loss modal for terminal loss and triggers onGameLoss", async () => {
      const haptics = require("react-native-haptic-feedback");
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "loss",
        correctAnswer: "ANSWER",
      });

      const { rerender } = render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      expect(haptics.trigger).toHaveBeenCalledWith(
        "notificationError",
        expect.any(Object)
      );
      expect(defaultProps.onGameLoss).toHaveBeenCalledWith("ANSWER");
    });

    it("shows spend-coins error when skip purchase fails", async () => {
      const { httpsCallable } = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.reject(new Error("nope")));
      httpsCallable.mockReturnValue(spendCoins);
      render(<GameScreen {...defaultProps} gameMode="daily" />);

      const inputProps = getLatestProps(mockGameInput);
      inputProps.handleNext();
      const config = mockShowSkipModal.mock.calls[0][0];
      await config.onSkipLevel();

      await waitFor(() => {
        expect(mockShowSpendCoinsError).toHaveBeenCalled();
      });
    });

    it("handles submit error by showing info modal", async () => {
      const haptics = require("react-native-haptic-feedback");
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockRejectedValueOnce(new Error("submit failed"));
      render(<GameScreen {...defaultProps} />);

      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error" })
      );
    });

    it("triggers haptic warning for incomplete guess submit", async () => {
      const haptics = require("react-native-haptic-feedback");
      mockUseGameLogic.currentGuess = ["K", "E"];
      render(<GameScreen {...defaultProps} />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      expect(haptics.trigger).toHaveBeenCalledWith(
        "notificationWarning",
        expect.any(Object)
      );
    });

    it("routes keyboard and slot handlers to game logic setters", () => {
      render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      const boardProps = getLatestProps(mockGameBoard);

      boardProps.handleKeyPress("A");
      boardProps.handleBackspace();
      boardProps.onSelectCurrentGuessSlot(2);

      expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalled();
      const updater = mockUseGameLogic.setCurrentGuess.mock.calls[0][0];
      expect(typeof updater).toBe("function");
      expect(updater([])).toEqual(["A"]);
    });

    it("opens profile modal from bottom navigation after refreshing player data", async () => {
      render(<GameScreen {...defaultProps} />);
      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      await bottomNavProps.onProfilePress();

      await waitFor(() => {
        expect(mockLoadUserProgressFromFirestore).toHaveBeenCalledWith(
          mockPlayerData.userId
        );
        expect(mockShowFullProfileDetailsModal).toHaveBeenCalledWith(
          expect.objectContaining({ playerData: expect.any(Object) })
        );
      });
    });

    it("opens coin shop and handles pay-and-play fallback when no products", () => {
      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      headerProps.onCoinsPress();

      expect(mockShowCoinShopModal).toHaveBeenCalled();
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      config.onPayAndPlay();

      expect(mockShowNoProductsAvailable).toHaveBeenCalled();
    });

    it("opens coin shop in loading state while shop products are still fetching", () => {
      const { IapService } = require("../../../services/IapService");
      const { ProductPricingService } = require("../../../services/ProductPricingService");

      IapService.getProducts.mockImplementationOnce(() => new Promise(() => {}));
      ProductPricingService.getActiveProducts.mockImplementationOnce(
        () => new Promise(() => {})
      );

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      headerProps.onCoinsPress();

      const config =
        mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      expect(config.loading).toBe(true);
    });

    it("handles coin shop purchase success and failure branches", async () => {
      const { IapService } = require("../../../services/IapService");
      IapService.purchaseProduct.mockResolvedValueOnce({ transactionId: "1" });

      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      headerProps.onCoinsPress();
      let config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];
      await config.onPurchaseProduct("pack_1");

      expect(mockCloseModalByType).toHaveBeenCalledWith("coinShop");
      expect(mockShowCoinPurchaseFanfareModal).toHaveBeenCalled();

      IapService.purchaseProduct.mockRejectedValueOnce(new Error("boom"));
      await config.onPurchaseProduct("pack_2");
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Purchase Failed" })
      );
    });

    it("handles watch-ad-for-coins not-ready and error branches", async () => {
      render(<GameScreen {...defaultProps} />);
      const headerProps = getLatestProps(mockHeader);
      headerProps.onCoinsPress();
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      mockShowRewardedAd.mockResolvedValueOnce(false);
      await config.onWatchVideo();
      expect(mockShowAdNotReady).toHaveBeenCalled();

      mockShowRewardedAd.mockRejectedValueOnce(new Error("ad crash"));
      await config.onWatchVideo();
      expect(mockShowAdError).toHaveBeenCalled();
    });

    it("handles onboarding flow outer catch when welcome modal throws", async () => {
      const { logger } = require("../../../utils/logger");
      const { captureException } = require("../../../utils/sentry");
      mockShowWelcomeModal.mockImplementationOnce(() => {
        throw new Error("welcome crash");
      });

      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Error running onboarding flow:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("handles settings load and save storage failures", async () => {
      const { logger } = require("../../../utils/logger");
      const { captureException } = require("../../../utils/sentry");
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error("load settings fail")
      );
      (AsyncStorage.setItem as jest.Mock)
        .mockRejectedValueOnce(new Error("save sound fail"))
        .mockRejectedValueOnce(new Error("save haptics fail"))
        .mockRejectedValueOnce(new Error("save language fail"));

      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Error loading settings from AsyncStorage:",
          expect.any(Error)
        );
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Error saving sound setting to AsyncStorage:",
          expect.any(Error)
        );
        expect(logger.error).toHaveBeenCalledWith(
          "Error saving haptics setting to AsyncStorage:",
          expect.any(Error)
        );
        expect(logger.error).toHaveBeenCalledWith(
          "Error saving language setting to AsyncStorage:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalled();
      });
    });

    it("pauses background music when loaded setting disables sound", async () => {
      const { SoundManager } = require("../../../services/SoundManager");
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("en");

      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(SoundManager.pauseBackgroundMusic).toHaveBeenCalled();
      });
    });

    it("does not overwrite persisted muted setting during initial load", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("en");

      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
          "isSoundEnabled",
          JSON.stringify(true)
        );
      });
    });

    it("hits active-slot branches for empty current index and first empty index", async () => {
      mockUseGameLogic.currentGuess = [""];
      const { rerender } = render(
        <GameScreen {...defaultProps} answerLength={4} answer="TEST" />
      );
      let boardProps = getLatestProps(mockGameBoard);
      expect(boardProps.activeSlotIndex).toBe(0);

      mockUseGameLogic.currentGuess = ["A", "", "C"];
      rerender(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      await waitFor(() => {
        boardProps = getLatestProps(mockGameBoard);
        expect(boardProps.activeSlotIndex).toBe(1);
      });
    });

    it("shows coin-continue error info when spendCoins fails", async () => {
      const { httpsCallable } = require("@react-native-firebase/functions");
      const spendCoins = jest.fn(() => Promise.reject(new Error("spend fail")));
      httpsCallable.mockReturnValue(spendCoins);
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
        canOfferCoinContinue: true,
      });

      const { rerender } = render(<GameScreen {...defaultProps} userCoins={100} />);
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} userCoins={100} />);

      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      await config.onCoinContinue();

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error" })
      );
    });

    it("maps unlocked achievements and triggers success haptic; handles victory modal callbacks", async () => {
      const haptics = require("react-native-haptic-feedback");
      const { ACHIEVEMENT_DEFINITIONS } = require("../../../constants/achievements");
      const { logger } = require("../../../utils/logger");
      const { captureException } = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      ACHIEVEMENT_DEFINITIONS.push({
        id: "ach-1",
        name: "First Win",
        description: "Win your first riddle",
        icon: "*",
      });

      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 10,
        scoreEarned: 20,
        newlyUnlockedAchievementIds: ["ach-1", "missing"],
      });

      const { rerender } = render(
        <GameScreen {...defaultProps} onNextLevel={failingNextLevel} />
      );
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });

      const config =
        mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      expect(config.unlockedAchievementNames).toEqual(["First Win"]);
      expect(mockShowAchievementUnlockFanfareModal).toHaveBeenCalledWith({
        achievementNames: ["First Win"],
        achievements: [
          {
            name: "First Win",
            description: "Win your first riddle",
            icon: "*",
          },
        ],
      });
      expect(haptics.trigger).toHaveBeenCalledWith("notificationSuccess", expect.any(Object));

      await config.onNext();
      expect(mockCloseModalByType).toHaveBeenCalledWith("victory");
      expect(mockUseGameLogic.resetGame).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith("Error calling onNextLevel:", expect.any(Error));
      expect(captureException).toHaveBeenCalledWith(expect.any(Error));

      ACHIEVEMENT_DEFINITIONS.length = 0;
    });

    it("covers victory onNext success logging branch", async () => {
      const { logger } = require("../../../utils/logger");
      const successfulNextLevel = jest.fn(() => Promise.resolve());
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "win",
        coinsEarned: 1,
        scoreEarned: 2,
      });

      const { rerender } = render(
        <GameScreen {...defaultProps} onNextLevel={successfulNextLevel} />
      );
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={successfulNextLevel} />);

      await waitFor(() => {
        expect(mockShowVictoryModal).toHaveBeenCalled();
      });

      const config =
        mockShowVictoryModal.mock.calls[mockShowVictoryModal.mock.calls.length - 1][0];
      await config.onNext();
      expect(logger.debug).toHaveBeenCalledWith("Victory modal: Next level button pressed");
    });

    it("handles attempt-limit modal next/home callbacks including next-level errors", async () => {
      const { logger } = require("../../../utils/logger");
      const { captureException } = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];

      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "attemptLimitReached",
        correctAnswer: "ANSWER",
      });
      const { rerender } = render(
        <GameScreen {...defaultProps} onNextLevel={failingNextLevel} />
      );
      const inputProps = getLatestProps(mockGameInput);
      await inputProps.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerender(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);
      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      let config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      config.onNext();
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Error loading next level after attempt limit:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("handles loss modal next/home callbacks including next-level errors", async () => {
      const { logger } = require("../../../utils/logger");
      const { captureException } = require("../../../utils/sentry");
      const failingNextLevel = jest.fn(() => Promise.reject(new Error("next fail")));
      mockUseGameLogic.currentGuess = ["K", "E", "Y", "B", "O", "A", "R", "D"];
      mockUseGameLogic.gameOver = false;
      mockUseGameLogic.processGuess.mockResolvedValueOnce({
        outcome: "loss",
        correctAnswer: "ANSWER",
      });
      const rerenderData = render(
        <GameScreen {...defaultProps} onNextLevel={failingNextLevel} />
      );
      const inputProps2 = getLatestProps(mockGameInput);
      await inputProps2.handleSubmit();
      mockUseGameLogic.gameOver = true;
      rerenderData.rerender(<GameScreen {...defaultProps} onNextLevel={failingNextLevel} />);
      await waitFor(() => {
        expect(mockShowLossModal).toHaveBeenCalled();
      });
      const config = mockShowLossModal.mock.calls[mockShowLossModal.mock.calls.length - 1][0];
      config.onNext();
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Error loading next level after loss:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("applies settings modal toggle callbacks", () => {
      const { SoundManager } = require("../../../services/SoundManager");
      const { setAppLanguage } = require("../../../constants/AppStrings");
      render(<GameScreen {...defaultProps} />);

      const bottomNavProps = getLatestProps(mockBottomNavigationBar);
      bottomNavProps.onSettingsPress();
      const config = mockShowSettingsModal.mock.calls[mockShowSettingsModal.mock.calls.length - 1][0];

      config.onToggleSound(false);
      config.onToggleSound(true);
      config.onToggleHaptics(false);
      config.onChangeLanguage("es");

      expect(SoundManager.pauseBackgroundMusic).toHaveBeenCalled();
      expect(SoundManager.playBackgroundMusic).toHaveBeenCalled();
      expect(setAppLanguage).toHaveBeenCalledWith("es");
    });

    it("passes a complete-riddle callback to the debug panel", async () => {
      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockModalTogglePanel).toHaveBeenCalled();
      });

      const latestProps =
        mockModalTogglePanel.mock.calls[mockModalTogglePanel.mock.calls.length - 1][0];
      expect(typeof latestProps.onCompleteRiddle).toBe("function");
      expect(typeof latestProps.onGenerateDailyChallenge).toBe("function");
    });

    it("debug complete-riddle fills letters without submitting", async () => {
      render(<GameScreen {...defaultProps} />);

      await waitFor(() => {
        expect(mockModalTogglePanel).toHaveBeenCalled();
      });

      const latestProps =
        mockModalTogglePanel.mock.calls[mockModalTogglePanel.mock.calls.length - 1][0];
      latestProps.onCompleteRiddle();

      expect(mockUseGameLogic.setCurrentGuess).toHaveBeenCalledWith([
        "K",
        "E",
        "Y",
        "B",
        "O",
        "A",
        "R",
        "D",
      ]);
      expect(mockUseGameLogic.processGuess).not.toHaveBeenCalled();
    });

    it("covers keypress truncation and backspace updater branches", () => {
      render(<GameScreen {...defaultProps} answerLength={4} answer="TEST" />);
      const boardProps = getLatestProps(mockGameBoard);
      boardProps.handleKeyPress("Z");
      boardProps.handleBackspace();

      const keyUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[0][0];
      expect(keyUpdater(["A", "B", "C", "D", "E"])).toEqual(["Z", "B", "C", "D"]);

      const backspaceUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[1][0];
      expect(backspaceUpdater([])).toEqual([]);
      expect(backspaceUpdater(["A", "B", "", ""])).toEqual(["", "B"]);
    });

    it("renders mode label for daily mode", async () => {
      const { rerender } = render(<GameScreen {...defaultProps} />);
      rerender(<GameScreen {...defaultProps} gameMode="daily" />);
      await waitFor(() => {
        expect(getLatestProps(mockHeader).modeLabel).toBe("Daily Challenge");
      });
    });

    it("shows hint-not-available when all letters are already revealed and covers hint updater", async () => {
      render(<GameScreen {...defaultProps} answer="A" answerLength={1} />);
      const inputProps = getLatestProps(mockGameInput);

      await inputProps.handleHint();
      let config = mockShowHintModal.mock.calls[mockShowHintModal.mock.calls.length - 1][0];
      config.onShowHint();
      const hintUpdater = mockUseGameLogic.setCurrentGuess.mock.calls[mockUseGameLogic.setCurrentGuess.mock.calls.length - 1][0];
      expect(hintUpdater([])).toEqual(["a"]);

      await inputProps.handleHint();
      config = mockShowHintModal.mock.calls[mockShowHintModal.mock.calls.length - 1][0];
      config.onShowHint();
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Hint Not Available" })
      );
    });

    it("handles purchase-null branch, pay-and-play cheapest product, and rewarded-ad success", async () => {
      const { IapService } = require("../../../services/IapService");
      const { logger } = require("../../../utils/logger");
      IapService.getProducts.mockResolvedValueOnce([
        { id: "expensive", price: 9.99 },
        { id: "cheap", price: 1.99 },
      ]);
      IapService.purchaseProduct.mockResolvedValueOnce(null);
      mockShowRewardedAd.mockResolvedValueOnce(true);

      render(<GameScreen {...defaultProps} />);
      await waitFor(() => {
        expect(IapService.getProducts).toHaveBeenCalled();
      });

      const headerProps = getLatestProps(mockHeader);
      headerProps.onCoinsPress();
      const config = mockShowCoinShopModal.mock.calls[mockShowCoinShopModal.mock.calls.length - 1][0];

      await config.onPurchaseProduct("cheap");
      config.onPayAndPlay();
      await waitFor(() => {
        expect(IapService.purchaseProduct).toHaveBeenCalledWith("cheap");
      });

      await config.onWatchVideo();
      expect(logger.debug).toHaveBeenCalledWith("Rewarded ad for coins shown successfully");
    });
  });
});

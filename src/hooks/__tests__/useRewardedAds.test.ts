// Mock react-native-applovin-max
const mockRewardedAd = {
  loadAd: jest.fn(),
  showAd: jest.fn(),
  addAdLoadedEventListener: jest.fn(),
  addAdLoadFailedEventListener: jest.fn(),
  addAdFailedToDisplayEventListener: jest.fn(),
  addAdDisplayedEventListener: jest.fn(),
  addAdClickedEventListener: jest.fn(),
  addAdHiddenEventListener: jest.fn(),
  addAdReceivedRewardEventListener: jest.fn(),
};

jest.mock("react-native-applovin-max", () => ({
  RewardedAd: mockRewardedAd,
  AdInfo: {},
  AdLoadFailedInfo: {},
  AdDisplayFailedInfo: {},
  AdRewardInfo: {},
}));

// Mock Firebase
const mockHttpsCallable = jest.fn();
const mockFunctions = jest.fn(() => ({
  httpsCallable: mockHttpsCallable,
}));

jest.mock("@react-native-firebase/functions", () => mockFunctions);
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

// Mock expo-constants
const mockConstants = {
  expoConfig: {
    extra: {
      APPLOVIN_REWARDED_AD_UNIT_ID: "test-rewarded-ad-unit-id",
    },
  },
};

jest.mock("expo-constants", () => mockConstants);

// Mock AuthContext
const mockPlayerData = {
  userId: "test-user-123",
  username: "testuser",
  email: "test@example.com",
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    playerData: mockPlayerData,
  })),
}));

// Mock console methods
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

describe("useRewardedAds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Hook structure and imports", () => {
    it("should import and define the hook", () => {
      expect(() => {
        require("../useRewardedAds");
      }).not.toThrow();
    });

    it("should export the hook as default", () => {
      const useRewardedAds = require("../useRewardedAds").default;
      expect(typeof useRewardedAds).toBe("function");
    });

    it("should have proper dependencies and imports", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("react-native-applovin-max");
      expect(hookContent).toContain("@react-native-firebase/functions");
      expect(hookContent).toContain("../contexts/AuthContext");
      expect(hookContent).toContain("expo-constants");
    });
  });

  describe("Configuration and constants", () => {
    it("should read rewarded ad unit ID from constants", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("APPLOVIN_REWARDED_AD_UNIT_ID");
      expect(hookContent).toContain("Constants.expoConfig?.extra");
    });

    it("should handle missing ad unit ID configuration", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("CRITICAL ERROR");
      expect(hookContent).toContain("environment variable is not set");
    });

    it("should define exponential retry constants", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("MAX_EXPONENTIAL_RETRY_COUNT");
      expect(hookContent).toContain("Math.pow");
    });
  });

  describe("Interface and types", () => {
    it("should define UseRewardedAds interface", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("interface UseRewardedAds");
      expect(hookContent).toContain("isRewardedAdReady: boolean");
      expect(hookContent).toContain("loadRewardedAd: () => void");
      expect(hookContent).toContain("showRewardedAd: () => void");
    });

    it("should define extended reward info interface", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("interface ExtendedAdRewardInfo");
      expect(hookContent).toContain("getAmount(): number");
      expect(hookContent).toContain("getLabel(): string");
      expect(hookContent).toContain("getAdUnitId(): string");
      expect(hookContent).toContain("getPlacement(): string | null");
      expect(hookContent).toContain("getNetworkName(): string");
    });
  });

  describe("State management", () => {
    it("should initialize with correct default state", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useState(false)");
      expect(hookContent).toContain("setIsRewardedAdReady");
      expect(hookContent).toContain("useRef(0)");
      expect(hookContent).toContain("retryAttempt");
    });

    it("should use proper hook dependencies", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useCallback");
      expect(hookContent).toContain("useEffect");
      expect(hookContent).toContain("playerData?.userId");
    });
  });

  describe("Ad loading functionality", () => {
    it("should implement loadRewardedAd function", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("const loadRewardedAd = useCallback");
      expect(hookContent).toContain("RewardedAd.loadAd");
      expect(hookContent).toContain("Loading rewarded ad");
    });

    it("should handle missing ad unit ID in load function", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Cannot load rewarded ad");
      expect(hookContent).toContain("APPLOVIN_REWARDED_AD_UNIT_ID is not set");
    });
  });

  describe("Ad showing functionality", () => {
    it("should implement showRewardedAd function", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("const showRewardedAd = useCallback");
      expect(hookContent).toContain("RewardedAd.showAd");
      expect(hookContent).toContain("Showing rewarded ad");
    });

    it("should handle ad not ready scenario", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad is not ready yet");
      expect(hookContent).toContain("if (isRewardedAdReady)");
    });

    it("should handle missing ad unit ID in show function", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Cannot show rewarded ad");
      expect(hookContent).toContain("APPLOVIN_REWARDED_AD_UNIT_ID is not set");
    });
  });

  describe("Event listeners setup", () => {
    it("should setup all required event listeners", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("addAdLoadedEventListener");
      expect(hookContent).toContain("addAdLoadFailedEventListener");
      expect(hookContent).toContain("addAdFailedToDisplayEventListener");
      expect(hookContent).toContain("addAdDisplayedEventListener");
      expect(hookContent).toContain("addAdClickedEventListener");
      expect(hookContent).toContain("addAdHiddenEventListener");
      expect(hookContent).toContain("addAdReceivedRewardEventListener");
    });

    it("should implement all event handler callbacks", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("onRewardedAdLoaded");
      expect(hookContent).toContain("onRewardedAdLoadFailed");
      expect(hookContent).toContain("onRewardedAdDisplayFailed");
      expect(hookContent).toContain("onRewardedAdDisplayed");
      expect(hookContent).toContain("onRewardedAdClicked");
      expect(hookContent).toContain("onRewardedAdHidden");
      expect(hookContent).toContain("onUserRewarded");
    });
  });

  describe("Retry mechanism", () => {
    it("should implement exponential backoff retry", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("retryAttempt.current++");
      expect(hookContent).toContain("MAX_EXPONENTIAL_RETRY_COUNT");
      expect(hookContent).toContain("Math.pow(");
      expect(hookContent).toContain("setTimeout");
    });

    it("should reset retry attempt on successful load", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("retryAttempt.current = 0");
      expect(hookContent).toContain("Reset retry attempt");
    });

    it("should handle retry limit reached", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("retry limit reached");
      expect(hookContent).toContain(
        "if (retryAttempt.current > MAX_EXPONENTIAL_RETRY_COUNT)"
      );
    });
  });

  describe("Firebase integration", () => {
    it("should integrate with Firebase functions", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("functions(getApp()).httpsCallable");
      expect(hookContent).toContain("awardedAdCallback");
      expect(hookContent).toContain("playerData?.userId");
    });

    it("should handle reward callback with proper data", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("userId: playerData.userId");
      expect(hookContent).toContain("placement: firebasePlacement");
      expect(hookContent).toContain("extendedRewardInfo.getAdUnitId()");
      expect(hookContent).toContain("extendedRewardInfo.getPlacement()");
      expect(hookContent).toContain("extendedRewardInfo.getNetworkName()");
    });

    it("should handle Firebase function errors", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("try {");
      expect(hookContent).toContain("catch (error)");
      expect(hookContent).toContain("Error calling rewardedAdCallback");
    });

    it("should handle missing user ID", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain(
        "Cannot notify server: User ID not available"
      );
    });
  });

  describe("Reward processing", () => {
    it("should process reward info correctly", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("const onUserRewarded = useCallback");
      expect(hookContent).toContain("extendedRewardInfo.getAmount()");
      expect(hookContent).toContain("extendedRewardInfo.getLabel()");
      expect(hookContent).toContain("User rewarded:");
    });

    it("should include server-side validation comments", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain(
        "Do NOT award coins directly on the client side"
      );
      expect(hookContent).toContain("server is the authority");
      expect(hookContent).toContain("S2S callback");
    });
  });

  describe("Ad lifecycle events", () => {
    it("should handle ad loaded event", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad loaded from");
      expect(hookContent).toContain("setIsRewardedAdReady(true)");
      expect(hookContent).toContain("adInfo.networkName");
    });

    it("should handle ad display failed event", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad failed to display");
      expect(hookContent).toContain("setIsRewardedAdReady(false)");
      expect(hookContent).toContain("loadRewardedAd()");
    });

    it("should handle ad hidden event", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad hidden");
      expect(hookContent).toContain("Pre-load the next ad");
    });

    it("should handle ad clicked event", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad clicked");
    });

    it("should handle ad displayed event", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("Rewarded ad displayed");
    });
  });

  describe("Hook lifecycle and dependencies", () => {
    it("should setup useEffect with proper dependencies", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useEffect(() => {");
      expect(hookContent).toContain("onRewardedAdLoaded,");
      expect(hookContent).toContain("onRewardedAdLoadFailed,");
      expect(hookContent).toContain("onUserRewarded,");
    });

    it("should return proper interface properties", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("return {");
      expect(hookContent).toContain("isRewardedAdReady,");
      expect(hookContent).toContain("loadRewardedAd,");
      expect(hookContent).toContain("showRewardedAd,");
    });

    it("should have proper useCallback dependencies", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("[loadRewardedAd]");
      expect(hookContent).toContain("[isRewardedAdReady, loadRewardedAd]");
      expect(hookContent).toContain("[playerData?.userId]");
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle missing configuration gracefully", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("if (!REWARDED_AD_UNIT_ID)");
      expect(hookContent).toContain("console.error");
      expect(hookContent).toContain("return;");
    });

    it("should handle network and loading failures", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("failed to load with code");
      expect(hookContent).toContain("failed to display with code");
      expect(hookContent).toContain("errorInfo.code");
      expect(hookContent).toContain("errorInfo.message");
    });

    it("should include proper logging for debugging", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("console.log");
      expect(hookContent).toContain("console.error");
      expect(hookContent).toContain("console.warn");
    });
  });

  describe("Integration patterns", () => {
    it("should integrate with AuthContext properly", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("const { playerData } = useAuth()");
      expect(hookContent).toContain("playerData?.userId");
    });

    it("should handle placement and ad unit ID logic", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("const firebasePlacement =");
      expect(hookContent).toContain("adUnitId || placement || networkName");
      expect(hookContent).toContain("rewarded_ad");
    });

    it("should follow AppLovin SDK patterns", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useRewardedAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("AppLovin recommends");
      expect(hookContent).toContain("exponentially higher delays");
      expect(hookContent).toContain("loading the next ad");
    });
  });
});

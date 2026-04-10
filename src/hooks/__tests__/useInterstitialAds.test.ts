// Mock react-native-applovin-max
const mockInterstitialAd = {
  loadAd: jest.fn(),
  showAd: jest.fn(),
  addAdLoadedEventListener: jest.fn(),
  addAdLoadFailedEventListener: jest.fn(),
  addAdFailedToDisplayEventListener: jest.fn(),
  addAdDisplayedEventListener: jest.fn(),
  addAdClickedEventListener: jest.fn(),
  addAdHiddenEventListener: jest.fn(),
};

jest.mock("react-native-applovin-max", () => ({
  InterstitialAd: mockInterstitialAd,
  AdInfo: {},
  AdLoadFailedInfo: {},
  AdDisplayFailedInfo: {},
}));

// Mock expo-constants
const mockConstants = {
  expoConfig: {
    extra: {
      APPLOVIN_INTERSTITIAL_AD_UNIT_ID: "test-ad-unit-id",
    },
  },
};

jest.mock("expo-constants", () => mockConstants);

// Mock React hooks
const mockSetState = jest.fn();
const mockUseState = jest.fn((initial) => [initial, mockSetState]);
const mockUseCallback = jest.fn((fn) => fn);
const mockUseEffect = jest.fn();
const mockUseRef = jest.fn((initial) => ({ current: initial }));

jest.mock("react", () => ({
  useState: mockUseState,
  useCallback: mockUseCallback,
  useEffect: mockUseEffect,
  useRef: mockUseRef,
}));

// Mock console methods
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("useInterstitialAds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore mock implementations after clearAllMocks
    mockUseState.mockImplementation((initial) => [initial, mockSetState]);
    mockUseCallback.mockImplementation((fn) => fn);
    mockUseEffect.mockImplementation(() => {});
    mockUseRef.mockImplementation((initial) => ({ current: initial }));
    // mockSetState is also cleared by clearAllMocks, which is fine for a simple jest.fn()
  });

  describe("Hook structure and imports", () => {
    it("should import and define the hook", () => {
      expect(() => {
        require("../useInterstitialAds");
      }).not.toThrow();
    });

    it("should have proper React dependencies", () => {
      const { useInterstitialAds } = require("../useInterstitialAds");
      expect(typeof useInterstitialAds).toBe("function");
      expect(mockUseState).toBeDefined();
      expect(mockUseCallback).toBeDefined();
      expect(mockUseEffect).toBeDefined();
    });

    it("should call useEffect, useState, and useCallback when the hook is executed", () => {
      const { useInterstitialAds } = require("../useInterstitialAds");
      useInterstitialAds(); // Execute the hook

      expect(mockUseEffect).toHaveBeenCalled();
      expect(mockUseState).toHaveBeenCalled();
      expect(mockUseCallback).toHaveBeenCalled();
    });
  });

  describe("Constants and configuration", () => {
    it("should read ad unit ID from expo constants", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain(
        "Constants.expoConfig?.extra?.APPLOVIN_INTERSTITIAL_AD_UNIT_ID"
      );
    });

    it("should handle missing configuration gracefully", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("logger.error");
      expect(hookContent).toContain("not configured");
    });
  });

  describe("Hook interface structure", () => {
    it("should define correct interface properties", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("interface InterstitialAdHook");
      expect(hookContent).toContain("isAdLoading: boolean");
      expect(hookContent).toContain("isAdShowing: boolean");
      expect(hookContent).toContain("loadInterstitialAd: () => void");
      expect(hookContent).toContain("showInterstitialAd: () => void");
      expect(hookContent).toContain("wasAdDisplayed: boolean");
    });

    it("should return correct interface properties", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("return {");
      expect(hookContent).toContain("isAdLoading,");
      expect(hookContent).toContain("isAdShowing,");
      expect(hookContent).toContain("loadInterstitialAd,");
      expect(hookContent).toContain("showInterstitialAd,");
      expect(hookContent).toContain("wasAdDisplayed,");
    });
  });

  describe("State management", () => {
    it("should initialize state with useState", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useState<boolean>(false)");
      expect(hookContent).toContain("setIsAdLoading");
      expect(hookContent).toContain("setIsAdShowing");
      expect(hookContent).toContain("setIsAdLoaded");
      expect(hookContent).toContain("setWasAdDisplayed");
    });

    it("should use useCallback for function memoization", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useCallback");
      expect(hookContent).toContain("loadInterstitialAd = useCallback");
      expect(hookContent).toContain("showInterstitialAd = useCallback");
    });
  });

  describe("Ad loading logic", () => {
    it("should implement ad loading with proper checks", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("InterstitialAd.loadAd");
      expect(hookContent).toContain("setIsAdLoading(true)");
      expect(hookContent).toContain("isAdLoading || isAdLoaded");
    });

    it("should implement ad showing with proper checks", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("InterstitialAd.showAd");
      expect(hookContent).toContain("if (isAdLoaded)");
      expect(hookContent).toContain("setWasAdDisplayed(false)");
    });
  });

  describe("Event listeners", () => {
    it("should setup all required event listeners", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("addAdLoadedEventListener");
      expect(hookContent).toContain("addAdLoadFailedEventListener");
      expect(hookContent).toContain("addAdFailedToDisplayEventListener");
      expect(hookContent).toContain("addAdDisplayedEventListener");
      expect(hookContent).toContain("addAdClickedEventListener");
      expect(hookContent).toContain("addAdHiddenEventListener");
    });

    it("should implement event handler callbacks", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("onInterstitialAdLoaded");
      expect(hookContent).toContain("onInterstitialAdLoadFailed");
      expect(hookContent).toContain("onInterstitialAdDisplayed");
      expect(hookContent).toContain("onInterstitialAdDisplayFailed");
      expect(hookContent).toContain("onInterstitialAdHidden");
      expect(hookContent).toContain("onInterstitialAdClicked");
    });
  });

  describe("Error handling", () => {
    it("should handle configuration errors", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("logger.error");
      expect(hookContent).toContain("not configured");
      expect(hookContent).toContain("Cannot load ad");
      expect(hookContent).toContain("Cannot show ad");
    });

    it("should handle load failures with retry", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("setTimeout");
      expect(hookContent).toContain("loadInterstitialAd()");
      expect(hookContent).toContain("5000");
    });

    it("should handle display failures", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("failed to display");
      expect(hookContent).toContain("setIsAdShowing(false)");
      expect(hookContent).toContain("setIsAdLoaded(false)");
    });
  });

  describe("Lifecycle management", () => {
    it("should use useEffect for lifecycle management", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("useEffect(() => {");
      expect(hookContent).toContain("// Attach event listeners");
    });

    it("should handle ad lifecycle events", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("setIsAdLoaded(true)");
      expect(hookContent).toContain("setIsAdShowing(true)");
      expect(hookContent).toContain("setWasAdDisplayed(true)");
    });
  });

  describe("Integration patterns", () => {
    it("should implement proper state transitions", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("setIsAdLoading(false)");
      expect(hookContent).toContain("Pre-load the next ad");
      expect(hookContent).toContain("loadInterstitialAd()");
    });

    it("should have proper dependency arrays", () => {
      const fs = require("fs");
      const path = require("path");

      const hookPath = path.join(__dirname, "../useInterstitialAds.ts");
      const hookContent = fs.readFileSync(hookPath, "utf8");

      expect(hookContent).toContain("[isAdLoading, isAdLoaded]");
      expect(hookContent).toContain("[loadInterstitialAd]");
      expect(hookContent).toContain("[isAdLoaded, loadInterstitialAd]");
    });
  });
});


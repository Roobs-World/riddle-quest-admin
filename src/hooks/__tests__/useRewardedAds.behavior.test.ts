/**
 * Behavioral unit tests for useRewardedAds hook.
 * These tests verify actual hook behavior using renderHook from React Testing Library.
 */
import { renderHook, act } from "@testing-library/react-native";

// Capture event handler callbacks registered with RewardedAd
let adLoadedHandler: ((adInfo: any) => void) | null = null;
let adLoadFailedHandler: ((errorInfo: any) => void) | null = null;
let adDisplayedHandler: ((adInfo: any) => void) | null = null;
let adDisplayFailedHandler: ((errorInfo: any) => void) | null = null;
let adHiddenHandler: ((adInfo: any) => void) | null = null;
let adClickedHandler: ((adInfo: any) => void) | null = null;
let adReceivedRewardHandler: ((rewardInfo: any) => void) | null = null;

// Export setter functions for the mock to use
export const _setAdLoadedHandler = (h: any) => {
  adLoadedHandler = h;
};
export const _setAdLoadFailedHandler = (h: any) => {
  adLoadFailedHandler = h;
};
export const _setAdDisplayedHandler = (h: any) => {
  adDisplayedHandler = h;
};
export const _setAdDisplayFailedHandler = (h: any) => {
  adDisplayFailedHandler = h;
};
export const _setAdHiddenHandler = (h: any) => {
  adHiddenHandler = h;
};
export const _setAdClickedHandler = (h: any) => {
  adClickedHandler = h;
};
export const _setAdReceivedRewardHandler = (h: any) => {
  adReceivedRewardHandler = h;
};

// Create mock functions inside factory to avoid hoisting issues
jest.mock("react-native-applovin-max", () => {
  const mockLoadAd = jest.fn();
  const mockShowAd = jest.fn();
  const mockAddAdLoadedEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdLoadedHandler) {
      testModule._setAdLoadedHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdLoadFailedEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdLoadFailedHandler) {
      testModule._setAdLoadFailedHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdDisplayedEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdDisplayedHandler) {
      testModule._setAdDisplayedHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdFailedToDisplayEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdDisplayFailedHandler) {
      testModule._setAdDisplayFailedHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdHiddenEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdHiddenHandler) {
      testModule._setAdHiddenHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdClickedEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdClickedHandler) {
      testModule._setAdClickedHandler(handler);
    }
    return jest.fn();
  });
  const mockAddAdReceivedRewardEventListener = jest.fn((handler: any) => {
    const testModule = require("./useRewardedAds.behavior.test");
    if (testModule._setAdReceivedRewardHandler) {
      testModule._setAdReceivedRewardHandler(handler);
    }
    return jest.fn();
  });

  return {
    __esModule: true,
    RewardedAd: {
      loadAd: mockLoadAd,
      showAd: mockShowAd,
      addAdLoadedEventListener: mockAddAdLoadedEventListener,
      addAdLoadFailedEventListener: mockAddAdLoadFailedEventListener,
      addAdDisplayedEventListener: mockAddAdDisplayedEventListener,
      addAdFailedToDisplayEventListener: mockAddAdFailedToDisplayEventListener,
      addAdHiddenEventListener: mockAddAdHiddenEventListener,
      addAdClickedEventListener: mockAddAdClickedEventListener,
      addAdReceivedRewardEventListener: mockAddAdReceivedRewardEventListener,
    },
    AdInfo: {},
    AdLoadFailedInfo: {},
    AdDisplayFailedInfo: {},
  };
});

// Mock expo-constants with ad unit ID
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        APPLOVIN_REWARDED_AD_UNIT_ID: "test-rewarded-ad-unit-id",
      },
    },
  },
}));

// Mock Firebase functions
const mockCallableFunction = jest.fn().mockResolvedValue({ data: {} });
const mockHttpsCallable = jest.fn(() => mockCallableFunction);
jest.mock("@react-native-firebase/functions", () => ({
  __esModule: true,
  getFunctions: jest.fn(() => ({})),
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  getApp: jest.fn(() => ({})),
}));

// Mock AuthContext
const mockPlayerData = { userId: "test-user-123", oddsUpgradeLevel: 0 };
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    playerData: mockPlayerData,
  })),
}));

// Mock AnalyticsService
const mockLogAdEvent = jest.fn().mockResolvedValue(undefined);
jest.mock("../../services/AnalyticsService", () => ({
  analyticsService: {
    logAdEvent: (...args: unknown[]) => mockLogAdEvent(...args),
  },
}));

// Mock logger
const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
  },
}));

// Mock Sentry
jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Import after mocks are set up
import useRewardedAds from "../useRewardedAds";
import { RewardedAd } from "react-native-applovin-max";

describe("useRewardedAds - Behavioral Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset captured handlers
    adLoadedHandler = null;
    adLoadFailedHandler = null;
    adDisplayedHandler = null;
    adDisplayFailedHandler = null;
    adHiddenHandler = null;
    adClickedHandler = null;
    adReceivedRewardHandler = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Initial State", () => {
    it("should return correct initial state values", () => {
      const { result } = renderHook(() => useRewardedAds());

      expect(result.current.isRewardedAdReady).toBe(false);
    });

    it("should provide loadRewardedAd and showRewardedAd functions", () => {
      const { result } = renderHook(() => useRewardedAds());

      expect(typeof result.current.loadRewardedAd).toBe("function");
      expect(typeof result.current.showRewardedAd).toBe("function");
    });

    it("should register all event listeners on mount", () => {
      renderHook(() => useRewardedAds());

      expect(RewardedAd.addAdLoadedEventListener).toHaveBeenCalledTimes(1);
      expect(RewardedAd.addAdLoadFailedEventListener).toHaveBeenCalledTimes(1);
      expect(RewardedAd.addAdDisplayedEventListener).toHaveBeenCalledTimes(1);
      expect(
        RewardedAd.addAdFailedToDisplayEventListener
      ).toHaveBeenCalledTimes(1);
      expect(RewardedAd.addAdHiddenEventListener).toHaveBeenCalledTimes(1);
      expect(RewardedAd.addAdClickedEventListener).toHaveBeenCalledTimes(1);
      expect(
        RewardedAd.addAdReceivedRewardEventListener
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("loadRewardedAd", () => {
    it("should call RewardedAd.loadAd with ad unit ID", () => {
      const { result } = renderHook(() => useRewardedAds());

      act(() => {
        result.current.loadRewardedAd();
      });

      expect(RewardedAd.loadAd).toHaveBeenCalledWith(
        "test-rewarded-ad-unit-id"
      );
    });

    it("should log debug message when loading", () => {
      const { result } = renderHook(() => useRewardedAds());

      act(() => {
        result.current.loadRewardedAd();
      });

      expect(mockLoggerDebug).toHaveBeenCalledWith("Loading rewarded ad...");
    });
  });

  describe("Ad Load Events", () => {
    it("should set isRewardedAdReady to true when ad is loaded", () => {
      const { result } = renderHook(() => useRewardedAds());

      act(() => {
        result.current.loadRewardedAd();
      });

      expect(result.current.isRewardedAdReady).toBe(false);

      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      expect(result.current.isRewardedAdReady).toBe(true);
    });

    it("should log analytics event when ad is loaded", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      expect(mockLogAdEvent).toHaveBeenCalledWith("loaded", {
        network_name: "AppLovin",
      });
    });

    it("should log when ad fails to load", () => {
      const { result } = renderHook(() => useRewardedAds());

      act(() => {
        result.current.loadRewardedAd();
      });

      act(() => {
        adLoadFailedHandler?.({ code: -1, message: "Network error" });
      });

      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining("Rewarded ad failed to load")
      );
    });

    it("should log analytics event when ad fails to load", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adLoadFailedHandler?.({ code: 204, message: "No fill" });
      });

      expect(mockLogAdEvent).toHaveBeenCalledWith("load_failed", {
        error_code: 204,
      });
    });
  });

  describe("showRewardedAd", () => {
    it("should return false when ad is not ready", async () => {
      const { result } = renderHook(() => useRewardedAds());

      let showResult: boolean = true;
      await act(async () => {
        showResult = await result.current.showRewardedAd();
      });

      expect(showResult).toBe(false);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "Rewarded ad is not ready yet."
      );
    });

    it("should attempt to load ad when showing but not ready", async () => {
      const { result } = renderHook(() => useRewardedAds());

      await act(async () => {
        await result.current.showRewardedAd();
      });

      expect(RewardedAd.loadAd).toHaveBeenCalled();
    });

    it("should call RewardedAd.showAd when ad is ready", async () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      // Show ad
      act(() => {
        result.current.showRewardedAd();
      });

      expect(RewardedAd.showAd).toHaveBeenCalledWith(
        "test-rewarded-ad-unit-id"
      );
    });

    it("should return false when another ad show is pending", async () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      // Start showing first ad
      act(() => {
        result.current.showRewardedAd();
      });

      // Try to show another ad while first is pending
      let secondShowResult: boolean = true;
      await act(async () => {
        secondShowResult = await result.current.showRewardedAd();
      });

      expect(secondShowResult).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Rewarded ad show requested while another ad is still active."
      );
    });

    it("should resolve with true when user earns reward", async () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      // Start showing ad
      let showPromise: Promise<boolean>;
      act(() => {
        showPromise = result.current.showRewardedAd();
      });

      // Simulate user receiving reward
      act(() => {
        adReceivedRewardHandler?.({
          getAmount: () => 50,
          getLabel: () => "coins",
          getAdUnitId: () => "test-rewarded-ad-unit-id",
          getPlacement: () => null,
          getNetworkName: () => "AppLovin",
        });
      });

      // Simulate ad being hidden (completes the show flow)
      await act(async () => {
        adHiddenHandler?.({ networkName: "AppLovin" });
      });

      const showResult = await showPromise!;
      expect(showResult).toBe(true);
    });

    it("should resolve with false when ad is hidden without reward", async () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      // Start showing ad
      let showPromise: Promise<boolean>;
      act(() => {
        showPromise = result.current.showRewardedAd();
      });

      // Simulate ad being hidden without reward
      await act(async () => {
        adHiddenHandler?.({ networkName: "AppLovin" });
      });

      const showResult = await showPromise!;
      expect(showResult).toBe(false);
    });

    it("should timeout after 90 seconds", async () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      // Start showing ad
      let showPromise: Promise<boolean>;
      act(() => {
        showPromise = result.current.showRewardedAd();
      });

      // Advance time past timeout
      await act(async () => {
        jest.advanceTimersByTime(90000);
      });

      const showResult = await showPromise!;
      expect(showResult).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Timed out waiting for rewarded ad to close."
      );
    });
  });

  describe("Ad Display Events", () => {
    it("should log analytics event when ad is displayed", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adDisplayedHandler?.({ networkName: "AppLovin" });
      });

      expect(mockLogAdEvent).toHaveBeenCalledWith("displayed", {
        network_name: "AppLovin",
      });
    });

    it("should set isRewardedAdReady to false when display fails", () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      expect(result.current.isRewardedAdReady).toBe(true);

      // Simulate display failure
      act(() => {
        adDisplayFailedHandler?.({ code: -1, message: "Display error" });
      });

      expect(result.current.isRewardedAdReady).toBe(false);
    });

    it("should set isRewardedAdReady to false when ad is hidden", () => {
      const { result } = renderHook(() => useRewardedAds());

      // Load and simulate successful load
      act(() => {
        result.current.loadRewardedAd();
      });
      act(() => {
        adLoadedHandler?.({ networkName: "AppLovin" });
      });

      expect(result.current.isRewardedAdReady).toBe(true);

      // Simulate ad hidden
      act(() => {
        adHiddenHandler?.({ networkName: "AppLovin" });
      });

      expect(result.current.isRewardedAdReady).toBe(false);
    });

    it("should log when ad is hidden", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adHiddenHandler?.({ networkName: "AppLovin" });
      });

      expect(mockLoggerDebug).toHaveBeenCalledWith("Rewarded ad hidden");
    });

    it("should log debug message when ad is clicked", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adClickedHandler?.({ networkName: "AppLovin" });
      });

      expect(mockLoggerDebug).toHaveBeenCalledWith("Rewarded ad clicked");
    });
  });

  describe("Reward Processing", () => {
    it("should log reward details when user is rewarded", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adReceivedRewardHandler?.({
          getAmount: () => 50,
          getLabel: () => "coins",
          getAdUnitId: () => "test-rewarded-ad-unit-id",
          getPlacement: () => null,
          getNetworkName: () => "AppLovin",
        });
      });

      expect(mockLoggerDebug).toHaveBeenCalledWith("User rewarded: 50 coins");
    });

    it("should log analytics event when user is rewarded", () => {
      renderHook(() => useRewardedAds());

      act(() => {
        adReceivedRewardHandler?.({
          getAmount: () => 50,
          getLabel: () => "coins",
          getAdUnitId: () => "test-rewarded-ad-unit-id",
          getPlacement: () => null,
          getNetworkName: () => "AppLovin",
        });
      });

      expect(mockLogAdEvent).toHaveBeenCalledWith("completed", {
        reward_amount: 50,
        reward_label: "coins",
      });
    });

    it("should call Firebase function to notify server of reward", async () => {
      renderHook(() => useRewardedAds());

      await act(async () => {
        adReceivedRewardHandler?.({
          getAmount: () => 50,
          getLabel: () => "coins",
          getAdUnitId: () => "test-rewarded-ad-unit-id",
          getPlacement: () => "banner_placement",
          getNetworkName: () => "AppLovin",
        });
      });

      expect(mockHttpsCallable).toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should clear timers on unmount", () => {
      const { result, unmount } = renderHook(() => useRewardedAds());

      act(() => {
        result.current.loadRewardedAd();
      });

      // Simulate load failure to potentially start retry timer
      act(() => {
        adLoadFailedHandler?.({ code: -1, message: "Network error" });
      });

      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});

// Note: Tests for missing configuration and exponential backoff edge cases
// are covered by the file-content-based tests in useRewardedAds.test.ts since
// dynamic module re-mocking with jest.resetModules() causes issues with
// React's hook state management in renderHook.

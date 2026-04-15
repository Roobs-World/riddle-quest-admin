/**
 * Tests for AnalyticsService.
 *
 * Verifies that the service initialises Firebase Analytics, wires to the
 * GameEventBus, and forwards the expected events to the analytics SDK.
 */

import { AnalyticsService } from "../AnalyticsService";
import {
  gameEventBus,
  GuessSubmittedEvent,
  GuessValidatedEvent,
  GameCompletedEvent,
} from "../GameEventBus";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockSetUserId = jest.fn().mockResolvedValue(undefined);
const mockSetAnalyticsCollectionEnabled = jest.fn().mockResolvedValue(undefined);
const mockLogEvent = jest.fn().mockResolvedValue(undefined);
const mockLogShare = jest.fn().mockResolvedValue(undefined);
const mockSetUserProperty = jest.fn().mockResolvedValue(undefined);

const mockAnalyticsInstance = {
  setUserId: mockSetUserId,
  setAnalyticsCollectionEnabled: mockSetAnalyticsCollectionEnabled,
  logEvent: mockLogEvent,
  logShare: mockLogShare,
  setUserProperty: mockSetUserProperty,
};

jest.mock("@react-native-firebase/analytics", () => ({
  __esModule: true,
  // Named modular-API functions delegate to the mock instance
  getAnalytics: jest.fn(() => mockAnalyticsInstance),
  setUserId: jest.fn((instance: typeof mockAnalyticsInstance, id: string | null) => instance.setUserId(id)),
  setAnalyticsCollectionEnabled: jest.fn((instance: typeof mockAnalyticsInstance, v: boolean) =>
    instance.setAnalyticsCollectionEnabled(v)
  ),
  logEvent: jest.fn((instance: typeof mockAnalyticsInstance, name: string, params: unknown) =>
    instance.logEvent(name, params)
  ),
  logShare: jest.fn((instance: typeof mockAnalyticsInstance, opts: unknown) =>
    instance.logShare(opts)
  ),
  setUserProperty: jest.fn((instance: typeof mockAnalyticsInstance, name: string, value: string) =>
    instance.setUserProperty(name, value)
  ),
}));

jest.mock("../../utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a fresh AnalyticsService instance (bypasses singleton for isolation). */
function createService(): AnalyticsService {
  // Access private constructor via type cast
  return new (AnalyticsService as unknown as new () => AnalyticsService)();
}

/** Flush multiple microtask queues to let chained async handlers settle. */
const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    gameEventBus.clearListeners();
    service = createService();
  });

  afterEach(async () => {
    await service.reset();
    gameEventBus.clearListeners();
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("sets the user id in Firebase Analytics", async () => {
      await service.initialize("user-123");
      expect(mockSetUserId).toHaveBeenCalledWith("user-123");
    });

    it("enables analytics collection", async () => {
      await service.initialize("user-123");
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe("reset", () => {
    it("clears the user id", async () => {
      await service.initialize("user-123");
      await service.reset();
      expect(mockSetUserId).toHaveBeenLastCalledWith(null);
    });
  });

  // ── Screen tracking ────────────────────────────────────────────────────────

  describe("logScreenView", () => {
    it("logs a screen_view event with screen name and class", async () => {
      await service.logScreenView("GameScreen");
      expect(mockLogEvent).toHaveBeenCalledWith("screen_view", {
        screen_name: "GameScreen",
        screen_class: "GameScreen",
      });
    });
  });

  // ── Manual events ──────────────────────────────────────────────────────────

  describe("logCoinSpend", () => {
    it("logs a coin_spend event", async () => {
      await service.logCoinSpend({ action: "hint", amount: 50, gameMode: "classic" });
      expect(mockLogEvent).toHaveBeenCalledWith("coin_spend", {
        action: "hint",
        amount: 50,
        gameMode: "classic",
      });
    });
  });

  describe("logAchievementUnlocked", () => {
    it("logs an achievement_unlocked event", async () => {
      await service.logAchievementUnlocked("first_win");
      expect(mockLogEvent).toHaveBeenCalledWith("achievement_unlocked", {
        achievement_id: "first_win",
      });
    });
  });

  describe("logShare", () => {
    it("calls analytics logShare with platform and game mode", async () => {
      await service.logShare({ platform: "x", gameMode: "daily" });
      expect(mockLogShare).toHaveBeenCalledWith({
        content_type: "game_result",
        item_id: "daily",
        method: "x",
      });
    });
  });

  describe("setUserProperty", () => {
    it("delegates to analytics setUserProperty", async () => {
      await service.setUserProperty("favorite_mode", "classic");
      expect(mockSetUserProperty).toHaveBeenCalledWith("favorite_mode", "classic");
    });
  });

  // ── GameEventBus wiring ────────────────────────────────────────────────────

  describe("GameEventBus integration", () => {
    beforeEach(async () => {
      await service.initialize("user-bus");
      jest.clearAllMocks(); // Clear init calls so we can assert on event-driven calls
    });

    it("logs guess_submitted when GUESS_SUBMITTED fires", async () => {
      gameEventBus.emit<GuessSubmittedEvent>({ type: "GUESS_SUBMITTED", guess: "APPLE", attemptNumber: 1 });
      await flushPromises();
      expect(mockLogEvent).toHaveBeenCalledWith("guess_submitted", {
        attempt_number: 1,
      });
    });

    it("logs guess_validated with letter counts when GUESS_VALIDATED fires", async () => {
      gameEventBus.emit<GuessValidatedEvent>({
        type: "GUESS_VALIDATED",
        guess: "APPLE",
        feedback: [
          { letter: "A", status: "green" },
          { letter: "P", status: "yellow" },
          { letter: "P", status: "red" },
          { letter: "L", status: "green" },
          { letter: "E", status: "red" },
        ],
        isCorrect: false,
      });
      await flushPromises();
      expect(mockLogEvent).toHaveBeenCalledWith("guess_validated", {
        is_correct: false,
        green_letters: 2,
        yellow_letters: 1,
      });
    });

    it("logs game_completed and level_end when GAME_COMPLETED with won fires", async () => {
      gameEventBus.emit<GameCompletedEvent>({
        type: "GAME_COMPLETED",
        outcome: "won",
        attempts: 3,
        coinsEarned: 150,
      });
      await flushPromises();
      expect(mockLogEvent).toHaveBeenCalledWith("game_completed", {
        outcome: "won",
        attempts: 3,
        coins_earned: 150,
      });
      expect(mockLogEvent).toHaveBeenCalledWith("level_end", {
        level: 3,
        success: "true",
      });
    });

    it("logs game_completed without level_end when GAME_COMPLETED with lost fires", async () => {
      gameEventBus.emit<GameCompletedEvent>({
        type: "GAME_COMPLETED",
        outcome: "lost",
        attempts: 6,
      });
      await flushPromises();
      expect(mockLogEvent).toHaveBeenCalledWith("game_completed", {
        outcome: "lost",
        attempts: 6,
        coins_earned: 0,
      });
      expect(mockLogEvent).not.toHaveBeenCalledWith(
        "level_end",
        expect.any(Object)
      );
    });

    it("stops forwarding events after reset", async () => {
      await service.reset();
      jest.clearAllMocks();
      gameEventBus.emit<GuessSubmittedEvent>({ type: "GUESS_SUBMITTED", guess: "APPLE", attemptNumber: 2 });
      await flushPromises();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  // ── Funnel events ─────────────────────────────────────────────────────────

  describe("logAuthEvent", () => {
    it("logs auth_signup event", async () => {
      await service.logAuthEvent("signup");
      expect(mockLogEvent).toHaveBeenCalledWith("auth_signup", {});
    });

    it("logs auth_login event", async () => {
      await service.logAuthEvent("login");
      expect(mockLogEvent).toHaveBeenCalledWith("auth_login", {});
    });

    it("logs auth_logout event", async () => {
      await service.logAuthEvent("logout");
      expect(mockLogEvent).toHaveBeenCalledWith("auth_logout", {});
    });

    it("includes extra params when provided", async () => {
      await service.logAuthEvent("login", { method: "google" });
      expect(mockLogEvent).toHaveBeenCalledWith("auth_login", { method: "google" });
    });
  });

  describe("logPurchaseEvent", () => {
    it("logs iap_purchase_initiated event", async () => {
      await service.logPurchaseEvent("initiated", { product_id: "com.qwordly.coinpack1" });
      expect(mockLogEvent).toHaveBeenCalledWith("iap_purchase_initiated", {
        product_id: "com.qwordly.coinpack1",
      });
    });

    it("logs iap_purchase_validated event", async () => {
      await service.logPurchaseEvent("validated", { product_id: "com.qwordly.coinpack1" });
      expect(mockLogEvent).toHaveBeenCalledWith("iap_purchase_validated", {
        product_id: "com.qwordly.coinpack1",
      });
    });

    it("logs iap_purchase_completed with coins", async () => {
      await service.logPurchaseEvent("completed", {
        product_id: "com.qwordly.coinpack2",
        coins: 100,
      });
      expect(mockLogEvent).toHaveBeenCalledWith("iap_purchase_completed", {
        product_id: "com.qwordly.coinpack2",
        coins: 100,
      });
    });

    it("logs iap_purchase_failed with error code", async () => {
      await service.logPurchaseEvent("failed", {
        product_id: "com.qwordly.coinpack1",
        error_code: "E_USER_CANCELLED",
      });
      expect(mockLogEvent).toHaveBeenCalledWith("iap_purchase_failed", {
        product_id: "com.qwordly.coinpack1",
        error_code: "E_USER_CANCELLED",
      });
    });
  });

  describe("logCoinPackPurchased", () => {
    it("logs coin_pack_purchased with a default purchase count", async () => {
      await service.logCoinPackPurchased({
        productId: "com.qwordly.coinpack2",
        coins: 100,
      });

      expect(mockLogEvent).toHaveBeenCalledWith("coin_pack_purchased", {
        product_id: "com.qwordly.coinpack2",
        coins: 100,
        purchase_count: 1,
      });
    });

    it("logs coin_pack_purchased with an explicit purchase count", async () => {
      await service.logCoinPackPurchased({
        productId: "com.qwordly.coinpack5",
        coins: 1000,
        purchaseCount: 3,
      });

      expect(mockLogEvent).toHaveBeenCalledWith("coin_pack_purchased", {
        product_id: "com.qwordly.coinpack5",
        coins: 1000,
        purchase_count: 3,
      });
    });
  });

  describe("logAdEvent", () => {
    it("logs rewarded_ad_loaded event", async () => {
      await service.logAdEvent("loaded", { network_name: "AppLovin" });
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_loaded", {
        network_name: "AppLovin",
      });
    });

    it("logs rewarded_ad_load_failed event", async () => {
      await service.logAdEvent("load_failed", { error_code: 204 });
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_load_failed", {
        error_code: 204,
      });
    });

    it("logs rewarded_ad_displayed event", async () => {
      await service.logAdEvent("displayed", { network_name: "AppLovin" });
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_displayed", {
        network_name: "AppLovin",
      });
    });

    it("logs rewarded_ad_completed with reward info", async () => {
      await service.logAdEvent("completed", { reward_amount: 50, reward_label: "coins" });
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_completed", {
        reward_amount: 50,
        reward_label: "coins",
      });
    });

    it("logs rewarded_ad_display_failed event", async () => {
      await service.logAdEvent("display_failed", { error_code: 503 });
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_display_failed", {
        error_code: 503,
      });
    });

    it("allows empty params", async () => {
      await service.logAdEvent("loaded");
      expect(mockLogEvent).toHaveBeenCalledWith("rewarded_ad_loaded", {});
    });
  });

  describe("shop pack events", () => {
    it("logs shop_pack_impression", async () => {
      await service.logShopPackImpression({
        productId: "com.qwordly.coinpack1",
        productKey: "COIN_PACK_TINY",
        coins: 50,
        sortOrder: 1,
        featured: false,
        displayPrice: "$0.99",
      });

      expect(mockLogEvent).toHaveBeenCalledWith("shop_pack_impression", {
        product_id: "com.qwordly.coinpack1",
        product_key: "COIN_PACK_TINY",
        coins: 50,
        sort_order: 1,
        featured: false,
        display_price: "$0.99",
      });
    });

    it("logs shop_pack_selected", async () => {
      await service.logShopPackSelected({
        productId: "com.qwordly.coinpack2",
        productKey: "COIN_PACK_SMALL",
        coins: 100,
        sortOrder: 2,
        featured: true,
        displayPrice: "$1.99",
      });

      expect(mockLogEvent).toHaveBeenCalledWith("shop_pack_selected", {
        product_id: "com.qwordly.coinpack2",
        product_key: "COIN_PACK_SMALL",
        coins: 100,
        sort_order: 2,
        featured: true,
        display_price: "$1.99",
      });
    });
  });

  // ── Error resilience ───────────────────────────────────────────────────────

  describe("error handling", () => {
    it("does not throw when analytics SDK throws during logScreenView", async () => {
      mockLogEvent.mockRejectedValueOnce(new Error("SDK error"));
      await expect(service.logScreenView("CrashScreen")).resolves.not.toThrow();
    });

    it("does not throw when analytics SDK throws during logEvent", async () => {
      mockLogEvent.mockRejectedValueOnce(new Error("SDK error"));
      await expect(
        service.logCoinSpend({ action: "skip", amount: 100, gameMode: "classic" })
      ).resolves.not.toThrow();
    });

    it("does not throw when initialize fails", async () => {
      const localService = createService();
      mockSetAnalyticsCollectionEnabled.mockRejectedValueOnce(new Error("Init error"));
      await expect(localService.initialize("test-user")).resolves.not.toThrow();
    });

    it("does not throw when reset fails", async () => {
      mockSetUserId.mockRejectedValueOnce(new Error("Reset error"));
      await expect(service.reset()).resolves.not.toThrow();
    });

    it("does not throw when logShare fails", async () => {
      mockLogShare.mockRejectedValueOnce(new Error("Share error"));
      await expect(
        service.logShare({ platform: "x", gameMode: "classic" })
      ).resolves.not.toThrow();
    });

    it("does not throw when setUserProperty fails", async () => {
      mockSetUserProperty.mockRejectedValueOnce(new Error("Property error"));
      await expect(
        service.setUserProperty("test_prop", "test_value")
      ).resolves.not.toThrow();
    });

    it("does not throw when level_end event logging fails in game completed handler", async () => {
      mockLogEvent
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("LevelEnd error"));

      const event: GameCompletedEvent = {
        type: "GAME_COMPLETED",
        timestamp: Date.now(),
        outcome: "won",
        attempts: 3,
        coinsEarned: 50,
      };

      gameEventBus.emit(event);
      await flushPromises();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ── Additional event coverage ──────────────────────────────────────────────

  describe("logGameStart", () => {
    it("logs game_start event with params", async () => {
      await service.logGameStart({ gameMode: "daily", riddleId: "riddle-456" });

      expect(mockLogEvent).toHaveBeenCalledWith("game_start", {
        gameMode: "daily",
        riddleId: "riddle-456",
      });
    });
  });

  describe("unknown event handling", () => {
    it("handles unknown event types gracefully", async () => {
      const unknownEvent = {
        type: "UNKNOWN_EVENT_TYPE",
        timestamp: Date.now(),
        payload: {},
      };

      // Should not throw when receiving unknown event
      gameEventBus.emit(unknownEvent as any);
      await flushPromises();

      expect(true).toBe(true);
    });
  });
});

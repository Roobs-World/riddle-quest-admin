/**
 * @fileoverview AnalyticsService - Google Analytics (Firebase) event tracking.
 *
 * Wraps `@react-native-firebase/analytics` and subscribes to the
 * `GameEventBus` singleton so that game events are automatically forwarded
 * to Google Analytics without callers needing to know the analytics SDK.
 *
 * Usage:
 *   // On login:
 *   await analyticsService.initialize(userId);
 *
 *   // On logout:
 *   await analyticsService.reset();
 *
 *   // Manual screen tracking:
 *   await analyticsService.logScreenView("GameScreen");
 */

import {
  getAnalytics,
  logEvent,
  logShare,
  setUserId,
  setAnalyticsCollectionEnabled,
  setUserProperty,
} from "@react-native-firebase/analytics";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {gameEventBus, AnyGameEvent, GameCompletedEvent, GuessSubmittedEvent, GuessValidatedEvent} from "./GameEventBus";

export type GameInteractionAction =
  | "coin_shop_opened"
  | "continue_with_ad_selected"
  | "continue_with_coins_selected"
  | "guess_letter_added"
  | "guess_letter_removed"
  | "guess_slot_selected"
  | "hint_confirmed"
  | "hint_opened"
  | "language_changed"
  | "loss_next_selected"
  | "pay_and_play_selected"
  | "profile_opened"
  | "settings_opened"
  | "skip_confirmed"
  | "skip_opened"
  | "sound_toggled"
  | "submit_invalid"
  | "support_opened"
  | "haptics_toggled"
  | "watch_ad_for_coins_selected";

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton analytics service backed by Google Analytics / Firebase Analytics.
 */
export class AnalyticsService {
  /** Singleton instance backing `getInstance()`. */
  private static instance: AnalyticsService;
  /** Current event-bus subscription, if analytics is actively wired up. */
  private unsubscribe: (() => void) | null = null;

  /** Creates the singleton analytics service. Use {@link getInstance} instead. */
  private constructor() {}

  /**
   * Returns the shared analytics service instance.
   *
   * @returns The singleton analytics service.
   */
  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set the analytics user, enable collection, and start listening to game
   * events.  Call this once after a successful login.
   */
  async initialize(userId: string): Promise<void> {
    try {
      await setUserId(getAnalytics(), userId);
      await setAnalyticsCollectionEnabled(getAnalytics(), true);
      this.subscribeToEventBus();
      logger.info(`[Analytics] Initialized for user ${userId}`);
    } catch (error) {
      logger.error("[Analytics] Failed to initialize", error);
      captureException(error);
    }
  }

  /**
   * Clear the user identity and stop listening to game events.
   * Call this on logout.
   */
  async reset(): Promise<void> {
    try {
      this.unsubscribe?.();
      this.unsubscribe = null;
      await setUserId(getAnalytics(), null);
      logger.info("[Analytics] Reset");
    } catch (error) {
      logger.error("[Analytics] Failed to reset", error);
      captureException(error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Screen tracking
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log a screen view to Google Analytics.
   *
   * @param screenName - Human-readable screen name (e.g. "GameScreen").
   */
  async logScreenView(screenName: string): Promise<void> {
    try {
      await logEvent(getAnalytics(), "screen_view", {
        screen_name: screenName,
        screen_class: screenName,
      });
    } catch (error) {
      logger.error(`[Analytics] logScreenView failed for ${screenName}`, error);
      captureException(error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Manual event helpers (callable from anywhere in the app)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log when the user starts a new game (any mode).
   */
  async logGameStart(params: {gameMode: "daily" | "classic"; riddleId: string}): Promise<void> {
    await this.logEvent("game_start", {
      game_mode: params.gameMode,
      riddle_id: params.riddleId,
    });
  }

  /**
   * Log a player interaction within the active game experience.
   */
  async logGameInteraction(
    action: GameInteractionAction,
    params: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    await this.logEvent("game_interaction", {
      action,
      ...params,
    });
  }

  /**
   * Log a purchase or coin spend event.
   */
  async logCoinSpend(params: {action: "hint" | "skip" | "continue"; amount: number; gameMode: string}): Promise<void> {
    await this.logEvent("coin_spend", params);
  }

  /**
   * Log when an achievement is unlocked.
   */
  async logAchievementUnlocked(achievementId: string): Promise<void> {
    await this.logEvent("achievement_unlocked", {
      achievement_id: achievementId,
    });
  }

  /**
   * Log a share action from the victory modal.
   */
  async logShare(params: {platform: "facebook" | "x" | "system"; gameMode: string}): Promise<void> {
    try {
      await logShare(getAnalytics(), {
        content_type: "game_result",
        item_id: params.gameMode,
        method: params.platform,
      });
    } catch (error) {
      logger.error("[Analytics] logShare failed", error);
      captureException(error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Funnel events
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log an authentication funnel event (signup, login, logout).
   *
   * @param event - The auth step that occurred.
   * @param params - Optional extra dimensions (e.g. `method: "google"`).
   */
  async logAuthEvent(
    event: "signup" | "login" | "logout",
    params: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    await this.logEvent(`auth_${event}`, params);
  }

  /**
   * Log an in-app purchase lifecycle event.
   *
   * @param event - Stage of the purchase flow.
   * @param params - Optional extra dimensions (e.g. `product_id`, `coins`).
   */
  async logPurchaseEvent(
    event: "initiated" | "validated" | "completed" | "failed",
    params: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    await this.logEvent(`iap_purchase_${event}`, params);
  }

  /**
   * Log a successful coin-pack purchase.
   * Firebase can aggregate this event count per pack to show total purchases.
   */
  async logCoinPackPurchased(params: {productId: string; coins: number; purchaseCount?: number}): Promise<void> {
    await this.logEvent("coin_pack_purchased", {
      product_id: params.productId,
      coins: params.coins,
      purchase_count: params.purchaseCount ?? 1,
    });
  }

  /**
   * Log a rewarded ad lifecycle event.
   *
   * @param event - Stage of the ad lifecycle.
   * @param params - Optional extra dimensions (e.g. `network_name`, `error_code`).
   */
  async logAdEvent(
    event: "loaded" | "load_failed" | "displayed" | "completed" | "display_failed",
    params: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    await this.logEvent(`rewarded_ad_${event}`, params);
  }

  /**
   * Log when the shop product catalog is missing or empty.
   * Useful to detect misconfiguration or Firestore issues.
   */
  async logShopCatalogMissing(params: {reason?: string; productCount?: number} = {}): Promise<void> {
    await this.logEvent("shop_catalog_missing", params);
  }

  /**
   * Log when a shop pack is shown in the coin-shop grid.
   */
  async logShopPackImpression(params: {
    productId: string;
    productKey: string;
    coins: number;
    sortOrder: number;
    featured: boolean;
    displayPrice: string;
  }): Promise<void> {
    await this.logEvent("shop_pack_impression", {
      product_id: params.productId,
      product_key: params.productKey,
      coins: params.coins,
      sort_order: params.sortOrder,
      featured: params.featured,
      display_price: params.displayPrice,
    });
  }

  /**
   * Log when a shop pack is tapped.
   */
  async logShopPackSelected(params: {
    productId: string;
    productKey: string;
    coins: number;
    sortOrder: number;
    featured: boolean;
    displayPrice: string;
  }): Promise<void> {
    await this.logEvent("shop_pack_selected", {
      product_id: params.productId,
      product_key: params.productKey,
      coins: params.coins,
      sort_order: params.sortOrder,
      featured: params.featured,
      display_price: params.displayPrice,
    });
  }

  /**
   * Set a persistent user property (visible in GA audiences).
   */
  async setUserProperty(name: string, value: string): Promise<void> {
    try {
      await setUserProperty(getAnalytics(), name, value);
    } catch (error) {
      logger.error(`[Analytics] setUserProperty(${name}) failed`, error);
      captureException(error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event bus wiring (automatic game event forwarding)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Connects the analytics service to the shared game-event bus.
   *
   * The latest subscription is replaced so repeated initialization stays
   * idempotent.
   */
  private subscribeToEventBus(): void {
    this.unsubscribe?.();
    this.unsubscribe = gameEventBus.onAll((event: AnyGameEvent) => {
      this.handleGameEvent(event);
    });
  }

  /**
   * Routes a game event to the matching analytics helper.
   *
   * @param event - Concrete game event emitted from the shared bus.
   */
  private handleGameEvent(event: AnyGameEvent): void {
    switch (event.type) {
      case "GUESS_SUBMITTED":
        void this.onGuessSubmitted(event as GuessSubmittedEvent);
        break;
      case "GUESS_VALIDATED":
        void this.onGuessValidated(event as GuessValidatedEvent);
        break;
      case "GAME_COMPLETED":
        void this.onGameCompleted(event as GameCompletedEvent);
        break;
      case "LETTER_ADDED":
        void this.logGameInteraction("guess_letter_added", {
          position: event.position,
        });
        break;
      case "LETTER_REMOVED":
        void this.logGameInteraction("guess_letter_removed", {
          position: event.position,
        });
        break;
      case "HINT_REQUESTED":
        void this.logGameInteraction("hint_confirmed", {
          hint_type: event.hintType,
        });
        break;
      default:
        break;
    }
  }

  /**
   * Logs the guess-submitted funnel step for analytics.
   *
   * @param event - Guess-submitted event payload from the game bus.
   */
  private async onGuessSubmitted(event: GuessSubmittedEvent): Promise<void> {
    await this.logEvent("guess_submitted", {
      attempt_number: event.attemptNumber,
    });
  }

  /**
   * Logs guess-validation outcomes for analytics.
   *
   * @param event - Guess-validated event payload from the game bus.
   */
  private async onGuessValidated(event: GuessValidatedEvent): Promise<void> {
    const greenCount = event.feedback.filter((f) => f.status === "green").length;
    const yellowCount = event.feedback.filter((f) => f.status === "yellow").length;
    await this.logEvent("guess_validated", {
      is_correct: event.isCorrect,
      green_letters: greenCount,
      yellow_letters: yellowCount,
    });
  }

  /**
   * Logs game-completion outcomes and derived level-end data.
   *
   * @param event - Game-completed event payload from the game bus.
   */
  private async onGameCompleted(event: GameCompletedEvent): Promise<void> {
    await this.logEvent("game_completed", {
      outcome: event.outcome,
      attempts: event.attempts,
      coins_earned: event.coinsEarned ?? 0,
    });

    if (event.outcome === "won") {
      // Also log the standard Firebase Analytics `level_end` event.
      await this.logEvent("level_end", {
        level: event.attempts,
        success: "true",
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sends a raw analytics event with the provided payload.
   *
   * @param name - Firebase Analytics event name.
   * @param params - Event parameters forwarded to the analytics SDK.
   */
  private async logEvent(name: string, params: Record<string, string | number | boolean> = {}): Promise<void> {
    try {
      await logEvent(getAnalytics(), name, params);
    } catch (error) {
      logger.error(`[Analytics] logEvent(${name}) failed`, error);
      captureException(error);
    }
  }
}

/** Singleton export for convenience. */
export const analyticsService = AnalyticsService.getInstance();

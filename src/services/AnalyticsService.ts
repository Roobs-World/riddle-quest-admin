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
  logLevelEnd,
  setUserId,
  setAnalyticsCollectionEnabled,
  setUserProperty,
} from "@react-native-firebase/analytics";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";
import {
  gameEventBus,
  AnyGameEvent,
  GameCompletedEvent,
  GuessSubmittedEvent,
  GuessValidatedEvent,
} from "./GameEventBus";

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton analytics service backed by Google Analytics / Firebase Analytics.
 */
export class AnalyticsService {
  private static instance: AnalyticsService;
  private unsubscribe: (() => void) | null = null;

  private constructor() {}

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
  async logGameStart(params: {
    gameMode: "daily" | "classic" | "tutorial";
    riddleId: string;
  }): Promise<void> {
    await this.logEvent("game_start", params);
  }

  /**
   * Log a purchase or coin spend event.
   */
  async logCoinSpend(params: {
    action: "hint" | "skip" | "continue";
    amount: number;
    gameMode: string;
  }): Promise<void> {
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
  async logShare(params: {
    platform: "facebook" | "x" | "system";
    gameMode: string;
  }): Promise<void> {
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
    params: Record<string, string | number | boolean> = {}
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
    params: Record<string, string | number | boolean> = {}
  ): Promise<void> {
    await this.logEvent(`iap_purchase_${event}`, params);
  }

  /**
   * Log a rewarded ad lifecycle event.
   *
   * @param event - Stage of the ad lifecycle.
   * @param params - Optional extra dimensions (e.g. `network_name`, `error_code`).
   */
  async logAdEvent(
    event: "loaded" | "load_failed" | "displayed" | "completed" | "display_failed",
    params: Record<string, string | number | boolean> = {}
  ): Promise<void> {
    await this.logEvent(`rewarded_ad_${event}`, params);
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

  private subscribeToEventBus(): void {
    this.unsubscribe?.();
    this.unsubscribe = gameEventBus.onAll((event: AnyGameEvent) => {
      this.handleGameEvent(event);
    });
  }

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
      default:
        break;
    }
  }

  private async onGuessSubmitted(event: GuessSubmittedEvent): Promise<void> {
    await this.logEvent("guess_submitted", {
      attempt_number: event.attemptNumber,
    });
  }

  private async onGuessValidated(event: GuessValidatedEvent): Promise<void> {
    const greenCount = event.feedback.filter((f) => f.status === "green").length;
    const yellowCount = event.feedback.filter((f) => f.status === "yellow").length;
    await this.logEvent("guess_validated", {
      is_correct: event.isCorrect,
      green_letters: greenCount,
      yellow_letters: yellowCount,
    });
  }

  private async onGameCompleted(event: GameCompletedEvent): Promise<void> {
    await this.logEvent("game_completed", {
      outcome: event.outcome,
      attempts: event.attempts,
      coins_earned: event.coinsEarned ?? 0,
    });

    if (event.outcome === "won") {
      // Also log the standard Firebase Analytics `level_end` event so the
      // game appears in the Firebase "Games" dashboard.
      try {
        await logLevelEnd(getAnalytics(), {
          level: event.attempts,
          success: "true",
        });
      } catch (error) {
        logger.error("[Analytics] logLevelEnd failed", error);
        captureException(error);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────────

  private async logEvent(
    name: string,
    params: Record<string, string | number | boolean> = {}
  ): Promise<void> {
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

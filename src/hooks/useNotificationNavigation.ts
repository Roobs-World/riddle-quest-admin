/**
 * @fileoverview useNotificationNavigation — handles notification deep linking.
 *
 * When a user taps a push notification (e.g. a daily streak reminder), this
 * hook inspects the notification data payload and triggers the appropriate
 * in-app navigation by calling the provided `onNavigate` callback.
 *
 * Two Firebase Messaging entry-points are covered:
 *  - **Initial notification** (`getInitialNotification`): the app was in a quit
 *    state when the notification was tapped. Checked once on mount.
 *  - **Background notification** (`onNotificationOpenedApp`): the app was in the
 *    background. A listener is attached on mount and cleaned up on unmount.
 *
 * Usage:
 *   useNotificationNavigation({
 *     onNavigate: ({ destination }) => {
 *       if (destination === "daily") setGameMode("daily");
 *     },
 *   });
 */

import { useEffect } from "react";
import { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { NotificationService } from "../services/NotificationService";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Destinations the app can navigate to from a notification tap. */
export type NotificationDestination = "daily" | "classic" | "unknown";

export interface NotificationNavigationPayload {
  destination: NotificationDestination;
  /** Raw `data` field from the notification message, for callers that need it. */
  rawData: Record<string, string>;
}

export interface UseNotificationNavigationOptions {
  /** Called when a notification tap should trigger in-app navigation. */
  onNavigate: (payload: NotificationNavigationPayload) => void;
  /**
   * Pass `false` to disable deep linking (e.g. while the user is not yet
   * authenticated). Defaults to `true`.
   */
  enabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a notification message to a navigation destination.
 *
 * Current mappings:
 *  - `data.type === "streak_reminder"` → "daily"
 *  - `data.type === "daily_challenge"`  → "daily"
 *  - anything else                      → "unknown"
 */
export function resolveNotificationDestination(
  message: FirebaseMessagingTypes.RemoteMessage,
): NotificationNavigationPayload {
  const rawData = (message.data ?? {}) as Record<string, string>;
  const type = rawData.type ?? "";

  let destination: NotificationDestination = "unknown";
  if (type === "streak_reminder" || type === "daily_challenge") {
    destination = "daily";
  }

  return { destination, rawData };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationNavigation({
  onNavigate,
  enabled = true,
}: UseNotificationNavigationOptions): void {
  useEffect(() => {
    if (!enabled) return;

    // ── Initial notification (app was quit, opened via notification tap) ───
    let cancelled = false;
    NotificationService.getInitialNotification()
      .then((message) => {
        if (!cancelled && message) {
          logger.info("[NotificationNav] Initial notification received:", message.data?.type);
          const payload = resolveNotificationDestination(message);
          if (payload.destination !== "unknown") {
            onNavigate(payload);
          }
        }
      })
      .catch((err) => {
        logger.error("[NotificationNav] getInitialNotification error:", err);
        captureException(err);
      });

    // ── Background notification (app was backgrounded, user taps notification) ──
    const unsubscribe = NotificationService.onNotificationOpenedApp((message) => {
      logger.info("[NotificationNav] Background notification tap:", message.data?.type);
      const payload = resolveNotificationDestination(message);
      if (payload.destination !== "unknown") {
        onNavigate(payload);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled, onNavigate]);
}

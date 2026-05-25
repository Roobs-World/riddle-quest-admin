/**
 * @fileoverview OfflineQueueService - Offline-resilient Firebase Function call queue.
 *
 * When a Firebase callable function fails due to a network error the call is
 * persisted to AsyncStorage and retried automatically when the app returns to
 * the foreground or when the next successful call is made.
 *
 * The service uses React Native's `AppState` API (no extra native packages
 * required) to detect when the user brings the app back to the foreground and
 * triggers a drain of any queued calls.
 *
 * Usage:
 *   // Wrap any firebase callable:
 *   const result = await offlineQueue.call("submitGuess", payload);
 *
 *   // Or enqueue fire-and-forget calls (e.g. analytics, stats):
 *   offlineQueue.enqueue("updateUserStats", payload);
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {AppState, AppStateStatus} from "react-native";
import {getFunctions, httpsCallable} from "@react-native-firebase/functions";
import {getApp} from "@react-native-firebase/app";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface QueuedCall {
  id: string;
  functionName: string;
  payload: unknown;
  enqueuedAt: number;
  attempts: number;
}

export type NetworkError = Error & {code?: string};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@offline_queue";
/** Maximum number of retry attempts before a queued call is discarded. */
const MAX_ATTEMPTS = 5;
/** Calls older than this (ms) are considered stale and dropped on drain. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when the error looks like a transient network failure. */
function isNetworkError(error: unknown): boolean {
  const e = error as NetworkError;
  if (!e) return false;
  // Firebase functions error codes for network issues
  const networkCodes = ["unavailable", "deadline-exceeded", "internal"];
  if (e.code && networkCodes.includes(e.code)) return true;
  // Generic network message patterns
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  );
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton offline queue for Firebase callable functions.
 * Call {@link OfflineQueueService.initialize} once at app startup.
 */
export class OfflineQueueService {
  private static instance: OfflineQueueService;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private isDraining = false;

  private constructor() {}

  static getInstance(): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService();
    }
    return OfflineQueueService.instance;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attach the foreground listener and attempt to drain any calls that were
   * queued in a previous session.  Call once at app startup.
   */
  initialize(): void {
    // Drain on foreground resume
    this.appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void this.drain();
      }
    });

    // Try to drain immediately (in case there are leftover items from last session)
    void this.drain();
    logger.info("[OfflineQueue] Initialized");
  }

  /**
   * Remove the AppState listener.  Call on app teardown (rare in RN but
   * useful in tests).
   */
  teardown(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Call a Firebase callable function, automatically queuing it for retry if
   * the call fails due to a network error.  Non-network errors are re-thrown
   * immediately.
   *
   * @param functionName  Firebase callable function name.
   * @param payload       Data to pass to the function.
   * @returns             The function result data, or `null` if the call was
   *                      queued (offline).
   */
  async call<T = unknown>(functionName: string, payload: unknown): Promise<T | null> {
    try {
      const callable = httpsCallable(getFunctions(getApp()), functionName);
      const result = await callable(payload);
      // Successful call — try to drain any previously queued items
      void this.drain();
      return result.data as T;
    } catch (error) {
      if (isNetworkError(error)) {
        logger.warn(`[OfflineQueue] Network error calling ${functionName}. Queuing for retry.`);
        await this.enqueue(functionName, payload);
        return null;
      }
      throw error;
    }
  }

  /**
   * Add a fire-and-forget call to the queue without waiting for a result.
   * Useful for non-critical updates (stats, analytics, etc.) that should not
   * block the UI.
   */
  async enqueue(functionName: string, payload: unknown): Promise<void> {
    const item: QueuedCall = {
      id: generateId(),
      functionName,
      payload,
      enqueuedAt: Date.now(),
      attempts: 0,
    };

    try {
      const queue = await this.loadQueue();
      queue.push(item);
      await this.saveQueue(queue);
      logger.info(`[OfflineQueue] Enqueued ${functionName} (id: ${item.id})`);
    } catch (error) {
      logger.error("[OfflineQueue] Failed to enqueue call", error);
      captureException(error);
    }
  }

  /**
   * Return the current number of queued calls (useful for debugging/UI).
   */
  async queueSize(): Promise<number> {
    const queue = await this.loadQueue();
    return queue.length;
  }

  /**
   * Clear the entire queue (e.g. on logout when stale calls are no longer
   * relevant).
   */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    logger.info("[OfflineQueue] Queue cleared");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Drain
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to execute all queued calls in order.  Calls that fail again with
   * a network error are left in the queue with an incremented attempt counter.
   * Calls that exceed {@link MAX_ATTEMPTS} or are older than {@link MAX_AGE_MS}
   * are silently discarded.
   */
  async drain(): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;

    try {
      const queue = await this.loadQueue();
      if (queue.length === 0) return;

      logger.info(`[OfflineQueue] Draining ${queue.length} queued call(s)`);

      const remaining: QueuedCall[] = [];
      const now = Date.now();

      for (const item of queue) {
        // Discard stale or exhausted items
        if (item.attempts >= MAX_ATTEMPTS || now - item.enqueuedAt > MAX_AGE_MS) {
          logger.warn(`[OfflineQueue] Discarding stale call ${item.functionName} (attempts: ${item.attempts})`);
          continue;
        }

        try {
          const callable = httpsCallable(getFunctions(getApp()), item.functionName);
          await callable(item.payload);
          logger.info(`[OfflineQueue] Successfully replayed ${item.functionName} (id: ${item.id})`);
          // Do NOT push back — it was successful
        } catch (error) {
          if (isNetworkError(error)) {
            // Still offline — keep in queue with incremented attempt count
            remaining.push({...item, attempts: item.attempts + 1});
          } else {
            // Non-network error — discard (e.g. auth error, bad payload)
            logger.warn(`[OfflineQueue] Discarding ${item.functionName} due to non-network error`, error);
          }
        }
      }

      await this.saveQueue(remaining);

      if (remaining.length < queue.length) {
        logger.info(
          `[OfflineQueue] Drain complete. ${queue.length - remaining.length} calls replayed, ${remaining.length} still queued.`,
        );
      }
    } catch (error) {
      logger.error("[OfflineQueue] Drain failed", error);
      captureException(error);
    } finally {
      this.isDraining = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage helpers
  // ───────────────────────────────────────────────────────────────────────────

  private async loadQueue(): Promise<QueuedCall[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedCall[]) : [];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: QueuedCall[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }
}

/** Singleton export for convenience. */
export const offlineQueue = OfflineQueueService.getInstance();

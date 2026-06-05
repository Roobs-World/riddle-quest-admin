import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ACTIVE_GAME_SESSION_STORAGE_KEY,
  type ActiveGameSessionSnapshot,
  getUtcDateKey,
  normalizeRestorableGameMode,
} from "../../features/auth/sessionBootstrap";
import {isGuestPlayer} from "../../features/auth/sessionBootstrap";
import {Player, FirestoreRiddle} from "../../validation/firestoreSchemas";
import {callValidatedFunction} from "../../utils/firebaseFunctions";
import {CurrentDailyChallengeOutputSchema, EmptyInputSchema} from "../../validation/cloudFunctionsSchemas";
import {logger} from "../../utils/logger";
import type {GameMode} from "./authTypes";

/**
 * Auth-session facade for guest and provider bootstrap policies.
 *
 * @remarks
 * Pattern: Facade. This module concentrates the daily-completion lookup,
 * streak-break calculation, and active-session snapshot persistence behind a
 * single application-layer API so callers do not need to know which parts are
 * local storage and which parts come from Firebase.
 *
 * Boundary: application auth layer. The facade may depend on AsyncStorage,
 * Firebase call helpers, and session-bootstrap utilities, but it must not
 * reach into React state or screen-level UI concerns.
 *
 * Invariants:
 * - Guest completion checks stay local and deterministic.
 * - Provider completion checks are read-only and fail closed.
 * - Active session snapshots only hydrate when the stored user and UTC date
 *   still match the current request.
 */
class AuthSessionFacade {
  /**
   * Resolves whether the player has already completed today's daily challenge.
   *
   * @param player - Current player document, or `null` when unauthenticated.
   * @returns `true` when the daily challenge is already complete for today.
   */
  async hasCompletedDailyChallengeToday(player: Player | null): Promise<boolean> {
    if (!player) return false;
    if (isGuestPlayer(player)) {
      const lastCompletedDate = player.lastDailyChallengeCompletedAt
        ? new Date(player.lastDailyChallengeCompletedAt)
        : null;
      if (!lastCompletedDate) return false;
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const lastCompletedUtc = new Date(lastCompletedDate);
      lastCompletedUtc.setUTCHours(0, 0, 0, 0);
      return todayUtc.getTime() <= lastCompletedUtc.getTime();
    }

    try {
      const data = await callValidatedFunction(
        "getCurrentDailyChallenge",
        {},
        EmptyInputSchema,
        CurrentDailyChallengeOutputSchema,
      );
      return data.hasCompletedToday === true;
    } catch (error) {
      logger.warn(
        "Unable to resolve daily completion from Firebase function for provider-auth user. Defaulting to not completed.",
        error,
      );
      return false;
    }
  }

  /**
   * Returns the streak value that should be restored after a broken daily run.
   *
   * @param player - Current player document, or `null` when unauthenticated.
   * @returns The streak value to restore, or `0` when no streak should be restored.
   */
  getBrokenDailyStreakValue(player: Player | null): number {
    if (!player) return 0;
    const currentWinStreak = player.stats?.winStreak ?? 0;
    if (currentWinStreak <= 0) return 0;

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const yesterdayUtcStart = todayUtc.getTime() - 24 * 60 * 60 * 1000;

    if (!player.lastDailyChallengeCompletedAt) {
      return currentWinStreak;
    }

    const lastCompletedDate = new Date(player.lastDailyChallengeCompletedAt);
    if (Number.isNaN(lastCompletedDate.getTime())) {
      return currentWinStreak;
    }
    lastCompletedDate.setUTCHours(0, 0, 0, 0);

    return lastCompletedDate.getTime() < yesterdayUtcStart ? currentWinStreak : 0;
  }

  /**
   * Loads a restorable active game session from local storage.
   *
   * @param uid - Authenticated user identifier used to validate the snapshot.
   * @returns The active session snapshot when it is still valid for this user and day.
   */
  async loadActiveGameSession(uid: string): Promise<ActiveGameSessionSnapshot | null> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_GAME_SESSION_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<ActiveGameSessionSnapshot>;
      if (parsed.version !== 1) return null;
      if (parsed.userId !== uid) return null;
      if (parsed.savedUtcDate !== getUtcDateKey()) return null;

      const gameMode = normalizeRestorableGameMode(parsed.gameMode);
      if (!gameMode) return null;

      return {
        version: 1,
        userId: uid,
        gameMode,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
        savedUtcDate: parsed.savedUtcDate,
        riddleId: typeof parsed.riddleId === "string" ? parsed.riddleId : undefined,
        classicIndex: typeof parsed.classicIndex === "number" ? parsed.classicIndex : undefined,
        dailyIndex: typeof parsed.dailyIndex === "number" ? parsed.dailyIndex : undefined,
      };
    } catch (error) {
      logger.warn("Error loading active game session locally:", error);
      return null;
    }
  }

  /**
   * Persists the active game session snapshot for the current player.
   *
   * @param player - Current player document that owns the session snapshot.
   * @param mode - Active game mode to persist.
   * @param riddle - Active riddle whose identifiers should be preserved locally.
   */
  async saveActiveGameSession(player: Player, mode: GameMode, riddle: FirestoreRiddle): Promise<void> {
    try {
      const snapshot: ActiveGameSessionSnapshot = {
        version: 1,
        userId: player.userId,
        gameMode: mode,
        savedAt: Date.now(),
        savedUtcDate: getUtcDateKey(),
        riddleId: riddle.riddleId,
        classicIndex: typeof riddle.classicIndex === "number" ? riddle.classicIndex : player.progress?.classicIndex,
        dailyIndex: typeof riddle.dailyIndex === "number" ? riddle.dailyIndex : player.progress?.dailyChallengeIndex,
      };
      await AsyncStorage.setItem(ACTIVE_GAME_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      logger.warn("Error saving active game session locally:", error);
    }
  }
}

export const authSessionFacade = new AuthSessionFacade();

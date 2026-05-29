import {
  fetchClassicRiddleFromFirestore,
  fetchDailyRiddleFromFirestore,
} from "../../services/FirestoreService";
import {RiddleInitializationService} from "../../services/RiddleInitializationService";
import {FirestoreRiddle, Player} from "../../validation/firestoreSchemas";
import {logger} from "../../utils/logger";
import type {GameMode} from "./authTypes";
import {authSessionFacade, type AuthSessionFacade} from "./AuthSessionFacade";

export interface RiddleSessionSink {
  setCurrentRiddle: (riddle: FirestoreRiddle | null) => void;
  setIsDailyChallengeAvailable: (available: boolean | undefined) => void;
  setGameMode: (mode: GameMode) => void;
  setIsRiddlesInitializing: (initializing: boolean) => void;
}

/**
 * Loads riddles for the active game mode with polling while initialization runs.
 *
 * @remarks
 * Pattern: Strategy + polling orchestrator. The service chooses the riddle
 * source based on the current mode and completion policy while delegating the
 * availability rule to {@link AuthSessionFacade}.
 *
 * Boundary: application auth layer. It may call Firestore loaders and mutate a
 * sink interface, but it should not reach into screen state or modal logic.
 *
 * Invariants:
 * - Stale requests never win over newer auth state.
 * - Daily mode falls back to classic mode when no daily riddle is available.
 * - Sink updates happen only after stale-request checks pass.
 */
export class RiddleSessionService {
  constructor(private readonly sessionFacade: AuthSessionFacade) {}

  async fetchCurrentRiddle(
    player: Player | null,
    mode: GameMode,
    sink: RiddleSessionSink,
    options: {
      completedDailyOverride?: boolean;
      isStaleRequest: () => boolean;
    },
  ): Promise<void> {
    const {completedDailyOverride, isStaleRequest} = options;

    if (!player) {
      if (!isStaleRequest()) {
        sink.setCurrentRiddle(null);
        sink.setIsDailyChallengeAvailable(undefined);
      }
      return;
    }

    let fetchedRiddle: FirestoreRiddle | null = null;
    let attemptCount = 0;
    const maxAttempts = 20;

    const completedToday =
      completedDailyOverride ?? (await this.sessionFacade.hasCompletedDailyChallengeToday(player));
    const dailyAvailable = !completedToday;
    if (isStaleRequest()) {
      logger.debug("Skipping stale fetchCurrentRiddle request before applying availability.");
      return;
    }
    sink.setIsDailyChallengeAvailable(dailyAvailable);

    const attemptFetchRiddle = async (): Promise<FirestoreRiddle | null> => {
      let riddle: FirestoreRiddle | null = null;

      if (mode === "daily") {
        if (dailyAvailable && player.progress?.dailyChallengeIndex !== undefined) {
          riddle = await fetchDailyRiddleFromFirestore(player.progress.dailyChallengeIndex);
        }
        if (!riddle) {
          logger.debug("No daily riddle available, falling back to classic mode riddle.");
          if (player.progress?.classicIndex !== undefined) {
            riddle = await fetchClassicRiddleFromFirestore(player.progress.classicIndex);
            if (!isStaleRequest()) {
              sink.setGameMode("classic");
            }
          } else {
            logger.warn("Classic index is undefined, cannot load fallback riddle.");
          }
        }
      } else if (mode === "classic") {
        if (player.progress?.classicIndex !== undefined) {
          riddle = await fetchClassicRiddleFromFirestore(player.progress.classicIndex);
        } else {
          logger.warn("Classic index is undefined for classic mode.");
        }
      } else if (mode === "challenge") {
        if (dailyAvailable && player.progress?.dailyChallengeIndex !== undefined) {
          riddle = await fetchDailyRiddleFromFirestore(player.progress.dailyChallengeIndex);
        }
        if (!riddle) {
          logger.debug("No daily challenge riddle available, falling back to classic mode riddle.");
          if (player.progress?.classicIndex !== undefined) {
            riddle = await fetchClassicRiddleFromFirestore(player.progress.classicIndex);
            if (!isStaleRequest()) {
              sink.setGameMode("classic");
            }
          }
        }
      }

      return riddle;
    };

    fetchedRiddle = await attemptFetchRiddle();

    if (!fetchedRiddle) {
      const initStatus = RiddleInitializationService.getInitializationStatus();
      if (!initStatus.initializationFailed) {
        logger.debug("📊 No riddle found, checking if riddles are still being generated...");
        sink.setIsRiddlesInitializing(true);

        while (!fetchedRiddle && attemptCount < maxAttempts) {
          if (isStaleRequest()) {
            logger.debug("Stopping stale fetchCurrentRiddle polling loop.");
            break;
          }
          attemptCount++;
          logger.debug(`🔄 Polling for riddles... Attempt ${attemptCount}/${maxAttempts}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          fetchedRiddle = await attemptFetchRiddle();
          if (isStaleRequest()) {
            logger.debug("Stopping stale fetchCurrentRiddle request after poll attempt.");
            break;
          }
          const currentStatus = RiddleInitializationService.getInitializationStatus();
          if (currentStatus.initializationFailed || currentStatus.hasInitialized) {
            break;
          }
        }

        sink.setIsRiddlesInitializing(false);
      }
    }

    if (isStaleRequest()) {
      logger.debug("Skipping stale fetchCurrentRiddle request before applying current riddle.");
      return;
    }
    sink.setCurrentRiddle(fetchedRiddle);

    if (!fetchedRiddle) {
      logger.error("❌ Failed to load any riddle after all attempts");
    }
  }
}

export const riddleSessionService = new RiddleSessionService(authSessionFacade);

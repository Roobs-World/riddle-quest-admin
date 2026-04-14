/**
 * @fileoverview
 * Core client-side game logic hook for Qwordly.
 *
 * Feedback (green/yellow/red) is computed locally from the cached riddle answer,
 * eliminating a server round-trip on every guess. The server (`completeGame`
 * Cloud Function) is called exactly once when the game truly ends — win or final
 * loss — to award coins, update stats, advance progress, and evaluate achievements.
 */
import { useState, useCallback, useEffect } from "react";
import type { SubmittedGuess } from "./types";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { logger } from "../utils/logger";
import { captureException, addBreadcrumb, startTransaction } from "../utils/sentry";
import { gameEventBus } from "../services/GameEventBus";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CLASSIC_RIDDLE_COIN_REWARD, DAILY_CHALLENGE_COIN_REWARD } from "../constants/game";
import { NUM_GUESSES } from "../utils/constants";

export type Feedback = "green" | "yellow" | "red";

/**
 * Props used to configure the `useGameLogic` hook for a specific riddle instance.
 */
interface UseGameLogicProps {
  /** Identifier of the active riddle, passed to backend completion calls. */
  riddleId: string;
  /**
   * The correct answer for the current riddle (lower-cased comparison is applied
   * internally). Provided by the caller so feedback is computed without a network
   * round-trip on every guess.
   */
  answer: string;
  /** Backend mode key used for analytics and completion submission. */
  gameMode: "challenge" | "classic";
  /** True when this game session is running in guest mode (local-only progress). */
  isGuestMode?: boolean;
}

interface CompleteGameResponseData {
  coinsEarned: number;
  newlyUnlockedAchievementIds: string[];
  scoreEarned?: number;
  xpEarned?: number;
  newWinStreak?: number;
}

const GUEST_GAME_SESSION_STORAGE_KEY = "@guest_game_session_v1";

function getLocalRewards(gameMode: "challenge" | "classic", attempts: number): { coins: number; score: number } {
  const scoreMaxAttempts = 5;
  const baseScore = gameMode === "challenge" ? 100 : 50;
  const attemptsBonus = Math.max(0, (scoreMaxAttempts - attempts + 1) * 10);
  const coins = gameMode === "challenge" ? DAILY_CHALLENGE_COIN_REWARD : CLASSIC_RIDDLE_COIN_REWARD;
  return { coins, score: baseScore + attemptsBonus };
}

type GuestGameSessionSnapshot = {
  version: 1;
  riddleId: string;
  gameMode: "challenge" | "classic";
  guesses: SubmittedGuess[];
  attemptsUsed: number;
  hasUsedContinue: boolean;
  gameOver: boolean;
};

/**
 * Computes green/yellow/red feedback for a guess against the correct answer.
 *
 * Algorithm mirrors the server-side logic in `submitGuessLogic.ts`:
 * 1. First pass marks exact-position matches as green and decrements their char count.
 * 2. Second pass marks in-word-but-wrong-position letters as yellow (only while the
 *    char count > 0 to handle duplicate letters correctly).
 * 3. Everything else stays red.
 *
 * Defined at module level — pure function with no closure, never reallocated.
 */
function computeFeedback(guess: string, answer: string): Feedback[] {
  const guessChars = guess.toLowerCase().split("");
  const answerChars = answer.toLowerCase().split("");

  const charCounts: Record<string, number> = {};
  for (const ch of answerChars) {
    charCounts[ch] = (charCounts[ch] || 0) + 1;
  }

  const feedback: Feedback[] = guessChars.map(() => "red");

  // Pass 1: greens
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === answerChars[i]) {
      feedback[i] = "green";
      charCounts[guessChars[i]]--;
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < guessChars.length; i++) {
    if (feedback[i] === "green") continue;
    if (charCounts[guessChars[i]] > 0) {
      feedback[i] = "yellow";
      charCounts[guessChars[i]]--;
    }
  }

  return feedback;
}

/**
 * Owns local guess state and bridges terminal game outcomes to backend completion.
 *
 * @param props Riddle identity, answer cache, and backend game mode key.
 * @returns Gameplay state plus actions used by `GameScreen`.
 */
const useGameLogic = ({ riddleId, answer, gameMode, isGuestMode = false }: UseGameLogicProps) => {
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [hasUsedContinue, setHasUsedContinue] = useState(false);

  const INITIAL_ATTEMPTS = NUM_GUESSES;
  const CONTINUE_ATTEMPTS = 3;

  const clearGuestSession = useCallback(async (): Promise<void> => {
    if (!isGuestMode) return;
    try {
      await AsyncStorage.removeItem(GUEST_GAME_SESSION_STORAGE_KEY);
    } catch (error) {
      logger.warn("Unable to clear guest session snapshot.", error);
    }
  }, [isGuestMode]);

  // Guest-only: restore in-progress game state after app restarts.
  useEffect(() => {
    if (!isGuestMode) return;
    let cancelled = false;

    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_GAME_SESSION_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<GuestGameSessionSnapshot>;
        if (parsed.version !== 1) return;
        if (parsed.riddleId !== riddleId) return;
        if (parsed.gameMode !== gameMode) return;
        if (cancelled) return;

        setGuesses(Array.isArray(parsed.guesses) ? (parsed.guesses as SubmittedGuess[]) : []);
        setAttemptsUsed(typeof parsed.attemptsUsed === "number" ? parsed.attemptsUsed : 0);
        setHasUsedContinue(parsed.hasUsedContinue === true);
        setGameOver(parsed.gameOver === true);
      } catch (error) {
        logger.warn("Guest session restore failed; starting fresh.", error);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [isGuestMode, riddleId, gameMode]);

  // Guest-only: persist in-progress session (so a force-close doesn't lose a run).
  useEffect(() => {
    if (!isGuestMode) return;

    const snapshot: GuestGameSessionSnapshot = {
      version: 1,
      riddleId,
      gameMode,
      guesses,
      attemptsUsed,
      hasUsedContinue,
      gameOver,
    };

    void AsyncStorage.setItem(GUEST_GAME_SESSION_STORAGE_KEY, JSON.stringify(snapshot)).catch((error) => {
      logger.warn("Guest session persist failed; progress may be lost.", error);
    });
  }, [isGuestMode, riddleId, gameMode, guesses, attemptsUsed, hasUsedContinue, gameOver]);

  /**
   * Processes one guess:
   * - Computes feedback locally (no network).
   * - Emits analytics events.
   * - On game-over (win or final loss) calls `completeGame` once to award
   *   coins, update stats/progress, and evaluate achievements.
   */
  const processGuess = useCallback(
    async (guess: string[]) => {
      const guessString = guess.join("");
      const maxAttempts = hasUsedContinue
        ? INITIAL_ATTEMPTS + CONTINUE_ATTEMPTS
        : INITIAL_ATTEMPTS;
      const currentAttempt = attemptsUsed + 1;

      addBreadcrumb("game", "Guess submitted", { guess: guessString, attempt: currentAttempt, riddleId, gameMode });
      gameEventBus.emit<import("../services/GameEventBus").GuessSubmittedEvent>({
        type: "GUESS_SUBMITTED",
        guess: guessString,
        attemptNumber: currentAttempt,
      });

      // Compute feedback entirely on the client.
      const feedback = computeFeedback(guessString, answer);
      const isCorrect = guessString.toLowerCase() === answer.toLowerCase();

      const newSubmittedGuess: SubmittedGuess = { guess, feedback };
      setGuesses((prev) => [...prev, newSubmittedGuess]);
      setCurrentGuess([]);
      setAttemptsUsed(currentAttempt);

      gameEventBus.emit<import("../services/GameEventBus").GuessValidatedEvent>({
        type: "GUESS_VALIDATED",
        guess: guessString,
        feedback: guess.map((letter, i) => ({ letter, status: feedback[i] })),
        isCorrect,
      });

      // --- Win ---
      if (isCorrect) {
        logger.debug("Correct guess!");
        setGameOver(true);
        addBreadcrumb("game", "Game won", { attempts: currentAttempt, riddleId, gameMode });
        void clearGuestSession();

        gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
          type: "GAME_COMPLETED",
          outcome: "won",
          attempts: currentAttempt,
        });

        let coinsEarned = 0;
        let scoreEarned = 0;
        let newlyUnlockedAchievementIds: string[] = [];
        let newWinStreak: number | undefined;
        if (isGuestMode) {
          const rewards = getLocalRewards(gameMode, currentAttempt);
          coinsEarned = rewards.coins;
          scoreEarned = rewards.score;
        } else {
          // Notify server once.
          const txn = startTransaction("completeGame", "http.client");
          try {
            const result = await httpsCallable(getFunctions(getApp()), "completeGame")({
              riddleId,
              gameMode,
              attempts: currentAttempt,
              isCorrect: true,
            });
            const data = result.data as CompleteGameResponseData;
            coinsEarned = data.coinsEarned ?? 0;
            // Some backend builds return xp as `xpEarned` only.
            scoreEarned = data.scoreEarned ?? data.xpEarned ?? 0;
            newlyUnlockedAchievementIds = data.newlyUnlockedAchievementIds ?? [];
            newWinStreak = data.newWinStreak;
            gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
              type: "GAME_COMPLETED",
              outcome: "won",
              attempts: currentAttempt,
              coinsEarned,
            });
          } catch (err) {
            logger.error("Error calling completeGame on win:", err);
            captureException(err);
          } finally {
            txn.finish();
          }
        }

        return {
          outcome: "win",
          feedback,
          coinsEarned,
          scoreEarned,
          correctAnswer: answer,
          newlyUnlockedAchievementIds,
          newWinStreak,
        };
      }

      // --- Attempt limit reached ---
      if (currentAttempt >= maxAttempts) {
        logger.debug("Out of attempts!");
        setGameOver(true);

        if (hasUsedContinue) {
          // Final loss — notify server (except guest/local-only mode).
          addBreadcrumb("game", "Game lost", { attempts: currentAttempt, riddleId, gameMode });
          gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
            type: "GAME_COMPLETED",
            outcome: "lost",
            attempts: currentAttempt,
          });
          void clearGuestSession();

          if (!isGuestMode) {
            try {
              await httpsCallable(getFunctions(getApp()), "completeGame")({
                riddleId,
                gameMode,
                attempts: currentAttempt,
                isCorrect: false,
              });
            } catch (err) {
              logger.error("Error calling completeGame on loss:", err);
              captureException(err);
            }
          }

          return {
            outcome: "loss",
            feedback,
            correctAnswer: answer,
            coinsEarned: 0,
            canOfferRewardedAd: false,
          };
        }

        // First time hitting the limit — offer continue (no server call yet).
        return {
          outcome: "attemptLimitReached",
          feedback,
          correctAnswer: answer,
          coinsEarned: 0,
          canOfferRewardedAd: true,
          canOfferCoinContinue: true,
        };
      }

      // --- Continue guessing ---
      logger.debug("Guess:", guessString, "Feedback:", feedback);
      return {
        outcome: "continue",
        feedback,
        attemptsRemaining: maxAttempts - currentAttempt,
      };
    },
    [riddleId, answer, gameMode, hasUsedContinue, attemptsUsed, isGuestMode, clearGuestSession]
  );

  /**
   * Marks that the player has used their one-time continue option and re-opens
   * the game with an expanded attempt limit.
   */
  const continueGame = useCallback(() => {
    setHasUsedContinue(true);
    setGameOver(false);
  }, []);

  /**
   * Resets all local game state for the next riddle.
   */
  const resetGame = useCallback(() => {
    setGuesses([]);
    setCurrentGuess([]);
    setGameOver(false);
    setAttemptsUsed(0);
    setHasUsedContinue(false);
    void clearGuestSession();
  }, [clearGuestSession]);

  const maxAttempts = hasUsedContinue
    ? INITIAL_ATTEMPTS + CONTINUE_ATTEMPTS
    : INITIAL_ATTEMPTS;
  const attemptsRemaining = maxAttempts - attemptsUsed;

  return {
    guesses,
    currentGuess,
    gameOver,
    attemptsUsed,
    attemptsRemaining,
    hasUsedContinue,
    setCurrentGuess,
    processGuess,
    continueGame,
    resetGame,
  };
};

export default useGameLogic;

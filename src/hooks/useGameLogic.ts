/**
 * @fileoverview
 * Core client-side game logic hook for Qwordly.
 *
 * Feedback (green/yellow/red) is computed locally from the cached riddle answer,
 * eliminating a server round-trip on every guess. The server (`completeGame`
 * Cloud Function) is called exactly once when the game truly ends — win or final
 * loss — to award coins, update stats, advance progress, and evaluate achievements.
 */
import { useState, useCallback } from "react";
import type { SubmittedGuess } from "./types";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { logger } from "../utils/logger";
import { captureException, addBreadcrumb, startTransaction } from "../utils/sentry";
import { gameEventBus } from "../services/GameEventBus";

export type Feedback = "green" | "yellow" | "red";

/**
 * Props used to configure the `useGameLogic` hook for a specific riddle instance.
 */
interface UseGameLogicProps {
  riddleId: string;
  /**
   * The correct answer for the current riddle (lower-cased comparison is applied
   * internally). Provided by the caller so feedback is computed without a network
   * round-trip on every guess.
   */
  answer: string;
  gameMode: "challenge" | "classic" | "tutorial";
}

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

const useGameLogic = ({ riddleId, answer, gameMode }: UseGameLogicProps) => {
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [hasUsedContinue, setHasUsedContinue] = useState(false);

  const INITIAL_ATTEMPTS = 3;
  const CONTINUE_ATTEMPTS = 3;

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

        gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
          type: "GAME_COMPLETED",
          outcome: "won",
          attempts: currentAttempt,
        });

        // Notify server once.
        let coinsEarned = 0;
        let scoreEarned = 0;
        let newlyUnlockedAchievementIds: string[] = [];
        const txn = startTransaction("completeGame", "http.client");
        try {
          const result = await httpsCallable(getFunctions(getApp()), "completeGame")({
            riddleId,
            gameMode,
            attempts: currentAttempt,
            isCorrect: true,
          });
          const data = result.data as { coinsEarned: number; newlyUnlockedAchievementIds: string[]; scoreEarned: number };
          coinsEarned = data.coinsEarned ?? 0;
          scoreEarned = data.scoreEarned ?? 0;
          newlyUnlockedAchievementIds = data.newlyUnlockedAchievementIds ?? [];
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

        return {
          outcome: "win",
          feedback,
          coinsEarned,
          scoreEarned,
          correctAnswer: answer,
          newlyUnlockedAchievementIds,
        };
      }

      // --- Attempt limit reached ---
      if (currentAttempt >= maxAttempts) {
        logger.debug("Out of attempts!");
        setGameOver(true);

        if (hasUsedContinue) {
          // Final loss — notify server.
          addBreadcrumb("game", "Game lost", { attempts: currentAttempt, riddleId, gameMode });
          gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
            type: "GAME_COMPLETED",
            outcome: "lost",
            attempts: currentAttempt,
          });

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
    [riddleId, answer, gameMode, hasUsedContinue, attemptsUsed]
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
  }, []);

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

/**
 * @fileoverview
 * Facade hook over {@link GameEngine} — React state, analytics, and completion ports.
 */
import {useState, useCallback, useEffect, useMemo, useRef} from "react";
import {
  GameEngine,
  computeGuestCompletionRewards,
  type Feedback,
  type GameEngineSnapshot,
} from "@qwordly/core";
import type {SubmittedGuess} from "./types";
import {logger} from "../utils/logger";
import {captureException, addBreadcrumb} from "../utils/sentry";
import {gameEventBus} from "../services/GameEventBus";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {CLASSIC_RIDDLE_COIN_REWARD, DAILY_CHALLENGE_COIN_REWARD} from "../constants/game";
import {NUM_GUESSES} from "../utils/constants";
import {getValidatedCallableFunction} from "../utils/firebaseFunctions";
import {
  CompleteGameInputSchema,
  CompleteGameOutputSchema,
  type CompleteGameOutput,
} from "../validation/cloudFunctionsSchemas";

export type {Feedback};

interface UseGameLogicProps {
  riddleId: string;
  answer: string;
  gameMode: "challenge" | "classic";
  isGuestMode?: boolean;
}

const GUEST_GAME_SESSION_STORAGE_KEY = "@guest_game_session_v1";
const INITIAL_ATTEMPTS = NUM_GUESSES;
const CONTINUE_ATTEMPTS = 3;

type GuestGameSessionSnapshot = {
  version: 2;
  riddleId: string;
  gameMode: "challenge" | "classic";
  guesses: SubmittedGuess[];
  attemptsUsed: number;
  hasUsedContinue: boolean;
  gameOver: boolean;
};

function createEngine(answer: string): GameEngine {
  return new GameEngine(
    {answer, initialAttempts: INITIAL_ATTEMPTS, continueAttempts: CONTINUE_ATTEMPTS},
    answer,
  );
}

function applySnapshot(
  snapshot: GameEngineSnapshot,
  setters: {
    setGuesses: (g: SubmittedGuess[]) => void;
    setAttemptsUsed: (n: number) => void;
    setHasUsedContinue: (v: boolean) => void;
    setGameOver: (v: boolean) => void;
  },
): void {
  setters.setGuesses(snapshot.guesses);
  setters.setAttemptsUsed(snapshot.attemptsUsed);
  setters.setHasUsedContinue(snapshot.hasUsedContinue);
  setters.setGameOver(snapshot.gameOver);
}

const useGameLogic = ({riddleId, answer, gameMode, isGuestMode = false}: UseGameLogicProps) => {
  const engine = useMemo(() => createEngine(answer), [answer]);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [hasUsedContinue, setHasUsedContinue] = useState(false);
  const lastPersistedGuestSnapshotRef = useRef<string | null>(null);

  const syncFromEngine = useCallback(
    (overrideGameOver?: boolean) => {
      const snapshot = engineRef.current.getSnapshot();
      applySnapshot(snapshot, {setGuesses, setAttemptsUsed, setHasUsedContinue, setGameOver});
      if (overrideGameOver !== undefined) {
        setGameOver(overrideGameOver);
      }
    },
    [],
  );

  const completeGame = useMemo(
    () => getValidatedCallableFunction("completeGame", CompleteGameInputSchema, CompleteGameOutputSchema),
    [],
  );

  const clearGuestSession = useCallback(async (): Promise<void> => {
    if (!isGuestMode) return;
    try {
      await AsyncStorage.removeItem(GUEST_GAME_SESSION_STORAGE_KEY);
      lastPersistedGuestSnapshotRef.current = null;
    } catch (error) {
      logger.warn("Unable to clear guest session snapshot.", error);
    }
  }, [isGuestMode]);

  useEffect(() => {
    if (!isGuestMode) return;
    let cancelled = false;

    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_GAME_SESSION_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<GuestGameSessionSnapshot>;
        if (parsed.version !== 2) return;
        if (parsed.riddleId !== riddleId) return;
        if (parsed.gameMode !== gameMode) return;
        if (cancelled) return;
        lastPersistedGuestSnapshotRef.current = raw;

        engineRef.current.restore({
          guesses: Array.isArray(parsed.guesses) ? (parsed.guesses as SubmittedGuess[]) : [],
          attemptsUsed: typeof parsed.attemptsUsed === "number" ? parsed.attemptsUsed : 0,
          hasUsedContinue: parsed.hasUsedContinue === true,
          gameOver: parsed.gameOver === true,
        });
        syncFromEngine();
      } catch (error) {
        logger.warn("Guest session restore failed; starting fresh.", error);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [isGuestMode, riddleId, gameMode, syncFromEngine]);

  useEffect(() => {
    if (!isGuestMode) return;

    const snapshot: GuestGameSessionSnapshot = {
      version: 2,
      riddleId,
      gameMode,
      guesses,
      attemptsUsed,
      hasUsedContinue,
      gameOver,
    };
    const serialized = JSON.stringify(snapshot);
    if (lastPersistedGuestSnapshotRef.current === serialized) {
      return;
    }

    void AsyncStorage.setItem(GUEST_GAME_SESSION_STORAGE_KEY, serialized)
      .then(() => {
        lastPersistedGuestSnapshotRef.current = serialized;
      })
      .catch((error) => {
        logger.warn("Unable to persist guest session snapshot.", error);
      });
  }, [isGuestMode, riddleId, gameMode, guesses, attemptsUsed, hasUsedContinue, gameOver]);

  const processGuess = useCallback(
    async (guess: string[]) => {
      const guessString = guess.join("");
      const currentAttempt = attemptsUsed + 1;

      addBreadcrumb("game", "Guess submitted", {guess: guessString, attempt: currentAttempt, riddleId, gameMode});
      gameEventBus.emit<import("../services/GameEventBus").GuessSubmittedEvent>({
        type: "GUESS_SUBMITTED",
        guess: guessString,
        attemptNumber: currentAttempt,
      });

      const engineOutcome = engineRef.current.submitGuess(guess);
      if (!engineOutcome) {
        return null;
      }

      const {feedback} = engineOutcome;
      const isCorrect = engineOutcome.kind === "win";
      setCurrentGuess([]);
      syncFromEngine(engineOutcome.kind === "attemptLimitReached" ? true : undefined);

      gameEventBus.emit<import("../services/GameEventBus").GuessValidatedEvent>({
        type: "GUESS_VALIDATED",
        guess: guessString,
        feedback: guess.map((letter, i) => ({letter, status: feedback[i]})),
        isCorrect,
      });

      if (engineOutcome.kind === "win") {
        logger.debug("Correct guess!");
        addBreadcrumb("game", "Game won", {attempts: engineOutcome.attempts, riddleId, gameMode});
        void clearGuestSession();

        let coinsEarned = 0;
        let scoreEarned = 0;
        let newlyUnlockedAchievementIds: string[] = [];
        let newWinStreak: number | undefined;
        let rewardBreakdown: CompleteGameOutput["rewardBreakdown"];
        if (isGuestMode) {
          const rewards = computeGuestCompletionRewards(gameMode, engineOutcome.attempts, {
            challengeCoinReward: DAILY_CHALLENGE_COIN_REWARD,
            classicCoinReward: CLASSIC_RIDDLE_COIN_REWARD,
          });
          coinsEarned = rewards.coins;
          scoreEarned = rewards.score;
        } else {
          try {
            const data: CompleteGameOutput = await completeGame({
              riddleId,
              gameMode,
              attempts: engineOutcome.attempts,
              isCorrect: true,
            });
            coinsEarned = data.coinsEarned ?? 0;
            scoreEarned = data.scoreEarned ?? data.xpEarned ?? 0;
            newlyUnlockedAchievementIds = data.newlyUnlockedAchievementIds ?? [];
            newWinStreak = data.newWinStreak;
            rewardBreakdown = data.rewardBreakdown;
          } catch (err) {
            logger.error("Error calling completeGame on win:", err);
            captureException(err);
          }
        }

        gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
          type: "GAME_COMPLETED",
          outcome: "won",
          attempts: engineOutcome.attempts,
          coinsEarned,
        });

        return {
          outcome: "win",
          feedback,
          coinsEarned,
          scoreEarned,
          correctAnswer: answer,
          newlyUnlockedAchievementIds,
          newWinStreak,
          ...(rewardBreakdown ? {rewardBreakdown} : {}),
        };
      }

      if (engineOutcome.kind === "loss") {
        logger.debug("Out of attempts!");
        addBreadcrumb("game", "Game lost", {attempts: engineOutcome.attempts, riddleId, gameMode});
        gameEventBus.emit<import("../services/GameEventBus").GameCompletedEvent>({
          type: "GAME_COMPLETED",
          outcome: "lost",
          attempts: engineOutcome.attempts,
        });
        void clearGuestSession();

        if (!isGuestMode) {
          try {
            await completeGame({
              riddleId,
              gameMode,
              attempts: engineOutcome.attempts,
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

      if (engineOutcome.kind === "attemptLimitReached") {
        logger.debug("Out of attempts!");
        return {
          outcome: "attemptLimitReached",
          feedback,
          correctAnswer: answer,
          coinsEarned: 0,
          canOfferRewardedAd: true,
          canOfferCoinContinue: true,
        };
      }

      logger.debug("Guess:", guessString, "Feedback:", feedback);
      return {
        outcome: "continue",
        feedback,
        attemptsRemaining: engineOutcome.attemptsRemaining,
      };
    },
    [riddleId, answer, gameMode, attemptsUsed, isGuestMode, clearGuestSession, completeGame, syncFromEngine],
  );

  const continueGame = useCallback(() => {
    engineRef.current.continueAfterLimit();
    syncFromEngine();
    setCurrentGuess([]);
  }, [syncFromEngine]);

  const resetGame = useCallback(() => {
    engineRef.current.reset();
    syncFromEngine();
    setCurrentGuess([]);
    void clearGuestSession();
  }, [clearGuestSession, syncFromEngine]);

  const maxAttempts = hasUsedContinue ? INITIAL_ATTEMPTS + CONTINUE_ATTEMPTS : INITIAL_ATTEMPTS;
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

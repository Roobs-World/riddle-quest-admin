import {computeFeedback} from "./computeFeedback";
import {lowerCaseGraphemes} from "./graphemes";
import type {Feedback, ScoredGuess} from "./types";

/**
 * Identifies the single-player progression rules surrounding a game-engine run.
 *
 * @remarks
 * The engine applies the same guess-scoring algorithm in both modes. Consumers use
 * the mode when selecting content and completion rewards.
 */
export type GameEngineMode = "challenge" | "classic";

/**
 * Describes the state transition caused by one submitted guess.
 *
 * @remarks
 * `attempts` is cumulative across the base attempt budget and an accepted
 * continue. `feedback` always belongs to the guess that caused this outcome.
 * A caller must stop accepting guesses after `attemptLimitReached` until it has
 * either invoked {@link GameEngine.continueAfterLimit} or ended the surrounding
 * session.
 */
export type GuessOutcome =
  | {
      /** Stores kind. */
      kind: "win"; /** Stores feedback. */
      /** Stores feedback. */
      feedback: Feedback[]; /** Stores attempts. */
      /** Stores attempts. */
      attempts: number;
    }
  | {
      /** Stores kind. */
      kind: "loss"; /** Stores feedback. */
      /** Stores feedback. */
      feedback: Feedback[]; /** Stores attempts. */
      /** Stores attempts. */
      attempts: number;
    }
  | {
      /** Stores kind. */
      kind: "attemptLimitReached"; /** Stores feedback. */
      /** Stores feedback. */
      feedback: Feedback[]; /** Stores attempts. */
      /** Stores attempts. */
      attempts: number; /** Stores can offer continue. */
      /** Stores can offer continue. */
      canOfferContinue: true;
    }
  | {
      /** Stores kind. */
      kind: "continue"; /** Stores feedback. */
      /** Stores feedback. */
      feedback: Feedback[]; /** Stores attempts. */
      /** Stores attempts. */
      attempts: number; /** Stores attempts remaining. */
      /** Stores attempts remaining. */
      attemptsRemaining: number;
    };

/** Configures the answer and attempt budgets for a {@link GameEngine}. */
export interface GameEngineConfig {
  /**
   * Answer compared with submitted guesses after NFC normalization and
   * locale-aware lowercasing using the default `en` locale.
   */
  answer: string;
  /**
   * Number of guesses available before the engine offers a continue.
   *
   * @remarks The engine expects a positive integer but does not validate it.
   */
  initialAttempts: number;
  /**
   * Additional guesses made available after a continue is accepted.
   *
   * @remarks The engine expects a non-negative integer but does not validate it.
   */
  continueAttempts: number;
}

/** Serializable mutable state required to resume a {@link GameEngine}. */
export interface GameEngineSnapshot {
  /** Guesses currently displayed in the active grid, in submission order. */
  guesses: ScoredGuess[];
  /** Cumulative guesses submitted, including guesses made before a continue. */
  attemptsUsed: number;
  /** Whether the additional continue attempt budget has been enabled. */
  hasUsedContinue: boolean;
  /** Whether a win or final loss has put the engine in its terminal state. */
  gameOver: boolean;
}

/**
 * Runs the deterministic, provider-independent state machine for local guess flow.
 *
 * @remarks
 * The engine is mutable and deliberately contains no React, persistence, network,
 * identity, or economy behavior. It assumes callers have already validated guess
 * length and characters. Attempt limits and restore snapshots are trusted rather
 * than checked at runtime.
 */
export class GameEngine {
  /** Guesses shown in the current grid; a continue starts a fresh grid. */
  private guesses: ScoredGuess[] = [];
  /** Cumulative submitted guesses, including guesses from a previous grid. */
  private attemptsUsed = 0;
  /** Whether the configured continue budget contributes to the attempt cap. */
  private hasUsedContinue = false;
  /** Prevents further submissions after a win or a final loss. */
  private gameOver = false;
  /** Immutable reference to the answer fallback and attempt budgets. */
  private readonly config: GameEngineConfig;
  /** NFC-normalized, lowercased answer used for equality and feedback. */
  private readonly normalizedAnswer: string;

  /**
   * Creates an empty game-engine run.
   *
   * @param config - Answer fallback and base/continue attempt budgets.
   * @param answer - Optional answer override, used instead of `config.answer` when supplied.
   */
  constructor(config: GameEngineConfig, answer?: string) {
    this.config = config;
    this.normalizedAnswer = lowerCaseGraphemes(answer ?? config.answer).join("");
  }

  /**
   * Captures the engine state needed for persistence or handoff.
   *
   * @returns A snapshot with a new outer `guesses` array.
   *
   * @remarks
   * Guess objects and their nested arrays are not deep-cloned. Treat the returned
   * snapshot as immutable unless it is serialized before further use.
   */
  getSnapshot(): GameEngineSnapshot {
    return {
      guesses: [...this.guesses],
      attemptsUsed: this.attemptsUsed,
      hasUsedContinue: this.hasUsedContinue,
      gameOver: this.gameOver,
    };
  }

  /**
   * Replaces the current mutable state with a previously captured snapshot.
   *
   * @param snapshot - Trusted snapshot associated with the same answer and config.
   *
   * @remarks
   * The snapshot is not validated and only its outer `guesses` array is copied.
   * Consumers must validate untrusted persisted data before calling this method.
   */
  restore(snapshot: GameEngineSnapshot): void {
    this.guesses = [...snapshot.guesses];
    this.attemptsUsed = snapshot.attemptsUsed;
    this.hasUsedContinue = snapshot.hasUsedContinue;
    this.gameOver = snapshot.gameOver;
  }

  /**
   * Clears all progress and returns the run to its initial state.
   *
   * @remarks The configured answer and attempt budgets are retained.
   */
  reset(): void {
    this.guesses = [];
    this.attemptsUsed = 0;
    this.hasUsedContinue = false;
    this.gameOver = false;
  }

  /**
   * Gets the cumulative attempt cap for the current continue state.
   *
   * @returns `initialAttempts`, or the sum of both budgets after a continue.
   */
  getMaxAttempts(): number {
    return this.hasUsedContinue
      ? this.config.initialAttempts + this.config.continueAttempts
      : this.config.initialAttempts;
  }

  /**
   * Indicates whether the engine has reached a winning or final losing state.
   *
   * @returns `true` after a win or a loss following the continue budget.
   * `attemptLimitReached` alone leaves the engine non-terminal.
   */
  isGameOver(): boolean {
    return this.gameOver;
  }

  /**
   * Scores one guess and advances the attempt state.
   *
   * @param guessLetters - Ordered graphemes for a prevalidated guess. The engine
   * retains this array in its snapshot, so callers must not mutate it afterward.
   * @returns The resulting state transition, or `null` when the engine is already
   * terminal.
   *
   * @remarks
   * The joined guess is NFC-normalized and lowercased before comparison. The
   * method does not enforce answer length or character policy. After an
   * `attemptLimitReached` result, submitting again without accepting a continue
   * will consume another attempt and repeat that result; the surrounding flow is
   * responsible for pausing input.
   */
  submitGuess(guessLetters: string[]): GuessOutcome | null {
    if (this.gameOver) {
      return null;
    }

    /** Provides guess string behavior. */
    const guessString = guessLetters.join("");
    /** Normalizes d guess. */
    const normalizedGuess = lowerCaseGraphemes(guessString).join("");
    /** Provides max attempts behavior. */
    const maxAttempts = this.getMaxAttempts();
    /** Provides current attempt behavior. */
    const currentAttempt = this.attemptsUsed + 1;
    /** Provides feedback behavior. */
    const feedback = computeFeedback(normalizedGuess, this.normalizedAnswer);
    /** Indicates whether is correct. */
    const isCorrect = normalizedGuess === this.normalizedAnswer;

    this.guesses.push({guess: guessLetters, feedback});
    this.attemptsUsed = currentAttempt;

    if (isCorrect) {
      this.gameOver = true;
      return {kind: "win", feedback, attempts: currentAttempt};
    }

    if (currentAttempt >= maxAttempts) {
      if (this.hasUsedContinue) {
        this.gameOver = true;
        return {kind: "loss", feedback, attempts: currentAttempt};
      }

      return {
        kind: "attemptLimitReached",
        feedback,
        attempts: currentAttempt,
        canOfferContinue: true,
      };
    }

    return {
      kind: "continue",
      feedback,
      attempts: currentAttempt,
      attemptsRemaining: maxAttempts - currentAttempt,
    };
  }

  /**
   * Enables the additional attempt budget after the base limit is reached.
   *
   * @remarks
   * This starts a fresh visible guess grid but deliberately preserves the
   * cumulative `attemptsUsed` count. The method does not verify that a limit was
   * reached or prevent multiple calls, so the surrounding flow must call it
   * exactly once in response to `attemptLimitReached`.
   */
  continueAfterLimit(): void {
    this.hasUsedContinue = true;
    this.gameOver = false;
    this.guesses = [];
  }
}

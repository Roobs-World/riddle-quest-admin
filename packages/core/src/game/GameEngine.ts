import {computeFeedback} from "./computeFeedback";
import {lowerCaseGraphemes} from "./graphemes";
import type {Feedback, ScoredGuess} from "./types";

/** Describes game engine mode. */
export type GameEngineMode = "challenge" | "classic";

/** Describes guess outcome. */
export type GuessOutcome =
  | {kind: "win"; feedback: Feedback[]; attempts: number}
  | {kind: "loss"; feedback: Feedback[]; attempts: number}
  | {kind: "attemptLimitReached"; feedback: Feedback[]; attempts: number; canOfferContinue: true}
  | {kind: "continue"; feedback: Feedback[]; attempts: number; attemptsRemaining: number};

/** Defines the contract for game engine config. */
export interface GameEngineConfig {
  /** Stores answer. */
  answer: string;
  /** Stores initial attempts. */
  initialAttempts: number;
  /** Stores continue attempts. */
  continueAttempts: number;
}

/** Defines the contract for game engine snapshot. */
export interface GameEngineSnapshot {
  /** Stores guesses. */
  guesses: ScoredGuess[];
  /** Stores attempts used. */
  attemptsUsed: number;
  /** Stores has used continue. */
  hasUsedContinue: boolean;
  /** Stores game over. */
  gameOver: boolean;
}

/**
 * Pure state machine for local guess flow (no React, no Firebase).
 */
export class GameEngine {
  /** Stores guesses. */
  private guesses: ScoredGuess[] = [];
  /** Stores attempts used. */
  private attemptsUsed = 0;
  /** Stores has used continue. */
  private hasUsedContinue = false;
  /** Stores game over. */
  private gameOver = false;
  /** Stores config. */
  private readonly config: GameEngineConfig;
  /** Stores normalized answer. */
  private readonly normalizedAnswer: string;

  /** Creates a game engine instance. */
  constructor(config: GameEngineConfig, answer?: string) {
    this.config = config;
    this.normalizedAnswer = lowerCaseGraphemes(answer ?? config.answer).join("");
  }

  /** Gets snapshot. */
  getSnapshot(): GameEngineSnapshot {
    return {
      guesses: [...this.guesses],
      attemptsUsed: this.attemptsUsed,
      hasUsedContinue: this.hasUsedContinue,
      gameOver: this.gameOver,
    };
  }

  /** Provides restore behavior. */
  restore(snapshot: GameEngineSnapshot): void {
    this.guesses = [...snapshot.guesses];
    this.attemptsUsed = snapshot.attemptsUsed;
    this.hasUsedContinue = snapshot.hasUsedContinue;
    this.gameOver = snapshot.gameOver;
  }

  /** Provides reset behavior. */
  reset(): void {
    this.guesses = [];
    this.attemptsUsed = 0;
    this.hasUsedContinue = false;
    this.gameOver = false;
  }

  /** Gets max attempts. */
  getMaxAttempts(): number {
    return this.hasUsedContinue
      ? this.config.initialAttempts + this.config.continueAttempts
      : this.config.initialAttempts;
  }

  /** Indicates whether is game over. */
  isGameOver(): boolean {
    return this.gameOver;
  }

  /** Submits guess. */
  submitGuess(guessLetters: string[]): GuessOutcome | null {
    if (this.gameOver) {
      return null;
    }

    const guessString = guessLetters.join("");
    const normalizedGuess = lowerCaseGraphemes(guessString).join("");
    const maxAttempts = this.getMaxAttempts();
    const currentAttempt = this.attemptsUsed + 1;
    const feedback = computeFeedback(normalizedGuess, this.normalizedAnswer);
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

  /** Provides continue after limit behavior. */
  continueAfterLimit(): void {
    this.hasUsedContinue = true;
    this.gameOver = false;
    this.guesses = [];
  }
}

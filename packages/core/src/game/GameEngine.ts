import {computeFeedback} from "./computeFeedback";
import {lowerCaseGraphemes} from "./graphemes";
import type {Feedback, ScoredGuess} from "./types";

export type GameEngineMode = "challenge" | "classic";

export type GuessOutcome =
  | {kind: "win"; feedback: Feedback[]; attempts: number}
  | {kind: "loss"; feedback: Feedback[]; attempts: number}
  | {kind: "attemptLimitReached"; feedback: Feedback[]; attempts: number; canOfferContinue: true}
  | {kind: "continue"; feedback: Feedback[]; attempts: number; attemptsRemaining: number};

export interface GameEngineConfig {
  answer: string;
  initialAttempts: number;
  continueAttempts: number;
}

export interface GameEngineSnapshot {
  guesses: ScoredGuess[];
  attemptsUsed: number;
  hasUsedContinue: boolean;
  gameOver: boolean;
}

/**
 * Pure state machine for local guess flow (no React, no Firebase).
 */
export class GameEngine {
  private guesses: ScoredGuess[] = [];
  private attemptsUsed = 0;
  private hasUsedContinue = false;
  private gameOver = false;
  private readonly config: GameEngineConfig;
  private readonly normalizedAnswer: string;

  constructor(config: GameEngineConfig, answer?: string) {
    this.config = config;
    this.normalizedAnswer = lowerCaseGraphemes(answer ?? config.answer).join("");
  }

  getSnapshot(): GameEngineSnapshot {
    return {
      guesses: [...this.guesses],
      attemptsUsed: this.attemptsUsed,
      hasUsedContinue: this.hasUsedContinue,
      gameOver: this.gameOver,
    };
  }

  restore(snapshot: GameEngineSnapshot): void {
    this.guesses = [...snapshot.guesses];
    this.attemptsUsed = snapshot.attemptsUsed;
    this.hasUsedContinue = snapshot.hasUsedContinue;
    this.gameOver = snapshot.gameOver;
  }

  reset(): void {
    this.guesses = [];
    this.attemptsUsed = 0;
    this.hasUsedContinue = false;
    this.gameOver = false;
  }

  getMaxAttempts(): number {
    return this.hasUsedContinue
      ? this.config.initialAttempts + this.config.continueAttempts
      : this.config.initialAttempts;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

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

  continueAfterLimit(): void {
    this.hasUsedContinue = true;
    this.gameOver = false;
    this.guesses = [];
  }
}

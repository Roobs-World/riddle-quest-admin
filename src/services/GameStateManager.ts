/**
 * @fileoverview
 * @deprecated Legacy game-state abstraction kept temporarily for compatibility.
 * Prefer `useGameLogic` and `GameScreen` flow-specific hooks for active gameplay.
 *
 * Local game state manager and React hook for classic 5-letter Riddle Quest gameplay.
 *
 * `GameStateManager` encapsulates client-side guess entry, feedback handling,
 * and audio feedback, while delegating authoritative guess validation to
 * `RiddleService.submitGuess` and the corresponding Firebase Function.
 *
 * The exported `useGameStateManager` hook provides a React-friendly wrapper
 * around this class for components that want an imperative-but-typed game API.
 */
import { useState, useCallback } from "react";
import { GameMode } from "../contexts/AuthContext";
import { RiddleService } from "./RiddleService";
import { SubmitGuessInput } from "../validation/cloudFunctionsSchemas";
import { IAudioFeedbackService } from "./interfaces/IAudioFeedbackService";
import { serviceRegistry } from "./ServiceRegistry";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Internal snapshot of the current game state for a single riddle.
 */
interface GameState {
  /** Current in-progress guess as a lowercased string. */
  currentGuess: string;
  /** Previously submitted guesses in order. */
  guesses: string[];
  /** Feedback rows aligned to `guesses`. */
  feedback: { letter: string; status: "green" | "yellow" | "red" }[][];
  /** Current lifecycle state of this riddle session. */
  gameStatus: "playing" | "won" | "lost";
  /** True while a guess submit request is in flight. */
  isLoading: boolean;
  /** Controls whether hint UI is visible. */
  showHint: boolean;
  /** Coins awarded when the session ends in a win. */
  coinsEarned?: number;
}

/**
 * Configuration used when constructing a new `GameStateManager` instance.
 */
interface GameConfig {
  /** Selected game mode for this session. */
  mode: GameMode;
  /** Maximum guesses allowed before loss. */
  maxGuesses: number;
  /** Optional riddle id required for server-backed submit flow. */
  riddleId?: string;
  /** Callback fired when the game reaches win/loss terminal state. */
  onGameComplete?: (result: { won: boolean; coinsEarned?: number }) => void;
  /** Callback fired when submit/validation flow fails. */
  onError?: (error: string) => void;
}

/**
 * Class-based game state manager used by the React hook wrapper below.
 *
 * This class owns the mutable game state for a single riddle instance,
 * exposes imperative actions (add/remove letters, submit guesses, reset),
 * and notifies subscribers when state changes so React components can
 * re-render via `useGameStateManager`.
 */
export class GameStateManager {
  private state: GameState = {
    currentGuess: "",
    guesses: [],
    feedback: [],
    gameStatus: "playing",
    isLoading: false,
    showHint: false,
  };

  private config: GameConfig;
  private listeners: Set<() => void> = new Set();
  private audioFeedback: IAudioFeedbackService;

  /**
   * Creates a new game state manager with the supplied configuration.
   *
   * @param config Game configuration including mode, max guesses, riddle id,
   * and optional completion/error callbacks.
   */
  constructor(config: GameConfig) {
    this.config = config;
    logger.warn(
      "[DEPRECATED] GameStateManager is legacy. Migrate callers to useGameLogic/controller hooks."
    );
    // Get audio feedback service from registry
    this.audioFeedback = serviceRegistry.getAudioFeedbackService();
  }

  /**
   * Subscribes to state updates emitted by this manager.
   *
   * @param listener Callback invoked after each state mutation.
   * @returns Unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Returns the latest immutable snapshot of game state.
   *
   * @returns Current game state snapshot.
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Notifies all active subscribers that state has changed.
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Merges partial updates into current state and emits change notifications.
   *
   * @param updates Partial state fields to update.
   */
  private setState(updates: Partial<GameState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Appends one letter to the current guess when input is allowed.
   *
   * @param letter Letter to append to the current guess.
   */
  addLetter = (letter: string): void => {
    if (
      this.state.currentGuess.length < 5 &&
      this.state.gameStatus === "playing"
    ) {
      this.setState({
        currentGuess: this.state.currentGuess + letter.toLowerCase(),
      });

      // Play neutral feedback using injected service
      this.audioFeedback.playNeutralFeedback();
    }
  };

  /**
   * Removes the last letter from the current guess when available.
   */
  removeLetter = (): void => {
    if (this.state.currentGuess.length > 0) {
      this.setState({
        currentGuess: this.state.currentGuess.slice(0, -1),
      });

      // Play neutral feedback using injected service
      this.audioFeedback.playNeutralFeedback();
    }
  };

  /**
   * Submits the current guess to backend validation and updates session state.
   *
   * @returns Promise resolved when submit flow is complete.
   */
  submitGuess = async (): Promise<void> => {
    if (
      this.state.currentGuess.length !== 5 ||
      this.state.gameStatus !== "playing" ||
      !this.config.riddleId
    ) {
      return;
    }

    this.setState({ isLoading: true });

    try {
      const guessData: SubmitGuessInput = {
        guess: this.state.currentGuess,
        riddleId: this.config.riddleId,
        gameMode: this.config.mode === "daily" ? "challenge" : "classic",
        attempts: this.state.guesses.length + 1, // Add the current attempt number
      };

      const result = await RiddleService.submitGuess(guessData);

      const newGuesses = [...this.state.guesses, this.state.currentGuess];
      const newFeedback = [...this.state.feedback, result.feedback];

      let gameStatus: "playing" | "won" | "lost" = "playing";
      let coinsEarned: number | undefined;

      if (result.isCorrect) {
        gameStatus = "won";
        coinsEarned = result.coinsEarned;

        // Play success feedback using injected service
        this.audioFeedback.playSuccessFeedback();
      } else if (
        newGuesses.length >= this.config.maxGuesses ||
        result.gameOver
      ) {
        gameStatus = "lost";

        // Play error feedback with dramatic fade-in using injected service
        this.audioFeedback.playErrorFeedback({ fadeInDuration: 1500 });
      } else {
        // Wrong guess but game continues
        this.audioFeedback.playWrongGuessFeedback();
      }

      this.setState({
        currentGuess: "",
        guesses: newGuesses,
        feedback: newFeedback,
        gameStatus,
        coinsEarned,
        isLoading: false,
      });

      // Notify parent component of game completion
      if (gameStatus !== "playing" && this.config.onGameComplete) {
        this.config.onGameComplete({
          won: gameStatus === "won",
          coinsEarned,
        });
      }
    } catch (error) {
      this.setState({ isLoading: false });

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      if (this.config.onError) {
        this.config.onError(errorMessage);
      }

      logger.error("Error submitting guess:", error);
      captureException(error);
    }
  };

  /**
   * Resets the manager to a fresh game state.
   */
  resetGame = (): void => {
    this.setState({
      currentGuess: "",
      guesses: [],
      feedback: [],
      gameStatus: "playing",
      isLoading: false,
      showHint: false,
      coinsEarned: undefined,
    });
  };

  /**
   * Toggles hint visibility to true.
   */
  showHint = (): void => {
    this.setState({ showHint: true });
  };

  /**
   * Indicates whether submit action is currently valid.
   *
   * @returns True when guess length is valid and game is ready to submit.
   */
  canSubmitGuess(): boolean {
    return (
      this.state.currentGuess.length === 5 &&
      this.state.gameStatus === "playing" &&
      !this.state.isLoading
    );
  }

  /**
   * Returns the zero-based row index for the next guess.
   *
   * @returns Number of submitted guesses.
   */
  getCurrentRow(): number {
    return this.state.guesses.length;
  }

  /**
   * Returns remaining guesses before reaching max attempts.
   *
   * @returns Remaining guess count.
   */
  getRemainingGuesses(): number {
    return this.config.maxGuesses - this.state.guesses.length;
  }
}

/**
 * React hook wrapper around `GameStateManager` for use in components.
 *
 * It creates a single `GameStateManager` instance per hook usage and
 * subscribes to its updates, forcing React re-renders when the internal
 * state changes.
 *
 * @param config Game configuration used to construct the underlying manager.
 * @returns Current game state plus grouped `actions` and `utils` helpers.
 */
export const useGameStateManager = (config: GameConfig) => {
  const [gameManager] = useState(() => new GameStateManager(config));
  const [, forceUpdate] = useState({});

  // Subscribe to state changes
  const rerender = useCallback(() => {
    forceUpdate({});
  }, []);

  // Subscribe on mount, unsubscribe on unmount
  useState(() => {
    const unsubscribe = gameManager.subscribe(rerender);
    return unsubscribe;
  });

  return {
    gameState: gameManager.getState(),
    actions: {
      addLetter: gameManager.addLetter,
      removeLetter: gameManager.removeLetter,
      submitGuess: gameManager.submitGuess,
      resetGame: gameManager.resetGame,
      showHint: gameManager.showHint,
    },
    utils: {
      canSubmitGuess: () => gameManager.canSubmitGuess(),
      getCurrentRow: () => gameManager.getCurrentRow(),
      getRemainingGuesses: () => gameManager.getRemainingGuesses(),
    },
  };
};

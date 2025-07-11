import { GameStateManager } from "../GameStateManager";
import { GameMode } from "../../contexts/AuthContext";
import { RiddleService } from "../RiddleService";
import { serviceRegistry } from "../ServiceRegistry";
import { IAudioFeedbackService } from "../interfaces/IAudioFeedbackService";

// Mock dependencies
jest.mock("../RiddleService", () => ({
  RiddleService: {
    submitGuess: jest.fn(),
  },
}));

jest.mock("../ServiceRegistry", () => ({
  serviceRegistry: {
    getAudioFeedbackService: jest.fn(),
  },
}));

// Mock audio feedback service
const mockAudioFeedback: jest.Mocked<IAudioFeedbackService> = {
  playNeutralFeedback: jest.fn(),
  playSuccessFeedback: jest.fn(),
  playErrorFeedback: jest.fn(),
  playWrongGuessFeedback: jest.fn(),
  playFeedback: jest.fn(),
};

describe("GameStateManager", () => {
  let gameStateManager: GameStateManager;
  let mockOnGameComplete: jest.MockedFunction<
    (result: { won: boolean; coinsEarned?: number }) => void
  >;
  let mockOnError: jest.MockedFunction<(error: string) => void>;

  const defaultConfig = {
    mode: "classic" as GameMode,
    maxGuesses: 6,
    riddleId: "test-riddle-id",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup service registry mock
    (serviceRegistry.getAudioFeedbackService as jest.Mock).mockReturnValue(
      mockAudioFeedback
    );

    // Setup callback mocks
    mockOnGameComplete = jest.fn();
    mockOnError = jest.fn();

    gameStateManager = new GameStateManager({
      ...defaultConfig,
      onGameComplete: mockOnGameComplete,
      onError: mockOnError,
    });
  });

  describe("Constructor", () => {
    it("should initialize with default state", () => {
      const state = gameStateManager.getState();

      expect(state).toEqual({
        currentGuess: "",
        guesses: [],
        feedback: [],
        gameStatus: "playing",
        isLoading: false,
        showHint: false,
      });
    });

    it("should get audio feedback service from registry", () => {
      expect(serviceRegistry.getAudioFeedbackService).toHaveBeenCalled();
    });

    it("should accept config without optional callbacks", () => {
      const manager = new GameStateManager(defaultConfig);
      expect(manager).toBeInstanceOf(GameStateManager);
    });
  });

  describe("State Management", () => {
    it("should return a copy of the state to prevent mutations", () => {
      const state1 = gameStateManager.getState();
      const state2 = gameStateManager.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });

    it("should notify listeners when state changes", () => {
      const listener = jest.fn();
      const unsubscribe = gameStateManager.subscribe(listener);

      gameStateManager.addLetter("a");

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      gameStateManager.addLetter("b");

      expect(listener).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
    });

    it("should handle multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      gameStateManager.subscribe(listener1);
      gameStateManager.subscribe(listener2);

      gameStateManager.addLetter("a");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function that works correctly", () => {
      const listener = jest.fn();
      const unsubscribe = gameStateManager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");

      gameStateManager.addLetter("a");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      gameStateManager.addLetter("b");
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("addLetter", () => {
    it("should add letter to current guess when valid", () => {
      gameStateManager.addLetter("H");

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("h"); // Should be lowercase
      expect(mockAudioFeedback.playNeutralFeedback).toHaveBeenCalledTimes(1);
    });

    it("should add multiple letters up to 5 characters", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("hello");
      expect(mockAudioFeedback.playNeutralFeedback).toHaveBeenCalledTimes(5);
    });

    it("should not add letter when guess is already 5 characters", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");
      gameStateManager.addLetter("W"); // Should be ignored

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("hello");
      expect(mockAudioFeedback.playNeutralFeedback).toHaveBeenCalledTimes(5); // Not 6
    });

    it("should not add letter when game is not playing", () => {
      // Force game to won state
      gameStateManager.resetGame();
      (gameStateManager as any).setState({ gameStatus: "won" });

      gameStateManager.addLetter("A");

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("");
      expect(mockAudioFeedback.playNeutralFeedback).not.toHaveBeenCalled();
    });

    it("should convert letters to lowercase", () => {
      gameStateManager.addLetter("A");
      gameStateManager.addLetter("B");

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("ab");
    });
  });

  describe("removeLetter", () => {
    it("should remove last letter from current guess", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");

      gameStateManager.removeLetter();

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("he");
      expect(mockAudioFeedback.playNeutralFeedback).toHaveBeenCalledTimes(4); // 3 adds + 1 remove
    });

    it("should not remove letter when guess is empty", () => {
      gameStateManager.removeLetter();

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("");
      expect(mockAudioFeedback.playNeutralFeedback).not.toHaveBeenCalled();
    });

    it("should handle removing all letters", () => {
      gameStateManager.addLetter("A");
      gameStateManager.addLetter("B");

      gameStateManager.removeLetter();
      gameStateManager.removeLetter();

      const state = gameStateManager.getState();
      expect(state.currentGuess).toBe("");
    });
  });

  describe("submitGuess", () => {
    beforeEach(() => {
      // Setup a valid 5-letter guess
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");
    });

    it("should not submit when guess is not 5 characters", async () => {
      gameStateManager.resetGame();
      gameStateManager.addLetter("H");

      await gameStateManager.submitGuess();

      expect(RiddleService.submitGuess).not.toHaveBeenCalled();
    });

    it("should not submit when game is not playing", async () => {
      (gameStateManager as any).setState({ gameStatus: "won" });

      await gameStateManager.submitGuess();

      expect(RiddleService.submitGuess).not.toHaveBeenCalled();
    });

    it("should not submit when riddleId is not provided", async () => {
      const managerWithoutRiddleId = new GameStateManager({
        mode: "classic",
        maxGuesses: 6,
      });

      await managerWithoutRiddleId.submitGuess();

      expect(RiddleService.submitGuess).not.toHaveBeenCalled();
    });

    it("should set loading state during submission", async () => {
      let resolvePromise: (value: any) => void;
      const submitPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (RiddleService.submitGuess as jest.Mock).mockReturnValue(submitPromise);

      const submitCall = gameStateManager.submitGuess();

      // Check loading state immediately
      const state = gameStateManager.getState();
      expect(state.isLoading).toBe(true);

      // Resolve the promise to clean up
      resolvePromise!({
        feedback: [],
        isCorrect: false,
        gameOver: false,
      });
      await submitCall;

      // Verify loading state is false after completion
      const finalState = gameStateManager.getState();
      expect(finalState.isLoading).toBe(false);
    });

    it("should handle successful guess (correct answer)", async () => {
      const mockResult = {
        feedback: [
          { letter: "h", status: "green" as const },
          { letter: "e", status: "green" as const },
          { letter: "l", status: "green" as const },
          { letter: "l", status: "green" as const },
          { letter: "o", status: "green" as const },
        ],
        isCorrect: true,
        coinsEarned: 50,
        gameOver: true,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await gameStateManager.submitGuess();

      const state = gameStateManager.getState();
      expect(state.gameStatus).toBe("won");
      expect(state.coinsEarned).toBe(50);
      expect(state.guesses).toEqual(["hello"]);
      expect(state.feedback).toEqual([mockResult.feedback]);
      expect(state.currentGuess).toBe("");
      expect(state.isLoading).toBe(false);

      expect(mockAudioFeedback.playSuccessFeedback).toHaveBeenCalledTimes(1);
      expect(mockOnGameComplete).toHaveBeenCalledWith({
        won: true,
        coinsEarned: 50,
      });
    });

    it("should handle wrong guess that ends game", async () => {
      const mockResult = {
        feedback: [
          { letter: "h", status: "red" as const },
          { letter: "e", status: "red" as const },
          { letter: "l", status: "red" as const },
          { letter: "l", status: "red" as const },
          { letter: "o", status: "red" as const },
        ],
        isCorrect: false,
        gameOver: true,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await gameStateManager.submitGuess();

      const state = gameStateManager.getState();
      expect(state.gameStatus).toBe("lost");
      expect(state.coinsEarned).toBeUndefined();

      expect(mockAudioFeedback.playErrorFeedback).toHaveBeenCalledWith({
        fadeInDuration: 1500,
      });
      expect(mockOnGameComplete).toHaveBeenCalledWith({
        won: false,
        coinsEarned: undefined,
      });
    });

    it("should handle wrong guess that continues game", async () => {
      const mockResult = {
        feedback: [
          { letter: "h", status: "yellow" as const },
          { letter: "e", status: "red" as const },
          { letter: "l", status: "green" as const },
          { letter: "l", status: "red" as const },
          { letter: "o", status: "yellow" as const },
        ],
        isCorrect: false,
        gameOver: false,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await gameStateManager.submitGuess();

      const state = gameStateManager.getState();
      expect(state.gameStatus).toBe("playing");
      expect(state.guesses).toEqual(["hello"]);
      expect(state.feedback).toEqual([mockResult.feedback]);

      expect(mockAudioFeedback.playWrongGuessFeedback).toHaveBeenCalledTimes(1);
      expect(mockOnGameComplete).not.toHaveBeenCalled();
    });

    it("should handle reaching max guesses", async () => {
      // Create a manager with only 1 guess allowed
      const singleGuessManager = new GameStateManager({
        mode: "classic",
        maxGuesses: 1,
        riddleId: "test-riddle",
        onGameComplete: mockOnGameComplete,
      });

      singleGuessManager.addLetter("H");
      singleGuessManager.addLetter("E");
      singleGuessManager.addLetter("L");
      singleGuessManager.addLetter("L");
      singleGuessManager.addLetter("O");

      const mockResult = {
        feedback: [
          { letter: "h", status: "red" as const },
          { letter: "e", status: "red" as const },
          { letter: "l", status: "red" as const },
          { letter: "l", status: "red" as const },
          { letter: "o", status: "red" as const },
        ],
        isCorrect: false,
        gameOver: false, // Service doesn't indicate game over, but we've reached max guesses
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await singleGuessManager.submitGuess();

      const state = singleGuessManager.getState();
      expect(state.gameStatus).toBe("lost");
      expect(mockOnGameComplete).toHaveBeenCalledWith({
        won: false,
        coinsEarned: undefined,
      });
    });

    it("should handle submission errors", async () => {
      const error = new Error("Network error");
      (RiddleService.submitGuess as jest.Mock).mockRejectedValue(error);

      await gameStateManager.submitGuess();

      const state = gameStateManager.getState();
      expect(state.isLoading).toBe(false);
      expect(state.gameStatus).toBe("playing"); // Should remain playing after error

      expect(mockOnError).toHaveBeenCalledWith("Network error");
    });

    it("should handle non-Error objects in catch", async () => {
      (RiddleService.submitGuess as jest.Mock).mockRejectedValue(
        "String error"
      );

      await gameStateManager.submitGuess();

      expect(mockOnError).toHaveBeenCalledWith("An error occurred");
    });

    it("should call RiddleService with correct parameters", async () => {
      const mockResult = {
        feedback: [],
        isCorrect: false,
        gameOver: false,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await gameStateManager.submitGuess();

      expect(RiddleService.submitGuess).toHaveBeenCalledWith({
        guess: "hello",
        riddleId: "test-riddle-id",
        gameMode: "classic",
        attempts: 1,
      });
    });

    it("should use 'challenge' game mode for daily mode", async () => {
      const dailyManager = new GameStateManager({
        mode: "daily",
        maxGuesses: 6,
        riddleId: "daily-riddle",
      });

      dailyManager.addLetter("H");
      dailyManager.addLetter("E");
      dailyManager.addLetter("L");
      dailyManager.addLetter("L");
      dailyManager.addLetter("O");

      const mockResult = {
        feedback: [],
        isCorrect: false,
        gameOver: false,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await dailyManager.submitGuess();

      expect(RiddleService.submitGuess).toHaveBeenCalledWith({
        guess: "hello",
        riddleId: "daily-riddle",
        gameMode: "challenge",
        attempts: 1,
      });
    });
  });

  describe("resetGame", () => {
    it("should reset all game state to initial values", () => {
      // Modify state first
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.showHint();
      (gameStateManager as any).setState({
        gameStatus: "won",
        coinsEarned: 100,
        guesses: ["hello"],
        feedback: [[{ letter: "h", status: "green" }]],
      });

      gameStateManager.resetGame();

      const state = gameStateManager.getState();
      expect(state).toEqual({
        currentGuess: "",
        guesses: [],
        feedback: [],
        gameStatus: "playing",
        isLoading: false,
        showHint: false,
        coinsEarned: undefined,
      });
    });
  });

  describe("showHint", () => {
    it("should set showHint to true", () => {
      gameStateManager.showHint();

      const state = gameStateManager.getState();
      expect(state.showHint).toBe(true);
    });

    it("should persist showHint state", () => {
      gameStateManager.showHint();
      gameStateManager.addLetter("A");

      const state = gameStateManager.getState();
      expect(state.showHint).toBe(true);
    });
  });

  describe("canSubmitGuess", () => {
    it("should return true when conditions are met", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");

      expect(gameStateManager.canSubmitGuess()).toBe(true);
    });

    it("should return false when guess is not 5 characters", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");

      expect(gameStateManager.canSubmitGuess()).toBe(false);
    });

    it("should return false when game is not playing", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");

      (gameStateManager as any).setState({ gameStatus: "won" });

      expect(gameStateManager.canSubmitGuess()).toBe(false);
    });

    it("should return false when loading", () => {
      gameStateManager.addLetter("H");
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");

      (gameStateManager as any).setState({ isLoading: true });

      expect(gameStateManager.canSubmitGuess()).toBe(false);
    });
  });

  describe("getCurrentRow", () => {
    it("should return 0 initially", () => {
      expect(gameStateManager.getCurrentRow()).toBe(0);
    });

    it("should return number of completed guesses", () => {
      (gameStateManager as any).setState({
        guesses: ["hello", "world"],
      });

      expect(gameStateManager.getCurrentRow()).toBe(2);
    });
  });

  describe("getRemainingGuesses", () => {
    it("should return maxGuesses initially", () => {
      expect(gameStateManager.getRemainingGuesses()).toBe(6);
    });

    it("should return correct remaining guesses", () => {
      (gameStateManager as any).setState({
        guesses: ["hello", "world"],
      });

      expect(gameStateManager.getRemainingGuesses()).toBe(4);
    });

    it("should return 0 when all guesses used", () => {
      (gameStateManager as any).setState({
        guesses: ["guess1", "guess2", "guess3", "guess4", "guess5", "guess6"],
      });

      expect(gameStateManager.getRemainingGuesses()).toBe(0);
    });
  });

  describe("Integration", () => {
    it("should handle a complete game flow", async () => {
      // Add a letter
      gameStateManager.addLetter("H");
      expect(gameStateManager.getState().currentGuess).toBe("h");

      // Add more letters
      gameStateManager.addLetter("E");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("L");
      gameStateManager.addLetter("O");

      expect(gameStateManager.canSubmitGuess()).toBe(true);

      // Mock a wrong guess
      const mockResult = {
        feedback: [
          { letter: "h", status: "yellow" as const },
          { letter: "e", status: "red" as const },
          { letter: "l", status: "green" as const },
          { letter: "l", status: "red" as const },
          { letter: "o", status: "yellow" as const },
        ],
        isCorrect: false,
        gameOver: false,
      };

      (RiddleService.submitGuess as jest.Mock).mockResolvedValue(mockResult);

      await gameStateManager.submitGuess();

      const stateAfterGuess = gameStateManager.getState();
      expect(stateAfterGuess.currentGuess).toBe("");
      expect(stateAfterGuess.guesses).toEqual(["hello"]);
      expect(stateAfterGuess.gameStatus).toBe("playing");
      expect(gameStateManager.getCurrentRow()).toBe(1);
      expect(gameStateManager.getRemainingGuesses()).toBe(5);
    });

    it("should handle game completion without callbacks", () => {
      const managerWithoutCallbacks = new GameStateManager({
        mode: "classic",
        maxGuesses: 6,
        riddleId: "test-riddle",
      });

      // Should not throw error when completing game without callbacks
      expect(() => {
        (managerWithoutCallbacks as any).setState({ gameStatus: "won" });
        (managerWithoutCallbacks as any).config.onGameComplete?.({
          won: true,
          coinsEarned: 50,
        });
      }).not.toThrow();
    });
  });
});

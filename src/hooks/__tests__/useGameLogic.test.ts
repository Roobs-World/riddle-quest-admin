// Import first since we're not overriding the global mocks
import { renderHook, act } from "@testing-library/react-native";
import useGameLogic, { Feedback } from "../useGameLogic";
import functions from "@react-native-firebase/functions";

// Get the mocked functions module
const mockFunctions = functions as jest.MockedFunction<typeof functions>;

// Create a mock callable function that we'll use for submitGuess
const mockSubmitGuessCallable = jest.fn();

describe("useGameLogic", () => {
  const defaultProps = {
    riddleId: "testRiddle123",
    gameMode: "classic" as "classic" | "challenge",
    correctAnswerLength: 5, // Assuming a default, adjust if necessary
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure the global mock to return our specific callable
    mockFunctions.mockReturnValue({
      httpsCallable: jest.fn((functionName: string) => {
        if (functionName === "submitGuess") {
          return mockSubmitGuessCallable;
        }
        return jest.fn().mockResolvedValue({ data: {} });
      }),
    } as any);

    mockSubmitGuessCallable.mockReset();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useGameLogic(defaultProps));
    expect(result.current.guesses).toEqual([]);
    expect(result.current.currentGuess).toEqual([]);
    expect(result.current.gameOver).toBe(false);
  });

  it("should update currentGuess when setCurrentGuess is called", () => {
    const { result } = renderHook(() => useGameLogic(defaultProps));
    act(() => {
      result.current.setCurrentGuess(["A", "P", "P", "L", "E"]);
    });
    expect(result.current.currentGuess).toEqual(["A", "P", "P", "L", "E"]);
  });

  it("should reset game state when resetGame is called", async () => {
    const { result } = renderHook(() => useGameLogic(defaultProps));

    mockSubmitGuessCallable.mockResolvedValueOnce({
      data: {
        feedback: ["red", "red", "red", "red", "red"] as Feedback[],
        isCorrect: false,
      },
    });
    await act(async () => {
      await result.current.processGuess(["W", "R", "O", "N", "G"]);
    });
    act(() => {
      result.current.setCurrentGuess(["A"]);
    });

    act(() => {
      result.current.resetGame();
    });

    expect(result.current.guesses).toEqual([]);
    expect(result.current.currentGuess).toEqual([]);
    expect(result.current.gameOver).toBe(false);
  });

  describe("processGuess", () => {
    const guessWord = ["G", "U", "E", "S", "S"];
    const guessString = "GUESS";

    it("should handle a winning guess", async () => {
      const guessChars = ["G", "U", "E", "S", "S"]; // Corresponds to guessString
      const feedbackStrings: Feedback[] = [
        "green",
        "green",
        "green",
        "green",
        "green",
      ];
      mockSubmitGuessCallable.mockResolvedValueOnce({
        data: {
          feedback: feedbackStrings.map((status, index) => ({
            // Create the structured feedback
            letter: guessChars[index],
            status,
          })),
          isCorrect: true,
          correctAnswer: guessString,
          coinsEarned: 10,
        },
      });

      const { result } = renderHook(() => useGameLogic(defaultProps));
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(1);
      expect(mockSubmitGuessCallable).toHaveBeenCalledWith({
        guess: guessString,
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 1,
      });
      expect(result.current.guesses.length).toBe(1);
      expect(result.current.guesses[0]).toEqual({
        guess: guessWord,
        feedback: feedbackStrings,
      }); // Assert against the transformed strings
      expect(result.current.currentGuess).toEqual([]);
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "win",
        feedback: feedbackStrings,
        coinsEarned: 10,
        correctAnswer: guessString,
      });
    });

    it("should handle an incorrect guess with attempts remaining", async () => {
      const guessChars = ["G", "U", "E", "S", "S"];
      const feedbackStrings: Feedback[] = [
        "red",
        "yellow",
        "red",
        "green",
        "red",
      ];
      mockSubmitGuessCallable.mockResolvedValueOnce({
        data: {
          feedback: feedbackStrings.map((status, index) => ({
            // Structured feedback
            letter: guessChars[index],
            status,
          })),
          isCorrect: false,
        },
      });

      const { result } = renderHook(() => useGameLogic(defaultProps));
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(1);
      expect(mockSubmitGuessCallable).toHaveBeenCalledWith({
        guess: guessString,
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 1,
      });

      expect(result.current.guesses.length).toBe(1);
      expect(result.current.guesses[0]).toEqual({
        guess: guessWord,
        feedback: feedbackStrings,
      }); // Assert against transformed strings
      expect(result.current.currentGuess).toEqual([]);
      expect(result.current.gameOver).toBe(false);
      expect(processResult).toEqual({
        outcome: "continue",
        feedback: feedbackStrings,
        attemptsRemaining: 2,
      });
    });

    it("should handle a losing guess (classic mode - 3 attempts)", async () => {
      const feedbackStrings: Feedback[] = ["red", "red", "red", "red", "red"];

      // Mock for all 3 calls (updated from 5 to 3 for new attempt system)
      mockSubmitGuessCallable.mockImplementation(
        async (callData: {
          guess: string;
          riddleId: string;
          gameMode: string;
          attempts: number;
        }) => {
          const currentGuessString = callData.guess as string;
          const currentGuessChars = currentGuessString.split("");

          return {
            data: {
              feedback: feedbackStrings.map((status, index) => ({
                // Structured feedback
                letter: currentGuessChars[index] || "", // Handle potential length mismatches gracefully for the mock
                status,
              })),
              isCorrect: false, // All these calls are incorrect
              correctAnswer: "ANSWER", // Only relevant on the last call from the SUT's perspective
              coinsEarned: 0,
            },
          };
        }
      );

      const { result } = renderHook(() => useGameLogic(defaultProps));
      const incorrectGuessBase = ["F", "A", "I", "L"];
      // Updated to only 2 loops for 3-attempt system
      for (let i = 0; i < 2; i++) {
        await act(async () => {
          await result.current.processGuess([
            ...incorrectGuessBase,
            (i + 1).toString() as "1" | "2",
          ]);
        });
      }
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord); // guessWord is ['G','U','E','S','S']
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(3); // Updated from 5 to 3
      expect(mockSubmitGuessCallable).toHaveBeenLastCalledWith({
        guess: guessString, // last guess
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 3, // Updated from 5 to 3
      });

      expect(result.current.guesses.length).toBe(3); // Updated from 5 to 3
      expect(result.current.guesses[2]).toEqual({
        // Updated from guesses[4] to guesses[2]
        guess: guessWord,
        feedback: feedbackStrings,
      }); // Check last guess feedback
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "attemptLimitReached", // Updated from "loss"
        feedback: feedbackStrings, // Assert against transformed strings
        correctAnswer: "ANSWER",
        coinsEarned: 0,
        canOfferRewardedAd: true,
        canOfferCoinContinue: true, // New field for 3-attempt system
      });
    });

    it("should handle a losing guess in challenge mode (3 attempts)", async () => {
      const challengeProps = {
        riddleId: "challengeRiddle456",
        gameMode: "challenge" as "classic" | "challenge",
        correctAnswerLength: 5,
      };
      const feedbackStrings: Feedback[] = ["red", "red", "red", "red", "red"];

      mockSubmitGuessCallable.mockImplementation(
        async (callData: {
          guess: string;
          riddleId: string;
          gameMode: string;
          attempts: number;
        }) => {
          const currentGuessString = callData.guess as string;
          const currentGuessChars = currentGuessString.split("");
          return {
            data: {
              feedback: feedbackStrings.map((status, index) => ({
                letter: currentGuessChars[index] || "",
                status,
              })),
              isCorrect: false,
              correctAnswer: "ANSWER",
              coinsEarned: 0,
            },
          };
        }
      );

      const { result } = renderHook(() => useGameLogic(challengeProps));
      const incorrectGuessBase = ["F", "A", "I", "L"];
      // Updated to only 2 loops for 3-attempt system (same for both classic and challenge now)
      for (let i = 0; i < 2; i++) {
        await act(async () => {
          await result.current.processGuess([
            ...incorrectGuessBase,
            (i + 1).toString() as "1" | "2",
          ]);
        });
      }
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(3); // Updated from 6 to 3
      expect(mockSubmitGuessCallable).toHaveBeenLastCalledWith({
        guess: guessString,
        riddleId: challengeProps.riddleId,
        gameMode: challengeProps.gameMode,
        attempts: 3, // Updated from 6 to 3
      });

      expect(result.current.guesses.length).toBe(3); // Updated from 6 to 3
      expect(result.current.guesses[2]).toEqual({
        // Updated from guesses[5] to guesses[2]
        guess: guessWord,
        feedback: feedbackStrings,
      });
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "attemptLimitReached", // Updated from "loss"
        feedback: feedbackStrings,
        correctAnswer: "ANSWER",
        coinsEarned: 0,
        canOfferRewardedAd: true,
        canOfferCoinContinue: true, // New field for 3-attempt system
      });
    });

    it("should throw an error if submitGuess callable fails", async () => {
      mockSubmitGuessCallable.mockRejectedValueOnce(
        new Error("Firebase error")
      );

      const { result } = renderHook(() => useGameLogic(defaultProps));

      await expect(
        act(async () => {
          await result.current.processGuess(guessWord);
        })
      ).rejects.toThrow("Firebase error");

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(1);
      expect(mockSubmitGuessCallable).toHaveBeenCalledWith({
        guess: guessString,
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 1,
      });
    });
  });
});

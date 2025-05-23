import { renderHook, act } from "@testing-library/react-native";
// import functions from "@react-native-firebase/functions"; // Will be mocked directly
import useGameLogic, { Feedback } from "../useGameLogic";
import { SubmittedGuess } from "../types"; // Make sure this path is correct

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({
      name: "[DEFAULT]",
      options: {},
    })),
    apps: [
      {
        name: "[DEFAULT]",
        options: {},
      },
    ],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue({
      name: "[DEFAULT]",
      options: {},
    }),
    NativeModules: {
      RNFBAppModule: {
        NATIVE_FIREBASE_APPS: JSON.stringify([
          { name: "[DEFAULT]", options: {} },
        ]),
        FIREBASE_RAW_JSON: "{}",
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
  },
}));

// Define the mock callable function that tests will interact with
const mockSubmitGuessCallable = jest.fn();

// Mock @react-native-firebase/functions specifically for this test file
jest.mock("@react-native-firebase/functions", () => {
  // This is the factory for the entire module
  return () => ({
    // This is the object returned by functions()
    httpsCallable: jest.fn((functionName: string) => {
      if (functionName === "submitGuess") {
        return mockSubmitGuessCallable; // Crucially, return the test-scoped mock
      }
      // Fallback for any other function name, if necessary
      return jest
        .fn()
        .mockResolvedValue({ data: { message: "Default mock response" } });
    }),
  });
});

describe("useGameLogic", () => {
  const defaultProps = {
    riddleId: "testRiddle123",
    gameMode: "classic" as "classic" | "challenge",
    correctAnswerLength: 5, // Assuming a default, adjust if necessary
  };

  beforeEach(() => {
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
      });
    });

    it("should handle a losing guess (classic mode - 5 attempts)", async () => {
      const lastGuessChars = ["G", "U", "E", "S", "S"]; // For the final guess
      const feedbackStrings: Feedback[] = ["red", "red", "red", "red", "red"];

      // Mock for all 5 calls. The SUT will call this 5 times.
      // For simplicity in this mock, we assume the server always returns a similar structure for incorrect guesses.
      // The important part is the final `isCorrect: false` and potentially `correctAnswer`.
      mockSubmitGuessCallable.mockImplementation(async (callData) => {
        // Determine the guess characters for this specific call to form structured feedback
        // This is a bit simplified; in reality, the SUT sends the string, and the server forms this.
        // For the mock, we just need to ensure the `status` part is right.
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
      });

      const { result } = renderHook(() => useGameLogic(defaultProps));
      const incorrectGuessBase = ["F", "A", "I", "L"];
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess([
            ...incorrectGuessBase,
            (i + 1).toString() as "1" | "2" | "3" | "4",
          ]);
        });
      }
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord); // guessWord is ['G','U','E','S','S']
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(5);
      expect(mockSubmitGuessCallable).toHaveBeenLastCalledWith({
        guess: guessString, // last guess
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 5,
      });

      expect(result.current.guesses.length).toBe(5);
      expect(result.current.guesses[4]).toEqual({
        guess: guessWord,
        feedback: feedbackStrings,
      }); // Check last guess feedback
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "loss",
        feedback: feedbackStrings, // Assert against transformed strings
        correctAnswer: "ANSWER",
        coinsEarned: 0,
        canOfferRewardedAd: true,
      });
    });

    it("should handle a losing guess in challenge mode (6 attempts)", async () => {
      const challengeProps = {
        riddleId: "challengeRiddle456",
        gameMode: "challenge" as "classic" | "challenge",
        correctAnswerLength: 5,
      };
      const lastGuessChars = ["G", "U", "E", "S", "S"];
      const feedbackStrings: Feedback[] = ["red", "red", "red", "red", "red"];

      mockSubmitGuessCallable.mockImplementation(async (callData) => {
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
      });

      const { result } = renderHook(() => useGameLogic(challengeProps));
      const incorrectGuessBase = ["F", "A", "I", "L"];
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.processGuess([
            ...incorrectGuessBase,
            (i + 1).toString() as "1" | "2" | "3" | "4" | "5",
          ]);
        });
      }
      let processResult;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockSubmitGuessCallable).toHaveBeenCalledTimes(6);
      expect(mockSubmitGuessCallable).toHaveBeenLastCalledWith({
        guess: guessString,
        riddleId: challengeProps.riddleId,
        gameMode: challengeProps.gameMode,
        attempts: 6,
      });

      expect(result.current.guesses.length).toBe(6);
      expect(result.current.guesses[5]).toEqual({
        guess: guessWord,
        feedback: feedbackStrings,
      });
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "loss",
        feedback: feedbackStrings,
        correctAnswer: "ANSWER",
        coinsEarned: 0,
        canOfferRewardedAd: true,
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

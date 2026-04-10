import { renderHook, act } from "@testing-library/react-native";
import useGameLogic, { Feedback } from "../useGameLogic";
import { httpsCallable } from "@react-native-firebase/functions";

const mockHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const mockCompleteGameCallable = jest.fn();

describe("useGameLogic", () => {
  /**
   * THORN contains none of G, U, E, S, F, A, I, L so any guess using those
   * letters will produce all-red feedback, which keeps most tests simple.
   */
  const defaultProps = {
    riddleId: "testRiddle123",
    gameMode: "classic" as "classic" | "challenge",
    answer: "THORN",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Route httpsCallable(functions, "completeGame") to mockCompleteGameCallable
    mockHttpsCallable.mockImplementation((_functions: any, functionName: string) => {
      if (functionName === "completeGame") {
        return mockCompleteGameCallable as any;
      }
      return jest.fn().mockResolvedValue({ data: {} }) as any;
    });

    mockCompleteGameCallable.mockReset();
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

    await act(async () => {
      await result.current.processGuess(["G", "U", "E", "S", "S"]);
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
    const allRedFeedback: Feedback[] = ["red", "red", "red", "red", "red"];
    const guessWord = ["G", "U", "E", "S", "S"];

    it("should compute feedback locally without calling the server", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));

      await act(async () => {
        await result.current.processGuess(guessWord);
      });

      // completeGame must NOT be called for a mid-game guess
      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.guesses[0].feedback).toEqual(allRedFeedback);
    });

    it("should handle a winning guess — calls completeGame once", async () => {
      mockCompleteGameCallable.mockResolvedValueOnce({
        data: { coinsEarned: 10, newlyUnlockedAchievementIds: [] },
      });

      // answer matches the guess exactly
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "GUESS" })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).toHaveBeenCalledTimes(1);
      expect(mockCompleteGameCallable).toHaveBeenCalledWith({
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 1,
        isCorrect: true,
      });

      expect(result.current.guesses.length).toBe(1);
      expect(result.current.guesses[0]).toEqual({
        guess: guessWord,
        feedback: ["green", "green", "green", "green", "green"],
      });
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "win",
        feedback: ["green", "green", "green", "green", "green"],
        coinsEarned: 10,
        scoreEarned: 0,
        correctAnswer: "GUESS",
        newlyUnlockedAchievementIds: [],
      });
    });

    it("should handle an incorrect guess with attempts remaining — no server call", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.guesses.length).toBe(1);
      expect(result.current.guesses[0]).toEqual({
        guess: guessWord,
        feedback: allRedFeedback,
      });
      expect(result.current.currentGuess).toEqual([]);
      expect(result.current.gameOver).toBe(false);
      expect(processResult).toEqual({
        outcome: "continue",
        feedback: allRedFeedback,
        attemptsRemaining: 2,
      });
    });

    it("should reach attemptLimitReached after 3 wrong guesses (classic)", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"]; // no letters in THORN

      for (let i = 0; i < 2; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      // completeGame NOT called yet (user can still continue)
      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.guesses.length).toBe(3);
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "attemptLimitReached",
        feedback: allRedFeedback,
        correctAnswer: defaultProps.answer,
        coinsEarned: 0,
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });
    });

    it("should reach attemptLimitReached after 3 wrong guesses (challenge)", async () => {
      const challengeProps = {
        riddleId: "challengeRiddle456",
        gameMode: "challenge" as "classic" | "challenge",
        answer: "THORN",
      };
      const { result } = renderHook(() => useGameLogic(challengeProps));
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 2; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.guesses.length).toBe(3);
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "attemptLimitReached",
        feedback: allRedFeedback,
        correctAnswer: challengeProps.answer,
        coinsEarned: 0,
        canOfferRewardedAd: true,
        canOfferCoinContinue: true,
      });
    });

    it("should produce final loss after using continue and exhausting extra attempts", async () => {
      mockCompleteGameCallable.mockResolvedValueOnce({
        data: { coinsEarned: 0, newlyUnlockedAchievementIds: [] },
      });

      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      // Use up initial 3 attempts
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      // Grant continue
      act(() => {
        result.current.continueGame();
      });
      expect(result.current.gameOver).toBe(false);

      // Use up the 3 extra attempts — final one triggers completeGame
      for (let i = 0; i < 2; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).toHaveBeenCalledTimes(1);
      expect(mockCompleteGameCallable).toHaveBeenCalledWith({
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
        attempts: 6,
        isCorrect: false,
      });
      expect(result.current.gameOver).toBe(true);
      expect(processResult).toEqual({
        outcome: "loss",
        feedback: allRedFeedback,
        correctAnswer: defaultProps.answer,
        coinsEarned: 0,
        canOfferRewardedAd: false,
      });
    });

    it("should gracefully handle completeGame server failure on win", async () => {
      mockCompleteGameCallable.mockRejectedValueOnce(new Error("Firebase error"));

      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "GUESS" })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      // Game still ends — error is swallowed so the user isn't blocked
      expect(result.current.gameOver).toBe(true);
      expect((processResult as { outcome: string }).outcome).toBe("win");
      expect((processResult as { coinsEarned: number }).coinsEarned).toBe(0);
    });
  });
});


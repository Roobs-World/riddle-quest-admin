import { renderHook, act } from "@testing-library/react-native";
import useGameLogic, { Feedback } from "../useGameLogic";
import { httpsCallable } from "@react-native-firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
        attemptsRemaining: 3,
      });
    });

    it("should reach attemptLimitReached after 4 wrong guesses (classic)", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"]; // no letters in THORN

      for (let i = 0; i < 3; i++) {
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
      expect(result.current.guesses.length).toBe(4);
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

    it("should reach attemptLimitReached after 4 wrong guesses (challenge)", async () => {
      const challengeProps = {
        riddleId: "challengeRiddle456",
        gameMode: "challenge" as "classic" | "challenge",
        answer: "THORN",
      };
      const { result } = renderHook(() => useGameLogic(challengeProps));
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.guesses.length).toBe(4);
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

      // Use up initial 4 attempts
      for (let i = 0; i < 4; i++) {
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
        attempts: 7,
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

    it("should gracefully handle completeGame server failure on loss", async () => {
      mockCompleteGameCallable.mockRejectedValueOnce(new Error("Firebase error"));

      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      // Use up initial 4 attempts
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      // Grant continue
      act(() => {
        result.current.continueGame();
      });

      // Use up the 3 extra attempts
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      // Game still ends — error is swallowed so the user isn't blocked
      expect(result.current.gameOver).toBe(true);
      expect(result.current.guesses.length).toBe(7);
    });

    it("should keep guest wins local and skip completeGame calls", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "GUESS", isGuestMode: true })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(guessWord);
      });

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(processResult).toEqual({
        outcome: "win",
        feedback: ["green", "green", "green", "green", "green"],
        coinsEarned: 15,
        scoreEarned: 100,
        correctAnswer: "GUESS",
        newlyUnlockedAchievementIds: [],
      });
    });

    it("should keep guest final losses local and skip completeGame calls", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, isGuestMode: true })
      );
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      act(() => {
        result.current.continueGame();
      });

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect(result.current.gameOver).toBe(true);
      expect(result.current.guesses.length).toBe(7);
    });

    it("persists guest in-progress sessions to AsyncStorage", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, isGuestMode: true, answer: "GUESS" })
      );

      await act(async () => {
        await result.current.processGuess(guessWord);
      });

      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const [key, value] = calls[calls.length - 1] as [string, string];
      expect(key).toBe("@guest_game_session_v1");
      expect(JSON.parse(value)).toMatchObject({
        version: 2,
        riddleId: defaultProps.riddleId,
        gameMode: defaultProps.gameMode,
      });
    });

    it("restores guest sessions for the same riddle/mode", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          version: 2,
          riddleId: defaultProps.riddleId,
          gameMode: defaultProps.gameMode,
          guesses: [{ guess: ["A"], feedback: ["red"] }],
          attemptsUsed: 1,
          hasUsedContinue: true,
          gameOver: false,
        })
      );

      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, isGuestMode: true })
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.attemptsUsed).toBe(1);
      expect(result.current.hasUsedContinue).toBe(true);
      expect(result.current.guesses).toHaveLength(1);
    });

    it("ignores legacy guest snapshots from older schema versions", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          version: 1,
          riddleId: defaultProps.riddleId,
          gameMode: defaultProps.gameMode,
          guesses: [{ guess: ["A"], feedback: ["red"] }],
          attemptsUsed: 3,
          hasUsedContinue: false,
          gameOver: true,
        })
      );

      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, isGuestMode: true })
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.attemptsUsed).toBe(0);
      expect(result.current.gameOver).toBe(false);
      expect(result.current.guesses).toHaveLength(0);
    });
  });

  describe("computeFeedback (via processGuess)", () => {
    it("should compute all-green feedback for exact match", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "HELLO" })
      );

      await act(async () => {
        await result.current.processGuess(["H", "E", "L", "L", "O"]);
      });

      expect(result.current.guesses[0].feedback).toEqual([
        "green", "green", "green", "green", "green"
      ]);
    });

    it("should compute yellow feedback for letters in wrong position", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "HELLO" })
      );

      // OLEHL has all letters of HELLO but in wrong positions
      await act(async () => {
        await result.current.processGuess(["O", "L", "E", "H", "L"]);
      });

      // O is in position 0, should be in position 4 -> yellow
      // L is in position 1, should be in position 2 or 3 -> yellow
      // E is in position 2, should be in position 1 -> yellow
      // H is in position 3, should be in position 0 -> yellow
      // L is in position 4, should be in position 2 or 3 -> yellow
      expect(result.current.guesses[0].feedback).toEqual([
        "yellow", "yellow", "yellow", "yellow", "yellow"
      ]);
    });

    it("should handle duplicate letters correctly - excess duplicates are red", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "HELLO" })
      );

      // LLLLL - only 2 L's in HELLO at positions 2 and 3
      await act(async () => {
        await result.current.processGuess(["L", "L", "L", "L", "L"]);
      });

      // Position 2 and 3 are green (L's in HELLO at positions 2,3)
      // Green pass uses up the 2 L counts
      // No L's left for yellows, so positions 0, 1, 4 are all red
      expect(result.current.guesses[0].feedback).toEqual([
        "red", "red", "green", "green", "red"
      ]);
    });

    it("should handle case insensitivity", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "hello" })
      );

      await act(async () => {
        await result.current.processGuess(["H", "E", "L", "L", "O"]);
      });

      expect(result.current.guesses[0].feedback).toEqual([
        "green", "green", "green", "green", "green"
      ]);
    });

    it("should handle mixed case guess against lowercase answer", async () => {
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "WORLD" })
      );

      await act(async () => {
        await result.current.processGuess(["w", "o", "r", "l", "d"]);
      });

      expect(result.current.guesses[0].feedback).toEqual([
        "green", "green", "green", "green", "green"
      ]);
    });

    it("should mark green before yellow to prevent double counting", async () => {
      // Answer: ABBEY (A at 0, B at 1 and 2, E at 3, Y at 4)
      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "ABBEY" })
      );

      // BABES: B at 0 (yellow, should be at 1/2), A at 1 (yellow), B at 2 (green), E at 3 (green), S at 4 (red)
      await act(async () => {
        await result.current.processGuess(["B", "A", "B", "E", "S"]);
      });

      expect(result.current.guesses[0].feedback).toEqual([
        "yellow", "yellow", "green", "green", "red"
      ]);
    });
  });

  describe("attemptsUsed and attemptsRemaining", () => {
    it("should track attempts correctly", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));

      expect(result.current.attemptsUsed).toBe(0);
      expect(result.current.attemptsRemaining).toBe(4);

      await act(async () => {
        await result.current.processGuess(["F", "A", "I", "L", "S"]);
      });

      expect(result.current.attemptsUsed).toBe(1);
      expect(result.current.attemptsRemaining).toBe(3);

      await act(async () => {
        await result.current.processGuess(["F", "A", "I", "L", "S"]);
      });

      expect(result.current.attemptsUsed).toBe(2);
      expect(result.current.attemptsRemaining).toBe(2);
    });

    it("should increase max attempts after continueGame", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      // Use up initial 4 attempts
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      expect(result.current.attemptsUsed).toBe(4);
      expect(result.current.attemptsRemaining).toBe(0);

      // Continue game
      act(() => {
        result.current.continueGame();
      });

      expect(result.current.attemptsUsed).toBe(4);
      expect(result.current.attemptsRemaining).toBe(3); // 3 more attempts granted
    });

    it("should reset attempts counter on resetGame", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));

      await act(async () => {
        await result.current.processGuess(["F", "A", "I", "L", "S"]);
      });

      expect(result.current.attemptsUsed).toBe(1);

      act(() => {
        result.current.resetGame();
      });

      expect(result.current.attemptsUsed).toBe(0);
      expect(result.current.attemptsRemaining).toBe(4);
    });
  });

  describe("hasUsedContinue", () => {
    it("should be false initially", () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      expect(result.current.hasUsedContinue).toBe(false);
    });

    it("should be true after continueGame is called", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      // Use up initial 4 attempts
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      act(() => {
        result.current.continueGame();
      });

      expect(result.current.hasUsedContinue).toBe(true);
    });

    it("should be reset to false on resetGame", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      act(() => {
        result.current.continueGame();
      });

      expect(result.current.hasUsedContinue).toBe(true);

      act(() => {
        result.current.resetGame();
      });

      expect(result.current.hasUsedContinue).toBe(false);
    });
  });

  describe("continueGame", () => {
    it("should set gameOver to false", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      expect(result.current.gameOver).toBe(true);

      act(() => {
        result.current.continueGame();
      });

      expect(result.current.gameOver).toBe(false);
    });

    it("should preserve existing guesses", async () => {
      const { result } = renderHook(() => useGameLogic(defaultProps));
      const wrong = ["F", "A", "I", "L", "S"];

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.processGuess(wrong);
        });
      }

      const guessesBeforeContinue = result.current.guesses.length;

      act(() => {
        result.current.continueGame();
      });

      expect(result.current.guesses.length).toBe(guessesBeforeContinue);
    });
  });

  describe("win with achievements", () => {
    it("should return unlocked achievement IDs from server", async () => {
      mockCompleteGameCallable.mockResolvedValueOnce({
        data: {
          coinsEarned: 100,
          scoreEarned: 500,
          newlyUnlockedAchievementIds: ["first_win", "speed_demon"],
        },
      });

      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "GUESS" })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(["G", "U", "E", "S", "S"]);
      });

      expect(processResult).toEqual({
        outcome: "win",
        feedback: ["green", "green", "green", "green", "green"],
        coinsEarned: 100,
        scoreEarned: 500,
        correctAnswer: "GUESS",
        newlyUnlockedAchievementIds: ["first_win", "speed_demon"],
      });
    });

    it("should use xpEarned when scoreEarned is missing", async () => {
      mockCompleteGameCallable.mockResolvedValueOnce({
        data: {
          coinsEarned: 25,
          xpEarned: 140,
          newlyUnlockedAchievementIds: [],
        },
      });

      const { result } = renderHook(() =>
        useGameLogic({ ...defaultProps, answer: "GUESS" })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess(["G", "U", "E", "S", "S"]);
      });

      expect(processResult).toEqual({
        outcome: "win",
        feedback: ["green", "green", "green", "green", "green"],
        coinsEarned: 25,
        scoreEarned: 140,
        correctAnswer: "GUESS",
        newlyUnlockedAchievementIds: [],
      });
    });

    it("should award 50 coins for guest challenge wins", async () => {
      const { result } = renderHook(() =>
        useGameLogic({
          ...defaultProps,
          answer: "GUESS",
          gameMode: "challenge",
          isGuestMode: true,
        })
      );

      let processResult: unknown;
      await act(async () => {
        processResult = await result.current.processGuess([
          "G",
          "U",
          "E",
          "S",
          "S",
        ]);
      });

      expect(mockCompleteGameCallable).not.toHaveBeenCalled();
      expect((processResult as { outcome: string }).outcome).toBe("win");
      expect((processResult as { coinsEarned: number }).coinsEarned).toBe(50);
    });
  });
});

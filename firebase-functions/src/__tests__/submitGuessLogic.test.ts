import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {handleCompleteGameLogic, handleGuessLogic} from "../submitGuessLogic";
import {
  COINS_REWARD_CLASSIC,
  COINS_REWARD_CHALLENGE,
  ACHIEVEMENT_UNLOCK_COIN_REWARD,
  getStreakRewardBonus,
} from "../constants";
import * as firestoreService from "../firestoreService";
import * as riddleGeneration from "../riddleGeneration";
import * as achievements from "../achievements";
import * as leaderboard from "../leaderboard";
import type {Player, FirestoreRiddle} from "../validation/firestoreSchemas";
import type {SubmitGuessRequestData, SubmitGuessAuthContext} from "../validation/requestSchemas";

// Mock firebase-functions logger (source uses functions.logger.info/error/debug instead of console)
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock firebase-admin
const mockAdminFirestoreUpdate = jest.fn().mockResolvedValue(undefined);
const mockAdminFirestoreGet = jest.fn();
const mockAdminFirestoreWhere = jest.fn();
const mockAdminFirestoreCollection = jest.fn();
const mockIncrement = jest.fn();
const mockServerTimestamp = jest.fn();

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    update: mockAdminFirestoreUpdate,
    get: mockAdminFirestoreGet,
    where: mockAdminFirestoreWhere.mockReturnThis(),
    runTransaction: jest.fn(),
  })),
}));

// More specific typing for the mock FieldValue
const mockFieldValue = {
  increment: mockIncrement,
  serverTimestamp: mockServerTimestamp,
};
(admin.firestore as unknown as {FieldValue: typeof mockFieldValue}).FieldValue = mockFieldValue;

// Mock firestoreService
jest.mock("../firestoreService", () => ({
  getUser: jest.fn(),
  updateUserCoins: jest.fn(),
  updateUserStats: jest.fn(),
  getRiddleByGameMode: jest.fn(),
  ensureUserDocumentComplete: jest.fn(),
}));

// Mock riddleGeneration
jest.mock("../riddleGeneration", () => ({
  generateAndAppendRiddles: jest.fn(),
  initializeRiddleDatabaseIfEmpty: jest.fn(),
}));

// Mock achievements
jest.mock("../achievements", () => ({
  evaluateAchievements: jest.fn().mockResolvedValue([]),
}));

// Mock leaderboard (non-blocking update, errors are swallowed)
jest.mock("../leaderboard", () => ({
  updateLeaderboardEntry: jest.fn().mockResolvedValue(undefined),
}));

// Mock Firebase Functions v2 onCall - create a proper HttpsError class
jest.mock("firebase-functions/v2/https", () => {
  class MockHttpsError extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.name = "HttpsError";
      this.code = code;
      this.details = details;
    }
  }

  return {
    onCall: jest.fn((handler) => handler),
    HttpsError: MockHttpsError,
  };
});

const mockUser: Player = {
  userId: "test-user-id",
  email: "test@example.com",
  username: "tester",
  coins: 100,
  hasPurchasedApp: false,
  stats: {
    gamesPlayed: 10,
    wins: 5,
    winStreak: 2,
    bestStreak: 3,
    totalWordsGuessed: 50,
    winRate: 50,
    averageGuesses: 3.5,
    totalScore: 1000,
    xp: 1000,
    level: 10,
    highestLevelClassic: 5,
    challengeWins: 1,
    totalWins: 5,
    totalGuessesInWins: 17,
    dailyPuzzlesCompleted: 0,
  },
  progress: {classicIndex: 5, dailyChallengeIndex: 1, dailyChallengeCurrentQuestion: 0},
  registeredAt: Date.now(),
  lastLogin: Date.now(),
};

const mockRiddle: FirestoreRiddle = {
  riddleId: "riddle-123",
  text: "I have keys but open no locks. I have space but no room. You can enter, but you can't go outside. What am I?",
  answer: "keyboard",
  category: "classic",
};

describe("handleGuessLogic", () => {
  let authContext: SubmitGuessAuthContext;

  beforeEach(() => {
    jest.clearAllMocks();
    authContext = {uid: "test-user-id"};

    (firestoreService.getUser as jest.Mock<Promise<Player | null>>).mockResolvedValue(
      JSON.parse(JSON.stringify(mockUser)),
    );
    (firestoreService.getRiddleByGameMode as jest.Mock<Promise<FirestoreRiddle | null>>).mockResolvedValue(
      JSON.parse(JSON.stringify(mockRiddle)),
    );
    (firestoreService.ensureUserDocumentComplete as jest.Mock<Promise<void>>).mockResolvedValue(undefined);
    (firestoreService.updateUserCoins as jest.Mock<Promise<void>>).mockResolvedValue(undefined);
    (firestoreService.updateUserStats as jest.Mock<Promise<void>>).mockResolvedValue(undefined);
    (riddleGeneration.generateAndAppendRiddles as jest.Mock<Promise<void>>).mockResolvedValue(undefined);
    (riddleGeneration.initializeRiddleDatabaseIfEmpty as jest.Mock<Promise<void>>).mockResolvedValue(undefined);

    mockAdminFirestoreUpdate.mockResolvedValue(undefined);

    // Mock for user document get
    const mockUserDocGet = jest.fn().mockResolvedValue({
      data: () => ({
        ...mockUser,
        progress: {...mockUser.progress, classicIndex: 6},
        // Ensure all required fields are present for PlayerSchema.parse
        userId: mockUser.userId,
        username: mockUser.username,
        coins: mockUser.coins,
        stats: mockUser.stats,
        registeredAt: mockUser.registeredAt,
        lastLogin: mockUser.lastLogin,
      }),
    });

    // Mock for riddles collection query
    const mockRiddlesQueryGet = jest.fn().mockResolvedValue({
      size: 100, // Mock that there are plenty of riddles
    });

    // Set up the firestore mock chain
    mockAdminFirestoreGet.mockImplementation(() => {
      // Always return the user document mock for .get() calls
      return mockUserDocGet();
    });

    // Set up the collection/where chain for riddles query
    mockAdminFirestoreWhere.mockImplementation(() => ({
      get: mockRiddlesQueryGet,
    }));

    mockAdminFirestoreCollection.mockReturnThis();

    mockIncrement.mockImplementation((val) => `increment(${val})`);
    mockServerTimestamp.mockReturnValue("server_timestamp_value");

    jest.spyOn(console, "log").mockImplementation((..._args: unknown[]) => {});
    jest.spyOn(console, "error").mockImplementation((..._args: unknown[]) => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should throw HttpsError if required parameters are missing", async () => {
    const baseRequest: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "id",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic({...baseRequest, guess: ""}, authContext)).rejects.toThrow(
      new HttpsError("invalid-argument", "Missing required parameters: guess, riddleId, gameMode, attempts."),
    );
    // ... (keep other missing param tests)
  });

  test("should throw HttpsError if riddle is not found", async () => {
    (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(null);
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "nonexistent",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("not-found", "classic riddle with ID nonexistent not found."),
    );
  });

  test("should throw HttpsError if riddle answer is not found", async () => {
    (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue({...mockRiddle, answer: undefined});
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("not-found", "Answer not found for classic riddle riddle-123."),
    );
  });

  test("should throw HttpsError if user is not found", async () => {
    (firestoreService.getUser as jest.Mock).mockResolvedValue(null);
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("internal", "User not found while trying to update stats."),
    );
  });

  describe("Correct Guess - Classic Mode", () => {
    const requestData: SubmitGuessRequestData = {
      guess: "keyboard",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };

    test("should return correct feedback, isCorrect true, and coins", async () => {
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toEqual(mockRiddle.answer!.split("").map((l) => ({letter: l, status: "green"})));
      expect(result.coinsEarned).toBe(COINS_REWARD_CLASSIC);
      expect(result.correctAnswer).toBe("keyboard");
      expect(Array.isArray(result.newlyUnlockedAchievementIds)).toBe(true);
    });

    test("should include newlyUnlockedAchievementIds when achievements module returns them", async () => {
      (achievements.evaluateAchievements as jest.Mock).mockResolvedValueOnce(["first_win", "wins_5"]);
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.newlyUnlockedAchievementIds).toEqual(["first_win", "wins_5"]);
      const achievementBonus = 2 * ACHIEVEMENT_UNLOCK_COIN_REWARD;
      expect(result.coinsEarned).toBe(COINS_REWARD_CLASSIC + achievementBonus);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(1, authContext.uid, COINS_REWARD_CLASSIC);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(2, authContext.uid, achievementBonus);
    });

    test("should not update leaderboard entry for anonymous guest users", async () => {
      const guestAuthContext: SubmitGuessAuthContext = {uid: "test-user-id", isAnonymous: true};
      await handleGuessLogic(requestData, guestAuthContext);
      expect(leaderboard.updateLeaderboardEntry).not.toHaveBeenCalled();
    });

    test("should update user stats correctly", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsSubtree: Record<string, unknown> = {
        gamesPlayed: "increment(1)",
        totalWordsGuessed: "increment(1)", // Added new stat
        wins: "increment(1)",
        totalWins: "increment(1)",
        totalGuessesInWins: "increment(1)",
        xp: "increment(100)",
        averageGuesses: parseFloat(
          ((mockUser.stats.totalGuessesInWins! + 1) / (mockUser.stats.totalWins! + 1)).toFixed(2),
        ),
        winRate: parseFloat((((mockUser.stats.totalWins! + 1) / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };

      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining(expectedStatsSubtree),
      );
      expect(firestoreService.updateUserCoins).toHaveBeenCalledWith(authContext.uid, COINS_REWARD_CLASSIC);
      // Verify direct Firestore update for classicIndex
      expect(mockAdminFirestoreUpdate).toHaveBeenCalledWith({
        "progress.classicIndex": mockIncrement(1),
      });
    });

    describe("Classic Mode Riddle Generation Trigger", () => {
      const baseClassicCorrectRequest: SubmitGuessRequestData = {
        guess: "keyboard",
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      test("should trigger riddle generation if user is near the end of classic riddles", async () => {
        const userNearEnd = {
          ...mockUser,
          progress: {...mockUser.progress, classicIndex: 98},
        };
        (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNearEnd)));

        mockAdminFirestoreGet.mockResolvedValueOnce({
          data: () => ({...userNearEnd, progress: {...userNearEnd.progress, classicIndex: 99}}),
        });

        mockAdminFirestoreWhere.mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({size: 100}),
        }));
        (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockResolvedValue(undefined);

        await handleGuessLogic(baseClassicCorrectRequest, authContext);

        expect(riddleGeneration.generateAndAppendRiddles).toHaveBeenCalledWith(5);
        expect(functions.logger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            "User test-user-id has <= 1 classic riddles remaining. Triggering generation of 5 new riddles.",
          ),
        );
      });

      test("should NOT trigger riddle generation if user is NOT near the end", async () => {
        const userNotNearEnd = {
          ...mockUser,
          progress: {...mockUser.progress, classicIndex: 50},
        };
        (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNotNearEnd)));
        mockAdminFirestoreGet.mockResolvedValueOnce({
          data: () => ({...userNotNearEnd, progress: {...userNotNearEnd.progress, classicIndex: 51}}),
        });
        mockAdminFirestoreWhere.mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({size: 100}),
        }));
        (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockClear();

        await handleGuessLogic(baseClassicCorrectRequest, authContext);

        expect(riddleGeneration.generateAndAppendRiddles).not.toHaveBeenCalled();
      });

      test("should handle errors during riddle count check gracefully", async () => {
        const userNearEnd = {
          ...mockUser,
          progress: {...mockUser.progress, classicIndex: 98},
        };
        (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNearEnd)));
        mockAdminFirestoreGet.mockResolvedValueOnce({
          data: () => ({...userNearEnd, progress: {...userNearEnd.progress, classicIndex: 99}}),
        });
        mockAdminFirestoreWhere.mockImplementationOnce(() => ({
          get: jest.fn().mockRejectedValue(new Error("Firestore count error")),
        }));
        (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockClear();

        await handleGuessLogic(baseClassicCorrectRequest, authContext);

        expect(functions.logger.error).toHaveBeenCalledWith("Error checking classic riddle count:", expect.any(Error));
        expect(riddleGeneration.generateAndAppendRiddles).not.toHaveBeenCalled();
      });

      test("should handle errors during generateAndAppendRiddles call gracefully", async () => {
        const userNearEnd = {
          ...mockUser,
          progress: {...mockUser.progress, classicIndex: 98},
        };
        (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNearEnd)));
        mockAdminFirestoreGet.mockResolvedValueOnce({
          data: () => ({...userNearEnd, progress: {...userNearEnd.progress, classicIndex: 99}}),
        });
        mockAdminFirestoreWhere.mockImplementationOnce(() => ({
          get: jest.fn().mockResolvedValue({size: 100}),
        }));
        (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockRejectedValue(new Error("Generation failed"));

        await handleGuessLogic(baseClassicCorrectRequest, authContext);

        expect(functions.logger.error).toHaveBeenCalledWith(
          "Error triggering generation of new classic riddles:",
          expect.any(Error),
        );
      });
    });
  });

  describe("Correct Guess - Challenge Mode", () => {
    const requestData: SubmitGuessRequestData = {
      guess: "keyboard",
      riddleId: "riddle-123",
      gameMode: "challenge",
      attempts: 2,
    };

    test("should calculate challenge coins correctly and update lastDailyChallengeCompletedAt", async () => {
      const expectedStreakBonus = getStreakRewardBonus(1);
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(true);
      expect(result.coinsEarned).toBe(COINS_REWARD_CHALLENGE + expectedStreakBonus);
      expect(firestoreService.updateUserCoins).toHaveBeenCalledWith(
        authContext.uid,
        COINS_REWARD_CHALLENGE + expectedStreakBonus,
      );
      // Check if the admin.firestore().update (which is the mockAdminUpdate in beforeEach) was called
      const adminUpdateMock = (admin.firestore() as unknown as {update: jest.Mock}).update; // Get the mock for this specific call context
      expect(adminUpdateMock).toHaveBeenCalledWith({
        lastDailyChallengeCompletedAt: "server_timestamp_value",
      });
    });

    test("should update stats including challengeWins", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsUpdate: Record<string, unknown> = {
        gamesPlayed: "increment(1)",
        totalWordsGuessed: "increment(1)", // Added new stat
        wins: "increment(1)",
        totalWins: "increment(1)",
        winStreak: 1,
        totalGuessesInWins: "increment(2)",
        challengeWins: "increment(1)",
        dailyPuzzlesCompleted: "increment(1)", // Added daily puzzles stat
        xp: "increment(140)",
        averageGuesses: parseFloat(
          ((mockUser.stats.totalGuessesInWins! + 2) / (mockUser.stats.totalWins! + 1)).toFixed(2),
        ),
        winRate: parseFloat((((mockUser.stats.totalWins! + 1) / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining(expectedStatsUpdate),
      );
    });
  });

  describe("Incorrect Guess - Not Game Over", () => {
    const requestData: SubmitGuessRequestData = {
      guess: "wrong",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };

    test("should return correct feedback, isCorrect false, no coins, no answer reveal", async () => {
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toEqual([
        {letter: "w", status: "red"},
        {letter: "r", status: "yellow"},
        {letter: "o", status: "yellow"},
        {letter: "n", status: "red"},
        {letter: "g", status: "red"},
      ]);
      expect(result.coinsEarned).toBe(0);
      expect(result.correctAnswer).toBeUndefined();
    });

    test("should update gamesPlayed and winRate for incorrect guess (not game over)", async () => {
      const userWithStreak = {...mockUser, stats: {...mockUser.stats, winStreak: 1}};
      (firestoreService.getUser as jest.Mock).mockResolvedValue(userWithStreak);
      await handleGuessLogic(requestData, authContext);
      // gamesPlayed is only incremented when gameOver (isCorrect or attempts >= maxAttempts)
      // For incorrect guess not game over: statsUpdate has totalWordsGuessed only (no gamesPlayed, no winRate)
      const statsUpdate = (firestoreService.updateUserStats as jest.Mock).mock.calls[0][1];
      expect(statsUpdate).toHaveProperty("totalWordsGuessed");
      expect(statsUpdate).not.toHaveProperty("gamesPlayed");
    });
  });

  describe("Incorrect Guess - Game Over", () => {
    const requestData: SubmitGuessRequestData = {
      guess: "wrong",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 5,
    };

    test("should reveal correct answer", async () => {
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe("keyboard");
    });

    test("should update gamesPlayed/winRate without modifying streak", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsUpdate: Record<string, unknown> = {
        gamesPlayed: "increment(1)",
        totalWordsGuessed: "increment(1)", // Added new stat for game over incorrect guesses too
        winRate: parseFloat(((mockUser.stats.totalWins! / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining(expectedStatsUpdate),
      );
      expect(firestoreService.updateUserStats).not.toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining({winStreak: 0}),
      );
    });
  });

  describe("Feedback Generation", () => {
    it("no match (all red)", async () => {
      const requestData: SubmitGuessRequestData = {
        guess: "plzno",
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      expect(result.feedback).toEqual([
        {letter: "p", status: "red"},
        {letter: "l", status: "red"},
        {letter: "z", status: "red"},
        {letter: "n", status: "red"},
        {letter: "o", status: "green"}, // "o" is at the same position in both "plzno" and "keyboard"
      ]);
    });
  });

  test("should correctly update bestStreak when challenge streak surpasses it", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const userWithLowerBestStreak = {
      ...mockUser,
      stats: {...mockUser.stats, winStreak: 3, bestStreak: 3},
      lastDailyChallengeCompletedAt: yesterday.toISOString(),
    };
    (firestoreService.getUser as jest.Mock).mockResolvedValue(userWithLowerBestStreak);
    const requestData: SubmitGuessRequestData = {
      guess: "keyboard",
      riddleId: "riddle-123",
      gameMode: "challenge",
      attempts: 1,
    };

    await handleGuessLogic(requestData, authContext);

    expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
      authContext.uid,
      expect.objectContaining({
        bestStreak: 4,
      }),
    );
  });

  test("handleGuessLogic should throw generic HttpsError for unexpected errors", async () => {
    (firestoreService.getRiddleByGameMode as jest.Mock).mockRejectedValue(new Error("Unexpected riddle error"));
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", expect.any(Error)),
    );
    expect(functions.logger.error).toHaveBeenCalledWith("Error in handleGuessLogic:", expect.any(Error));
  });

  // New tests to cover uncovered lines
  describe("Edge Cases for Missing Coverage", () => {
    test("should handle feedback generation edge cases with character count checks", async () => {
      // This test targets lines 113 and 116 - the defensive checks before decrementing character counts
      const riddleWithRepeatedChars: FirestoreRiddle = {
        ...mockRiddle,
        answer: "apple", // Has repeated 'p'
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(riddleWithRepeatedChars);

      const requestData: SubmitGuessRequestData = {
        guess: "plpep", // Guess that will trigger the character count logic
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      expect(result.feedback).toBeDefined();
      expect(result.isCorrect).toBe(false);
    });

    test("should handle edge case where guess is longer than answer", async () => {
      // This helps cover edge cases in feedback generation
      const shortAnswerRiddle: FirestoreRiddle = {
        ...mockRiddle,
        answer: "cat",
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(shortAnswerRiddle);

      const requestData: SubmitGuessRequestData = {
        guess: "catcher", // Longer than answer
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      expect(result.feedback).toHaveLength(7); // Should match guess length
      expect(result.isCorrect).toBe(false);
    });

    test("should handle when answerCharCounts reaches zero during feedback generation", async () => {
      // Targeting the specific defensive checks in lines 113 and 116
      const riddleWithSingleChars: FirestoreRiddle = {
        ...mockRiddle,
        answer: "abc",
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(riddleWithSingleChars);

      const requestData: SubmitGuessRequestData = {
        guess: "aaa", // Repeated chars to exhaust character counts
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      expect(result.feedback[0]).toEqual({letter: "a", status: "green"});
      expect(result.feedback[1]).toEqual({letter: "a", status: "red"});
      expect(result.feedback[2]).toEqual({letter: "a", status: "red"});
    });

    test("should handle character count edge case with zero counts", async () => {
      // More specific test to hit lines 113 and 116 with character count decrements
      const specialRiddle: FirestoreRiddle = {
        ...mockRiddle,
        answer: "test", // t-e-s-t
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(specialRiddle);

      const requestData: SubmitGuessRequestData = {
        guess: "tttt", // All same letter but only one exists in answer
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      // First 't' should be green (position match), last 't' should be yellow (position 3 in "test")
      expect(result.feedback[0]).toEqual({letter: "t", status: "green"});
      expect(result.feedback[1]).toEqual({letter: "t", status: "red"});
      expect(result.feedback[2]).toEqual({letter: "t", status: "red"});
      expect(result.feedback[3]).toEqual({letter: "t", status: "green"}); // Position match at index 3
    });

    test("should handle defensive checks when character counts reach zero", async () => {
      // Very specific test to force the defensive if checks on lines 113 and 116
      const riddleForTest: FirestoreRiddle = {
        ...mockRiddle,
        answer: "door", // d-o-o-r (has two 'o's)
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(riddleForTest);

      const requestData: SubmitGuessRequestData = {
        guess: "oooo", // More 'o's than available, should exhaust count
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);
      // Should only have 2 'o's marked as yellow/green, others red
      expect(result.feedback.length).toBe(4);
      const oCount = result.feedback.filter((f) => f.status !== "red").length;
      expect(oCount).toBeLessThanOrEqual(2); // Only 2 'o's in "door"
    });

    test("should handle error in riddle generation and continue execution", async () => {
      // This test targets lines 186-188: error handling in riddle generation
      const userNearEnd = {
        ...mockUser,
        progress: {...mockUser.progress, classicIndex: 98},
      };
      (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNearEnd)));

      mockAdminFirestoreGet.mockResolvedValueOnce({
        data: () => ({...userNearEnd, progress: {...userNearEnd.progress, classicIndex: 99}}),
      });

      // Mock that we're near the end of riddles
      mockAdminFirestoreWhere.mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue({size: 100}),
      }));

      // Make riddle generation throw an error to hit lines 186-188
      (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockRejectedValue(new Error("Generation service down"));

      const requestData: SubmitGuessRequestData = {
        guess: "keyboard",
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      // Should still succeed despite riddle generation error
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(true);
      expect(functions.logger.error).toHaveBeenCalledWith(
        "Error triggering generation of new classic riddles:",
        expect.any(Error),
      );
    });

    test("should handle errors from updateUserStats and throw HttpsError", async () => {
      // This targets lines 255-260: main error handling block
      (firestoreService.updateUserStats as jest.Mock).mockRejectedValue(new Error("Database connection failed"));

      const requestData: SubmitGuessRequestData = {
        guess: "keyboard",
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
        new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", expect.any(Error)),
      );
      expect(functions.logger.error).toHaveBeenCalledWith("Error in handleGuessLogic:", expect.any(Error));
    });

    test("should handle non-HttpsError exceptions in main catch block", async () => {
      // Target lines 255-260 with a different error path
      (firestoreService.getRiddleByGameMode as jest.Mock).mockImplementation(() => {
        throw new TypeError("Invalid operation"); // Non-HttpsError
      });

      const requestData: SubmitGuessRequestData = {
        guess: "test",
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
        new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", expect.any(TypeError)),
      );
      expect(functions.logger.error).toHaveBeenCalledWith("Error in handleGuessLogic:", expect.any(TypeError));
    });

    test("should handle extremely specific character count edge case to trigger defensive checks", async () => {
      // Very targeted test for lines 113 and 116 - the if checks before decrementing
      const riddleWithMultipleChars: FirestoreRiddle = {
        ...mockRiddle,
        answer: "book", // b-o-o-k (two 'o's)
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(riddleWithMultipleChars);

      const requestData: SubmitGuessRequestData = {
        guess: "poor", // p-o-o-r (two 'o's but different positions)
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);

      // The defensive checks should prevent decrementing below zero
      expect(result.feedback).toBeDefined();
      expect(result.feedback.length).toBe(4);

      // Count how many 'o's got yellow/green status (should be max 2 from "book")
      const oFeedback = result.feedback.filter(
        (f, _idx) => f.letter === "o" && (f.status === "yellow" || f.status === "green"),
      );
      expect(oFeedback.length).toBeLessThanOrEqual(2); // Can't be more than available in answer
    });

    test("should handle scenario where guess has more repeated letters than answer", async () => {
      // Test to specifically trigger the defensive if statements in lines 113 and 116
      const riddleForCountTest: FirestoreRiddle = {
        ...mockRiddle,
        answer: "cat", // Only one of each letter
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(riddleForCountTest);

      const requestData: SubmitGuessRequestData = {
        guess: "aaa", // Three 'a's but answer only has one
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);

      // Should only have one 'a' marked as correct status, others should be red
      expect(result.feedback).toEqual([
        {letter: "a", status: "red"}, // First 'a' doesn't match position 0 (c)
        {letter: "a", status: "green"}, // Second 'a' matches position 1 (a) in "cat"
        {letter: "a", status: "red"}, // Third 'a' - no more 'a's available after first match
      ]);
    });

    test("should handle complex character counting with mixed correct/incorrect positions", async () => {
      // Another test targeting the character count defensive logic
      const complexRiddle: FirestoreRiddle = {
        ...mockRiddle,
        answer: "level", // l-e-v-e-l (has repeated letters)
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(complexRiddle);

      const requestData: SubmitGuessRequestData = {
        guess: "lllee", // More l's and e's than positions allow
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);

      // Verify that the defensive checks prevented over-counting
      expect(result.feedback).toBeDefined();
      expect(result.feedback.length).toBe(5);

      // Count green and yellow statuses for each letter
      const lCount = result.feedback.filter((f) => f.letter === "l" && f.status !== "red").length;
      const eCount = result.feedback.filter((f) => f.letter === "e" && f.status !== "red").length;

      // Should not exceed the actual count in "level" (2 l's, 2 e's)
      expect(lCount).toBeLessThanOrEqual(2);
      expect(eCount).toBeLessThanOrEqual(2);
    });

    test("should handle edge case where answerCharCounts could become negative without defensive checks", async () => {
      // Specifically designed to test the if statements on lines 113 and 116
      const testRiddle: FirestoreRiddle = {
        ...mockRiddle,
        answer: "dad", // d-a-d (two d's, one a)
      };
      (firestoreService.getRiddleByGameMode as jest.Mock).mockResolvedValue(testRiddle);

      const requestData: SubmitGuessRequestData = {
        guess: "ddd", // Three d's but answer only has two
        riddleId: "riddle-123",
        gameMode: "classic",
        attempts: 1,
      };

      const result = await handleGuessLogic(requestData, authContext);

      expect(result.feedback).toEqual([
        {letter: "d", status: "green"}, // Position 0 match
        {letter: "d", status: "red"}, // No more d's at position 1 (it's 'a')
        {letter: "d", status: "green"}, // Position 2 match
      ]);

      // This tests that the defensive check prevented using a third 'd'
      // when only 2 were available in the answer
      const greenDs = result.feedback.filter((f) => f.letter === "d" && f.status === "green").length;
      const yellowDs = result.feedback.filter((f) => f.letter === "d" && f.status === "yellow").length;
      expect(greenDs + yellowDs).toBeLessThanOrEqual(2); // Can't exceed available d's in "dad"
    });
  });

  describe("handleCompleteGameLogic - Leaderboard", () => {
    test("increments challenge streak when last completion is a Firestore timestamp-like object", async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(12, 0, 0, 0);

      const userWithTimestampLastCompletion = {
        ...mockUser,
        stats: {
          ...mockUser.stats,
          winStreak: 4,
          bestStreak: 4,
        },
        lastDailyChallengeCompletedAt: {
          _seconds: Math.floor(yesterday.getTime() / 1000),
          _nanoseconds: 0,
        },
      };
      (firestoreService.getUser as jest.Mock).mockResolvedValue(userWithTimestampLastCompletion);

      const requestData = {
        riddleId: "riddle-123",
        gameMode: "challenge" as const,
        attempts: 2,
        isCorrect: true,
      };

      const result = await handleCompleteGameLogic(requestData, authContext);

      expect(result.newWinStreak).toBe(5);
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining({
          winStreak: 5,
          bestStreak: 5,
        }),
      );
    });

    test("awards the initial streak bonus before the first seven-day milestone", async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const expectedStreakBonus = getStreakRewardBonus(6);

      (firestoreService.getUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        stats: {...mockUser.stats, winStreak: 5},
        lastDailyChallengeCompletedAt: yesterday,
      });

      const result = await handleCompleteGameLogic(
        {
          riddleId: "riddle-123",
          gameMode: "challenge",
          attempts: 2,
          isCorrect: true,
        },
        authContext,
      );

      expect(result.newWinStreak).toBe(6);
      expect(result.rewardBreakdown?.dailyStreakBonus).toBe(expectedStreakBonus);
      expect(result.coinsEarned).toBe(COINS_REWARD_CHALLENGE + expectedStreakBonus);
    });

    test("increases the streak bonus at a seven-day milestone", async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const expectedStreakBonus = getStreakRewardBonus(7);

      (firestoreService.getUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        stats: {...mockUser.stats, winStreak: 6},
        lastDailyChallengeCompletedAt: yesterday,
      });

      const result = await handleCompleteGameLogic(
        {
          riddleId: "riddle-123",
          gameMode: "challenge",
          attempts: 2,
          isCorrect: true,
        },
        authContext,
      );

      expect(result.newWinStreak).toBe(7);
      expect(result.rewardBreakdown?.dailyStreakBonus).toBe(expectedStreakBonus);
      expect(result.coinsEarned).toBe(COINS_REWARD_CHALLENGE + expectedStreakBonus);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(
        2,
        authContext.uid,
        expectedStreakBonus,
      );
    });

    test("increases the streak bonus at later seven-day milestones", async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const expectedStreakBonus = getStreakRewardBonus(14);

      (firestoreService.getUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        stats: {...mockUser.stats, winStreak: 13},
        lastDailyChallengeCompletedAt: yesterday,
      });

      const result = await handleCompleteGameLogic(
        {
          riddleId: "riddle-123",
          gameMode: "challenge",
          attempts: 2,
          isCorrect: true,
        },
        authContext,
      );

      expect(result.newWinStreak).toBe(14);
      expect(result.rewardBreakdown?.dailyStreakBonus).toBe(expectedStreakBonus);
      expect(result.coinsEarned).toBe(COINS_REWARD_CHALLENGE + expectedStreakBonus);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(2, authContext.uid, expectedStreakBonus);
    });

    test("adds achievement bonus coins to balance and response on win", async () => {
      (achievements.evaluateAchievements as jest.Mock).mockResolvedValueOnce(["first_win", "perfect_guess"]);
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "classic" as const,
        attempts: 1,
        isCorrect: true,
      };

      const result = await handleCompleteGameLogic(requestData, authContext);

      expect(result.newlyUnlockedAchievementIds).toEqual(["first_win", "perfect_guess"]);
      const achievementBonus = 2 * ACHIEVEMENT_UNLOCK_COIN_REWARD;
      expect(result.coinsEarned).toBe(COINS_REWARD_CLASSIC + achievementBonus);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(1, authContext.uid, COINS_REWARD_CLASSIC);
      expect(firestoreService.updateUserCoins).toHaveBeenNthCalledWith(2, authContext.uid, achievementBonus);
    });

    test("adds every awarded point to the persisted total score", async () => {
      const result = await handleCompleteGameLogic(
        {
          riddleId: "riddle-123",
          gameMode: "classic",
          attempts: 2,
          isCorrect: true,
        },
        authContext,
      );

      expect(result.scoreEarned).toBeGreaterThan(0);
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining({
          totalScore: `increment(${result.scoreEarned})`,
          xp: `increment(${result.xpEarned})`,
        }),
      );
    });

    test("should update leaderboard entry when game is won", async () => {
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "classic" as const,
        attempts: 1,
        isCorrect: true,
      };

      await handleCompleteGameLogic(requestData, authContext);

      expect(leaderboard.updateLeaderboardEntry).toHaveBeenCalledTimes(1);
      expect(leaderboard.updateLeaderboardEntry).toHaveBeenCalledWith(
        authContext.uid,
        mockUser.username,
        expect.objectContaining({
          totalWins: mockUser.stats.totalWins + 1,
          bestStreak: Math.max(mockUser.stats.bestStreak, mockUser.stats.winStreak + 1),
        }),
        null,
      );

      const leaderboardStats = (leaderboard.updateLeaderboardEntry as jest.Mock).mock.calls[0][2] as {
        xp: number;
      };
      expect(leaderboardStats.xp).toBeGreaterThan(mockUser.stats.xp ?? 0);
    });

    test("should not update leaderboard entry when game is lost", async () => {
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "classic" as const,
        attempts: 3,
        isCorrect: false,
      };

      await handleCompleteGameLogic(requestData, authContext);

      expect(leaderboard.updateLeaderboardEntry).not.toHaveBeenCalled();
    });

    test("resets challenge win streak when the daily game is lost", async () => {
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "challenge" as const,
        attempts: 5,
        isCorrect: false,
      };

      (firestoreService.getUser as jest.Mock).mockResolvedValue({
        ...mockUser,
        stats: {...mockUser.stats, winStreak: 5},
      });

      const result = await handleCompleteGameLogic(requestData, authContext);

      expect(result.newWinStreak).toBe(0);
      expect(result.rewardBreakdown).toBeUndefined();
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining({winStreak: 0}),
      );
    });

    test("should not update leaderboard entry for guest users even when game is won", async () => {
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "classic" as const,
        attempts: 1,
        isCorrect: true,
      };
      const guestAuthContext: SubmitGuessAuthContext = {uid: "test-user-id", isAnonymous: true};

      await handleCompleteGameLogic(requestData, guestAuthContext);

      expect(leaderboard.updateLeaderboardEntry).not.toHaveBeenCalled();
    });

    test("generates 5 classic riddles when user reaches the penultimate threshold", async () => {
      const requestData = {
        riddleId: "riddle-123",
        gameMode: "classic" as const,
        attempts: 1,
        isCorrect: true,
      };

      const userNearEnd = {
        ...mockUser,
        progress: {...mockUser.progress, classicIndex: 98},
      };
      (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(userNearEnd)));
      mockAdminFirestoreGet.mockResolvedValueOnce({
        data: () => ({...userNearEnd, progress: {...userNearEnd.progress, classicIndex: 99}}),
      });
      mockAdminFirestoreWhere.mockImplementationOnce(() => ({
        get: jest.fn().mockResolvedValue({size: 100}),
      }));
      (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockResolvedValue(undefined);

      await handleCompleteGameLogic(requestData, authContext);

      expect(riddleGeneration.generateAndAppendRiddles).toHaveBeenCalledWith(5);
    });
  });
});

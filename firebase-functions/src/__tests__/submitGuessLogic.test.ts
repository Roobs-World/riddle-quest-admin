import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {handleGuessLogic} from "../submitGuessLogic";
import * as firestoreService from "../firestoreService";
import * as riddleGeneration from "../riddleGeneration";
import type {Player, FirestoreRiddle} from "../validation/firestoreSchemas";
import type {SubmitGuessRequestData, SubmitGuessAuthContext} from "../validation/requestSchemas";

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

// Assign FieldValue to the mocked admin.firestore object
(admin.firestore as unknown as {FieldValue: {increment: jest.Mock; serverTimestamp: jest.Mock}}).FieldValue = {
  increment: mockIncrement,
  serverTimestamp: mockServerTimestamp,
};

// Mock firestoreService
jest.mock("../firestoreService", () => ({
  getUser: jest.fn(),
  updateUserCoins: jest.fn(),
  updateUserStats: jest.fn(),
  getRiddle: jest.fn(),
}));

// Mock riddleGeneration
jest.mock("../riddleGeneration", () => ({
  generateAndAppendRiddles: jest.fn(),
  initializeRiddleDatabaseIfEmpty: jest.fn(),
}));

const mockUser: Player = {
  userId: "test-user-id",
  email: "test@example.com",
  username: "tester",
  coins: 100,
  xp: 0,
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
    highestLevelClassic: 5,
    challengeWins: 1,
    totalWins: 5,
    totalGuessesInWins: 17,
    dailyPuzzlesCompleted: 0,
  },
  progress: {classicIndex: 5, dailyChallengeIndex: 1, tutorialIndex: 0},
  registeredAt: Date.now(),
  lastLogin: Date.now(),
};

const mockRiddle: FirestoreRiddle = {
  riddleId: "riddle-123",
  text: "I have keys but open no locks. I have space but no room. You can enter, but you can't go outside. What am I?",
  answer: "keyboard",
  category: "classic",
  classicIndex: 1,
};

describe("handleGuessLogic", () => {
  let authContext: SubmitGuessAuthContext;

  beforeEach(() => {
    jest.clearAllMocks();
    authContext = {uid: "test-user-id"};

    (firestoreService.getUser as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(mockUser)));
    (firestoreService.getRiddle as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(mockRiddle)));
    (firestoreService.updateUserCoins as jest.Mock).mockResolvedValue(undefined);
    (firestoreService.updateUserStats as jest.Mock).mockResolvedValue(undefined);
    (riddleGeneration.generateAndAppendRiddles as jest.Mock).mockResolvedValue(undefined);

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
        xp: mockUser.xp,
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

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
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
    (firestoreService.getRiddle as jest.Mock).mockResolvedValue(null);
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "nonexistent",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("not-found", "Riddle with ID nonexistent not found."),
    );
  });

  test("should throw HttpsError if riddle answer is not found", async () => {
    (firestoreService.getRiddle as jest.Mock).mockResolvedValue({...mockRiddle, answer: undefined});
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };
    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("not-found", "Answer not found for riddle riddle-123."),
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
      expect(result.feedback).toEqual(mockRiddle.answer.split("").map((l) => ({letter: l, status: "green"})));
      expect(result.coinsEarned).toBe(10);
      expect(result.correctAnswer).toBe("keyboard");
    });

    test("should update user stats correctly", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsUpdate: Record<string, string | number> = {
        gamesPlayed: "increment(1)",
        wins: "increment(1)",
        totalWins: "increment(1)",
        winStreak: "increment(1)",
        totalGuessesInWins: "increment(1)",
        averageGuesses: parseFloat(
          ((mockUser.stats.totalGuessesInWins! + 1) / (mockUser.stats.totalWins! + 1)).toFixed(2),
        ),
        winRate: parseFloat((((mockUser.stats.totalWins! + 1) / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };
      if (mockUser.stats.winStreak! + 1 > mockUser.stats.bestStreak!) {
        expectedStatsUpdate.bestStreak = mockUser.stats.winStreak! + 1;
      }

      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(authContext.uid, expectedStatsUpdate);
      expect(firestoreService.updateUserCoins).toHaveBeenCalledWith(authContext.uid, 10);
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
      const result = await handleGuessLogic(requestData, authContext);
      expect(result.isCorrect).toBe(true);
      expect(result.coinsEarned).toBe(15);
      expect(firestoreService.updateUserCoins).toHaveBeenCalledWith(authContext.uid, 15);
      // Check if the admin.firestore().update (which is the mockAdminUpdate in beforeEach) was called
      const adminUpdateMock = (admin.firestore() as unknown as {update: jest.Mock}).update; // Get the mock for this specific call context
      expect(adminUpdateMock).toHaveBeenCalledWith({
        lastDailyChallengeCompletedAt: "server_timestamp_value",
      });
    });

    test("should update stats including challengeWins", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsUpdate: Record<string, string | number> = {
        gamesPlayed: "increment(1)",
        wins: "increment(1)",
        totalWins: "increment(1)",
        winStreak: "increment(1)",
        totalGuessesInWins: "increment(2)",
        challengeWins: "increment(1)",
        averageGuesses: parseFloat(
          ((mockUser.stats.totalGuessesInWins! + 2) / (mockUser.stats.totalWins! + 1)).toFixed(2),
        ),
        winRate: parseFloat((((mockUser.stats.totalWins! + 1) / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };
      if (mockUser.stats.winStreak! + 1 > mockUser.stats.bestStreak!) {
        expectedStatsUpdate.bestStreak = mockUser.stats.winStreak! + 1;
      }

      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(authContext.uid, expectedStatsUpdate);
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
      const expectedStatsUpdate = {
        gamesPlayed: "increment(1)",
        winRate: parseFloat(
          ((userWithStreak.stats.totalWins! / (userWithStreak.stats.gamesPlayed! + 1)) * 100).toFixed(2),
        ),
      };
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining(expectedStatsUpdate),
      );
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

    test("should reset winStreak and update gamesPlayed/winRate", async () => {
      await handleGuessLogic(requestData, authContext);
      const expectedStatsUpdate = {
        gamesPlayed: "increment(1)",
        winStreak: 0,
        winRate: parseFloat(((mockUser.stats.totalWins! / (mockUser.stats.gamesPlayed! + 1)) * 100).toFixed(2)),
      };
      expect(firestoreService.updateUserStats).toHaveBeenCalledWith(
        authContext.uid,
        expect.objectContaining(expectedStatsUpdate),
      );
    });
  });

  describe("Feedback Generation", () => {
    test("exact match (all green)", async () => {
      const {feedback} = await handleGuessLogic(
        {guess: "keyboard", riddleId: "r1", gameMode: "classic", attempts: 1},
        authContext,
      );
      expect(feedback).toEqual(mockRiddle.answer.split("").map((l) => ({letter: l, status: "green"})));
    });

    test("no match (all red)", async () => {
      const {feedback} = await handleGuessLogic(
        {guess: "plzno", riddleId: "r1", gameMode: "classic", attempts: 1},
        authContext,
      );
      expect(feedback).toEqual([
        {letter: "p", status: "red"},
        {letter: "l", status: "red"},
        {letter: "z", status: "red"},
        {letter: "n", status: "red"},
        {letter: "o", status: "green"},
      ]);
    });
  });

  test("should correctly update bestStreak when current winStreak surpasses it", async () => {
    const userWithLowerBestStreak = {
      ...mockUser,
      stats: {...mockUser.stats, winStreak: 3, bestStreak: 3},
    };
    (firestoreService.getUser as jest.Mock).mockResolvedValue(userWithLowerBestStreak);
    const requestData: SubmitGuessRequestData = {
      guess: "keyboard",
      riddleId: "riddle-123",
      gameMode: "classic",
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
    const unexpectedError = new Error("Something went very wrong");
    (firestoreService.getRiddle as jest.Mock).mockRejectedValue(unexpectedError);
    const requestData: SubmitGuessRequestData = {
      guess: "test",
      riddleId: "riddle-123",
      gameMode: "classic",
      attempts: 1,
    };

    await expect(handleGuessLogic(requestData, authContext)).rejects.toThrow(
      new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", unexpectedError),
    );
  });
});

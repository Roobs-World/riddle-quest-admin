import {describe, expect, it, jest, beforeAll, afterAll, beforeEach} from "@jest/globals"; // Added import
// Import the functions to be tested
import {
  getUser,
  updateUserLastCompletedDailyChallengeDate,
  updateUserCoins,
  updateUserStats,
  updateUserProfile,
  getRiddle,
} from "../firestoreService"; // Adjust path as needed
import type {Player, PlayerStats} from "../validation/firestoreSchemas"; // Adjust path as needed
import * as admin from "firebase-admin"; // Added import
import {initializeTestEnvironment, RulesTestEnvironment} from "@firebase/rules-unit-testing"; // Added import
import * as functions from "firebase-functions"; // Added import for logger

// Mock Firebase functions logger
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(), // Added warn for completeness
  },
}));

// Mock Firestore admin SDK
let mockCollection: jest.Mock;
let mockDoc: jest.Mock;
// Define a union type for mock data that can be either Player or riddle data
type MockDocumentData = Partial<Player> | {answer: string; text: string; riddleId?: string} | null | undefined;
let mockGet: jest.Mock<() => Promise<{exists: boolean; data?: () => MockDocumentData}>>; // More specific union type
let mockUpdate: jest.Mock<() => Promise<void>>; // Typed mockUpdate
let mockRunTransaction: jest.MockedFunction<
  (TTransactionCallback: (transaction: admin.firestore.Transaction) => Promise<unknown>) => Promise<unknown>
>;
let mockSet: jest.Mock<() => Promise<void>>; // Typed mockSet

// Vitest's vi.hoisted can be used if more complex hoisting is needed
// For this case, direct mocking is simpler.
jest.mock("firebase-admin", async () => {
  const actualAdmin = await jest.requireActual<typeof admin>("firebase-admin");
  mockGet = jest.fn<() => Promise<{exists: boolean; data?: () => MockDocumentData}>>(); // Use union type
  mockUpdate = jest.fn<() => Promise<void>>(); // Initialize with type
  mockSet = jest.fn<() => Promise<void>>(); // Initialize with type

  mockDoc = jest.fn(() => ({
    get: mockGet,
    update: mockUpdate,
    set: mockSet, // Add set to mockDoc
  }));
  mockCollection = jest.fn(() => ({
    doc: mockDoc,
  }));
  mockRunTransaction = jest
    .fn<(TTransactionCallback: (transaction: admin.firestore.Transaction) => Promise<unknown>) => Promise<unknown>>() // Renamed type param
    .mockImplementation(async (updateFunction: (transaction: admin.firestore.Transaction) => Promise<unknown>) => {
      const mockTransaction = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
        create: jest.fn(),
        delete: jest.fn(),
        getAll: jest.fn(),
      } as unknown as admin.firestore.Transaction;
      return updateFunction(mockTransaction);
    });

  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: () => ({
      collection: mockCollection,
      doc: mockDoc, // Also mock top-level doc if used, though usually it's collection().doc()
      runTransaction: mockRunTransaction,
      FieldValue: actualAdmin.firestore.FieldValue, // Ensure FieldValue is available
      Timestamp: actualAdmin.firestore.Timestamp, // Ensure Timestamp is available
    }),
  };
});

describe("Firestore Service", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Using a unique projectId for each test suite run can prevent interference.
    testEnv = await initializeTestEnvironment({
      projectId: `test-firestore-service-${Date.now()}`,
      firestore: {
        host: "localhost", // Ensure this matches your emulator settings
        port: 8080, // Ensure this matches your emulator settings
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    // Clear all mock implementations and call history before each test
    jest.clearAllMocks();

    // Re-initialize mocks to ensure correct typing for mockResolvedValue/mockRejectedValue
    mockGet = jest.fn<() => Promise<{exists: boolean; data?: () => MockDocumentData}>>(); // Use union type
    mockUpdate = jest.fn<() => Promise<void>>();
    mockSet = jest.fn<() => Promise<void>>();

    mockDoc = jest.fn().mockImplementation(() => ({
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
    }));
    mockCollection = jest.fn().mockImplementation(() => ({
      doc: mockDoc,
    }));
    mockRunTransaction = jest
      .fn<(TTransactionCallback: (transaction: admin.firestore.Transaction) => Promise<unknown>) => Promise<unknown>>() // Renamed type param
      .mockImplementation(async (updateFunction: (transaction: admin.firestore.Transaction) => Promise<unknown>) => {
        const mockTransactionInternal = {
          get: mockGet,
          update: mockUpdate,
          set: mockSet,
          create: jest.fn(),
          delete: jest.fn(),
          getAll: jest.fn(),
        } as unknown as admin.firestore.Transaction;
        return updateFunction(mockTransactionInternal);
      });
  });

  describe("getUser", () => {
    it("should return user data if user exists", async () => {
      const mockUserData: Player = {
        userId: "testUser",
        email: "test@example.com",
        username: "tester",
        xp: 0,
        coins: 100,
        progress: {classicIndex: 1, dailyChallengeIndex: 1, tutorialIndex: 0},
        stats: {
          gamesPlayed: 0,
          wins: 0,
          totalWins: 0,
          winStreak: 0,
          bestStreak: 0,
          averageGuesses: 0,
          winRate: 0,
          challengeWins: 0,
          totalGuessesInWins: 0,
          dailyPuzzlesCompleted: 0,
          totalWordsGuessed: 0,
          totalScore: 0,
          highestLevelClassic: 0,
        },
        registeredAt: Date.now(), // Changed to numeric timestamp
        lastLogin: Date.now(), // Changed to numeric timestamp
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockUserData});

      const user = await getUser("testUser");
      expect(user).toEqual(mockUserData);
      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith("testUser");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return undefined if user does not exist", async () => {
      mockGet.mockResolvedValue({exists: false});

      const user = await getUser("nonExistentUser");
      expect(user).toBeUndefined();
      expect(functions.logger.info).toHaveBeenCalledWith("User document not found for ID nonExistentUser");
    });
  });

  describe("updateUserLastCompletedDailyChallengeDate", () => {
    it("should update the last daily challenge completed date", async () => {
      mockUpdate.mockResolvedValue(undefined); // Simulate successful update

      const userId = "testUser";
      const date = "2023-10-26";
      await updateUserLastCompletedDailyChallengeDate(userId, date);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(mockUpdate).toHaveBeenCalledWith({lastDailyChallengeCompletedAt: date});
    });

    it("should throw an error if update fails", async () => {
      const error = new Error("Update failed");
      mockUpdate.mockRejectedValue(error);

      const userId = "testUser";
      const date = "2023-10-26";
      await expect(updateUserLastCompletedDailyChallengeDate(userId, date)).rejects.toThrow("Update failed");
      // console.error is expected to be called by the original function
    });
  });

  describe("updateUserCoins", () => {
    it("should update user coins within a transaction", async () => {
      const userId = "testUser";
      const initialCoins = 100;
      const coinsToAdd = 50;

      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins})});
      await updateUserCoins(userId, coinsToAdd);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1); // Called by transaction.get
      expect(mockUpdate).toHaveBeenCalledWith({coins: initialCoins + coinsToAdd});
    });

    it("should use provided transaction if available", async () => {
      const userId = "testUser";
      const initialCoins = 100;
      const coinsToAdd = 50;
      const mockTransactionExt = {
        get: mockGet,
        update: mockUpdate,
        set: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        getAll: jest.fn(),
      } as unknown as admin.firestore.Transaction;

      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins})});

      await updateUserCoins(userId, coinsToAdd, mockTransactionExt);

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1); // Called by transaction.get
      expect(mockUpdate).toHaveBeenCalledWith({coins: initialCoins + coinsToAdd});
    });

    it("should throw error if user does not exist", async () => {
      const userId = "nonExistentUser";
      mockGet.mockResolvedValue({exists: false}); // User does not exist
      await expect(updateUserCoins(userId, 50)).rejects.toThrow(`User with ID ${userId} not found.`);
    });

    it("should throw error for insufficient coins", async () => {
      const userId = "testUser";
      const initialCoins = 10;
      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins})});

      await expect(updateUserCoins(userId, -50)).rejects.toThrow(
        `Insufficient coins for user ${userId}. Current: ${initialCoins}, Attempted to spend: 50.`,
      );
    });
  });

  describe("updateUserStats", () => {
    const userId = "testUser";
    const initialStats: PlayerStats = {
      gamesPlayed: 5,
      wins: 2,
      totalWins: 2,
      winStreak: 1,
      bestStreak: 1,
      averageGuesses: 3,
      winRate: 40,
      challengeWins: 1,
      totalGuessesInWins: 6,
      dailyPuzzlesCompleted: 10,
      totalWordsGuessed: 20,
      totalScore: 100,
      highestLevelClassic: 5,
    };
    const statsUpdate: Partial<PlayerStats> = {wins: 3, winStreak: 2};

    it("should update user stats within a transaction, merging with existing stats", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => ({stats: initialStats})});

      await updateUserStats(userId, statsUpdate);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        stats: {...initialStats, ...statsUpdate},
      });
    });

    it("should use provided transaction if available for stats update", async () => {
      const mockTransactionExt = {
        get: mockGet,
        update: mockUpdate,
        set: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        getAll: jest.fn(),
      } as unknown as admin.firestore.Transaction;
      mockGet.mockResolvedValue({exists: true, data: () => ({stats: initialStats})});

      await updateUserStats(userId, statsUpdate, mockTransactionExt);

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        stats: {...initialStats, ...statsUpdate},
      });
    });

    it("should initialize stats if they don't exist", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => ({})}); // No initial stats

      await updateUserStats(userId, statsUpdate);
      expect(mockUpdate).toHaveBeenCalledWith({stats: {...statsUpdate}});
    });

    it("should throw error if user does not exist for stats update", async () => {
      mockGet.mockResolvedValue({exists: false});
      await expect(updateUserStats("nonExistentUser", statsUpdate)).rejects.toThrow(
        "User with ID nonExistentUser not found.",
      );
    });
  });

  describe("updateUserProfile", () => {
    it("should update user profile fields", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const userId = "testUser";
      const profileUpdate: Partial<Player> = {username: "newUsername", avatarUrl: "newAvatar.png"};

      await updateUserProfile(userId, profileUpdate);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(mockUpdate).toHaveBeenCalledWith(profileUpdate);
    });

    it("should throw an error if profile update fails", async () => {
      const error = new Error("Profile update failed");
      mockUpdate.mockRejectedValue(error);
      const userId = "testUser";
      const profileUpdate = {username: "newUsername"};

      await expect(updateUserProfile(userId, profileUpdate)).rejects.toThrow("Profile update failed");
    });
  });

  describe("getRiddle", () => {
    it("should return riddle data if riddle exists", async () => {
      const mockRiddleData = {
        answer: "HELLO",
        text: "A greeting word",
        riddleId: "riddle123",
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockRiddleData});

      const riddle = await getRiddle("riddle123");
      expect(riddle).toEqual({
        answer: "HELLO",
        text: "A greeting word",
        riddleId: "riddle123",
      });
      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockDoc).toHaveBeenCalledWith("riddle123");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return undefined if riddle does not exist", async () => {
      mockGet.mockResolvedValue({exists: false});

      const riddle = await getRiddle("nonExistentRiddle");
      expect(riddle).toBeUndefined();
      expect(functions.logger.info).toHaveBeenCalledWith("Riddle document not found for ID nonExistentRiddle");
    });

    it("should return undefined if riddle data is null", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => null});

      const riddle = await getRiddle("riddleWithNullData");
      expect(riddle).toBeUndefined();
    });

    it("should use riddleId from data if available, otherwise use provided riddleId", async () => {
      const mockRiddleDataWithoutId = {
        answer: "WORLD",
        text: "The planet we live on",
        // riddleId is missing from data
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockRiddleDataWithoutId});

      const riddle = await getRiddle("riddle456");
      expect(riddle).toEqual({
        answer: "WORLD",
        text: "The planet we live on",
        riddleId: "riddle456", // Should use the provided riddleId
      });
    });

    it("should prefer riddleId from data over provided riddleId", async () => {
      const mockRiddleDataWithId = {
        answer: "EARTH",
        text: "Our home planet",
        riddleId: "dataRiddleId",
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockRiddleDataWithId});

      const riddle = await getRiddle("providedRiddleId");
      expect(riddle).toEqual({
        answer: "EARTH",
        text: "Our home planet",
        riddleId: "dataRiddleId", // Should use the riddleId from data
      });
    });
  });
});

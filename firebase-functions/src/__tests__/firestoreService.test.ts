import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// Import necessary testing libraries and modules
import * as functions from "firebase-functions";
import {Transaction} from "firebase-admin/firestore";
import * as admin from "firebase-admin";

// Initialize mock variables outside the factory
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockSet = jest.fn();
const mockAdd = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockOnSnapshot = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const mockGetAll = jest.fn();

// Define the structure of the mocked DocumentReference
const mockDocumentRef = {
  get: mockGet,
  update: mockUpdate,
  set: mockSet,
  delete: mockDelete,
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocumentRef),
};

// Define the structure of the mocked CollectionReference
const mockCollectionRef = {
  doc: jest.fn(() => mockDocumentRef),
  add: mockAdd,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockGet, // Collection.get() can return a QuerySnapshot
  onSnapshot: mockOnSnapshot,
  collection: jest.fn(() => mockCollectionRef),
};

const mockRunTransaction = jest
  .fn()
  .mockImplementation(async (updateFunction: (transaction: admin.firestore.Transaction) => Promise<unknown>) => {
    const mockTransaction = {
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
      create: mockCreate,
      delete: mockDelete,
      getAll: mockGetAll,
    } as unknown as Transaction; // Cast to unknown as Transaction due to partial mock
    return updateFunction(mockTransaction);
  });

// Mock firebase-functions specifically for logger
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    write: jest.fn(),
  },
}));

// Mock firebase-admin with simplified setup, referencing the variables defined above
jest.mock("firebase-admin", () => {
  const mockFirestoreInstance = {
    collection: jest.fn(() => mockCollectionRef), // firestore.collection() returns a CollectionRef
    doc: jest.fn(() => mockDocumentRef), // firestore.doc() returns a DocumentRef
    runTransaction: (updateFunction: (transaction: admin.firestore.Transaction) => Promise<unknown>) =>
      mockRunTransaction(updateFunction),
    FieldValue: {
      increment: jest.fn((val: number) => `increment(${val})`),
      arrayUnion: jest.fn((...args: unknown[]) => `arrayUnion(${args.join(", ")})`), // Use unknown[]
      arrayRemove: jest.fn((...args: unknown[]) => `arrayRemove(${args.join(", ")})`), // Use unknown[]
      delete: jest.fn(() => "FieldValue.delete()"),
    },
    Timestamp: {
      now: jest.fn(() => new Date()),
      fromDate: jest.fn((date: Date) => date),
      fromMillis: jest.fn((milliseconds: number) => new Date(milliseconds)),
    },
  };

  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestoreInstance), // firebase-admin.firestore() returns the firestore instance
    apps: [{options: {}}],
  };
});

// Import the functions to be tested
import {
  getUser,
  updateUserLastCompletedDailyChallengeDate,
  updateUserCoins,
  updateUserStats,
  updateUserProfile,
  getRiddle,
} from "../firestoreService";
import {Player, PlayerStats} from "../validation/firestoreSchemas";

describe("Firestore Service", () => {
  beforeAll(async () => {
    // Simplified setup without Firebase rules testing environment
  });

  afterAll(async () => {
    // No cleanup needed for unit tests
  });

  beforeEach(async () => {
    // Clear all mock implementations and call history before each test
    jest.clearAllMocks();
  });

  describe("getUser", () => {
    it("should return user data if user exists", async () => {
      const mockUserData: Player = {
        userId: "testUser",
        email: "test@example.com",
        username: "tester",
        xp: 0,
        coins: 100,
        hasPurchasedApp: false,
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
        registeredAt: Date.now(),
        lastLogin: Date.now(),
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockUserData});

      const user = await getUser("testUser");
      expect(user).toEqual(mockUserData);
      expect(admin.firestore().collection).toHaveBeenCalledWith("users");
      expect(mockCollectionRef.doc).toHaveBeenCalledWith("testUser");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return undefined if user does not exist and log info", async () => {
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      const user = await getUser("nonExistentUser");
      expect(user).toBeUndefined();
      expect(functions.logger.info).toHaveBeenCalledWith("User document not found for ID nonExistentUser");
    });
  });

  describe("updateUserLastCompletedDailyChallengeDate", () => {
    it("should update the last daily challenge completed date", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const userId = "testUser";
      const date = "2023-10-26";
      await updateUserLastCompletedDailyChallengeDate(userId, date);
      expect(admin.firestore().collection).toHaveBeenCalledWith("users");
      expect(mockCollectionRef.doc).toHaveBeenCalledWith(userId);
      expect(mockUpdate).toHaveBeenCalledWith({lastDailyChallengeCompletedAt: date});
    });

    it("should log an error if update fails", async () => {
      const error = new Error("Update failed");
      mockUpdate.mockRejectedValue(error); // Simulate Firestore update failure

      const userId = "testUser";
      const date = "2023-10-26";

      // Expect the function to log the error and reject when the update fails.
      await expect(updateUserLastCompletedDailyChallengeDate(userId, date)).rejects.toThrow(error);

      expect(functions.logger.error).toHaveBeenCalledWith(
        `Error updating last completed daily challenge date for user ${userId}:`,
        error,
      );
    });
  });

  describe("updateUserCoins", () => {
    beforeEach(async () => {
      // Clear all mock implementations and call history before each test
      jest.clearAllMocks();
      // Ensure mockUpdate is reset to resolve successfully
      mockUpdate.mockResolvedValue(undefined);
    });

    it("should update user coins within a transaction", async () => {
      const userId = "testUser";
      const initialCoins = 100;
      const coinsToAdd = 50;

      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins}) as Player});
      await updateUserCoins(userId, coinsToAdd);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          get: mockGet,
          update: mockUpdate,
          set: mockSet,
        }),
        {coins: initialCoins + coinsToAdd},
      );
    });

    it("should use provided transaction if available", async () => {
      const userId = "testUser";
      const initialCoins = 100;
      const coinsToAdd = 50;
      const mockTransactionExt = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
        create: jest.fn(),
        delete: jest.fn(),
        getAll: jest.fn(),
      } as unknown as Transaction;

      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins}) as Player});

      await updateUserCoins(userId, coinsToAdd, mockTransactionExt);

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({get: mockGet, update: mockUpdate, set: mockSet}),
        {coins: initialCoins + coinsToAdd},
      );
    });

    it("should throw error and log if user does not exist in transaction", async () => {
      const userId = "nonExistentUser";
      mockGet.mockResolvedValue({exists: false, data: () => undefined});
      await expect(updateUserCoins(userId, 50)).rejects.toThrow(`User with ID ${userId} not found.`);
      expect(functions.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`User with ID ${userId} not found during transaction for updateUserCoins.`),
        expect.any(Error),
      );
    });

    it("should throw error and log for insufficient coins in transaction", async () => {
      const userId = "testUser";
      const initialCoins = 10;
      mockGet.mockResolvedValue({exists: true, data: () => ({coins: initialCoins}) as Player});

      await expect(updateUserCoins(userId, -50)).rejects.toThrow(
        `Insufficient coins for user ${userId}. Current: ${initialCoins}, Attempted to spend: 50.`,
      );
      expect(functions.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Insufficient coins for user ${userId}`),
        expect.any(Error),
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
      mockGet.mockResolvedValue({exists: true, data: () => ({stats: initialStats}) as Player});
      mockUpdate.mockResolvedValue(undefined);

      await updateUserStats(userId, statsUpdate);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({get: mockGet, update: mockUpdate, set: mockSet}),
        {
          stats: {...initialStats, ...statsUpdate},
        },
      );
    });

    it("should use provided transaction if available for stats update", async () => {
      const mockTransactionExt = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
        create: jest.fn(),
        delete: jest.fn(),
        getAll: jest.fn(),
      } as unknown as Transaction;
      mockGet.mockResolvedValue({exists: true, data: () => ({stats: initialStats}) as Player});

      await updateUserStats(userId, statsUpdate, mockTransactionExt);

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({get: mockGet, update: mockUpdate, set: mockSet}),
        {
          stats: {...initialStats, ...statsUpdate},
        },
      );
    });

    it("should initialize stats if they don't exist in transaction", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => ({}) as Player});

      await updateUserStats(userId, statsUpdate);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({get: mockGet, update: mockUpdate, set: mockSet}),
        {stats: {...statsUpdate}},
      );
    });

    it("should throw error and log if user does not exist for stats update in transaction", async () => {
      mockGet.mockResolvedValue({exists: false, data: () => undefined});
      await expect(updateUserStats("nonExistentUser", statsUpdate)).rejects.toThrow(
        "User with ID nonExistentUser not found.",
      );
      expect(functions.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("User with ID nonExistentUser not found during transaction for updateUserStats."),
        expect.any(Error),
      );
    });
  });

  describe("updateUserProfile", () => {
    it("should update user profile fields", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const userId = "testUser";
      const profileUpdate: Partial<Player> = {username: "newUsername", avatarUrl: "newAvatar.png"};

      await updateUserProfile(userId, profileUpdate);

      expect(admin.firestore().collection).toHaveBeenCalledWith("users");
      expect(mockCollectionRef.doc).toHaveBeenCalledWith(userId);
      expect(mockUpdate).toHaveBeenCalledWith(profileUpdate);
    });

    it("should log an error and rethrow if profile update fails", async () => {
      const error = new Error("Profile update failed");
      mockUpdate.mockRejectedValue(error);
      const userId = "testUser";
      const profileUpdate = {username: "newUsername"};

      await expect(updateUserProfile(userId, profileUpdate)).rejects.toThrow("Profile update failed");
      expect(functions.logger.error).toHaveBeenCalledWith(`Error updating profile for user ${userId}:`, error);
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
      expect(admin.firestore().collection).toHaveBeenCalledWith("riddles");
      expect(mockCollectionRef.doc).toHaveBeenCalledWith("riddle123");
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return undefined and log info if riddle does not exist", async () => {
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      const riddle = await getRiddle("nonExistentRiddle");
      expect(riddle).toBeUndefined();
      expect(functions.logger.info).toHaveBeenCalledWith("Riddle document not found for ID nonExistentRiddle");
    });

    it("should return undefined and log info if riddle data is null", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => null});

      const riddle = await getRiddle("riddleWithNullData");
      expect(riddle).toBeUndefined();
      expect(functions.logger.info).toHaveBeenCalledWith("Riddle data is null for ID riddleWithNullData");
    });

    it("should use riddleId from data if available, otherwise use provided riddleId", async () => {
      const mockRiddleDataWithoutId = {
        answer: "WORLD",
        text: "The planet we live on",
      };
      mockGet.mockResolvedValue({exists: true, data: () => mockRiddleDataWithoutId});

      const riddle = await getRiddle("riddle456");
      expect(riddle).toEqual({
        answer: "WORLD",
        text: "The planet we live on",
        riddleId: "riddle456",
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
        riddleId: "dataRiddleId",
      });
    });
  });
});

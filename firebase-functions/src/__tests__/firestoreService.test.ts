/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, test, beforeEach, jest} from "@jest/globals";

// Mock Firebase Admin SDK
const mockFirestore = {
  collection: jest.fn(),
  runTransaction: jest.fn(),
};

const mockCollection = {
  doc: jest.fn(),
};

const mockDoc = {
  get: jest.fn() as jest.MockedFunction<any>,
  update: jest.fn() as jest.MockedFunction<any>,
  set: jest.fn() as jest.MockedFunction<any>,
};

const mockTransaction = {
  get: jest.fn() as jest.MockedFunction<any>,
  update: jest.fn() as jest.MockedFunction<any>,
};

// Mock Firebase Functions logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock("firebase-admin", () => ({
  firestore: () => mockFirestore,
}));

jest.mock("firebase-functions", () => ({
  logger: mockLogger,
}));

// Import the module after mocking
import {
  getUser,
  updateUserLastCompletedDailyChallengeDate,
  updateUserCoins,
  updateUserStats,
  updateUserProfile,
  getRiddle,
} from "../firestoreService";

describe("FirestoreService", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDoc);
    mockFirestore.runTransaction.mockImplementation((callback: any) => callback(mockTransaction));
  });

  describe("getUser", () => {
    const testUserId = "testUser123";
    const testUserData = {
      userId: testUserId,
      email: "test@example.com",
      username: "TestUser",
      coins: 100,
      xp: 50,
      stats: {
        gamesPlayed: 10,
        wins: 5,
        winRate: 0.5,
      },
    };

    test("should return user data when user exists", async () => {
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      const result = await getUser(testUserId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual(testUserData);
    });

    test("should return undefined when user does not exist", async () => {
      const mockUserDoc = {
        exists: false,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      const result = await getUser(testUserId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`User document not found for ID ${testUserId}`);
    });

    test("should handle Firestore errors", async () => {
      const testError = new Error("Firestore connection failed");
      (mockDoc.get as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(getUser(testUserId)).rejects.toThrow("Firestore connection failed");
    });
  });

  describe("updateUserLastCompletedDailyChallengeDate", () => {
    const testUserId = "testUser123";
    const testDate = "2024-01-15";

    test("should update user's last completed daily challenge date", async () => {
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserLastCompletedDailyChallengeDate(testUserId, testDate);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.update).toHaveBeenCalledWith({
        lastDailyChallengeCompletedAt: testDate,
      });
    });

    test("should handle Firestore errors and rethrow", async () => {
      const testError = new Error("Update failed");
      (mockDoc.update as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(updateUserLastCompletedDailyChallengeDate(testUserId, testDate)).rejects.toThrow("Update failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error updating last completed daily challenge date for user ${testUserId}:`,
        testError,
      );
    });
  });

  describe("updateUserCoins", () => {
    const testUserId = "testUser123";
    const testUserData = {
      coins: 100,
    };

    test("should update user coins with positive amount", async () => {
      const coinsToAdd = 50;
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockFirestore.runTransaction).toHaveBeenCalled();
      expect(mockTransaction.get).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 150,
      });
      expect(consoleSpy).toHaveBeenCalledWith(`User ${testUserId} coins updated by ${coinsToAdd}.`);

      consoleSpy.mockRestore();
    });

    test("should update user coins with negative amount", async () => {
      const coinsToSpend = -30;
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserCoins(testUserId, coinsToSpend);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 70,
      });
      expect(consoleSpy).toHaveBeenCalledWith(`User ${testUserId} coins updated by ${coinsToSpend}.`);

      consoleSpy.mockRestore();
    });

    test("should throw error when user does not exist", async () => {
      const coinsToAdd = 50;
      const mockUserDoc = {
        exists: false,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await expect(updateUserCoins(testUserId, coinsToAdd)).rejects.toThrow(`User with ID ${testUserId} not found.`);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test("should throw error when insufficient coins", async () => {
      const coinsToSpend = -150;
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await expect(updateUserCoins(testUserId, coinsToSpend)).rejects.toThrow(
        `Insufficient coins for user ${testUserId}. Current: 100, Attempted to spend: 150.`,
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test("should handle missing coins property", async () => {
      const userWithoutCoins = {};
      const coinsToAdd = 10;
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutCoins,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 10,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("updateUserStats", () => {
    const testUserId = "testUser123";
    const currentUserData = {
      stats: {
        gamesPlayed: 10,
        wins: 5,
        winRate: 0.5,
      },
    };

    test("should update user stats", async () => {
      const statsUpdate = {
        gamesPlayed: 11,
        wins: 6,
        winRate: 0.55,
      };

      const mockUserDoc = {
        exists: true,
        data: () => currentUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserStats(testUserId, statsUpdate);

      expect(mockFirestore.runTransaction).toHaveBeenCalled();
      expect(mockTransaction.get).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        stats: {
          gamesPlayed: 11,
          wins: 6,
          winRate: 0.55,
        },
      });
      expect(consoleSpy).toHaveBeenCalledWith(`Stats for user ${testUserId} updated.`);

      consoleSpy.mockRestore();
    });

    test("should handle missing stats property", async () => {
      const userWithoutStats = {};
      const statsUpdate = {
        gamesPlayed: 1,
        wins: 1,
      };

      const mockUserDoc = {
        exists: true,
        data: () => userWithoutStats,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserStats(testUserId, statsUpdate);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        stats: {
          gamesPlayed: 1,
          wins: 1,
        },
      });

      consoleSpy.mockRestore();
    });

    test("should throw error when user does not exist", async () => {
      const statsUpdate = {gamesPlayed: 1};
      const mockUserDoc = {
        exists: false,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await expect(updateUserStats(testUserId, statsUpdate)).rejects.toThrow(`User with ID ${testUserId} not found.`);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("updateUserProfile", () => {
    const testUserId = "testUser123";

    test("should update user profile successfully", async () => {
      const profileUpdate = {
        username: "NewUsername",
        email: "newemail@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
      };

      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserProfile(testUserId, profileUpdate);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.update).toHaveBeenCalledWith(profileUpdate);
    });

    test("should handle Firestore errors and rethrow", async () => {
      const profileUpdate = {username: "NewUsername"};
      const testError = new Error("Profile update failed");

      (mockDoc.update as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(updateUserProfile(testUserId, profileUpdate)).rejects.toThrow("Profile update failed");
      expect(mockLogger.error).toHaveBeenCalledWith(`Error updating profile for user ${testUserId}:`, testError);
    });
  });

  describe("getRiddle", () => {
    const testRiddleId = "riddle123";
    const testRiddleData = {
      riddleId: testRiddleId,
      text: "What has keys but no locks?",
      answer: "KEYBOARD",
      difficulty: 3,
    };

    test("should return riddle data when riddle exists", async () => {
      const mockRiddleDoc = {
        exists: true,
        data: () => testRiddleData,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      const result = await getRiddle(testRiddleId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("riddles");
      expect(mockCollection.doc).toHaveBeenCalledWith(testRiddleId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual(testRiddleData);
    });

    test("should return undefined when riddle does not exist", async () => {
      const mockRiddleDoc = {
        exists: false,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      const result = await getRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`Riddle document not found for ID ${testRiddleId}`);
    });

    test("should return undefined when riddle data is null", async () => {
      const mockRiddleDoc = {
        exists: true,
        data: () => null,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      const result = await getRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`Riddle data is null for ID ${testRiddleId}`);
    });

    test("should add riddleId to data if missing", async () => {
      const riddleDataWithoutId = {
        text: "What has keys but no locks?",
        answer: "KEYBOARD",
        difficulty: 3,
      };

      const mockRiddleDoc = {
        exists: true,
        data: () => riddleDataWithoutId,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      const result = await getRiddle(testRiddleId);

      expect(result).toEqual({
        ...riddleDataWithoutId,
        riddleId: testRiddleId,
      });
    });

    test("should handle Firestore errors", async () => {
      const testError = new Error("Firestore connection failed");
      (mockDoc.get as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(getRiddle(testRiddleId)).rejects.toThrow("Firestore connection failed");
    });
  });

  describe("Edge Cases", () => {
    test("should handle zero coins case", async () => {
      const testUserId = "testUser123";
      const userWithZeroCoins = {coins: 0};
      const coinsToAdd = 10;
      const mockUserDoc = {
        exists: true,
        data: () => userWithZeroCoins,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 10,
      });

      consoleSpy.mockRestore();
    });

    test("should handle empty stats updates", async () => {
      const testUserId = "testUser123";
      const mockUserDoc = {
        exists: true,
        data: () => ({stats: {gamesPlayed: 5}}),
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserStats(testUserId, {});

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        stats: {gamesPlayed: 5},
      });

      consoleSpy.mockRestore();
    });
  });
});

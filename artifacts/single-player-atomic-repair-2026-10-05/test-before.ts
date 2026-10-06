import {describe, expect, test, beforeEach, jest} from "@jest/globals";

// Mock Firebase Admin SDK
/** Provides mock firestore behavior. */
const mockFirestore = {
  collection: jest.fn(),
  runTransaction: jest.fn(),
};
/** Provides firestore with field value behavior. */
const firestoreWithFieldValue = Object.assign(() => mockFirestore, {
  FieldValue: {arrayUnion: (...args: any[]) => args},
});

/** Provides mock collection behavior. */
const mockCollection = {
  doc: jest.fn(),
};

/** Provides mock doc behavior. */
const mockDoc = {
  get: jest.fn() as jest.MockedFunction<any>,
  update: jest.fn() as jest.MockedFunction<any>,
  set: jest.fn() as jest.MockedFunction<any>,
};

/** Provides mock transaction behavior. */
const mockTransaction = {
  get: jest.fn() as jest.MockedFunction<any>,
  update: jest.fn() as jest.MockedFunction<any>,
  create: jest.fn() as jest.MockedFunction<any>,
};

// Mock Firebase Functions logger
/** Provides mock logger behavior. */
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock("firebase-admin", () => ({
  firestore: firestoreWithFieldValue,
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
  initializeNewUser,
  ensureUserDocumentComplete,
  appendUnlockedAchievements,
  getDailyRiddle,
  getRiddleByGameMode,
} from "../gameplay/firestoreService";

describe("FirestoreService", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    (mockDoc.get as jest.MockedFunction<any>).mockReset();
    (mockDoc.update as jest.MockedFunction<any>).mockReset();
    (mockDoc.set as jest.MockedFunction<any>).mockReset();
    (mockTransaction.get as jest.MockedFunction<any>).mockReset();
    (mockTransaction.update as jest.MockedFunction<any>).mockReset();
    (mockTransaction.create as jest.MockedFunction<any>).mockReset();

    // Setup default mock implementations
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDoc);
    mockFirestore.runTransaction.mockImplementation((callback: any) => callback(mockTransaction));
  });

  describe("getUser", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";
    /** Provides test user data behavior. */
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
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      /** Provides result behavior. */
      const result = await getUser(testUserId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual(testUserData);
    });

    test("should return undefined when user does not exist", async () => {
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: false,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      /** Provides result behavior. */
      const result = await getUser(testUserId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`User document not found for ID ${testUserId}`);
    });

    test("should handle Firestore errors", async () => {
      /** Provides test error behavior. */
      const testError = new Error("Firestore connection failed");
      (mockDoc.get as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(getUser(testUserId)).rejects.toThrow("Firestore connection failed");
    });
  });

  describe("updateUserLastCompletedDailyChallengeDate", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";
    /** Provides test date behavior. */
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
      /** Provides test error behavior. */
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
    /** Provides test user id behavior. */
    const testUserId = "testUser123";
    /** Provides test user data behavior. */
    const testUserData = {
      coins: 100,
    };

    test("should update user coins with positive amount", async () => {
      /** Provides coins to add behavior. */
      const coinsToAdd = 50;
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockFirestore.runTransaction).toHaveBeenCalled();
      expect(mockTransaction.get).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 150,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`User ${testUserId} coins updated by ${coinsToAdd}.`);
    });

    test("should update user coins with negative amount", async () => {
      /** Provides coins to spend behavior. */
      const coinsToSpend = -30;
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => testUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserCoins(testUserId, coinsToSpend);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 70,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`User ${testUserId} coins updated by ${coinsToSpend}.`);
    });

    test("should throw error when user does not exist", async () => {
      /** Provides coins to add behavior. */
      const coinsToAdd = 50;
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: false,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await expect(updateUserCoins(testUserId, coinsToAdd)).rejects.toThrow(`User with ID ${testUserId} not found.`);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test("should throw error when insufficient coins", async () => {
      /** Provides coins to spend behavior. */
      const coinsToSpend = -150;
      /** Provides mock user doc behavior. */
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
      /** Provides r without coins. */
      const userWithoutCoins = {};
      /** Provides coins to add behavior. */
      const coinsToAdd = 10;
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutCoins,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      /** Provides console spy behavior. */
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 10,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("updateUserStats", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";
    /** Provides current user data behavior. */
    const currentUserData = {
      stats: {
        gamesPlayed: 10,
        wins: 5,
        winRate: 0.5,
      },
    };

    test("should update user stats", async () => {
      /** Provides stats update behavior. */
      const statsUpdate = {
        gamesPlayed: 11,
        wins: 6,
        winRate: 0.55,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => currentUserData,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserStats(testUserId, statsUpdate);

      expect(mockFirestore.runTransaction).toHaveBeenCalled();
      expect(mockTransaction.get).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        "stats.gamesPlayed": 11,
        "stats.wins": 6,
        "stats.winRate": 0.55,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Stats for user ${testUserId} updated.`);
    });

    test("should handle missing stats property", async () => {
      /** Provides r without stats. */
      const userWithoutStats = {};
      /** Provides stats update behavior. */
      const statsUpdate = {
        gamesPlayed: 1,
        wins: 1,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutStats,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserStats(testUserId, statsUpdate);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        "stats.gamesPlayed": 1,
        "stats.wins": 1,
      });
    });

    test("should throw error when user does not exist", async () => {
      /** Provides stats update behavior. */
      const statsUpdate = {gamesPlayed: 1};
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: false,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await expect(updateUserStats(testUserId, statsUpdate)).rejects.toThrow(`User with ID ${testUserId} not found.`);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("updateUserProfile", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";

    test("should update user profile successfully", async () => {
      /** Provides profile update behavior. */
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
      /** Provides profile update behavior. */
      const profileUpdate = {username: "NewUsername"};
      /** Provides test error behavior. */
      const testError = new Error("Profile update failed");

      (mockDoc.update as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(updateUserProfile(testUserId, profileUpdate)).rejects.toThrow("Profile update failed");
      expect(mockLogger.error).toHaveBeenCalledWith(`Error updating profile for user ${testUserId}:`, testError);
    });
  });

  describe("getRiddle", () => {
    /** Provides test riddle id behavior. */
    const testRiddleId = "riddle123";
    /** Provides test riddle data behavior. */
    const testRiddleData = {
      riddleId: testRiddleId,
      text: "What has keys but no locks?",
      answer: "KEYBOARD",
    };

    test("should return riddle data when riddle exists", async () => {
      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => testRiddleData,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("localizedRiddles/en/riddles");
      expect(mockCollection.doc).toHaveBeenCalledWith(testRiddleId);
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual({
        ...testRiddleData,
        locale: "en",
      });
    });

    test("should return undefined when riddle does not exist", async () => {
      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: false,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Riddle document not found for ID ${testRiddleId} in any collection`,
      );
    });

    test("should return undefined when riddle data is null", async () => {
      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => null,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`Classic riddle data is null for ID ${testRiddleId} in locale en`);
    });

    test("should add riddleId to data if missing", async () => {
      /** Provides riddle data without id behavior. */
      const riddleDataWithoutId = {
        text: "What has keys but no locks?",
        answer: "KEYBOARD",
      };

      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => riddleDataWithoutId,
      };

      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(result).toEqual({
        ...riddleDataWithoutId,
        riddleId: testRiddleId,
        locale: "en",
      });
    });

    test("should handle Firestore errors", async () => {
      /** Provides test error behavior. */
      const testError = new Error("Firestore connection failed");
      (mockDoc.get as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(getRiddle(testRiddleId)).rejects.toThrow("Firestore connection failed");
    });
  });

  describe("Edge Cases", () => {
    test("should handle zero coins case", async () => {
      /** Provides test user id behavior. */
      const testUserId = "testUser123";
      /** Provides r with zero coins. */
      const userWithZeroCoins = {coins: 0};
      /** Provides coins to add behavior. */
      const coinsToAdd = 10;
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithZeroCoins,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserCoins(testUserId, coinsToAdd);

      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        coins: 10,
      });
    });

    test("should handle empty stats updates", async () => {
      /** Provides test user id behavior. */
      const testUserId = "testUser123";
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => ({stats: {gamesPlayed: 5}}),
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockTransaction.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await updateUserStats(testUserId, {});

      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    test("should log specific error for insufficient coins with exact error message", async () => {
      /** Provides test user id behavior. */
      const testUserId = "testUser123";
      /** Provides current coins behavior. */
      const currentCoins = 50;
      /** Provides coins to spend behavior. */
      const coinsToSpend = -75; // More than available
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => ({coins: currentCoins}),
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      /** Provides expected error message behavior. */
      const expectedErrorMessage = `Insufficient coins for user ${testUserId}. Current: ${currentCoins}, Attempted to spend: ${-coinsToSpend}.`;

      await expect(updateUserCoins(testUserId, coinsToSpend)).rejects.toThrow(expectedErrorMessage);

      // Verify the specific error logging call (line 111)
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage, expect.any(Error));
    });

    test("should log specific error for user not found in stats with exact error message", async () => {
      /** Provides test user id behavior. */
      const testUserId = "testUser123";
      /** Provides stats update behavior. */
      const statsUpdate = {gamesPlayed: 1};
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: false,
      };

      (mockTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      /** Provides expected error message behavior. */
      const expectedErrorMessage = `User with ID ${testUserId} not found during transaction for updateUserStats.`;

      await expect(updateUserStats(testUserId, statsUpdate)).rejects.toThrow(`User with ID ${testUserId} not found.`);

      // Verify the specific error logging call (line 149)
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage, expect.any(Error));
    });
  });

  describe("updateUserCoins - external transaction path", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";

    test("should use provided transaction instead of creating a new one", async () => {
      /** Provides external transaction behavior. */
      const externalTransaction = {
        get: jest.fn() as jest.MockedFunction<any>,
        update: jest.fn() as jest.MockedFunction<any>,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => ({coins: 100}),
      };

      (externalTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await updateUserCoins(testUserId, 50, externalTransaction as any);

      expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
      expect(externalTransaction.get).toHaveBeenCalled();
      expect(externalTransaction.update).toHaveBeenCalledWith(expect.any(Object), {coins: 150});
    });
  });

  describe("updateUserStats - external transaction path", () => {
    /** Provides test user id behavior. */
    const testUserId = "testUser123";

    test("should use provided transaction instead of creating a new one", async () => {
      /** Provides external transaction behavior. */
      const externalTransaction = {
        get: jest.fn() as jest.MockedFunction<any>,
        update: jest.fn() as jest.MockedFunction<any>,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => ({stats: {gamesPlayed: 5, wins: 2}}),
      };

      (externalTransaction.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await updateUserStats(testUserId, {gamesPlayed: 6}, externalTransaction as any);

      expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
      expect(externalTransaction.get).toHaveBeenCalled();
      expect(externalTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        "stats.gamesPlayed": 6,
      });
    });
  });

  describe("initializeNewUser", () => {
    /** Provides test user id behavior. */
    const testUserId = "newUser123";
    /** Provides test user data behavior. */
    const testUserData = {
      email: "new@example.com",
      username: "NewPlayer",
    };

    test("should create user document with default stats and progress", async () => {
      await initializeNewUser(testUserId, testUserData);

      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockCollection.doc).toHaveBeenCalledWith(testUserId);
      expect(mockTransaction.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          userId: testUserId,
          email: testUserData.email,
          username: testUserData.username,
          usernameNormalized: "newplayer",
          usernameReservationId: expect.stringMatching(/^[0-9a-f]{64}$/),
          coins: 300,
          hasPurchasedApp: false,
          stats: expect.objectContaining({
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            gamesPlayed: 0,
            wins: 0,
          }),
          progress: expect.objectContaining({
            classicIndex: 1,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          }),
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Initialized new user document for ${testUserId} with default stats and progress`,
      );
    });

    test("should include optional displayName and avatarUrl when provided", async () => {
      await initializeNewUser(testUserId, {
        ...testUserData,
        displayName: "New Player",
        avatarUrl: "https://example.com/avatar.png",
      });

      expect(mockTransaction.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          displayName: "New Player",
          avatarUrl: "https://example.com/avatar.png",
        }),
      );
    });

    test("should throw and log error when Firestore set fails", async () => {
      /** Provides test error behavior. */
      const testError = new Error("Firestore write failed");
      (mockTransaction.create as jest.MockedFunction<any>).mockImplementationOnce(() => {
        throw testError;
      });

      await expect(initializeNewUser(testUserId, testUserData)).rejects.toThrow("Firestore write failed");
      expect(mockLogger.error).toHaveBeenCalledWith(`Error initializing new user ${testUserId}:`, testError);
    });
  });

  describe("ensureUserDocumentComplete", () => {
    /** Provides test user id behavior. */
    const testUserId = "existingUser123";

    test("should return early when user document does not exist", async () => {
      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: false,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await ensureUserDocumentComplete(testUserId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `User document not found for ${testUserId}, cannot ensure completeness without basic user data`,
      );
      expect(mockDoc.update).not.toHaveBeenCalled();
    });

    test("should not update when user has all required fields", async () => {
      /** Completes user. */
      const completeUser = {
        stats: {
          xp: 0,
          level: 1,
          dailyPuzzlesCompleted: 5,
          bestStreak: 3,
          totalWordsGuessed: 20,
          winRate: 0.6,
          averageGuesses: 4,
          totalScore: 100,
          highestLevelClassic: 5,
          gamesPlayed: 10,
          wins: 6,
          challengeWins: 2,
          winStreak: 3,
          totalWins: 6,
          totalGuessesInWins: 24,
          totalHintsUsed: 0,
          multiplayerGamesPlayed: 0,
          multiplayerWins: 0,
          multiplayerChallengesCreated: 0,
        },
        progress: {
          classicIndex: 5,
          dailyChallengeIndex: 3,
          dailyChallengeCurrentQuestion: 1,
        },
        coins: 200,
        hasPurchasedApp: true,
        unlockedAchievements: [],
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => completeUser,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).not.toHaveBeenCalled();
    });

    test("should add default stats when stats object is missing", async () => {
      /** Provides r without stats. */
      const userWithoutStats = {
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 0,
        },
        coins: 100,
        hasPurchasedApp: false,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutStats,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
            gamesPlayed: 0,
            wins: 0,
          }),
        }),
      );
    });

    test("should add default progress when progress object is missing", async () => {
      /** Provides r without progress. */
      const userWithoutProgress = {
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 0,
          wins: 0,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
        },
        coins: 100,
        hasPurchasedApp: false,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutProgress,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: {
            classicIndex: 1,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          },
        }),
      );
    });

    test("should merge missing stat fields into existing partial stats", async () => {
      /** Provides r with partial stats. */
      const userWithPartialStats = {
        stats: {
          gamesPlayed: 10,
          wins: 5,
        },
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 0,
        },
        coins: 100,
        hasPurchasedApp: false,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithPartialStats,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            gamesPlayed: 10,
            wins: 5,
            dailyPuzzlesCompleted: 0,
            bestStreak: 0,
            totalWordsGuessed: 0,
          }),
        }),
      );
    });

    test("should merge missing progress fields into existing partial progress", async () => {
      /** Provides r with partial progress. */
      const userWithPartialProgress = {
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 0,
          wins: 0,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
          totalHintsUsed: 0,
        },
        progress: {
          classicIndex: 5,
          dailyChallengeIndex: 2,
        },
        coins: 100,
        hasPurchasedApp: false,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithPartialProgress,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: expect.objectContaining({
            classicIndex: 5,
            dailyChallengeIndex: 2,
            dailyChallengeCurrentQuestion: 0,
          }),
        }),
      );
    });

    test("should add default coins when coins is undefined", async () => {
      /** Provides r without coins. */
      const userWithoutCoins = {
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 0,
          wins: 0,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
        },
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 0,
        },
        hasPurchasedApp: false,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutCoins,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          coins: 300,
        }),
      );
    });

    test("should add default hasPurchasedApp when it is undefined", async () => {
      /** Provides r without purchase flag. */
      const userWithoutPurchaseFlag = {
        stats: {
          dailyPuzzlesCompleted: 0,
          bestStreak: 0,
          totalWordsGuessed: 0,
          winRate: 0,
          averageGuesses: 0,
          totalScore: 0,
          highestLevelClassic: 0,
          gamesPlayed: 0,
          wins: 0,
          challengeWins: 0,
          winStreak: 0,
          totalWins: 0,
          totalGuessesInWins: 0,
        },
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 0,
        },
        coins: 100,
      };

      /** Provides mock user doc behavior. */
      const mockUserDoc = {
        exists: true,
        data: () => userWithoutPurchaseFlag,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockUserDoc);
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await ensureUserDocumentComplete(testUserId);

      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPurchasedApp: false,
        }),
      );
    });

    test("should throw and log error when Firestore fails", async () => {
      /** Provides test error behavior. */
      const testError = new Error("Firestore read failed");
      (mockDoc.get as jest.MockedFunction<any>).mockRejectedValue(testError);

      await expect(ensureUserDocumentComplete(testUserId)).rejects.toThrow("Firestore read failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error ensuring user document completeness for ${testUserId}:`,
        testError,
      );
    });
  });

  describe("appendUnlockedAchievements", () => {
    /** Provides test user id behavior. */
    const testUserId = "user-achievements-1";

    test("should do nothing when newEntries is empty", async () => {
      await appendUnlockedAchievements(testUserId, []);

      expect(mockDoc.get).not.toHaveBeenCalled();
      expect(mockDoc.update).not.toHaveBeenCalled();
    });

    test("should do nothing and warn when user document does not exist", async () => {
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue({exists: false});

      await appendUnlockedAchievements(testUserId, [{achievementId: "first_win", unlockedAt: 1000}]);

      expect(mockLogger.warn).toHaveBeenCalledWith(`Cannot append achievements: user ${testUserId} not found`);
      expect(mockDoc.update).not.toHaveBeenCalled();
    });

    test("should append new achievements when user exists and has no existing unlocks", async () => {
      /** Provides r data. */
      const userData = {unlockedAchievements: []};
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue({
        exists: true,
        data: () => userData,
      });
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      /** Provides new entries behavior. */
      const newEntries = [
        {achievementId: "first_win", unlockedAt: 1000},
        {achievementId: "wins_5", unlockedAt: 1001},
      ];

      await appendUnlockedAchievements(testUserId, newEntries);

      expect(mockDoc.update).toHaveBeenCalledTimes(1);
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          unlockedAchievements: expect.anything(),
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(`Appended 2 achievements for user ${testUserId}`);
    });

    test("should not duplicate already unlocked achievement ids", async () => {
      /** Provides r data. */
      const userData = {
        unlockedAchievements: [{achievementId: "first_win", unlockedAt: 999}],
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue({
        exists: true,
        data: () => userData,
      });
      (mockDoc.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await appendUnlockedAchievements(testUserId, [{achievementId: "first_win", unlockedAt: 1000}]);

      expect(mockDoc.update).not.toHaveBeenCalled();
    });
  });

  describe("getDailyRiddle", () => {
    /** Provides test riddle id behavior. */
    const testRiddleId = "daily123";

    test("should return undefined when data is null", async () => {
      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => null,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getDailyRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(`Daily riddle data is null for ID ${testRiddleId} in locale en`);
    });

    test("should return riddle data when daily riddle exists", async () => {
      /** Provides daily riddle data behavior. */
      const dailyRiddleData = {
        riddleId: testRiddleId,
        text: "A daily challenge",
        answer: "ANSWER",
        dailyIndex: 1,
      };

      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => dailyRiddleData,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getDailyRiddle(testRiddleId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("localizedRiddles/en/riddles");
      expect(result).toEqual({
        ...dailyRiddleData,
        locale: "en",
      });
    });
  });

  describe("getRiddle - localized lookup", () => {
    /** Provides test riddle id behavior. */
    const testRiddleId = "search123";

    test("should return classic riddle from the localized classic collection", async () => {
      /** Provides classic riddle data behavior. */
      const classicRiddleData = {
        riddleId: testRiddleId,
        text: "Classic riddle",
        answer: "CLASSIC",
        classicIndex: 0,
      };

      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => classicRiddleData,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(mockFirestore.collection).toHaveBeenCalledWith("localizedRiddles/en/riddles");
      expect(result).toEqual({
        ...classicRiddleData,
        locale: "en",
      });
    });

    test("should return undefined when riddle not found in the localized collection", async () => {
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue({exists: false});

      /** Provides result behavior. */
      const result = await getRiddle(testRiddleId);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Riddle document not found for ID ${testRiddleId} in any collection`,
      );
    });
  });

  describe("getRiddleByGameMode", () => {
    /** Provides test riddle id behavior. */
    const testRiddleId = "mode123";

    test("should fetch from classic collection for 'classic' game mode", async () => {
      /** Provides classic riddle data behavior. */
      const classicRiddleData = {
        riddleId: testRiddleId,
        text: "Classic riddle",
        answer: "WORD",
        classicIndex: 5,
      };

      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => classicRiddleData,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddleByGameMode(testRiddleId, "classic");

      expect(mockFirestore.collection).toHaveBeenCalledWith("localizedRiddles/en/riddles");
      expect(result).toEqual({
        ...classicRiddleData,
        locale: "en",
      });
    });

    test("should fetch from daily collection for 'challenge' game mode", async () => {
      /** Provides daily riddle data behavior. */
      const dailyRiddleData = {
        riddleId: testRiddleId,
        text: "Daily riddle",
        answer: "DAILY",
        dailyIndex: 2,
      };

      /** Provides mock riddle doc behavior. */
      const mockRiddleDoc = {
        exists: true,
        data: () => dailyRiddleData,
      };
      (mockDoc.get as jest.MockedFunction<any>).mockResolvedValue(mockRiddleDoc);

      /** Provides result behavior. */
      const result = await getRiddleByGameMode(testRiddleId, "challenge");

      expect(mockFirestore.collection).toHaveBeenCalledWith("localizedRiddles/en/riddles");
      expect(result).toEqual({
        ...dailyRiddleData,
        locale: "en",
      });
    });

    test("should return undefined and warn for unknown game mode", async () => {
      /** Provides result behavior. */
      const result = await getRiddleByGameMode(testRiddleId, "unknown" as any);

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown game mode: unknown");
    });
  });
});

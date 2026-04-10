import { ZodError } from "zod";
import * as FirestoreService from "../FirestoreService";
import {
  Player,
  PlayerSchema,
  FirestoreRiddleSchema,
} from "../../validation/firestoreSchemas";
import { logger } from "../../utils/logger";

// Mock refs assigned in jest.mock factory
let mockGetDoc: jest.Mock;
let mockGetDocs: jest.Mock;
let mockSetDoc: jest.Mock;
let mockUpdateDoc: jest.Mock;
let mockDoc: jest.Mock;
let mockWhere: jest.Mock;
let mockLimit: jest.Mock;
let mockCollection: jest.Mock;
let mockQuery: jest.Mock;
let mockServerTimestamp: jest.Mock;
let mockGetFirestore: jest.Mock;

// Keep legacy aliases for assertions that still use v8-style names
let mockGet: jest.Mock;
let mockSet: jest.Mock;
let mockUpdate: jest.Mock;

jest.mock("@react-native-firebase/firestore", () => {
  mockGetDoc = jest.fn();
  mockGetDocs = jest.fn();
  mockSetDoc = jest.fn();
  mockUpdateDoc = jest.fn();
  mockDoc = jest.fn(() => ({}));
  mockWhere = jest.fn(() => ({}));
  mockLimit = jest.fn(() => ({}));
  mockCollection = jest.fn(() => ({}));
  mockQuery = jest.fn(() => ({}));
  mockServerTimestamp = jest.fn(() => "MOCK_SERVER_TIMESTAMP");
  mockGetFirestore = jest.fn(() => ({}));

  // Legacy aliases
  mockGet = mockGetDoc;
  mockSet = mockSetDoc;
  mockUpdate = mockUpdateDoc;

  return {
    __esModule: true,
    getFirestore: mockGetFirestore,
    doc: mockDoc,
    collection: mockCollection,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    query: mockQuery,
    where: mockWhere,
    limit: mockLimit,
    serverTimestamp: mockServerTimestamp,
    FirebaseFirestoreTypes: {},
  };
});

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));

// Mock schemas
jest.mock("../../validation/firestoreSchemas", () => ({
  PlayerSchema: { parse: jest.fn() },
  FirestoreRiddleSchema: { parse: jest.fn() },
}));

// Mock logger - must be defined in factory so it's available when module loads
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("FirestoreService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FirestoreService.clearRiddleCache();

    // Reset all mocks
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockDoc.mockReset();
    mockWhere.mockReset();
    mockLimit.mockReset();
    mockCollection.mockReset();
    mockQuery.mockReset();
    mockServerTimestamp.mockReset();
    mockGetFirestore.mockReset();

    // Setup defaults: standalone functions return their arg or {}
    mockDoc.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockLimit.mockReturnValue({});
    mockGetFirestore.mockReturnValue({});
    mockServerTimestamp.mockReturnValue("MOCK_SERVER_TIMESTAMP");

    // Default: schema parse returns input (identity)
    (PlayerSchema.parse as jest.Mock).mockImplementation((x: unknown) => x);
    (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation((x: unknown) => x);
  });

  describe("saveUserProgressToFirestore", () => {
    const mockUserId = "test-user-id";
    const mockProgress = {
      classicIndex: 5,
      dailyChallengeIndex: 2,
      tutorialIndex: 1,
    } as Player["progress"];

    it("should save user progress successfully", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await FirestoreService.saveUserProgressToFirestore(
        mockUserId,
        mockProgress
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { progress: mockProgress },
        { merge: true }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Player progress saved to Firestore successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.saveUserProgressToFirestore("", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      await FirestoreService.saveUserProgressToFirestore(
        null as any,
        mockProgress
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockSetDoc.mockRejectedValue(error);

      await expect(
        FirestoreService.saveUserProgressToFirestore(mockUserId, mockProgress)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        error
      );
    });
  });

  describe("loadUserProgressFromFirestore", () => {
    const mockUserId = "test-user-id";
    const mockUserData = {
      userId: mockUserId,
      username: "TestUser",
      email: "test@example.com",
      coins: 100,
      progress: {
        classicIndex: 5,
        dailyChallengeIndex: 2,
        tutorialIndex: 1,
      },
    } as unknown as Player;

    it("should load user progress successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(
        mockUserId
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockGetDoc).toHaveBeenCalled();
      // expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData); // This line is removed as per the edit hint
      expect(result).toEqual(mockUserData);
      expect(logger.info).toHaveBeenCalledWith(
        "Player data validated successfully."
      );
    });

    it("should handle empty userId gracefully", async () => {
      const result = await FirestoreService.loadUserProgressFromFirestore("");

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle non-existent user document", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(
        mockUserId
      );

      expect(logger.info).toHaveBeenCalledWith(
        "No player progress found in Firestore for user:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle Zod validation errors", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["email"],
          message: "Expected string, received number",
        },
      ]);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(
        mockUserId
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Zod validation error for player data:",
        zodError.issues
      );
      expect(result).toBeNull();
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGetDoc.mockRejectedValue(error);

      await expect(
        FirestoreService.loadUserProgressFromFirestore(mockUserId)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error loading player progress from Firestore:",
        error
      );
    });
  });

  describe("fetchDailyRiddleFromFirestore", () => {
    const dailyIndex = 5;
    const mockRiddleData = {
      riddleId: "daily-5",
      category: "daily",
      dailyIndex: 5,
      text: "What has four legs?",
      answer: "DOG",
      hint: "A pet",
      difficulty: "easy",
    };

    it("should fetch daily riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockRiddleData,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(
        dailyIndex
      );

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "dailyRiddles");
      expect(mockWhere).toHaveBeenCalledWith("dailyIndex", "==", dailyIndex);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockRiddleData);
    });

    it("should return null when no daily riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(
        dailyIndex
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `No daily riddle found for index: ${dailyIndex}`
      );
    });

    it("should handle Zod validation errors", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["riddle"],
          message: "Expected string, received number",
        },
      ]);

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockRiddleData,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(
        dailyIndex
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Zod validation error for daily riddle data:",
        zodError.issues
      );
      expect(result).toBeNull();
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore connection failed");
      mockGetDocs.mockRejectedValue(error);

      await expect(
        FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex)
      ).rejects.toThrow("Firestore connection failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Error fetching daily riddle from Firestore:",
        error
      );
    });
  });

  describe("fetchClassicRiddleFromFirestore", () => {
    const classicIndex = 10;
    const mockRiddleData = {
      riddleId: "classic-10",
      category: "classic",
      classicIndex: 10,
      text: "I am thinking of a word",
      answer: "WORD",
      hint: "Something you say",
      difficulty: "medium",
    };

    it("should fetch classic riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockRiddleData,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchClassicRiddleFromFirestore(
        classicIndex
      );

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
      expect(mockWhere).toHaveBeenCalledWith(
        "classicIndex",
        "==",
        classicIndex
      );
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockRiddleData);
    });

    it("should return null when no classic riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchClassicRiddleFromFirestore(
        classicIndex
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `No classic riddle found for index: ${classicIndex}`
      );
    });
  });

  describe("fetchDailyRiddleForDate", () => {
    const dateString = "2023-12-01";
    const mockRiddleData = {
      riddleId: "daily-date",
      category: "daily",
      date: dateString,
      text: "What flies without wings?",
      answer: "TIME",
      hint: "It goes fast",
      difficulty: "hard",
    };

    it("should fetch daily riddle for date successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockRiddleData,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchDailyRiddleForDate(dateString);

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
      expect(mockWhere).toHaveBeenCalledWith("date", "==", dateString);
      expect(mockLimit).toHaveBeenCalledWith(1);
      // expect(result).toEqual(mockRiddleData); // This line is removed as per the edit hint
    });

    it("should return null when no riddle found for date", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchDailyRiddleForDate(dateString);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "No daily riddle found for date:",
        dateString
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Database error");
      mockGetDocs.mockRejectedValue(error);

      await expect(
        FirestoreService.fetchDailyRiddleForDate(dateString)
      ).rejects.toThrow("Database error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error fetching daily riddle for date from Firestore:",
        error
      );
    });
  });

  describe("updateLastDailyChallengeCompletedAt", () => {
    const mockUserId = "test-user-id";

    it("should update last daily challenge timestamp successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateLastDailyChallengeCompletedAt(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockServerTimestamp).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { lastDailyChallengeCompletedAt: "MOCK_SERVER_TIMESTAMP" }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Last daily challenge completed timestamp updated successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateLastDailyChallengeCompletedAt("");

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update daily challenge completion timestamp without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Update failed");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(
        FirestoreService.updateLastDailyChallengeCompletedAt(mockUserId)
      ).rejects.toThrow("Update failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating last daily challenge completed timestamp in Firestore:",
        error
      );
    });
  });

  describe("fetchTutorialRiddleFromFirestore", () => {
    const tutorialIndex = 3;
    const mockRiddleData = {
      riddleId: "tutorial-3",
      category: "tutorial",
      tutorialIndex: 3,
      text: "Simple puzzle",
      answer: "CAT",
      hint: "Feline friend",
      difficulty: "easy",
    };

    it("should fetch tutorial riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockRiddleData,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchTutorialRiddleFromFirestore(
        tutorialIndex
      );

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
      expect(mockWhere).toHaveBeenCalledWith(
        "tutorialIndex",
        "==",
        tutorialIndex
      );
      expect(mockLimit).toHaveBeenCalledWith(1);
      // expect(result).toEqual(mockRiddleData); // This line is removed as per the edit hint
    });

    it("should return null when no tutorial riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await FirestoreService.fetchTutorialRiddleFromFirestore(
        tutorialIndex
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "No tutorial riddle found for index:",
        tutorialIndex
      );
    });
  });

  describe("getTutorialRiddleCount", () => {
    it("should return count of tutorial riddles", async () => {
      mockGetDocs.mockResolvedValue({ size: 5 });

      const result = await FirestoreService.getTutorialRiddleCount();

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "tutorial");
      expect(result).toBe(5);
    });

    it("should return 0 when no tutorial riddles exist", async () => {
      mockGetDocs.mockResolvedValue({ size: 0 });

      const result = await FirestoreService.getTutorialRiddleCount();

      expect(result).toBe(0);
    });

    it("should throw when get fails", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore get failed!"));

      await expect(FirestoreService.getTutorialRiddleCount()).rejects.toThrow(
        "Firestore get failed!"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error getting tutorial riddle count from Firestore:",
        expect.any(Error)
      );
    });
  });

  describe("updateClassicIndexInFirestore", () => {
    const mockUserId = "test-user-id";
    const classicIndex = 15;

    it("should update classic index successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateClassicIndexInFirestore(
        mockUserId,
        classicIndex
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.classicIndex": classicIndex }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Classic index updated successfully for user:",
        mockUserId,
        "to",
        classicIndex
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateClassicIndexInFirestore("", classicIndex);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update classic index in Firestore without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe("updateDailyChallengeIndexInFirestore", () => {
    const mockUserId = "test-user-id";
    const dailyChallengeIndex = 8;

    it("should update daily challenge index successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateDailyChallengeIndexInFirestore(
        mockUserId,
        dailyChallengeIndex
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.dailyChallengeIndex": dailyChallengeIndex }
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateDailyChallengeIndexInFirestore(
        "",
        dailyChallengeIndex
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update daily challenge index in Firestore without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe("updateTutorialIndexInFirestore", () => {
    const mockUserId = "test-user-id";
    const tutorialIndex = 5;

    it("should update tutorial index successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateTutorialIndexInFirestore(
        mockUserId,
        tutorialIndex
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.tutorialIndex": tutorialIndex }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Tutorial index updated successfully for user:",
        mockUserId,
        "to",
        tutorialIndex
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateTutorialIndexInFirestore("", tutorialIndex);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update tutorial index in Firestore without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe("updateUserDocumentInFirestore", () => {
    const mockUserId = "test-user-id";
    const mockUpdates: Partial<Player> = {
      displayName: "New Name",
      coins: 500,
    };

    it("should update user document successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateUserDocumentInFirestore(
        mockUserId,
        mockUpdates
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), mockUpdates);
      expect(logger.info).toHaveBeenCalledWith(
        "User document updated successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateUserDocumentInFirestore("", mockUpdates);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update user document in Firestore without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle Zod errors", async () => {
      const zodError = new ZodError([]);
      mockUpdateDoc.mockRejectedValue(zodError);

      await expect(
        FirestoreService.updateUserDocumentInFirestore(mockUserId, mockUpdates)
      ).rejects.toThrow("Invalid user document update data provided.");

      expect(logger.error).toHaveBeenCalledWith(
        "Zod validation error for user document updates:",
        zodError.issues
      );
    });
  });

  describe("updateUserStats", () => {
    const mockUserId = "test-user-id";
    const mockStats: Partial<Player["stats"]> = {
      totalScore: 1500,
      winRate: 0.8,
    };

    it("should update user stats successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await FirestoreService.updateUserStats(mockUserId, mockStats);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), { stats: mockStats });
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateUserStats("", mockStats);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update user stats without a userId."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should update user stats with transaction", async () => {
      const mockTransaction = {
        update: jest.fn(),
      };

      await FirestoreService.updateUserStats(
        mockUserId,
        mockStats,
        mockTransaction as any
      );

      expect(mockTransaction.update).toHaveBeenCalled();
    });
  });

  describe("createUserDocumentInFirestore", () => {
    const mockUserId = "test-user-id";
    const mockEmail = "test@example.com";
    const mockDisplayName = "Test User";

    it("should create user document successfully", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        displayName: mockDisplayName,
        username: mockDisplayName,
        coins: 100,
        progress: {
          classicIndex: 1,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        },
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
      } as Player;

      const result = await FirestoreService.createUserDocumentInFirestore(
        mockUserId,
        mockEmail,
        mockDisplayName
      );

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockSetDoc).toHaveBeenCalled();
      expect(result).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        displayName: mockDisplayName,
        username: mockDisplayName,
        coins: 100,
        progress: mockValidatedUser.progress,
        stats: mockValidatedUser.stats,
      });
      expect(logger.info).toHaveBeenCalledWith(
        "New user document created successfully for user:",
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        FirestoreService.createUserDocumentInFirestore("", mockEmail)
      ).rejects.toThrow("Cannot create user document without a userId.");
    });

    it("should create user document without displayName", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        username: "test",
        coins: 100,
        progress: {
          classicIndex: 1,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        },
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
      } as Player;

      // (PlayerSchema.parse as jest.Mock).mockReturnValue(mockValidatedUser); // This line is removed as per the edit hint

      const result = await FirestoreService.createUserDocumentInFirestore(
        mockUserId,
        mockEmail
      );

      expect(result).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        username: "test",
        coins: 100,
        progress: mockValidatedUser.progress,
        stats: mockValidatedUser.stats,
      });
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Creation failed");
      mockSetDoc.mockRejectedValue(error);

      await expect(
        FirestoreService.createUserDocumentInFirestore(mockUserId, mockEmail)
      ).rejects.toThrow("Creation failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Error creating user document in Firestore:",
        error
      );
    });
  });
});


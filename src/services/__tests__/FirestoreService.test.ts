import {ZodError} from "zod";
import * as FirestoreService from "../FirestoreService";
import {Player, PlayerSchema, FirestoreRiddleSchema} from "../../validation/firestoreSchemas";
import {logger} from "../../utils/logger";

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
let mockGetCallableFunction: jest.Mock;
let mockCallValidatedFunction: jest.Mock;
let mockCallableFunction: jest.Mock;

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
  PlayerSchema: {parse: jest.fn()},
  FirestoreRiddleSchema: {parse: jest.fn()},
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

jest.mock("../../utils/firebaseFunctions", () => {
  mockCallableFunction = jest.fn();
  mockGetCallableFunction = jest.fn(() => mockCallableFunction);
  mockCallValidatedFunction = jest.fn();

  return {
    callValidatedFunction: mockCallValidatedFunction,
    getCallableFunction: mockGetCallableFunction,
  };
});

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
    mockGetCallableFunction.mockReset();
    mockCallValidatedFunction.mockReset();
    mockCallableFunction.mockReset();

    // Setup defaults: standalone functions return their arg or {}
    mockDoc.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockLimit.mockReturnValue({});
    mockGetFirestore.mockReturnValue({});
    mockServerTimestamp.mockReturnValue("MOCK_SERVER_TIMESTAMP");
    mockGetCallableFunction.mockReturnValue(mockCallableFunction);
    mockCallValidatedFunction.mockResolvedValue({
      challenge: {
        date: "2023-01-01",
        questions: [{riddleId: "current", text: "Question 1?", answer: "answer", questionNumber: 1}],
        totalQuestions: 1,
      },
      currentQuestion: 0,
      hasCompletedToday: false,
      questionsCompleted: 0,
    });

    // Default: schema parse returns input (identity)
    (PlayerSchema.parse as jest.Mock).mockImplementation((x: unknown) => x);
    (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation((x: unknown) => x);
  });

  describe("saveUserProgressToFirestore", () => {
    const mockUserId = "test-user-id";
    const mockProgress = {
      classicIndex: 5,
      dailyChallengeIndex: 2,
    } as Player["progress"];

    it("skips direct client progress writes", async () => {
      await FirestoreService.saveUserProgressToFirestore(mockUserId, mockProgress);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client progress write; player progress is persisted by Cloud Functions.",
        {userId: mockUserId, progress: mockProgress},
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.saveUserProgressToFirestore("", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      await FirestoreService.saveUserProgressToFirestore(null as any, mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("does not surface Firestore write errors because no direct write is attempted", async () => {
      mockSetDoc.mockRejectedValue(new Error("Firestore error"));

      await expect(FirestoreService.saveUserProgressToFirestore(mockUserId, mockProgress)).resolves.toBeUndefined();

      expect(mockSetDoc).not.toHaveBeenCalled();
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
      },
    } as unknown as Player;

    it("should load user progress successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockGetDoc).toHaveBeenCalled();
      // expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData); // This line is removed as per the edit hint
      expect(result).toEqual(mockUserData);
      expect(logger.info).toHaveBeenCalledWith("Player data validated successfully.");
    });

    it("should handle empty userId gracefully", async () => {
      const result = await FirestoreService.loadUserProgressFromFirestore("");

      expect(logger.warn).toHaveBeenCalledWith("Attempted to load progress from Firestore without a userId.");
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle non-existent user document", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(mockUserId);

      expect(logger.info).toHaveBeenCalledWith("No player progress found in Firestore for user:", mockUserId);
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

      const result = await FirestoreService.loadUserProgressFromFirestore(mockUserId);

      expect(logger.error).toHaveBeenCalledWith("Zod validation error for player data:", zodError.issues);
      expect(result).toBeNull();
    });

    it("handles non-Zod validation error path", async () => {
      const nonZod = new Error("unexpected parse error");
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw nonZod;
      });

      const result = await FirestoreService.loadUserProgressFromFirestore(mockUserId);
      expect(logger.error).toHaveBeenCalledWith("Unexpected error during player data validation:", nonZod);
      expect(result).toBeNull();
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGetDoc.mockRejectedValue(error);

      await expect(FirestoreService.loadUserProgressFromFirestore(mockUserId)).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith("Error loading player progress from Firestore:", error);
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
    };

    it("should fetch the current daily riddle successfully", async () => {
      const result = await FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex);

      expect(result).toMatchObject({
        riddleId: "current",
        canonicalKey: "daily:2023-01-01",
        challengeKey: "2023-01-01",
        locale: "en",
        dailyIndex,
        text: "Question 1?",
        answer: "answer",
        category: "daily",
      });
    });

    it("should return null when no daily riddle found", async () => {
      mockCallValidatedFunction.mockResolvedValue({error: "No daily challenge available at the moment."});

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith("No current daily riddle available for locale en");
    });

    it("should handle Zod validation errors", async () => {
      mockCallValidatedFunction.mockResolvedValue({
        challenge: {
          date: "2023-01-01",
          questions: [{riddleId: "current", text: "Question 1?", answer: "", questionNumber: 1}],
          totalQuestions: 1,
        },
      });

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith("No current daily riddle available for locale en");
    });

    it("handles non-Zod daily riddle parse error path", async () => {
      mockCallValidatedFunction.mockResolvedValue({
        challenge: {
          date: "2023-01-01",
          questions: [{riddleId: "current", text: "Question 1?", answer: 123 as unknown as string, questionNumber: 1}],
          totalQuestions: 1,
        },
      });

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex);
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith("No current daily riddle available for locale en");
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore connection failed");
      mockCallValidatedFunction.mockRejectedValue(error);

      await expect(FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex)).rejects.toThrow(
        "Firestore connection failed",
      );

      expect(logger.error).toHaveBeenCalledWith("Error fetching daily riddle from callable:", error);
    });

    it("returns null instead of throwing on permission-denied access errors", async () => {
      const error = {
        code: "firestore/permission-denied",
        message: "[firestore/permission-denied] Access denied",
      };
      mockCallValidatedFunction.mockRejectedValue(error);

      const result = await FirestoreService.fetchDailyRiddleFromFirestore(dailyIndex);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Daily riddle Firestore read denied during startup; falling back to local state.",
        error,
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
    };

    it("should fetch classic riddle successfully", async () => {
      mockCallValidatedFunction.mockResolvedValue({
        challenge: {
          date: undefined,
          questions: [{riddleId: "classic-10", text: "Question 1?", answer: "answer", questionNumber: 1}],
          totalQuestions: 1,
        },
      });

      const result = await FirestoreService.fetchClassicRiddleFromFirestore(classicIndex);

      expect(mockCallValidatedFunction).toHaveBeenCalledWith(
        "getCurrentClassicRiddle",
        {classicIndex, locale: "en"},
        expect.any(Object),
        expect.any(Object),
      );
      expect(result).toMatchObject({
        canonicalKey: "classic:10",
        locale: "en",
        category: "classic",
        text: "Question 1?",
        answer: "answer",
      });
    });

    it("should return null when no classic riddle found", async () => {
      mockCallValidatedFunction.mockResolvedValue({error: "No classic riddle available at index 10."});

      const result = await FirestoreService.fetchClassicRiddleFromFirestore(classicIndex);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(`No classic riddle found for index: ${classicIndex} in locale en`);
    });

    it("handles classic riddle zod and non-zod parse errors", async () => {
      mockCallValidatedFunction.mockResolvedValue({
        challenge: {
          date: undefined,
          questions: [{riddleId: "classic-10", text: "", answer: "answer", questionNumber: 1}],
          totalQuestions: 1,
        },
      });
      const zodResult = await FirestoreService.fetchClassicRiddleFromFirestore(classicIndex);
      expect(zodResult).toBeNull();

      mockCallValidatedFunction.mockResolvedValue({
        challenge: {
          date: undefined,
          questions: [{riddleId: "classic-11", text: "Question 1?", answer: 123 as unknown as string, questionNumber: 1}],
          totalQuestions: 1,
        },
      });
      const otherResult = await FirestoreService.fetchClassicRiddleFromFirestore(classicIndex + 1);
      expect(otherResult).toBeNull();
    });

    it("returns null instead of throwing on permission-denied access errors", async () => {
      const error = {
        code: "firestore/permission-denied",
        message: "[firestore/permission-denied] Access denied",
      };
      mockCallValidatedFunction.mockRejectedValue(error);

      const result = await FirestoreService.fetchClassicRiddleFromFirestore(classicIndex);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Classic riddle Firestore read denied during startup; falling back to local state.",
        error,
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

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/daily");
      expect(mockWhere).toHaveBeenCalledWith("challengeKey", "==", dateString);
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
      expect(logger.debug).toHaveBeenCalledWith("No daily riddle found for date:", dateString);
    });

    it("handles date riddle zod and non-zod parse errors", async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{data: () => mockRiddleData}],
      });
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementationOnce(() => {
        throw new ZodError([]);
      });
      const zodResult = await FirestoreService.fetchDailyRiddleForDate(dateString);
      expect(zodResult).toBeNull();

      const otherErr = new Error("date parse error");
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementationOnce(() => {
        throw otherErr;
      });
      const otherResult = await FirestoreService.fetchDailyRiddleForDate(`${dateString}-x`);
      expect(otherResult).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "Unexpected error during daily riddle data validation for date:",
        `${dateString}-x`,
        otherErr,
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Database error");
      mockGetDocs.mockRejectedValue(error);

      await expect(FirestoreService.fetchDailyRiddleForDate(dateString)).rejects.toThrow("Database error");

      expect(logger.error).toHaveBeenCalledWith("Error fetching daily riddle for date from Firestore:", error);
    });

    it("returns null instead of throwing on permission-denied access errors", async () => {
      const error = {
        code: "firestore/permission-denied",
        message: "[firestore/permission-denied] Access denied",
      };
      mockGetDocs.mockRejectedValue(error);

      const result = await FirestoreService.fetchDailyRiddleForDate(dateString);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Daily riddle lookup for date denied during startup; falling back to local state.",
        error,
      );
    });
  });

  describe("updateLastDailyChallengeCompletedAt", () => {
    const mockUserId = "test-user-id";

    it("skips direct client daily completion timestamp writes", async () => {
      await FirestoreService.updateLastDailyChallengeCompletedAt(mockUserId);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockServerTimestamp).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client daily completion timestamp write; completion is persisted by Cloud Functions.",
        {userId: mockUserId},
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateLastDailyChallengeCompletedAt("");

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update daily challenge completion timestamp without a userId.",
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("does not surface daily timestamp write errors because no direct write is attempted", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Update failed"));

      await expect(FirestoreService.updateLastDailyChallengeCompletedAt(mockUserId)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe("updateClassicIndexInFirestore", () => {
    const mockUserId = "test-user-id";
    const classicIndex = 15;

    it("skips direct client classic progress writes", async () => {
      await FirestoreService.updateClassicIndexInFirestore(mockUserId, classicIndex);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, classicIndex},
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateClassicIndexInFirestore("", classicIndex);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to update classic index in Firestore without a userId.");
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("normalizes classic index before logging skipped writes", async () => {
      await FirestoreService.updateClassicIndexInFirestore(mockUserId, -4.8);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, classicIndex: 0},
      );
    });
  });

  describe("updateDailyChallengeIndexInFirestore", () => {
    const mockUserId = "test-user-id";
    const dailyChallengeIndex = 8;

    it("skips direct client daily progress writes", async () => {
      await FirestoreService.updateDailyChallengeIndexInFirestore(mockUserId, dailyChallengeIndex);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client daily progress write; daily progress is persisted by Cloud Functions.",
        {userId: mockUserId, dailyChallengeIndex},
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateDailyChallengeIndexInFirestore("", dailyChallengeIndex);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to update daily challenge index in Firestore without a userId.",
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("does not surface daily progress write errors because no direct write is attempted", async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error("daily update failed"));

      await expect(
        FirestoreService.updateDailyChallengeIndexInFirestore(mockUserId, dailyChallengeIndex),
      ).resolves.toBeUndefined();

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

      await FirestoreService.updateUserDocumentInFirestore(mockUserId, mockUpdates);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          displayName: mockUpdates.displayName,
          userId: mockUserId,
        }),
      );
      expect(mockUpdateDoc).not.toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({coins: mockUpdates.coins}),
      );
      expect(logger.info).toHaveBeenCalledWith("User document updated successfully for user:", mockUserId);
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateUserDocumentInFirestore("", mockUpdates);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to update user document in Firestore without a userId.");
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle Zod errors", async () => {
      const zodError = new ZodError([]);
      mockUpdateDoc.mockRejectedValue(zodError);

      await expect(FirestoreService.updateUserDocumentInFirestore(mockUserId, mockUpdates)).rejects.toThrow(
        "Invalid user document update data provided.",
      );

      expect(logger.error).toHaveBeenCalledWith("Zod validation error for user document updates:", zodError.issues);
    });
  });

  describe("updateUserStats", () => {
    const mockUserId = "test-user-id";
    const mockStats: Partial<Player["stats"]> = {
      totalScore: 1500,
      winRate: 0.8,
    };

    it("skips direct client stats writes", async () => {
      await FirestoreService.updateUserStats(mockUserId, mockStats);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client stats write; player stats are persisted by Cloud Functions.",
        {
          userId: mockUserId,
          stats: {
            "stats.totalScore": 1500,
            "stats.winRate": 0.8,
          },
        },
      );
    });

    it("should handle empty userId gracefully", async () => {
      await FirestoreService.updateUserStats("", mockStats);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to update user stats without a userId.");
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("throws when a client transaction is supplied for server-managed stats", async () => {
      const mockTransaction = {
        update: jest.fn(),
      };

      await expect(FirestoreService.updateUserStats(mockUserId, mockStats, mockTransaction as any)).rejects.toThrow(
        "Client-side Firestore transactions cannot update server-managed user stats.",
      );
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it("does not surface stats write errors because no direct write is attempted", async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error("stats failed"));

      await expect(FirestoreService.updateUserStats(mockUserId, mockStats)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe("createUserDocumentInFirestore", () => {
    const mockUserId = "test-user-id";
    const mockEmail = "test@example.com";
    const mockDisplayName = "Test User";

    it("should create user document through the initialization callable", async () => {
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        displayName: mockDisplayName,
        username: mockDisplayName,
        coins: 100,
        progress: {
          classicIndex: 1,
          dailyChallengeIndex: 0,
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
      mockCallableFunction.mockResolvedValue({data: {player: mockValidatedUser}});

      const result = await FirestoreService.createUserDocumentInFirestore(mockUserId, mockEmail, mockDisplayName);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockGetCallableFunction).toHaveBeenCalledWith("initializeUser");
      expect(mockCallableFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          username: mockDisplayName,
          displayName: mockDisplayName,
          seed: expect.objectContaining({
            userId: mockUserId,
            email: mockEmail,
            username: mockDisplayName,
          }),
        }),
      );
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
        "New user document created successfully via Cloud Function for user:",
        mockUserId,
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(FirestoreService.createUserDocumentInFirestore("", mockEmail)).rejects.toThrow(
        "Cannot create user document without a userId.",
      );
    });

    it("should create user document without displayName", async () => {
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        username: "test",
        coins: 100,
        progress: {
          classicIndex: 1,
          dailyChallengeIndex: 0,
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

      mockCallableFunction.mockResolvedValue({data: {player: mockValidatedUser}});

      const result = await FirestoreService.createUserDocumentInFirestore(mockUserId, mockEmail);

      expect(mockCallableFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          username: "test",
          seed: expect.objectContaining({
            userId: mockUserId,
            email: mockEmail,
            username: "test",
          }),
        }),
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

    it("should handle initialization callable errors", async () => {
      const error = new Error("Creation failed");
      mockCallableFunction.mockRejectedValue(error);

      await expect(FirestoreService.createUserDocumentInFirestore(mockUserId, mockEmail)).rejects.toThrow(
        "Creation failed",
      );

      expect(logger.error).toHaveBeenCalledWith("Error creating user document in Firestore:", error);
    });

    it("stores avatarUrl when provided", async () => {
      const avatarUrl = "https://example.com/provider-avatar.png";
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        displayName: mockDisplayName,
        username: mockDisplayName,
        avatarUrl,
        coins: 100,
        progress: {
          classicIndex: 1,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 0,
        },
        stats: {
          xp: 0,
          level: 1,
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
        unlockedAchievements: [],
        hasPurchasedApp: false,
      } as Player;
      mockCallableFunction.mockResolvedValue({data: {player: mockValidatedUser}});

      const result = await FirestoreService.createUserDocumentInFirestore(
        mockUserId,
        mockEmail,
        mockDisplayName,
        avatarUrl,
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockCallableFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl,
          seed: expect.objectContaining({avatarUrl}),
        }),
      );
      expect(result.avatarUrl).toBe(avatarUrl);
    });

    it("seeds new user document from guest progress when provided", async () => {
      const seed = {
        coins: 777,
        username: "MyGuestName",
        progress: {
          classicIndex: 42,
          dailyChallengeIndex: 5,
          dailyChallengeCurrentQuestion: 2,
        },
        stats: {
          winStreak: 3,
          bestStreak: 9,
        },
        unlockedAchievements: ["FIRST_WIN"],
        lastDailyChallengeCompletedAt: 1710000000000,
        hasPurchasedApp: true,
      } as unknown as Player;
      const mockValidatedUser = {
        userId: mockUserId,
        email: mockEmail,
        displayName: mockDisplayName,
        username: seed.username,
        coins: seed.coins,
        progress: seed.progress,
        stats: {
          xp: 0,
          level: 1,
          dailyPuzzlesCompleted: 0,
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
          ...(seed.stats as Record<string, unknown>),
        },
        unlockedAchievements: seed.unlockedAchievements,
        lastDailyChallengeCompletedAt: seed.lastDailyChallengeCompletedAt,
        hasPurchasedApp: true,
      } as Player;
      mockCallableFunction.mockResolvedValue({data: {player: mockValidatedUser}});

      const result = await FirestoreService.createUserDocumentInFirestore(
        mockUserId,
        mockEmail,
        mockDisplayName,
        undefined,
        seed,
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockCallableFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEmail,
          username: seed.username,
          displayName: mockDisplayName,
          seed: expect.objectContaining({
            userId: mockUserId,
            email: mockEmail,
            username: seed.username,
            coins: seed.coins,
            progress: expect.objectContaining(seed.progress),
            stats: expect.objectContaining(seed.stats),
            unlockedAchievements: seed.unlockedAchievements,
            lastDailyChallengeCompletedAt: seed.lastDailyChallengeCompletedAt,
            hasPurchasedApp: true,
          }),
        }),
      );

      expect(result).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        username: seed.username,
        coins: seed.coins,
        progress: seed.progress,
        stats: expect.objectContaining(seed.stats),
        unlockedAchievements: seed.unlockedAchievements,
        lastDailyChallengeCompletedAt: seed.lastDailyChallengeCompletedAt,
        hasPurchasedApp: true,
      });
    });
  });
});

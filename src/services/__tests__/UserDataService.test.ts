import { UserDataService } from "../UserDataService";
import { getFirestore } from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { Player, PlayerSchema } from "../../validation/firestoreSchemas";
import { ZodError } from "zod";
import { logger } from "../../utils/logger";

// Mock refs assigned in jest.mock factory (must use let for hoisting)
let mockGetDoc: jest.Mock;
let mockSetDoc: jest.Mock;
let mockUpdateDoc: jest.Mock;
let mockDoc: jest.Mock;
let mockGetFirestore: jest.Mock;

// Legacy aliases for assertions still referencing old names
let mockGet: jest.Mock;
let mockSet: jest.Mock;
let mockUpdate: jest.Mock;
let mockCollection: jest.Mock;

jest.mock("@react-native-firebase/firestore", () => {
  mockGetDoc = jest.fn();
  mockSetDoc = jest.fn();
  mockUpdateDoc = jest.fn();
  mockDoc = jest.fn(() => ({}));
  mockGetFirestore = jest.fn(() => ({}));

  // Legacy aliases
  mockGet = mockGetDoc;
  mockSet = mockSetDoc;
  mockUpdate = mockUpdateDoc;
  mockCollection = jest.fn(() => ({}));

  return {
    __esModule: true,
    getFirestore: mockGetFirestore,
    doc: mockDoc,
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    collection: mockCollection,
    default: jest.fn(() => ({})),
  };
});

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));

// Mock PlayerSchema
jest.mock("../../validation/firestoreSchemas", () => ({
  PlayerSchema: {
    parse: jest.fn(),
  },
}));

// Mock logger (UserDataService uses logger, not console)
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("UserDataService", () => {
  let userDataService: UserDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    (logger.info as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();
    (logger.error as jest.Mock).mockClear();
    userDataService = new UserDataService();

    // Reset standalone mock functions
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockUpdateDoc.mockReset();
    mockDoc.mockReset();

    // Setup defaults: doc() returns a docRef placeholder
    mockDoc.mockReturnValue({});
    mockGetFirestore.mockReturnValue({});
  });

  describe("saveUserProgress", () => {
    const mockUserId = "test-user-id";
    const mockProgress = {
      classicIndex: 5,
      dailyChallengeIndex: 2,
      tutorialIndex: 1,
    } as Player["progress"];

    it("should save user progress successfully", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await userDataService.saveUserProgress(mockUserId, mockProgress);

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
      await userDataService.saveUserProgress("", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      await userDataService.saveUserProgress(null as any, mockProgress);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      await userDataService.saveUserProgress(undefined as any, mockProgress);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      await userDataService.saveUserProgress("   ", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should save progress with zero values", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const zeroProgress = {
        classicIndex: 0,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, zeroProgress);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { progress: zeroProgress },
        { merge: true }
      );
    });

    it("should save progress with large values", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const largeProgress = {
        classicIndex: 999999,
        dailyChallengeIndex: 888888,
        tutorialIndex: 777777,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, largeProgress);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { progress: largeProgress },
        { merge: true }
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockSetDoc.mockRejectedValue(error);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockSetDoc.mockRejectedValue(permissionError);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockSetDoc.mockRejectedValue(networkError);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        networkError
      );
    });
  });

  describe("loadUserProgress", () => {
    const mockUserId = "test-user-id";
    const mockUserData = {
      userId: mockUserId,
      username: "TestUser",
      coins: 100,
      stats: {
        dailyPuzzlesCompleted: 5,
        bestStreak: 3,
        totalWordsGuessed: 25,
        winRate: 0.8,
        averageGuesses: 4.2,
        totalScore: 1500,
        totalClassicGamesPlayed: 10,
        totalClassicGamesWon: 8,
        totalDailyChallengeGamesPlayed: 5,
        totalDailyChallengeGamesWon: 4,
        totalGuesses: 100,
        totalGuessesInWins: 80,
      },
      progress: {
        classicIndex: 5,
        dailyChallengeIndex: 2,
      dailyChallengeCurrentQuestion: 0,
        tutorialIndex: 1,
      },
      preferences: {
        soundEnabled: true,
        hapticsEnabled: true,
        theme: "light",
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    } as unknown as Player;

    it("should load user progress successfully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockGetDoc).toHaveBeenCalled();
      expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockUserData);
      expect(logger.info).toHaveBeenCalledWith(
        "User progress loaded successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("");

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(null as any);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(undefined as any);

      expect(logger.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("   ");

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

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.info).toHaveBeenCalledWith(
        "No user document found for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with no data", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => null,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.warn).toHaveBeenCalledWith(
        "User document exists but has no data for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with undefined data", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => undefined,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.warn).toHaveBeenCalledWith(
        "User document exists but has no data for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with empty object data", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["userId"],
          message: "Required",
        },
      ]);

      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Invalid user data structure in Firestore");

      expect(logger.error).toHaveBeenCalledWith(
        "User data validation failed:",
        zodError.issues
      );
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

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Invalid user data structure in Firestore");

      expect(logger.error).toHaveBeenCalledWith(
        "User data validation failed:",
        zodError.issues
      );
    });

    it("should handle complex Zod validation errors", async () => {
      const complexZodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["username"],
          message: "Expected string, received number",
        },
        {
          code: "too_small",
          minimum: 0,
          origin: "number",
          inclusive: true,
          exact: false,
          path: ["coins"],
          message: "Number must be greater than or equal to 0",
        },
      ]);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw complexZodError;
      });

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Invalid user data structure in Firestore");

      expect(logger.error).toHaveBeenCalledWith(
        "User data validation failed:",
        complexZodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGetDoc.mockRejectedValue(error);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error loading user progress from Firestore:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGetDoc.mockRejectedValue(permissionError);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error loading user progress from Firestore:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGetDoc.mockRejectedValue(networkError);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error loading user progress from Firestore:",
        networkError
      );
    });
  });

  describe("createUserDocument", () => {
    const mockUserId = "test-user-id";
    const mockUserData = {
      userId: mockUserId,
      username: "TestUser",
      coins: 50,
      stats: {
        dailyPuzzlesCompleted: 0,
        bestStreak: 0,
        totalWordsGuessed: 0,
        winRate: 0,
        averageGuesses: 0,
        totalScore: 0,
        totalClassicGamesPlayed: 0,
        totalClassicGamesWon: 0,
        totalDailyChallengeGamesPlayed: 0,
        totalDailyChallengeGamesWon: 0,
        totalGuesses: 0,
        totalGuessesInWins: 0,
      },
      progress: {
        classicIndex: 0,
        dailyChallengeIndex: 0,
      dailyChallengeCurrentQuestion: 0,
        tutorialIndex: 0,
      },
      preferences: {
        soundEnabled: true,
        hapticsEnabled: true,
        theme: "light",
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    } as unknown as Player;

    it("should create user document successfully", async () => {
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSetDoc.mockResolvedValue(undefined);

      await userDataService.createUserDocument(mockUserId, mockUserData);

      expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData);
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockSetDoc).toHaveBeenCalledWith(expect.any(Object), mockUserData);
      expect(logger.info).toHaveBeenCalledWith(
        "User document created successfully for user:",
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.createUserDocument("", mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.createUserDocument(null as any, mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.createUserDocument(undefined as any, mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(
        userDataService.createUserDocument("   ", mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle Zod validation errors during creation", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["email"],
          message: "Expected string, received number",
        },
      ]);

      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Invalid user data provided for creation");

      expect(logger.error).toHaveBeenCalledWith(
        "User data validation failed during creation:",
        zodError.issues
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle complex Zod validation errors during creation", async () => {
      const complexZodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["username"],
          message: "Expected string, received number",
        },
        {
          code: "too_small",
          minimum: 0,
          origin: "number",
          inclusive: true,
          exact: false,
          path: ["coins"],
          message: "Number must be greater than or equal to 0",
        },
      ]);

      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw complexZodError;
      });

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Invalid user data provided for creation");

      expect(logger.error).toHaveBeenCalledWith(
        "User data validation failed during creation:",
        complexZodError.issues
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle Firestore errors during creation", async () => {
      const error = new Error("Firestore error");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSetDoc.mockRejectedValue(error);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error creating user document:",
        error
      );
    });

    it("should handle Firestore permission errors during creation", async () => {
      const permissionError = new Error("Permission denied");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSetDoc.mockRejectedValue(permissionError);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error creating user document:",
        permissionError
      );
    });

    it("should handle Firestore network errors during creation", async () => {
      const networkError = new Error("Network unavailable");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSetDoc.mockRejectedValue(networkError);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error creating user document:",
        networkError
      );
    });
  });

  describe("updateUserDocument", () => {
    const mockUserId = "test-user-id";
    const mockUpdates: Partial<Player> = {
      displayName: "Updated Name",
      progress: {
        classicIndex: 10,
        dailyChallengeIndex: 3,
      dailyChallengeCurrentQuestion: 0,
        tutorialIndex: 2,
      },
    };

    it("should update user document successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, mockUpdates);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), mockUpdates);
      expect(logger.info).toHaveBeenCalledWith(
        "User document updated successfully for user:",
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateUserDocument("", mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateUserDocument(null as any, mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateUserDocument(undefined as any, mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(
        userDataService.updateUserDocument("   ", mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle empty updates object", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, {});

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), {});
      expect(logger.info).toHaveBeenCalledWith(
        "User document updated successfully for user:",
        mockUserId
      );
    });

    it("should handle single field updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const singleUpdate = { coins: 150 };

      await userDataService.updateUserDocument(mockUserId, singleUpdate);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), singleUpdate);
    });

    it("should handle multiple field updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const multipleUpdates = {
        coins: 200,
        username: "NewUsername",
        displayName: "New Display Name",
      };

      await userDataService.updateUserDocument(mockUserId, multipleUpdates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), multipleUpdates);
    });

    it("should handle nested object updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const nestedUpdates: Partial<Player> = {
        coins: 200,
        username: "UpdatedUsername",
      };

      await userDataService.updateUserDocument(mockUserId, nestedUpdates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), nestedUpdates);
    });

    it("should handle Firestore errors during update", async () => {
      const error = new Error("Firestore error");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user document:",
        error
      );
    });

    it("should handle Firestore permission errors during update", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdateDoc.mockRejectedValue(permissionError);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user document:",
        permissionError
      );
    });

    it("should handle Firestore network errors during update", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdate.mockRejectedValue(networkError);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user document:",
        networkError
      );
    });

    it("should handle document not found errors", async () => {
      const notFoundError = new Error("Document not found");
      mockUpdate.mockRejectedValue(notFoundError);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Document not found");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user document:",
        notFoundError
      );
    });
  });

  describe("updateClassicIndex", () => {
    const mockUserId = "test-user-id";
    const newIndex = 15;

    it("should update classic index successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, newIndex);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.classicIndex": newIndex }
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Classic index updated to ${newIndex} for user:`,
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateClassicIndex("", newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateClassicIndex(null as any, newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateClassicIndex(undefined as any, newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle zero index", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, 0);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.classicIndex": 0 }
      );
    });

    it("should handle large index values", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const largeIndex = 99999;

      await userDataService.updateClassicIndex(mockUserId, largeIndex);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.classicIndex": largeIndex }
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Classic index updated to ${largeIndex} for user:`,
        mockUserId
      );
    });

    it("should handle negative index values", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const negativeIndex = -5;

      await userDataService.updateClassicIndex(mockUserId, negativeIndex);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { "progress.classicIndex": negativeIndex }
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockUpdate.mockRejectedValue(error);

      await expect(
        userDataService.updateClassicIndex(mockUserId, newIndex)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating classic index:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdate.mockRejectedValue(permissionError);

      await expect(
        userDataService.updateClassicIndex(mockUserId, newIndex)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating classic index:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdate.mockRejectedValue(networkError);

      await expect(
        userDataService.updateClassicIndex(mockUserId, newIndex)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating classic index:",
        networkError
      );
    });
  });

  describe("updateUserCoins", () => {
    const mockUserId = "test-user-id";
    const newCoinAmount = 250;

    it("should update user coins successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, newCoinAmount);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { coins: newCoinAmount }
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Coins updated to ${newCoinAmount} for user:`,
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateUserCoins("", newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateUserCoins(null as any, newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateUserCoins(undefined as any, newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for negative coin amount", async () => {
      await expect(
        userDataService.updateUserCoins(mockUserId, -10)
      ).rejects.toThrow("Coin amount cannot be negative");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle zero coin amount", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, 0);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { coins: 0 }
      );
    });

    it("should handle large coin amounts", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const largeCoinAmount = 999999;

      await userDataService.updateUserCoins(mockUserId, largeCoinAmount);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        { coins: largeCoinAmount }
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Coins updated to ${largeCoinAmount} for user:`,
        mockUserId
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(
        userDataService.updateUserCoins(mockUserId, newCoinAmount)
      ).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user coins:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdate.mockRejectedValue(permissionError);

      await expect(
        userDataService.updateUserCoins(mockUserId, newCoinAmount)
      ).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user coins:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdate.mockRejectedValue(networkError);

      await expect(
        userDataService.updateUserCoins(mockUserId, newCoinAmount)
      ).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith(
        "Error updating user coins:",
        networkError
      );
    });
  });

  describe("userExists", () => {
    const mockUserId = "test-user-id";

    it("should return true when user exists", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
      });

      const result = await userDataService.userExists(mockUserId);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockGetDoc).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when user does not exist", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await userDataService.userExists(mockUserId);

      expect(result).toBe(false);
    });

    it("should return false for empty userId", async () => {
      const result = await userDataService.userExists("");

      expect(result).toBe(false);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should return false for null userId", async () => {
      const result = await userDataService.userExists(null as any);

      expect(result).toBe(false);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should return false for undefined userId", async () => {
      const result = await userDataService.userExists(undefined as any);

      expect(result).toBe(false);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should return false for whitespace-only userId", async () => {
      const result = await userDataService.userExists("   ");

      expect(result).toBe(false);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should return false on Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGetDoc.mockRejectedValue(error);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        error
      );
      expect(result).toBe(false);
    });

    it("should return false on Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGetDoc.mockRejectedValue(permissionError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        permissionError
      );
      expect(result).toBe(false);
    });

    it("should return false on Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGetDoc.mockRejectedValue(networkError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        networkError
      );
      expect(result).toBe(false);
    });

    it("should return false on document not found errors", async () => {
      const notFoundError = new Error("Document not found");
      mockGetDoc.mockRejectedValue(notFoundError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        notFoundError
      );
      expect(result).toBe(false);
    });

    it("should handle malformed exists response gracefully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => {
          throw new Error("Malformed response");
        },
      });

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        expect.any(Error)
      );
      expect(result).toBe(false);
    });
  });

  describe("Service Integration", () => {
    it("should have correct users collection constant", () => {
      expect((UserDataService as any).USERS_COLLECTION).toBe("users");
    });

    it("should implement IUserDataService interface", () => {
      // Test that the service has all required methods
      expect(typeof userDataService.saveUserProgress).toBe("function");
      expect(typeof userDataService.loadUserProgress).toBe("function");
      expect(typeof userDataService.createUserDocument).toBe("function");
      expect(typeof userDataService.updateUserDocument).toBe("function");
      expect(typeof userDataService.updateClassicIndex).toBe("function");
      expect(typeof userDataService.updateUserCoins).toBe("function");
      expect(typeof userDataService.userExists).toBe("function");
    });

    it("should use correct Firebase app instance", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await userDataService.saveUserProgress("test-id", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      expect(mockSetDoc).toHaveBeenCalled();
    });

    it("should handle service instantiation correctly", () => {
      const newService = new UserDataService();
      expect(newService).toBeInstanceOf(UserDataService);
      expect(typeof newService.saveUserProgress).toBe("function");
    });

    it("should maintain consistent collection reference across methods", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockUpdateDoc.mockResolvedValue(undefined);

      // Test multiple methods use same "users" collection via doc()
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");
      await userDataService.updateClassicIndex("user3", 5);

      // Verify all doc() calls used "users"
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", "user1");
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", "user2");
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", "user3");
    });

    it("should handle Firebase app connection consistently", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValue({ exists: () => true });

      // Test Firebase app is used consistently
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");

      expect(mockDoc).toHaveBeenCalledTimes(2);
    });

    it("should handle method chaining and complex operations", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "test-user",
          username: "TestUser",
          coins: 100,
          progress: {
            classicIndex: 5,
            dailyChallengeIndex: 2,
            dailyChallengeCurrentQuestion: 0,
            tutorialIndex: 1,
          },
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      (PlayerSchema.parse as jest.Mock).mockReturnValue({
        userId: "test-user",
        username: "TestUser",
        coins: 100,
      });

      // Simulate a complex user operation workflow
      const userExists = await userDataService.userExists("test-user");
      expect(userExists).toBe(true);

      const userData = await userDataService.loadUserProgress("test-user");
      expect(userData).toBeDefined();

      await userDataService.updateUserCoins("test-user", 150);
      await userDataService.updateClassicIndex("test-user", 10);

      // Verify all operations completed successfully
      expect(mockGetDoc).toHaveBeenCalledTimes(2); // userExists + loadUserProgress
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2); // updateUserCoins + updateClassicIndex
    });

    it("should handle concurrent operations gracefully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      // Simulate concurrent operations
      const operations = [
        userDataService.updateUserCoins("user1", 100),
        userDataService.updateClassicIndex("user2", 5),
        userDataService.updateUserCoins("user3", 200),
      ];

      await Promise.all(operations);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(3);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), { coins: 100 });
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), { "progress.classicIndex": 5 });
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), { coins: 200 });
    });

    it("should handle service recovery from errors", async () => {
      // First operation fails
      mockUpdateDoc.mockRejectedValueOnce(new Error("Network error"));

      // Second operation succeeds
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      // First call should fail
      await expect(
        userDataService.updateUserCoins("user1", 100)
      ).rejects.toThrow("Network error");

      // Service should still work for subsequent calls
      await expect(
        userDataService.updateUserCoins("user2", 200)
      ).resolves.toBeUndefined();

      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });
  });
});

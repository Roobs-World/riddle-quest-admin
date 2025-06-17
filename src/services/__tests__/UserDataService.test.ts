import { UserDataService } from "../UserDataService";
import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { Player, PlayerSchema } from "../../validation/firestoreSchemas";
import { ZodError } from "zod";

// Mock Firebase dependencies
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));
const mockFirestore = {
  collection: mockCollection,
};

jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  default: jest.fn(() => mockFirestore),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));

// Mock PlayerSchema
jest.mock("../../validation/firestoreSchemas", () => ({
  PlayerSchema: {
    parse: jest.fn(),
  },
}));

// Mock console methods to reduce noise
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("UserDataService", () => {
  let userDataService: UserDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    userDataService = new UserDataService();

    // Reset and setup mock implementations
    mockGet.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
    mockDoc.mockReset();
    mockCollection.mockReset();

    // Setup default mock chain
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockDoc.mockReturnValue({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
    });

    // Ensure the firestore mock returns our mock object
    (firestore as jest.MockedFunction<typeof firestore>).mockReturnValue(
      mockFirestore as any
    );
  });

  describe("saveUserProgress", () => {
    const mockUserId = "test-user-id";
    const mockProgress = {
      classicIndex: 5,
      dailyChallengeIndex: 2,
      tutorialIndex: 1,
    } as Player["progress"];

    it("should save user progress successfully", async () => {
      mockSet.mockResolvedValue(undefined);

      await userDataService.saveUserProgress(mockUserId, mockProgress);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockSet).toHaveBeenCalledWith(
        { progress: mockProgress },
        { merge: true }
      );
      expect(console.log).toHaveBeenCalledWith(
        "Player progress saved to Firestore successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      await userDataService.saveUserProgress("", mockProgress);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      await userDataService.saveUserProgress(null as any, mockProgress);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      await userDataService.saveUserProgress(undefined as any, mockProgress);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      await userDataService.saveUserProgress("   ", mockProgress);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to save progress to Firestore without a userId."
      );
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should save progress with zero values", async () => {
      mockSet.mockResolvedValue(undefined);
      const zeroProgress = {
        classicIndex: 0,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, zeroProgress);

      expect(mockSet).toHaveBeenCalledWith(
        { progress: zeroProgress },
        { merge: true }
      );
    });

    it("should save progress with large values", async () => {
      mockSet.mockResolvedValue(undefined);
      const largeProgress = {
        classicIndex: 999999,
        dailyChallengeIndex: 888888,
        tutorialIndex: 777777,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, largeProgress);

      expect(mockSet).toHaveBeenCalledWith(
        { progress: largeProgress },
        { merge: true }
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockSet.mockRejectedValue(error);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockSet.mockRejectedValue(permissionError);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Permission denied");

      expect(console.error).toHaveBeenCalledWith(
        "Error saving player progress to Firestore:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockSet.mockRejectedValue(networkError);

      await expect(
        userDataService.saveUserProgress(mockUserId, mockProgress)
      ).rejects.toThrow("Network unavailable");

      expect(console.error).toHaveBeenCalledWith(
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
      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockGet).toHaveBeenCalled();
      expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockUserData);
      expect(console.log).toHaveBeenCalledWith(
        "User progress loaded successfully for user:",
        mockUserId
      );
    });

    it("should handle empty userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("");

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(null as any);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(undefined as any);

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("   ");

      expect(console.warn).toHaveBeenCalledWith(
        "Attempted to load progress from Firestore without a userId."
      );
      expect(result).toBeNull();
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle non-existent user document", async () => {
      mockGet.mockResolvedValue({
        exists: () => false,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(console.log).toHaveBeenCalledWith(
        "No user document found for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with no data", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => null,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(console.warn).toHaveBeenCalledWith(
        "User document exists but has no data for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with undefined data", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => undefined,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(console.warn).toHaveBeenCalledWith(
        "User document exists but has no data for userId:",
        mockUserId
      );
      expect(result).toBeNull();
    });

    it("should handle user document with empty object data", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
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

      expect(console.error).toHaveBeenCalledWith(
        "User data validation failed:",
        zodError.issues
      );
    });

    it("should handle Zod validation errors", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["email"],
          message: "Expected string, received number",
        },
      ]);

      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Invalid user data structure in Firestore");

      expect(console.error).toHaveBeenCalledWith(
        "User data validation failed:",
        zodError.issues
      );
    });

    it("should handle complex Zod validation errors", async () => {
      const complexZodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["username"],
          message: "Expected string, received number",
        },
        {
          code: "too_small",
          minimum: 0,
          type: "number",
          inclusive: true,
          exact: false,
          path: ["coins"],
          message: "Number must be greater than or equal to 0",
        },
      ]);

      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });
      (PlayerSchema.parse as jest.Mock).mockImplementation(() => {
        throw complexZodError;
      });

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Invalid user data structure in Firestore");

      expect(console.error).toHaveBeenCalledWith(
        "User data validation failed:",
        complexZodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGet.mockRejectedValue(error);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
        "Error loading user progress from Firestore:",
        error
      );
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Permission denied");

      expect(console.error).toHaveBeenCalledWith(
        "Error loading user progress from Firestore:",
        permissionError
      );
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGet.mockRejectedValue(networkError);

      await expect(
        userDataService.loadUserProgress(mockUserId)
      ).rejects.toThrow("Network unavailable");

      expect(console.error).toHaveBeenCalledWith(
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
      mockSet.mockResolvedValue(undefined);

      await userDataService.createUserDocument(mockUserId, mockUserData);

      expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData);
      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockSet).toHaveBeenCalledWith(mockUserData);
      expect(console.log).toHaveBeenCalledWith(
        "User document created successfully for user:",
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.createUserDocument("", mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.createUserDocument(null as any, mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.createUserDocument(undefined as any, mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(
        userDataService.createUserDocument("   ", mockUserData)
      ).rejects.toThrow("User ID is required to create user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle Zod validation errors during creation", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
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

      expect(console.error).toHaveBeenCalledWith(
        "User data validation failed during creation:",
        zodError.issues
      );
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("should handle complex Zod validation errors during creation", async () => {
      const complexZodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["username"],
          message: "Expected string, received number",
        },
        {
          code: "too_small",
          minimum: 0,
          type: "number",
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

      expect(console.error).toHaveBeenCalledWith(
        "User data validation failed during creation:",
        complexZodError.issues
      );
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("should handle Firestore errors during creation", async () => {
      const error = new Error("Firestore error");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSet.mockRejectedValue(error);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
        "Error creating user document:",
        error
      );
    });

    it("should handle Firestore permission errors during creation", async () => {
      const permissionError = new Error("Permission denied");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSet.mockRejectedValue(permissionError);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Permission denied");

      expect(console.error).toHaveBeenCalledWith(
        "Error creating user document:",
        permissionError
      );
    });

    it("should handle Firestore network errors during creation", async () => {
      const networkError = new Error("Network unavailable");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockSet.mockRejectedValue(networkError);

      await expect(
        userDataService.createUserDocument(mockUserId, mockUserData)
      ).rejects.toThrow("Network unavailable");

      expect(console.error).toHaveBeenCalledWith(
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
        tutorialIndex: 2,
      },
    };

    it("should update user document successfully", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, mockUpdates);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdate).toHaveBeenCalledWith(mockUpdates);
      expect(console.log).toHaveBeenCalledWith(
        "User document updated successfully for user:",
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateUserDocument("", mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateUserDocument(null as any, mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateUserDocument(undefined as any, mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(
        userDataService.updateUserDocument("   ", mockUpdates)
      ).rejects.toThrow("User ID is required to update user document");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle empty updates object", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, {});

      expect(mockUpdate).toHaveBeenCalledWith({});
      expect(console.log).toHaveBeenCalledWith(
        "User document updated successfully for user:",
        mockUserId
      );
    });

    it("should handle single field updates", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const singleUpdate = { coins: 150 };

      await userDataService.updateUserDocument(mockUserId, singleUpdate);

      expect(mockUpdate).toHaveBeenCalledWith(singleUpdate);
    });

    it("should handle multiple field updates", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const multipleUpdates = {
        coins: 200,
        username: "NewUsername",
        displayName: "New Display Name",
      };

      await userDataService.updateUserDocument(mockUserId, multipleUpdates);

      expect(mockUpdate).toHaveBeenCalledWith(multipleUpdates);
    });

    it("should handle nested object updates", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const nestedUpdates: Partial<Player> = {
        coins: 200,
        xp: 500,
        username: "UpdatedUsername",
      };

      await userDataService.updateUserDocument(mockUserId, nestedUpdates);

      expect(mockUpdate).toHaveBeenCalledWith(nestedUpdates);
    });

    it("should handle Firestore errors during update", async () => {
      const error = new Error("Firestore error");
      mockUpdate.mockRejectedValue(error);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
        "Error updating user document:",
        error
      );
    });

    it("should handle Firestore permission errors during update", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdate.mockRejectedValue(permissionError);

      await expect(
        userDataService.updateUserDocument(mockUserId, mockUpdates)
      ).rejects.toThrow("Permission denied");

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
        "Error updating user document:",
        notFoundError
      );
    });
  });

  describe("updateClassicIndex", () => {
    const mockUserId = "test-user-id";
    const newIndex = 15;

    it("should update classic index successfully", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, newIndex);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdate).toHaveBeenCalledWith({
        "progress.classicIndex": newIndex,
      });
      expect(console.log).toHaveBeenCalledWith(
        `Classic index updated to ${newIndex} for user:`,
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateClassicIndex("", newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateClassicIndex(null as any, newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateClassicIndex(undefined as any, newIndex)
      ).rejects.toThrow("User ID is required to update classic index");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle zero index", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, 0);

      expect(mockUpdate).toHaveBeenCalledWith({
        "progress.classicIndex": 0,
      });
    });

    it("should handle large index values", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const largeIndex = 99999;

      await userDataService.updateClassicIndex(mockUserId, largeIndex);

      expect(mockUpdate).toHaveBeenCalledWith({
        "progress.classicIndex": largeIndex,
      });
      expect(console.log).toHaveBeenCalledWith(
        `Classic index updated to ${largeIndex} for user:`,
        mockUserId
      );
    });

    it("should handle negative index values", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const negativeIndex = -5;

      await userDataService.updateClassicIndex(mockUserId, negativeIndex);

      expect(mockUpdate).toHaveBeenCalledWith({
        "progress.classicIndex": negativeIndex,
      });
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockUpdate.mockRejectedValue(error);

      await expect(
        userDataService.updateClassicIndex(mockUserId, newIndex)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
        "Error updating classic index:",
        networkError
      );
    });
  });

  describe("updateUserCoins", () => {
    const mockUserId = "test-user-id";
    const newCoinAmount = 250;

    it("should update user coins successfully", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, newCoinAmount);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdate).toHaveBeenCalledWith({
        coins: newCoinAmount,
      });
      expect(console.log).toHaveBeenCalledWith(
        `Coins updated to ${newCoinAmount} for user:`,
        mockUserId
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(
        userDataService.updateUserCoins("", newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(
        userDataService.updateUserCoins(null as any, newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(
        userDataService.updateUserCoins(undefined as any, newCoinAmount)
      ).rejects.toThrow("User ID is required to update coins");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should throw error for negative coin amount", async () => {
      await expect(
        userDataService.updateUserCoins(mockUserId, -10)
      ).rejects.toThrow("Coin amount cannot be negative");

      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should handle zero coin amount", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, 0);

      expect(mockUpdate).toHaveBeenCalledWith({
        coins: 0,
      });
    });

    it("should handle large coin amounts", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const largeCoinAmount = 999999;

      await userDataService.updateUserCoins(mockUserId, largeCoinAmount);

      expect(mockUpdate).toHaveBeenCalledWith({
        coins: largeCoinAmount,
      });
      expect(console.log).toHaveBeenCalledWith(
        `Coins updated to ${largeCoinAmount} for user:`,
        mockUserId
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockUpdate.mockRejectedValue(error);

      await expect(
        userDataService.updateUserCoins(mockUserId, newCoinAmount)
      ).rejects.toThrow("Firestore error");

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
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

      expect(console.error).toHaveBeenCalledWith(
        "Error updating user coins:",
        networkError
      );
    });
  });

  describe("userExists", () => {
    const mockUserId = "test-user-id";

    it("should return true when user exists", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
      });

      const result = await userDataService.userExists(mockUserId);

      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockDoc).toHaveBeenCalledWith(mockUserId);
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when user does not exist", async () => {
      mockGet.mockResolvedValue({
        exists: () => false,
      });

      const result = await userDataService.userExists(mockUserId);

      expect(result).toBe(false);
    });

    it("should return false for empty userId", async () => {
      const result = await userDataService.userExists("");

      expect(result).toBe(false);
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should return false for null userId", async () => {
      const result = await userDataService.userExists(null as any);

      expect(result).toBe(false);
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should return false for undefined userId", async () => {
      const result = await userDataService.userExists(undefined as any);

      expect(result).toBe(false);
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should return false for whitespace-only userId", async () => {
      const result = await userDataService.userExists("   ");

      expect(result).toBe(false);
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should return false on Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGet.mockRejectedValue(error);

      const result = await userDataService.userExists(mockUserId);

      expect(console.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        error
      );
      expect(result).toBe(false);
    });

    it("should return false on Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      const result = await userDataService.userExists(mockUserId);

      expect(console.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        permissionError
      );
      expect(result).toBe(false);
    });

    it("should return false on Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGet.mockRejectedValue(networkError);

      const result = await userDataService.userExists(mockUserId);

      expect(console.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        networkError
      );
      expect(result).toBe(false);
    });

    it("should return false on document not found errors", async () => {
      const notFoundError = new Error("Document not found");
      mockGet.mockRejectedValue(notFoundError);

      const result = await userDataService.userExists(mockUserId);

      expect(console.error).toHaveBeenCalledWith(
        "Error checking if user exists:",
        notFoundError
      );
      expect(result).toBe(false);
    });

    it("should handle malformed exists response gracefully", async () => {
      mockGet.mockResolvedValue({
        exists: () => {
          throw new Error("Malformed response");
        },
      });

      const result = await userDataService.userExists(mockUserId);

      expect(console.error).toHaveBeenCalledWith(
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
      mockSet.mockResolvedValue(undefined);

      await userDataService.saveUserProgress("test-id", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      expect(getApp).toHaveBeenCalled();
      expect(firestore).toHaveBeenCalledWith(getApp());
    });

    it("should handle service instantiation correctly", () => {
      const newService = new UserDataService();
      expect(newService).toBeInstanceOf(UserDataService);
      expect(typeof newService.saveUserProgress).toBe("function");
    });

    it("should maintain consistent collection reference across methods", async () => {
      mockSet.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({ exists: () => false });
      mockUpdate.mockResolvedValue(undefined);

      // Test multiple methods use same collection
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");
      await userDataService.updateClassicIndex("user3", 5);

      // Verify all calls used the same collection name
      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(mockCollection).toHaveBeenCalledTimes(3);
    });

    it("should handle Firebase app connection consistently", async () => {
      mockSet.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({ exists: () => true });

      // Test Firebase app is used consistently
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");

      // Verify getApp was called for each Firebase operation
      expect(getApp).toHaveBeenCalledTimes(2);
    });

    it("should handle method chaining and complex operations", async () => {
      mockSet.mockResolvedValue(undefined);
      mockGet.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "test-user",
          username: "TestUser",
          coins: 100,
          progress: {
            classicIndex: 5,
            dailyChallengeIndex: 2,
            tutorialIndex: 1,
          },
        }),
      });
      mockUpdate.mockResolvedValue(undefined);
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
      expect(mockGet).toHaveBeenCalledTimes(2); // userExists + loadUserProgress
      expect(mockUpdate).toHaveBeenCalledTimes(2); // updateUserCoins + updateClassicIndex
    });

    it("should handle concurrent operations gracefully", async () => {
      mockUpdate.mockResolvedValue(undefined);

      // Simulate concurrent operations
      const operations = [
        userDataService.updateUserCoins("user1", 100),
        userDataService.updateClassicIndex("user2", 5),
        userDataService.updateUserCoins("user3", 200),
      ];

      await Promise.all(operations);

      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenCalledWith({ coins: 100 });
      expect(mockUpdate).toHaveBeenCalledWith({ "progress.classicIndex": 5 });
      expect(mockUpdate).toHaveBeenCalledWith({ coins: 200 });
    });

    it("should handle service recovery from errors", async () => {
      // First operation fails
      mockUpdate.mockRejectedValueOnce(new Error("Network error"));

      // Second operation succeeds
      mockUpdate.mockResolvedValueOnce(undefined);

      // First call should fail
      await expect(
        userDataService.updateUserCoins("user1", 100)
      ).rejects.toThrow("Network error");

      // Service should still work for subsequent calls
      await expect(
        userDataService.updateUserCoins("user2", 200)
      ).resolves.toBeUndefined();

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });
});

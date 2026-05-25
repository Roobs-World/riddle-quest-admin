import {ZodError} from "zod";
import {logger} from "../../utils/logger";
import {Player, PlayerSchema} from "../../validation/firestoreSchemas";
import {UserDataService} from "../UserDataService";

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

// Firebase Functions mocks
let mockHttpsCallable: jest.Mock;
let mockGetFunctions: jest.Mock;
let mockCallableFunction: jest.Mock;

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

jest.mock("@react-native-firebase/functions", () => {
  mockCallableFunction = jest.fn();
  mockHttpsCallable = jest.fn(() => mockCallableFunction);
  mockGetFunctions = jest.fn(() => ({}));

  return {
    __esModule: true,
    getFunctions: mockGetFunctions,
    httpsCallable: mockHttpsCallable,
  };
});

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

// Mock sentry
jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
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
    mockHttpsCallable.mockReset();
    mockCallableFunction.mockReset();

    // Setup defaults: doc() returns a docRef placeholder
    mockDoc.mockReturnValue({});
    mockGetFirestore.mockReturnValue({});
    mockGetFunctions.mockReturnValue({});
    mockHttpsCallable.mockReturnValue(mockCallableFunction);
  });

  describe("saveUserProgress", () => {
    const mockUserId = "test-user-id";
    const mockProgress = {
      classicIndex: 5,
      dailyChallengeIndex: 2,
    } as Player["progress"];

    it("should skip direct client progress writes", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await userDataService.saveUserProgress(mockUserId, mockProgress);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client progress write; player progress is persisted by Cloud Functions.",
        {userId: mockUserId, progress: mockProgress},
      );
    });

    it("should handle empty userId gracefully", async () => {
      await userDataService.saveUserProgress("", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      await userDataService.saveUserProgress(null as any, mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      await userDataService.saveUserProgress(undefined as any, mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      await userDataService.saveUserProgress("   ", mockProgress);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to save progress to Firestore without a userId.");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should skip direct progress writes with zero values", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const zeroProgress = {
        classicIndex: 0,
        dailyChallengeIndex: 0,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, zeroProgress);

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client progress write; player progress is persisted by Cloud Functions.",
        {userId: mockUserId, progress: zeroProgress},
      );
    });

    it("should skip direct progress writes with large values", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const largeProgress = {
        classicIndex: 999999,
        dailyChallengeIndex: 888888,
      } as Player["progress"];

      await userDataService.saveUserProgress(mockUserId, largeProgress);

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client progress write; player progress is persisted by Cloud Functions.",
        {userId: mockUserId, progress: largeProgress},
      );
    });

    it("should not touch Firestore when a direct progress write would fail", async () => {
      const error = new Error("Firestore error");
      mockSetDoc.mockRejectedValue(error);

      await expect(userDataService.saveUserProgress(mockUserId, mockProgress)).resolves.toBeUndefined();

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct progress write would hit permissions", async () => {
      const permissionError = new Error("Permission denied");
      mockSetDoc.mockRejectedValue(permissionError);

      await expect(userDataService.saveUserProgress(mockUserId, mockProgress)).resolves.toBeUndefined();

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct progress write would hit the network", async () => {
      const networkError = new Error("Network unavailable");
      mockSetDoc.mockRejectedValue(networkError);

      await expect(userDataService.saveUserProgress(mockUserId, mockProgress)).resolves.toBeUndefined();

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
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
      expect(logger.info).toHaveBeenCalledWith("User progress loaded successfully for user:", mockUserId);
    });

    it("should handle empty userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("");

      expect(logger.warn).toHaveBeenCalledWith("Attempted to load progress from Firestore without a userId.");
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle null userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(null as any);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to load progress from Firestore without a userId.");
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle undefined userId gracefully", async () => {
      const result = await userDataService.loadUserProgress(undefined as any);

      expect(logger.warn).toHaveBeenCalledWith("Attempted to load progress from Firestore without a userId.");
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only userId gracefully", async () => {
      const result = await userDataService.loadUserProgress("   ");

      expect(logger.warn).toHaveBeenCalledWith("Attempted to load progress from Firestore without a userId.");
      expect(result).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should handle non-existent user document", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.info).toHaveBeenCalledWith("No user document found for userId:", mockUserId);
      expect(result).toBeNull();
    });

    it("should handle user document with no data", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => null,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.warn).toHaveBeenCalledWith("User document exists but has no data for userId:", mockUserId);
      expect(result).toBeNull();
    });

    it("should handle user document with undefined data", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => undefined,
      });

      const result = await userDataService.loadUserProgress(mockUserId);

      expect(logger.warn).toHaveBeenCalledWith("User document exists but has no data for userId:", mockUserId);
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

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow(
        "Invalid user data structure in Firestore",
      );

      expect(logger.error).toHaveBeenCalledWith("User data validation failed:", zodError.issues);
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

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow(
        "Invalid user data structure in Firestore",
      );

      expect(logger.error).toHaveBeenCalledWith("User data validation failed:", zodError.issues);
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

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow(
        "Invalid user data structure in Firestore",
      );

      expect(logger.error).toHaveBeenCalledWith("User data validation failed:", complexZodError.issues);
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore error");
      mockGetDoc.mockRejectedValue(error);

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith("Error loading user progress from Firestore:", error);
    });

    it("should handle Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGetDoc.mockRejectedValue(permissionError);

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith("Error loading user progress from Firestore:", permissionError);
    });

    it("should handle Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGetDoc.mockRejectedValue(networkError);

      await expect(userDataService.loadUserProgress(mockUserId)).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith("Error loading user progress from Firestore:", networkError);
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
      },
      preferences: {
        soundEnabled: true,
        hapticsEnabled: true,
        theme: "light",
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    } as unknown as Player;

    it("should create user document through the initialization callable", async () => {
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockCallableFunction.mockResolvedValue({data: {success: true}});

      await userDataService.createUserDocument(mockUserId, mockUserData);

      expect(PlayerSchema.parse).toHaveBeenCalledWith(mockUserData);
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.any(Object), "initializeUser");
      expect(mockCallableFunction).toHaveBeenCalledWith({
        email: mockUserData.email,
        username: mockUserData.username,
        displayName: mockUserData.displayName,
        avatarUrl: mockUserData.avatarUrl,
        seed: mockUserData,
      });
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "User document created successfully via Cloud Function for user:",
        mockUserId,
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(userDataService.createUserDocument("", mockUserData)).rejects.toThrow(
        "User ID is required to create user document",
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(userDataService.createUserDocument(null as any, mockUserData)).rejects.toThrow(
        "User ID is required to create user document",
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(userDataService.createUserDocument(undefined as any, mockUserData)).rejects.toThrow(
        "User ID is required to create user document",
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(userDataService.createUserDocument("   ", mockUserData)).rejects.toThrow(
        "User ID is required to create user document",
      );

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

      await expect(userDataService.createUserDocument(mockUserId, mockUserData)).rejects.toThrow(
        "Invalid user data provided for creation",
      );

      expect(logger.error).toHaveBeenCalledWith("User data validation failed during creation:", zodError.issues);
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

      await expect(userDataService.createUserDocument(mockUserId, mockUserData)).rejects.toThrow(
        "Invalid user data provided for creation",
      );

      expect(logger.error).toHaveBeenCalledWith("User data validation failed during creation:", complexZodError.issues);
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it("should handle callable errors during creation", async () => {
      const error = new Error("Callable error");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockCallableFunction.mockRejectedValue(error);

      await expect(userDataService.createUserDocument(mockUserId, mockUserData)).rejects.toThrow("Callable error");

      expect(logger.error).toHaveBeenCalledWith("Error creating user document:", error);
    });

    it("should handle callable permission errors during creation", async () => {
      const permissionError = new Error("Permission denied");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockCallableFunction.mockRejectedValue(permissionError);

      await expect(userDataService.createUserDocument(mockUserId, mockUserData)).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith("Error creating user document:", permissionError);
    });

    it("should handle callable network errors during creation", async () => {
      const networkError = new Error("Network unavailable");
      (PlayerSchema.parse as jest.Mock).mockReturnValue(mockUserData);
      mockCallableFunction.mockRejectedValue(networkError);

      await expect(userDataService.createUserDocument(mockUserId, mockUserData)).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith("Error creating user document:", networkError);
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
      },
    };

    it("should update user document successfully", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, mockUpdates);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), {
        displayName: "Updated Name",
      });
      expect(logger.info).toHaveBeenCalledWith("User document updated successfully for user:", mockUserId);
    });

    it("should throw error for empty userId", async () => {
      await expect(userDataService.updateUserDocument("", mockUpdates)).rejects.toThrow(
        "User ID is required to update user document",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(userDataService.updateUserDocument(null as any, mockUpdates)).rejects.toThrow(
        "User ID is required to update user document",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(userDataService.updateUserDocument(undefined as any, mockUpdates)).rejects.toThrow(
        "User ID is required to update user document",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for whitespace-only userId", async () => {
      await expect(userDataService.updateUserDocument("   ", mockUpdates)).rejects.toThrow(
        "User ID is required to update user document",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle empty updates object", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserDocument(mockUserId, {});

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping user document update because it only contained server-managed fields.",
        {userId: mockUserId},
      );
    });

    it("should skip single server-managed field updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const singleUpdate = {coins: 150};

      await userDataService.updateUserDocument(mockUserId, singleUpdate);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping user document update because it only contained server-managed fields.",
        {userId: mockUserId},
      );
    });

    it("should handle multiple field updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const multipleUpdates = {
        coins: 200,
        username: "NewUsername",
        displayName: "New Display Name",
      };

      await userDataService.updateUserDocument(mockUserId, multipleUpdates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), {
        username: "NewUsername",
        displayName: "New Display Name",
      });
    });

    it("should handle nested object updates", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const nestedUpdates: Partial<Player> = {
        coins: 200,
        username: "UpdatedUsername",
      };

      await userDataService.updateUserDocument(mockUserId, nestedUpdates);

      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), {
        username: "UpdatedUsername",
      });
    });

    it("should handle Firestore errors during update", async () => {
      const error = new Error("Firestore error");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(userDataService.updateUserDocument(mockUserId, mockUpdates)).rejects.toThrow("Firestore error");

      expect(logger.error).toHaveBeenCalledWith("Error updating user document:", error);
    });

    it("should handle Firestore permission errors during update", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdateDoc.mockRejectedValue(permissionError);

      await expect(userDataService.updateUserDocument(mockUserId, mockUpdates)).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith("Error updating user document:", permissionError);
    });

    it("should handle Firestore network errors during update", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdateDoc.mockRejectedValue(networkError);

      await expect(userDataService.updateUserDocument(mockUserId, mockUpdates)).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith("Error updating user document:", networkError);
    });

    it("should handle document not found errors", async () => {
      const notFoundError = new Error("Document not found");
      mockUpdateDoc.mockRejectedValue(notFoundError);

      await expect(userDataService.updateUserDocument(mockUserId, mockUpdates)).rejects.toThrow("Document not found");

      expect(logger.error).toHaveBeenCalledWith("Error updating user document:", notFoundError);
    });
  });

  describe("updateClassicIndex", () => {
    const mockUserId = "test-user-id";
    const newIndex = 15;

    it("should skip direct client classic index writes", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, newIndex);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, newIndex},
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(userDataService.updateClassicIndex("", newIndex)).rejects.toThrow(
        "User ID is required to update classic index",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(userDataService.updateClassicIndex(null as any, newIndex)).rejects.toThrow(
        "User ID is required to update classic index",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(userDataService.updateClassicIndex(undefined as any, newIndex)).rejects.toThrow(
        "User ID is required to update classic index",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle zero index", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateClassicIndex(mockUserId, 0);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, newIndex: 0},
      );
    });

    it("should handle large index values", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const largeIndex = 99999;

      await userDataService.updateClassicIndex(mockUserId, largeIndex);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, newIndex: largeIndex},
      );
    });

    it("should handle negative index values", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const negativeIndex = -5;

      await userDataService.updateClassicIndex(mockUserId, negativeIndex);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: mockUserId, newIndex: negativeIndex},
      );
    });

    it("should not touch Firestore when a direct classic write would fail", async () => {
      const error = new Error("Firestore error");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(userDataService.updateClassicIndex(mockUserId, newIndex)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct classic write would hit permissions", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdateDoc.mockRejectedValue(permissionError);

      await expect(userDataService.updateClassicIndex(mockUserId, newIndex)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct classic write would hit the network", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdateDoc.mockRejectedValue(networkError);

      await expect(userDataService.updateClassicIndex(mockUserId, newIndex)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("updateUserCoins", () => {
    const mockUserId = "test-user-id";
    const newCoinAmount = 250;

    it("should skip direct client coin writes", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, newCoinAmount);

      expect(mockDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client coin write; economy changes are persisted by Cloud Functions.",
        {userId: mockUserId, newCoinAmount},
      );
    });

    it("should throw error for empty userId", async () => {
      await expect(userDataService.updateUserCoins("", newCoinAmount)).rejects.toThrow(
        "User ID is required to update coins",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for null userId", async () => {
      await expect(userDataService.updateUserCoins(null as any, newCoinAmount)).rejects.toThrow(
        "User ID is required to update coins",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for undefined userId", async () => {
      await expect(userDataService.updateUserCoins(undefined as any, newCoinAmount)).rejects.toThrow(
        "User ID is required to update coins",
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should throw error for negative coin amount", async () => {
      await expect(userDataService.updateUserCoins(mockUserId, -10)).rejects.toThrow("Coin amount cannot be negative");

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle zero coin amount", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await userDataService.updateUserCoins(mockUserId, 0);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client coin write; economy changes are persisted by Cloud Functions.",
        {userId: mockUserId, newCoinAmount: 0},
      );
    });

    it("should handle large coin amounts", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const largeCoinAmount = 999999;

      await userDataService.updateUserCoins(mockUserId, largeCoinAmount);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client coin write; economy changes are persisted by Cloud Functions.",
        {userId: mockUserId, newCoinAmount: largeCoinAmount},
      );
    });

    it("should not touch Firestore when a direct coin write would fail", async () => {
      const error = new Error("Firestore error");
      mockUpdateDoc.mockRejectedValue(error);

      await expect(userDataService.updateUserCoins(mockUserId, newCoinAmount)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct coin write would hit permissions", async () => {
      const permissionError = new Error("Permission denied");
      mockUpdateDoc.mockRejectedValue(permissionError);

      await expect(userDataService.updateUserCoins(mockUserId, newCoinAmount)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should not touch Firestore when a direct coin write would hit the network", async () => {
      const networkError = new Error("Network unavailable");
      mockUpdateDoc.mockRejectedValue(networkError);

      await expect(userDataService.updateUserCoins(mockUserId, newCoinAmount)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
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

      expect(logger.error).toHaveBeenCalledWith("Error checking if user exists:", error);
      expect(result).toBe(false);
    });

    it("should return false on Firestore permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGetDoc.mockRejectedValue(permissionError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith("Error checking if user exists:", permissionError);
      expect(result).toBe(false);
    });

    it("should return false on Firestore network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGetDoc.mockRejectedValue(networkError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith("Error checking if user exists:", networkError);
      expect(result).toBe(false);
    });

    it("should return false on document not found errors", async () => {
      const notFoundError = new Error("Document not found");
      mockGetDoc.mockRejectedValue(notFoundError);

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith("Error checking if user exists:", notFoundError);
      expect(result).toBe(false);
    });

    it("should handle malformed exists response gracefully", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => {
          throw new Error("Malformed response");
        },
      });

      const result = await userDataService.userExists(mockUserId);

      expect(logger.error).toHaveBeenCalledWith("Error checking if user exists:", expect.any(Error));
      expect(result).toBe(false);
    });
  });

  describe("initializeNewUser", () => {
    const mockUserData = {
      email: "test@example.com",
      username: "TestUser",
      displayName: "Test User",
      avatarUrl: "https://example.com/avatar.png",
    };

    it("should initialize new user successfully", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "User initialized successfully",
          userId: "new-user-id",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.initializeNewUser(mockUserData);

      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.any(Object), "initializeUser");
      expect(mockCallableFunction).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockResponse.data);
      expect(logger.info).toHaveBeenCalledWith("User initialized successfully:", mockResponse.data);
    });

    it("should initialize user with minimal data", async () => {
      const minimalUserData = {
        email: "minimal@example.com",
        username: "MinimalUser",
      };
      const mockResponse = {
        data: {
          success: true,
          message: "User initialized successfully",
          userId: "minimal-user-id",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.initializeNewUser(minimalUserData);

      expect(mockCallableFunction).toHaveBeenCalledWith(minimalUserData);
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle Firebase function errors", async () => {
      const error = new Error("Firebase function error");
      mockCallableFunction.mockRejectedValue(error);

      await expect(userDataService.initializeNewUser(mockUserData)).rejects.toThrow(
        "Failed to initialize new user account",
      );

      expect(logger.error).toHaveBeenCalledWith("Error initializing new user:", error);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockCallableFunction.mockRejectedValue(networkError);

      await expect(userDataService.initializeNewUser(mockUserData)).rejects.toThrow(
        "Failed to initialize new user account",
      );

      expect(logger.error).toHaveBeenCalledWith("Error initializing new user:", networkError);
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockCallableFunction.mockRejectedValue(permissionError);

      await expect(userDataService.initializeNewUser(mockUserData)).rejects.toThrow(
        "Failed to initialize new user account",
      );

      expect(logger.error).toHaveBeenCalledWith("Error initializing new user:", permissionError);
    });

    it("should handle unauthenticated errors", async () => {
      const unauthError = new Error("User is not authenticated");
      mockCallableFunction.mockRejectedValue(unauthError);

      await expect(userDataService.initializeNewUser(mockUserData)).rejects.toThrow(
        "Failed to initialize new user account",
      );

      expect(logger.error).toHaveBeenCalledWith("Error initializing new user:", unauthError);
    });

    it("should pass optional displayName correctly", async () => {
      const userDataWithDisplayName = {
        email: "test@example.com",
        username: "TestUser",
        displayName: "Custom Display Name",
      };
      const mockResponse = {
        data: {
          success: true,
          message: "User initialized successfully",
          userId: "user-id",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      await userDataService.initializeNewUser(userDataWithDisplayName);

      expect(mockCallableFunction).toHaveBeenCalledWith(userDataWithDisplayName);
    });

    it("should pass optional avatarUrl correctly", async () => {
      const userDataWithAvatar = {
        email: "test@example.com",
        username: "TestUser",
        avatarUrl: "https://example.com/custom-avatar.png",
      };
      const mockResponse = {
        data: {
          success: true,
          message: "User initialized successfully",
          userId: "user-id",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      await userDataService.initializeNewUser(userDataWithAvatar);

      expect(mockCallableFunction).toHaveBeenCalledWith(userDataWithAvatar);
    });
  });

  describe("ensureUserDocumentComplete", () => {
    it("should ensure user document is complete successfully", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "User document is complete",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.ensureUserDocumentComplete();

      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.any(Object), "ensureUserComplete");
      expect(mockCallableFunction).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse.data);
      expect(logger.info).toHaveBeenCalledWith("User document completeness ensured:", mockResponse.data);
    });

    it("should handle successful fix of missing fields", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "Missing fields added to user document",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.ensureUserDocumentComplete();

      expect(result).toEqual(mockResponse.data);
      expect(result.success).toBe(true);
    });

    it("should handle Firebase function errors", async () => {
      const error = new Error("Firebase function error");
      mockCallableFunction.mockRejectedValue(error);

      await expect(userDataService.ensureUserDocumentComplete()).rejects.toThrow(
        "Failed to ensure user document completeness",
      );

      expect(logger.error).toHaveBeenCalledWith("Error ensuring user document completeness:", error);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockCallableFunction.mockRejectedValue(networkError);

      await expect(userDataService.ensureUserDocumentComplete()).rejects.toThrow(
        "Failed to ensure user document completeness",
      );

      expect(logger.error).toHaveBeenCalledWith("Error ensuring user document completeness:", networkError);
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockCallableFunction.mockRejectedValue(permissionError);

      await expect(userDataService.ensureUserDocumentComplete()).rejects.toThrow(
        "Failed to ensure user document completeness",
      );

      expect(logger.error).toHaveBeenCalledWith("Error ensuring user document completeness:", permissionError);
    });

    it("should handle unauthenticated errors", async () => {
      const unauthError = new Error("User is not authenticated");
      mockCallableFunction.mockRejectedValue(unauthError);

      await expect(userDataService.ensureUserDocumentComplete()).rejects.toThrow(
        "Failed to ensure user document completeness",
      );

      expect(logger.error).toHaveBeenCalledWith("Error ensuring user document completeness:", unauthError);
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      mockCallableFunction.mockRejectedValue(timeoutError);

      await expect(userDataService.ensureUserDocumentComplete()).rejects.toThrow(
        "Failed to ensure user document completeness",
      );

      expect(logger.error).toHaveBeenCalledWith("Error ensuring user document completeness:", timeoutError);
    });
  });

  describe("updateUserStats", () => {
    const mockTargetUserId = "target-user-id";
    const mockStatsUpdate = {
      dailyPuzzlesCompleted: 10,
      bestStreak: 5,
      totalWordsGuessed: 50,
      winRate: 0.75,
      averageGuesses: 4.5,
      totalScore: 2500,
    };

    it("should update user stats successfully", async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "User stats updated successfully",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate);

      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.any(Object), "updateUserStats");
      expect(mockCallableFunction).toHaveBeenCalledWith({
        targetUserId: mockTargetUserId,
        statsUpdate: mockStatsUpdate,
      });
      expect(result).toEqual(mockResponse.data);
      expect(logger.info).toHaveBeenCalledWith("User stats updated successfully:", mockResponse.data);
    });

    it("should update single stat field", async () => {
      const singleStatUpdate = {gamesPlayed: 25};
      const mockResponse = {
        data: {
          success: true,
          message: "User stats updated successfully",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.updateUserStats(mockTargetUserId, singleStatUpdate);

      expect(mockCallableFunction).toHaveBeenCalledWith({
        targetUserId: mockTargetUserId,
        statsUpdate: singleStatUpdate,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should update all stat fields", async () => {
      const allStatsUpdate = {
        dailyPuzzlesCompleted: 15,
        bestStreak: 10,
        totalWordsGuessed: 100,
        winRate: 0.85,
        averageGuesses: 4.0,
        totalScore: 5000,
        highestLevelClassic: 50,
        gamesPlayed: 100,
        wins: 85,
        challengeWins: 20,
        winStreak: 5,
        totalWins: 85,
        totalGuessesInWins: 340,
      };
      const mockResponse = {
        data: {
          success: true,
          message: "User stats updated successfully",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.updateUserStats(mockTargetUserId, allStatsUpdate);

      expect(mockCallableFunction).toHaveBeenCalledWith({
        targetUserId: mockTargetUserId,
        statsUpdate: allStatsUpdate,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle empty stats update", async () => {
      const emptyStatsUpdate = {};
      const mockResponse = {
        data: {
          success: true,
          message: "No stats to update",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.updateUserStats(mockTargetUserId, emptyStatsUpdate);

      expect(mockCallableFunction).toHaveBeenCalledWith({
        targetUserId: mockTargetUserId,
        statsUpdate: emptyStatsUpdate,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle Firebase function errors", async () => {
      const error = new Error("Firebase function error");
      mockCallableFunction.mockRejectedValue(error);

      await expect(userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate)).rejects.toThrow(
        "Failed to update user stats",
      );

      expect(logger.error).toHaveBeenCalledWith("Error updating user stats:", error);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockCallableFunction.mockRejectedValue(networkError);

      await expect(userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate)).rejects.toThrow(
        "Failed to update user stats",
      );

      expect(logger.error).toHaveBeenCalledWith("Error updating user stats:", networkError);
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockCallableFunction.mockRejectedValue(permissionError);

      await expect(userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate)).rejects.toThrow(
        "Failed to update user stats",
      );

      expect(logger.error).toHaveBeenCalledWith("Error updating user stats:", permissionError);
    });

    it("should handle user not found errors", async () => {
      const notFoundError = new Error("Target user not found");
      mockCallableFunction.mockRejectedValue(notFoundError);

      await expect(userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate)).rejects.toThrow(
        "Failed to update user stats",
      );

      expect(logger.error).toHaveBeenCalledWith("Error updating user stats:", notFoundError);
    });

    it("should handle unauthenticated errors", async () => {
      const unauthError = new Error("User is not authenticated");
      mockCallableFunction.mockRejectedValue(unauthError);

      await expect(userDataService.updateUserStats(mockTargetUserId, mockStatsUpdate)).rejects.toThrow(
        "Failed to update user stats",
      );

      expect(logger.error).toHaveBeenCalledWith("Error updating user stats:", unauthError);
    });

    it("should handle invalid stats values gracefully", async () => {
      const invalidStatsUpdate = {
        winRate: 1.5, // Invalid: should be between 0 and 1
        gamesPlayed: -5, // Invalid: should be non-negative
      };
      const mockResponse = {
        data: {
          success: false,
          message: "Invalid stats values provided",
        },
      };
      mockCallableFunction.mockResolvedValue(mockResponse);

      const result = await userDataService.updateUserStats(mockTargetUserId, invalidStatsUpdate);

      expect(result.success).toBe(false);
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

    it("should have additional methods not in interface", () => {
      // Test that the service has Firebase Functions methods
      expect(typeof userDataService.initializeNewUser).toBe("function");
      expect(typeof userDataService.ensureUserDocumentComplete).toBe("function");
      expect(typeof userDataService.updateUserStats).toBe("function");
    });

    it("should not use Firestore for skipped client progress writes", async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await userDataService.saveUserProgress("test-id", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
      } as Player["progress"]);

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockDoc).not.toHaveBeenCalled();
    });

    it("should handle service instantiation correctly", () => {
      const newService = new UserDataService();
      expect(newService).toBeInstanceOf(UserDataService);
      expect(typeof newService.saveUserProgress).toBe("function");
    });

    it("should maintain consistent collection reference across methods", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValue({exists: () => false});
      mockUpdateDoc.mockResolvedValue(undefined);

      // Direct client progress writes are skipped; reads still use the users collection.
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");
      await userDataService.updateClassicIndex("user3", 5);

      expect(mockDoc).not.toHaveBeenCalledWith(expect.any(Object), "users", "user1");
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", "user2");
      expect(mockDoc).not.toHaveBeenCalledWith(expect.any(Object), "users", "user3");
    });

    it("should handle Firebase app connection consistently", async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValue({exists: () => true});

      // Direct progress writes are skipped; reads still use Firestore.
      await userDataService.saveUserProgress("user1", {
        classicIndex: 1,
        dailyChallengeIndex: 0,
      } as Player["progress"]);

      await userDataService.userExists("user2");

      expect(mockDoc).toHaveBeenCalledTimes(1);
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
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client coin write; economy changes are persisted by Cloud Functions.",
        {userId: "test-user", newCoinAmount: 150},
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.",
        {userId: "test-user", newIndex: 10},
      );
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

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(3);
    });

    it("should remain stable when skipped client writes have failing Firestore mocks", async () => {
      // First operation fails
      mockUpdateDoc.mockRejectedValueOnce(new Error("Network error"));

      // Second operation succeeds
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await expect(userDataService.updateUserCoins("user1", 100)).resolves.toBeUndefined();

      await expect(userDataService.updateUserCoins("user2", 200)).resolves.toBeUndefined();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("should handle mixed Firestore and Firebase Functions operations", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockCallableFunction.mockResolvedValue({
        data: {success: true, message: "Done"},
      });

      // Execute both Firestore and Functions operations
      await userDataService.updateUserCoins("user1", 100);
      await userDataService.ensureUserDocumentComplete();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockCallableFunction).toHaveBeenCalledTimes(1);
    });
  });
});

import {getApp} from "@react-native-firebase/app";
import {getAuth} from "@react-native-firebase/auth";
import {ZodError} from "zod";
import {logger} from "../../utils/logger";
import {SubmitGuessInputSchema, SubmitGuessOutputSchema} from "../../validation/cloudFunctionsSchemas";
import {RiddleService} from "../RiddleService";

// Standalone modular mock function references (assigned in jest.mock factories)
let mockGetDoc: jest.Mock;
let mockGetDocs: jest.Mock;
let mockUpdateDoc: jest.Mock;
let mockWhere: jest.Mock;
let mockLimit: jest.Mock;
let mockDoc: jest.Mock;
let mockCollection: jest.Mock;
let mockQuery: jest.Mock;
let mockHttpsCallableFn: jest.Mock;

const mockCurrentUser = {
  uid: "test-user-id",
};

const mockAuth = {
  currentUser: mockCurrentUser,
};

// mockHttpsCallable is the callable returned by httpsCallable(functions, name)
const mockHttpsCallable = jest.fn();

jest.mock("@react-native-firebase/firestore", () => {
  mockGetDoc = jest.fn();
  mockGetDocs = jest.fn();
  mockUpdateDoc = jest.fn();
  mockWhere = jest.fn(() => ({}));
  mockLimit = jest.fn(() => ({}));
  mockDoc = jest.fn(() => ({}));
  mockCollection = jest.fn(() => ({}));
  mockQuery = jest.fn(() => ({}));

  return {
    __esModule: true,
    getFirestore: jest.fn(() => ({})),
    doc: mockDoc,
    collection: mockCollection,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    updateDoc: mockUpdateDoc,
    query: mockQuery,
    where: mockWhere,
    limit: mockLimit,
    default: jest.fn(() => ({})),
  };
});

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: jest.fn(() => mockAuth),
  default: jest.fn(() => mockAuth),
}));

jest.mock("@react-native-firebase/functions", () => {
  mockHttpsCallableFn = jest.fn(() => mockHttpsCallable);
  return {
    __esModule: true,
    getFunctions: jest.fn(() => ({})),
    httpsCallable: mockHttpsCallableFn,
    default: jest.fn(() => ({})),
  };
});

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../validation/cloudFunctionsSchemas", () => ({
  SubmitGuessInputSchema: {
    parse: jest.fn(),
  },
  SubmitGuessOutputSchema: {
    parse: jest.fn(),
  },
}));

// Mock sentry to avoid actual error reporting during tests
jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Get the mocked captureException for assertions
import {captureException} from "../../utils/sentry";
const mockCaptureException = captureException as jest.Mock;

// Mock console.log/warn to reduce noise
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

// Mock Date for consistent testing
const mockToday = "2024-01-15";
const mockTodayISO = "2024-01-15T12:00:00.000Z";

describe("RiddleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock implementations
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
    mockWhere.mockReset();
    mockLimit.mockReset();
    mockDoc.mockReset();
    mockCollection.mockReset();
    mockQuery.mockReset();
    mockHttpsCallable.mockReset();
    mockHttpsCallableFn.mockReset();
    mockHttpsCallableFn.mockReturnValue(mockHttpsCallable);
    mockCaptureException.mockReset();

    // Setup defaults for standalone modular functions
    mockDoc.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockLimit.mockReturnValue({});

    // Ensure Firebase auth mock returns our mock object
    (getAuth as jest.MockedFunction<typeof getAuth>).mockReturnValue(mockAuth as any);

    // Mock Date to return consistent test date
    jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockTodayISO);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("fetchDailyRiddle", () => {
    const mockUserId = "test-user-id";
    const mockRiddleData = {
      text: "What has keys but no locks?",
      answer: "PIANO",
      category: "daily",
    };

    beforeEach(() => {
      mockAuth.currentUser = {uid: mockUserId};
    });

    it("should return null when no authenticated user", async () => {
      (mockAuth as any).currentUser = null;

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("No authenticated user found.");
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("should return completedToday: true when user already completed today's challenge", async () => {
      const userDoc = {
        exists: () => true,
        data: () => ({
          lastDailyChallengeCompletedAt: mockTodayISO,
        }),
      };
      mockGetDoc.mockResolvedValueOnce(userDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toEqual({completedToday: true});
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(logger.debug).toHaveBeenCalledWith(
        `User ${mockUserId} has already completed the daily challenge for today (${mockToday}).`,
      );
    });

    it("should return null when no current daily riddle document exists", async () => {
      const userDoc = {
        exists: () => false,
      };
      const currentDailyDoc = {
        exists: () => false,
      };

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toBeNull();
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", mockUserId);
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "dailyRiddles", "current");
      expect(logger.debug).toHaveBeenCalledWith(
        `No current daily challenge found (docId: current) for date: ${mockToday}`,
      );
    });

    it("should return null when current daily riddle is missing answer", async () => {
      const userDoc = {exists: () => false};
      const currentDailyDoc = {
        exists: () => true,
        data: () => ({text: "Incomplete riddle"}),
      };

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Current daily riddle data or answer missing:", {
        text: "Incomplete riddle",
      });
    });

    it("should fetch current daily riddle from dailyRiddles/current", async () => {
      const userDoc = {exists: () => false};
      const currentDailyDoc = {
        exists: () => true,
        data: () => mockRiddleData,
        id: "current",
      };

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toEqual({
        ...mockRiddleData,
        riddleId: "current",
        completedToday: false,
        answerLength: 5,
      });
      expect(logger.debug).toHaveBeenCalledWith("Fetched current daily riddle from dailyRiddles/current");
    });

    it("should handle Firestore errors gracefully and call captureException", async () => {
      const error = new Error("Firestore connection error");
      mockGetDoc.mockRejectedValue(error);

      await expect(RiddleService.fetchDailyRiddle()).rejects.toThrow("Firestore connection error");

      expect(logger.error).toHaveBeenCalledWith("Error fetching daily riddle:", error);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });

    it("should handle network errors during current daily riddle fetch and call captureException", async () => {
      const userDoc = {exists: () => false};
      const networkError = new Error("Network unavailable");

      mockGetDoc.mockResolvedValueOnce(userDoc).mockRejectedValueOnce(networkError);

      await expect(RiddleService.fetchDailyRiddle()).rejects.toThrow("Network unavailable");

      expect(logger.error).toHaveBeenCalledWith("Error fetching daily riddle:", networkError);
      expect(mockCaptureException).toHaveBeenCalledWith(networkError);
    });

    it("should proceed when user doc exists but has no lastDailyChallengeCompletedAt", async () => {
      const userDoc = {
        exists: () => true,
        data: () => ({someOtherField: "value"}),
      };
      const currentDailyDoc = {
        exists: () => true,
        data: () => ({
          text: "Test riddle",
          answer: "TEST",
        }),
        id: "current",
      };

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toEqual({
        text: "Test riddle",
        answer: "TEST",
        riddleId: "current",
        completedToday: false,
        answerLength: 4,
      });
    });

    it("should proceed when user doc exists but userData is null", async () => {
      const userDoc = {
        exists: () => true,
        data: () => null,
      };
      const currentDailyDoc = {
        exists: () => true,
        data: () => ({
          text: "Test riddle",
          answer: "TEST",
        }),
        id: "current",
      };

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toEqual({
        text: "Test riddle",
        answer: "TEST",
        riddleId: "current",
        completedToday: false,
        answerLength: 4,
      });
    });

    it("should return null when current daily document uses legacy non-callable shape", async () => {
      const userDoc = {exists: () => false};

      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce({exists: true, data: {answer: "BAD"}});

      const result = await RiddleService.fetchDailyRiddle();

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `No current daily challenge found (docId: current) for date: ${mockToday}`,
      );
    });
  });
  describe("fetchClassicRiddle", () => {
    const mockClassicRiddleData = {
      text: "I can be cracked, made, told, and played. What am I?",
      answer: "JOKE",
      category: "classic",
      classicIndex: 1,
    };

    it("should fetch classic riddle successfully", async () => {
      const level = 1;
      const riddleId = "classic-001";
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => mockClassicRiddleData,
            id: riddleId,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toEqual({
        ...mockClassicRiddleData,
        riddleId,
        answerLength: 4,
      });
      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", level);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(logger.debug).toHaveBeenCalledWith(`Classic riddle found for level: ${level}`);
    });

    it("should return null when no classic riddle found for level", async () => {
      const level = 999;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`,
      );
    });

    it("should return null when riddle data is missing answer", async () => {
      const level = 1;
      const riddleId = "invalid-classic";
      const invalidRiddleData = {
        text: "Incomplete classic riddle",
        category: "classic",
        classicIndex: 1,
      };
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => invalidRiddleData,
            id: riddleId,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        `Riddle data or answer missing for level: ${level}. Data:`,
        invalidRiddleData,
      );
    });

    it("should handle zero level", async () => {
      const level = 0;
      const riddleId = "classic-000";
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            data: () => ({...mockClassicRiddleData, classicIndex: 0}),
            id: riddleId,
          },
        ],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toEqual({
        ...mockClassicRiddleData,
        classicIndex: 0,
        riddleId,
        answerLength: 4,
      });
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", 0);
    });

    it("should handle large level numbers", async () => {
      const level = 99999;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", 99999);
    });

    it("should handle negative level numbers", async () => {
      const level = -1;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGetDocs.mockResolvedValue(mockSnapshot);

      const result = await RiddleService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", -1);
    });

    it("should handle Firestore errors", async () => {
      const level = 1;
      const error = new Error("Firestore query error");
      mockGetDocs.mockRejectedValue(error);

      await expect(RiddleService.fetchClassicRiddle(level)).rejects.toThrow("Firestore query error");

      expect(logger.error).toHaveBeenCalledWith(`Error fetching classic riddle for level ${level}:`, error);
    });

    it("should handle permission errors", async () => {
      const level = 1;
      const permissionError = new Error("Permission denied");
      mockGetDocs.mockRejectedValue(permissionError);

      await expect(RiddleService.fetchClassicRiddle(level)).rejects.toThrow("Permission denied");

      expect(logger.error).toHaveBeenCalledWith(`Error fetching classic riddle for level ${level}:`, permissionError);
    });
  });

  describe("submitGuess", () => {
    const mockGuessData = {
      guess: "PIANO",
      riddleId: "riddle-123",
      gameMode: "classic" as const,
      attempts: 1,
    };

    const mockValidResult = {
      feedback: [
        {letter: "P", status: "green" as const},
        {letter: "I", status: "yellow" as const},
        {letter: "A", status: "gray" as const},
        {letter: "N", status: "green" as const},
        {letter: "O", status: "green" as const},
      ],
      isCorrect: true,
      gameOver: true,
      coinsEarned: 10,
      correctAnswer: "PIANO",
    };

    beforeEach(() => {
      (SubmitGuessInputSchema.parse as jest.Mock).mockImplementation((data) => data);
      (SubmitGuessOutputSchema.parse as jest.Mock).mockImplementation((data) => data);
    });

    it("should submit guess successfully and return validated result", async () => {
      mockHttpsCallable.mockResolvedValue({data: mockValidResult});

      const result = await RiddleService.submitGuess(mockGuessData);

      expect(SubmitGuessInputSchema.parse).toHaveBeenCalledWith(mockGuessData);
      expect(mockHttpsCallableFn).toHaveBeenCalledWith(expect.any(Object), "submitGuess");
      expect(mockHttpsCallable).toHaveBeenCalledWith(mockGuessData);
      expect(SubmitGuessOutputSchema.parse).toHaveBeenCalledWith(mockValidResult);
      expect(result).toEqual(mockValidResult);
      expect(logger.debug).toHaveBeenCalledWith("Submitting guess for validation:", mockGuessData);
      expect(logger.debug).toHaveBeenCalledWith("Guess validation result received and validated:", mockValidResult);
    });

    it("should submit guess for daily challenge game mode", async () => {
      const dailyGuessData = {
        gameMode: "challenge" as const,
        guess: "daily",
        riddleId: "daily-riddle-id",
        attempts: 1,
      };
      mockHttpsCallable.mockResolvedValue({data: mockValidResult});

      const result = await RiddleService.submitGuess(dailyGuessData);

      expect(SubmitGuessInputSchema.parse).toHaveBeenCalledWith(dailyGuessData);
      expect(mockHttpsCallable).toHaveBeenCalledWith(dailyGuessData);
      expect(result).toEqual(mockValidResult);
    });

    it("should handle incorrect guess result", async () => {
      const incorrectResult = {
        feedback: [
          {letter: "W", status: "gray" as const},
          {letter: "R", status: "gray" as const},
          {letter: "O", status: "yellow" as const},
          {letter: "N", status: "gray" as const},
          {letter: "G", status: "gray" as const},
        ],
        isCorrect: false,
        gameOver: false,
        coinsEarned: 0,
      };
      mockHttpsCallable.mockResolvedValue({data: incorrectResult});

      const result = await RiddleService.submitGuess(mockGuessData);

      expect(result).toEqual(incorrectResult);
      expect(result.isCorrect).toBe(false);
      expect(result.gameOver).toBe(false);
    });

    it("should handle input validation errors from Zod", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          path: ["guess"],
          message: "Expected string, received number",
        },
      ]);

      (SubmitGuessInputSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Invalid guess data provided.");

      expect(logger.error).toHaveBeenCalledWith("Zod validation error for guess submission:", zodError.issues);
    });

    it("should handle output validation errors from Zod", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "boolean",
          path: ["isCorrect"],
          message: "Expected boolean, received string",
        },
      ]);

      mockHttpsCallable.mockResolvedValue({data: {invalidData: true}});

      (SubmitGuessOutputSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Invalid guess data provided.");

      expect(logger.error).toHaveBeenCalledWith("Zod validation error for guess submission:", zodError.issues);
    });

    it("should handle Cloud Function call errors", async () => {
      const functionError = new Error("Cloud Function execution failed");
      mockHttpsCallable.mockRejectedValue(functionError);

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Failed to submit guess.");

      expect(logger.error).toHaveBeenCalledWith("Error submitting guess to Cloud Function:", functionError);
    });

    it("should handle network timeout errors", async () => {
      const timeoutError = new Error("Network timeout");
      mockHttpsCallable.mockRejectedValue(timeoutError);

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Failed to submit guess.");

      expect(logger.error).toHaveBeenCalledWith("Error submitting guess to Cloud Function:", timeoutError);
    });

    it("should handle Firebase Functions permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockHttpsCallable.mockRejectedValue(permissionError);

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Failed to submit guess.");

      expect(logger.error).toHaveBeenCalledWith("Error submitting guess to Cloud Function:", permissionError);
    });

    it("should handle empty guess data", async () => {
      const emptyGuessData = {
        guess: "",
        riddleId: "test-riddle-id",
        gameMode: "classic" as const,
        attempts: 1,
      };

      const zodError = new ZodError([
        {
          code: "too_small",
          minimum: 1,
          origin: "string",
          inclusive: true,
          exact: false,
          path: ["guess"],
          message: "String must contain at least 1 character(s)",
        },
      ]);

      (SubmitGuessInputSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(RiddleService.submitGuess(emptyGuessData)).rejects.toThrow("Invalid guess data provided.");

      expect(logger.error).toHaveBeenCalledWith("Zod validation error for guess submission:", zodError.issues);
    });

    it("should handle complex validation results with partial feedback", async () => {
      const partialResult = {
        feedback: [
          {letter: "T", status: "green" as const},
          {letter: "E", status: "yellow" as const},
        ],
        isCorrect: false,
        gameOver: false,
        coinsEarned: 0,
      };
      mockHttpsCallable.mockResolvedValue({data: partialResult});

      const result = await RiddleService.submitGuess(mockGuessData);

      expect(result).toEqual(partialResult);
      expect(result.feedback).toHaveLength(2);
      expect(result.feedback[0].status).toBe("green");
      expect(result.feedback[1].status).toBe("yellow");
    });

    it("should handle Firebase Functions initialization errors", async () => {
      const initError = new Error("Firebase Functions not initialized");
      mockHttpsCallable.mockImplementation(() => {
        throw initError;
      });

      await expect(RiddleService.submitGuess(mockGuessData)).rejects.toThrow("Failed to submit guess.");

      expect(logger.error).toHaveBeenCalledWith("Error submitting guess to Cloud Function:", initError);
    });

    it("should handle multiple concurrent guess submissions", async () => {
      mockHttpsCallable.mockResolvedValue({data: mockValidResult});

      const guess1 = {
        riddleId: "riddle1",
        guess: "guess1",
        gameMode: "classic" as const,
        attempts: 1,
      };
      const guess2 = {
        riddleId: "riddle2",
        guess: "guess2",
        gameMode: "classic" as const,
        attempts: 2,
      };
      const guess3 = {
        riddleId: "riddle3",
        guess: "guess3",
        gameMode: "classic" as const,
        attempts: 3,
      };

      const results = await Promise.all([
        RiddleService.submitGuess(guess1),
        RiddleService.submitGuess(guess2),
        RiddleService.submitGuess(guess3),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toEqual(mockValidResult);
      });
      expect(mockHttpsCallable).toHaveBeenCalledTimes(3);
    });
  });

  describe("Service Integration", () => {
    it("should have all required methods available", () => {
      expect(typeof RiddleService.fetchDailyRiddle).toBe("function");
      expect(typeof RiddleService.fetchClassicRiddle).toBe("function");
      expect(typeof RiddleService.submitGuess).toBe("function");
    });

    it("should use correct Firebase app instance", async () => {
      (mockAuth as any).currentUser = null;

      await RiddleService.fetchDailyRiddle();

      expect(getApp).toHaveBeenCalled();
      expect(getAuth).toHaveBeenCalledWith(getApp());
      // Note: firestore may not be called when no user is authenticated
    });

    it("should maintain consistent Firestore collection names", async () => {
      // Clear all previous mock calls first
      mockCollection.mockClear();

      // Test multiple method calls use consistent collection names
      (mockAuth as any).currentUser = {uid: "test-user"};

      // Test fetchDailyRiddle (uses doc() not collection())
      const userDoc = {exists: () => false};
      const currentDailyDoc = {exists: () => false};
      mockGetDoc.mockResolvedValueOnce(userDoc).mockResolvedValueOnce(currentDailyDoc);

      await RiddleService.fetchDailyRiddle();

      // Test other service collections
      const mockSnapshot = {empty: true, docs: []};
      mockGetDocs.mockResolvedValue(mockSnapshot);
      await RiddleService.fetchClassicRiddle(1);

      // Verify doc/collection calls were made with correct collection names
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "users", expect.any(String));
      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "dailyRiddles", "current");
      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "riddles");
    });

    it("should handle service recovery from intermittent errors", async () => {
      // First call fails, second succeeds
      mockAuth.currentUser = {uid: "test-user"};

      const userDoc = {exists: () => false};
      const dailyChallengeDoc = {exists: () => false};

      mockGetDoc
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(userDoc)
        .mockResolvedValueOnce(dailyChallengeDoc);

      // First call should fail
      await expect(RiddleService.fetchDailyRiddle()).rejects.toThrow("Network error");

      // Second call should succeed
      const result = await RiddleService.fetchDailyRiddle();
      expect(result).toBeNull(); // No daily challenge doc
    });
  });
});

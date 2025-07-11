import { RiddleDataService } from "../RiddleDataService";
import { getFirestore } from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { FirestoreRiddleSchema } from "../../validation/firestoreSchemas";
import { ZodError } from "zod";

// Mock Firebase dependencies
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockLimit = jest.fn(() => ({
  get: mockGet,
}));
const mockWhere = jest.fn();
const mockCollection = jest.fn(() => ({
  where: mockWhere,
  doc: mockDoc,
  get: mockGet,
}));

// Setup the mock chain properly
mockWhere.mockImplementation(() => ({
  where: mockWhere,
  limit: mockLimit,
  get: mockGet,
}));

mockDoc.mockImplementation(() => ({
  get: mockGet,
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

// Mock FirestoreRiddleSchema
jest.mock("../../validation/firestoreSchemas", () => ({
  FirestoreRiddleSchema: {
    parse: jest.fn(),
  },
}));

// Mock console methods to reduce noise
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("RiddleDataService", () => {
  let riddleDataService: RiddleDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    riddleDataService = new RiddleDataService();

    // Reset all mocks
    mockGet.mockReset();
    mockDoc.mockReset();
    mockLimit.mockReset();
    mockWhere.mockReset();
    mockCollection.mockReset();

    // Setup default mock chain
    mockWhere.mockImplementation(() => ({
      where: mockWhere,
      limit: mockLimit,
      get: mockGet,
    }));
    mockLimit.mockReturnValue({
      get: mockGet,
    });
    mockCollection.mockReturnValue({
      where: mockWhere,
      doc: mockDoc,
      get: mockGet,
    });
    mockDoc.mockImplementation(() => ({
      get: mockGet,
    }));

    // Ensure the firestore mock returns our mock object
    (getFirestore as jest.MockedFunction<typeof getFirestore>).mockReturnValue(
      mockFirestore as any
    );
  });

  describe("fetchDailyRiddle", () => {
    const mockRiddleData = {
      category: "daily",
      date: "2023-12-01",
      riddle: "What has four legs and goes woof?",
      answer: "DOG",
      hint: "A loyal pet",
      difficulty: "easy",
    };

    const mockValidatedRiddle = {
      ...mockRiddleData,
      riddleId: "daily-riddle-123",
      answerLength: 3,
    };

    beforeEach(() => {
      // Mock Date to return consistent date
      jest
        .spyOn(Date.prototype, "toISOString")
        .mockReturnValue("2023-12-01T10:00:00.000Z");
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should fetch daily riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "daily-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(
        mockValidatedRiddle
      );

      const result = await riddleDataService.fetchDailyRiddle();

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "daily");
      expect(mockWhere).toHaveBeenCalledWith("date", "==", "2023-12-01");
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: "daily-riddle-123",
      });
      expect(result).toEqual(mockValidatedRiddle);
      expect(console.log).toHaveBeenCalledWith(
        "Daily riddle found for date:",
        "2023-12-01"
      );
    });

    it("should return null when no daily riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchDailyRiddle();

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        "No daily riddle found for date:",
        "2023-12-01"
      );
    });

    it("should handle Zod validation errors", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "daily-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["riddle"],
          message: "Expected string, received number",
        },
      ]);

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow(
        "Invalid daily riddle data structure"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Daily riddle validation failed:",
        zodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore connection failed");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow(
        "Firestore connection failed"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching daily riddle:",
        error
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGet.mockRejectedValue(networkError);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow(
        "Network unavailable"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching daily riddle:",
        networkError
      );
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow(
        "Permission denied"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching daily riddle:",
        permissionError
      );
    });
  });

  describe("fetchClassicRiddle", () => {
    const level = 5;
    const mockRiddleData = {
      category: "classic",
      classicIndex: 5,
      riddle: "I am thinking of a word",
      answer: "WORD",
      hint: "Something you say",
      difficulty: "medium",
    };

    const mockValidatedRiddle = {
      ...mockRiddleData,
      riddleId: "classic-riddle-123",
      answerLength: 4,
    };

    it("should fetch classic riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "classic-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(
        mockValidatedRiddle
      );

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", level);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: "classic-riddle-123",
        answerLength: 4,
      });
      expect(result).toEqual(mockValidatedRiddle);
      expect(console.log).toHaveBeenCalledWith(
        `Fetching classic riddle for level ${level} from Firestore`
      );
      expect(console.log).toHaveBeenCalledWith(
        `Classic riddle found for level: ${level}`
      );
    });

    it("should return null when no classic riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`
      );
    });

    it("should return null when riddle data is missing", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "classic-riddle-123",
            data: () => null,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        `Riddle data or answer missing for level: ${level}. Data:`,
        null
      );
    });

    it("should return null when answer is missing", async () => {
      const incompleteRiddleData = {
        category: "classic",
        classicIndex: 5,
        riddle: "I am thinking of a word",
        hint: "Something you say",
        difficulty: "medium",
        // answer is missing
      };

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "classic-riddle-123",
            data: () => incompleteRiddleData,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        `Riddle data or answer missing for level: ${level}. Data:`,
        incompleteRiddleData
      );
    });

    it("should handle zero level", async () => {
      const zeroLevel = 0;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(zeroLevel);

      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", zeroLevel);
      expect(result).toBeNull();
    });

    it("should handle large level numbers", async () => {
      const largeLevel = 999999;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(largeLevel);

      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", largeLevel);
      expect(result).toBeNull();
    });

    it("should handle negative level numbers", async () => {
      const negativeLevel = -5;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(negativeLevel);

      expect(mockWhere).toHaveBeenCalledWith(
        "classicIndex",
        "==",
        negativeLevel
      );
      expect(result).toBeNull();
    });

    it("should handle Zod validation errors", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "classic-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["answer"],
          message: "Expected string, received number",
        },
      ]);

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchClassicRiddle(level)).rejects.toThrow(
        "Invalid classic riddle data structure"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Classic riddle validation failed:",
        zodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Database unavailable");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.fetchClassicRiddle(level)).rejects.toThrow(
        "Database unavailable"
      );

      expect(console.error).toHaveBeenCalledWith(
        `Error fetching classic riddle for level ${level}:`,
        error
      );
    });
  });

  describe("fetchTutorialRiddle", () => {
    const level = 3;
    const mockRiddleData = {
      category: "tutorial",
      tutorialIndex: 3,
      riddle: "Simple word puzzle",
      answer: "CAT",
      hint: "A feline friend",
      difficulty: "easy",
    };

    const mockValidatedRiddle = {
      ...mockRiddleData,
      riddleId: "tutorial-riddle-123",
      answerLength: 3,
    };

    it("should fetch tutorial riddle successfully", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "tutorial-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(
        mockValidatedRiddle
      );

      const result = await riddleDataService.fetchTutorialRiddle(level);

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "tutorial");
      expect(mockWhere).toHaveBeenCalledWith("tutorialIndex", "==", level);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: "tutorial-riddle-123",
        answerLength: 3,
      });
      expect(result).toEqual(mockValidatedRiddle);
      expect(console.log).toHaveBeenCalledWith(
        `Fetching tutorial riddle for level ${level} from Firestore`
      );
      expect(console.log).toHaveBeenCalledWith(
        `Tutorial riddle found for level: ${level}`
      );
    });

    it("should return null when no tutorial riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchTutorialRiddle(level);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        `No tutorial riddle found for level: ${level}`
      );
    });

    it("should return null when riddle data is null", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "tutorial-riddle-123",
            data: () => null,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchTutorialRiddle(level);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        `Riddle data or answer missing for level: ${level}. Data:`,
        null
      );
    });

    it("should return null when answer is undefined", async () => {
      const incompleteRiddleData = {
        category: "tutorial",
        tutorialIndex: 3,
        riddle: "Simple word puzzle",
        hint: "A feline friend",
        difficulty: "easy",
        answer: undefined,
      };

      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "tutorial-riddle-123",
            data: () => incompleteRiddleData,
          },
        ],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchTutorialRiddle(level);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        `Riddle data or answer missing for level: ${level}. Data:`,
        incompleteRiddleData
      );
    });

    it("should handle Zod validation errors", async () => {
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: "tutorial-riddle-123",
            data: () => mockRiddleData,
          },
        ],
      };

      const zodError = new ZodError([
        {
          code: "too_small",
          minimum: 1,
          type: "string",
          inclusive: true,
          exact: false,
          path: ["answer"],
          message: "String must contain at least 1 character(s)",
        },
      ]);

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(
        riddleDataService.fetchTutorialRiddle(level)
      ).rejects.toThrow("Invalid tutorial riddle data structure");

      expect(console.error).toHaveBeenCalledWith(
        "Tutorial riddle validation failed:",
        zodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Connection timeout");
      mockGet.mockRejectedValue(error);

      await expect(
        riddleDataService.fetchTutorialRiddle(level)
      ).rejects.toThrow("Connection timeout");

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching tutorial riddle:",
        error
      );
    });

    it("should handle zero level for tutorial", async () => {
      const zeroLevel = 0;
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchTutorialRiddle(zeroLevel);

      expect(mockWhere).toHaveBeenCalledWith("tutorialIndex", "==", zeroLevel);
      expect(result).toBeNull();
    });
  });

  describe("fetchRiddleById", () => {
    const riddleId = "riddle-abc-123";
    const mockRiddleData = {
      category: "classic",
      riddle: "What flies but has no wings?",
      answer: "TIME",
      hint: "It moves fast",
      difficulty: "hard",
    };

    const mockValidatedRiddle = {
      ...mockRiddleData,
      riddleId: riddleId,
    };

    it("should fetch riddle by ID successfully", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => mockRiddleData,
      };

      mockGet.mockResolvedValue(mockDocumentSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(
        mockValidatedRiddle
      );

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockDoc).toHaveBeenCalledWith(riddleId);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: riddleId,
      });
      expect(result).toEqual(mockValidatedRiddle);
      expect(console.log).toHaveBeenCalledWith(
        "Riddle loaded successfully for ID:",
        riddleId
      );
    });

    it("should throw error for empty riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById("")).rejects.toThrow(
        "Riddle ID is required"
      );
    });

    it("should throw error for null riddleId", async () => {
      await expect(
        riddleDataService.fetchRiddleById(null as any)
      ).rejects.toThrow("Riddle ID is required");
    });

    it("should throw error for undefined riddleId", async () => {
      await expect(
        riddleDataService.fetchRiddleById(undefined as any)
      ).rejects.toThrow("Riddle ID is required");
    });

    it("should return null when riddle document does not exist", async () => {
      const mockDocumentSnapshot = {
        exists: () => false,
        id: riddleId,
        data: () => null,
      };

      mockGet.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        "No riddle found with ID:",
        riddleId
      );
    });

    it("should return null when document exists but has no data", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => null,
      };

      mockGet.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        "Riddle document exists but has no data for ID:",
        riddleId
      );
    });

    it("should return null when document data is undefined", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => undefined,
      };

      mockGet.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        "Riddle document exists but has no data for ID:",
        riddleId
      );
    });

    it("should handle Zod validation errors", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => mockRiddleData,
      };

      const zodError = new ZodError([
        {
          code: "invalid_literal",
          expected: "classic",
          received: "invalid",
          path: ["category"],
          message: "Invalid literal value, expected 'classic'",
        },
      ]);

      mockGet.mockResolvedValue(mockDocumentSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchRiddleById(riddleId)).rejects.toThrow(
        "Invalid riddle data structure"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Riddle validation failed:",
        zodError.issues
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Document read failed");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.fetchRiddleById(riddleId)).rejects.toThrow(
        "Document read failed"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching riddle by ID:",
        error
      );
    });

    it("should handle whitespace-only riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById("   ")).rejects.toThrow(
        "Riddle ID is required"
      );
    });
  });

  describe("getClassicRiddleCount", () => {
    it("should get classic riddle count successfully", async () => {
      const mockSnapshot = {
        size: 25,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getClassicRiddleCount();

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "classic");
      expect(result).toBe(25);
    });

    it("should return zero when no classic riddles found", async () => {
      const mockSnapshot = {
        size: 0,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getClassicRiddleCount();

      expect(result).toBe(0);
    });

    it("should handle large counts", async () => {
      const mockSnapshot = {
        size: 999999,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getClassicRiddleCount();

      expect(result).toBe(999999);
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Query failed");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow(
        "Query failed"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting classic riddle count:",
        error
      );
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow(
        "Permission denied"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting classic riddle count:",
        permissionError
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      mockGet.mockRejectedValue(networkError);

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow(
        "Network error"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting classic riddle count:",
        networkError
      );
    });
  });

  describe("getTutorialRiddleCount", () => {
    it("should get tutorial riddle count successfully", async () => {
      const mockSnapshot = {
        size: 10,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getTutorialRiddleCount();

      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "tutorial");
      expect(result).toBe(10);
    });

    it("should return zero when no tutorial riddles found", async () => {
      const mockSnapshot = {
        size: 0,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getTutorialRiddleCount();

      expect(result).toBe(0);
    });

    it("should handle single tutorial riddle", async () => {
      const mockSnapshot = {
        size: 1,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getTutorialRiddleCount();

      expect(result).toBe(1);
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Collection access denied");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.getTutorialRiddleCount()).rejects.toThrow(
        "Collection access denied"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting tutorial riddle count:",
        error
      );
    });

    it("should handle database connection errors", async () => {
      const connectionError = new Error("Database connection lost");
      mockGet.mockRejectedValue(connectionError);

      await expect(riddleDataService.getTutorialRiddleCount()).rejects.toThrow(
        "Database connection lost"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting tutorial riddle count:",
        connectionError
      );
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      mockGet.mockRejectedValue(timeoutError);

      await expect(riddleDataService.getTutorialRiddleCount()).rejects.toThrow(
        "Request timeout"
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error getting tutorial riddle count:",
        timeoutError
      );
    });
  });

  describe("Service Integration", () => {
    it("should have correct riddles collection constant", () => {
      expect((RiddleDataService as any).RIDDLES_COLLECTION).toBe("riddles");
    });

    it("should implement IRiddleDataService interface", () => {
      // Test that the service has all required methods
      expect(typeof riddleDataService.fetchDailyRiddle).toBe("function");
      expect(typeof riddleDataService.fetchClassicRiddle).toBe("function");
      expect(typeof riddleDataService.fetchTutorialRiddle).toBe("function");
      expect(typeof riddleDataService.fetchRiddleById).toBe("function");
      expect(typeof riddleDataService.getClassicRiddleCount).toBe("function");
      expect(typeof riddleDataService.getTutorialRiddleCount).toBe("function");
    });

    it("should use correct Firebase app instance", async () => {
      mockGet.mockResolvedValue({ size: 0 });

      await riddleDataService.getClassicRiddleCount();

      expect(getApp).toHaveBeenCalled();
      expect(getFirestore).toHaveBeenCalledWith(getApp());
    });

    it("should handle service instantiation correctly", () => {
      const newService = new RiddleDataService();
      expect(newService).toBeInstanceOf(RiddleDataService);
      expect(typeof newService.fetchDailyRiddle).toBe("function");
    });

    it("should maintain consistent collection reference across methods", async () => {
      mockGet.mockResolvedValue({ size: 0, empty: true, docs: [] });

      // Test multiple methods use same collection
      await riddleDataService.getClassicRiddleCount();
      await riddleDataService.getTutorialRiddleCount();

      // Verify all calls used the same collection name
      expect(mockCollection).toHaveBeenCalledWith("riddles");
      expect(mockCollection).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent operations gracefully", async () => {
      mockGet.mockResolvedValue({ size: 5 });

      // Simulate concurrent operations
      const operations = [
        riddleDataService.getClassicRiddleCount(),
        riddleDataService.getTutorialRiddleCount(),
      ];

      const results = await Promise.all(operations);

      expect(results).toEqual([5, 5]);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should handle service recovery from errors", async () => {
      // First operation fails
      mockGet.mockRejectedValueOnce(new Error("Temporary failure"));

      // Second operation succeeds
      mockGet.mockResolvedValueOnce({ size: 10 });

      // First call should fail
      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow(
        "Temporary failure"
      );

      // Service should still work for subsequent calls
      const result = await riddleDataService.getTutorialRiddleCount();
      expect(result).toBe(10);

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});

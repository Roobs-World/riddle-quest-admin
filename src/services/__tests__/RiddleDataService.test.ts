import {getFirestore} from "@react-native-firebase/firestore";
import {ZodError} from "zod";
import {FirestoreRiddleSchema} from "../../validation/firestoreSchemas";
import {RiddleDataService} from "../RiddleDataService";

// Standalone modular mock function references (assigned in jest.mock factories)
let mockGetDocs: jest.Mock;
let mockGetDoc: jest.Mock;
let mockCollection: jest.Mock;
let mockWhere: jest.Mock;
let mockLimit: jest.Mock;
let mockDoc: jest.Mock;
let mockQuery: jest.Mock;

// Legacy alias: mockGet used throughout tests - routes to both getDocs and getDoc
let mockGet: jest.Mock;

jest.mock("@react-native-firebase/firestore", () => {
  mockGetDocs = jest.fn();
  mockGetDoc = jest.fn();
  mockDoc = jest.fn(() => ({}));
  mockLimit = jest.fn(() => ({}));
  mockWhere = jest.fn(() => ({}));
  mockCollection = jest.fn(() => ({}));
  mockQuery = jest.fn(() => ({}));
  // mockGet is a shared alias - assigned after factory
  mockGet = mockGetDocs;

  return {
    __esModule: true,
    getFirestore: jest.fn(() => ({})),
    getDocs: mockGetDocs,
    getDoc: mockGetDoc,
    doc: mockDoc,
    collection: mockCollection,
    query: mockQuery,
    where: mockWhere,
    limit: mockLimit,
    default: jest.fn(() => ({})),
  };
});

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn().mockReturnValue({}),
}));

// Mock FirestoreRiddleSchema
jest.mock("../../validation/firestoreSchemas", () => ({
  FirestoreRiddleSchema: {
    parse: jest.fn(),
  },
}));

// Mock logger to avoid console assertions (service uses logger for errors)
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("RiddleDataService", () => {
  let riddleDataService: RiddleDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    riddleDataService = new RiddleDataService();

    // Setup default return values for standalone functions
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockLimit.mockReturnValue({});
    mockQuery.mockReturnValue({});

    // Sync mockGet alias with mockGetDocs after clearAllMocks
    mockGet = mockGetDocs;

    // fetchRiddleById uses getDoc; other queries use getDocs.
    // When tests do mockGet.mockResolvedValue(...), it applies to getDocs.
    // For fetchRiddleById tests, mockGet is also routed to mockGetDoc below.
  });

  describe("fetchDailyRiddle", () => {
    const mockRiddleData = {
      category: "daily",
      date: "2023-12-01",
      text: "What has four legs and goes woof?",
      answer: "DOG",
      hint: "A loyal pet",
    };

    const mockValidatedRiddle = {
      ...mockRiddleData,
      riddleId: "daily-riddle-123",
      answerLength: 3,
    };

    beforeEach(() => {
      // Mock Date to return consistent date
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2023-12-01T10:00:00.000Z");
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
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(mockValidatedRiddle);

      const result = await riddleDataService.fetchDailyRiddle();

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/daily");
      expect(mockWhere).toHaveBeenCalledWith("riddleId", "==", "current");
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockRiddleData,
          riddleId: "daily-riddle-123",
        }),
      );
      expect(result).toEqual(mockValidatedRiddle);
    });

    it("should return null when no daily riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchDailyRiddle();

      expect(result).toBeNull();
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
          path: ["riddle"],
          message: "Expected string, received number",
        },
      ]);

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow("Invalid data format. Please check your input.");
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Firestore connection failed");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow("Firestore connection failed");
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network unavailable");
      mockGet.mockRejectedValue(networkError);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow("Network unavailable");
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      await expect(riddleDataService.fetchDailyRiddle()).rejects.toThrow("Permission denied");
    });
  });

  describe("fetchClassicRiddle", () => {
    const level = 5;
    const mockRiddleData = {
      category: "classic",
      classicIndex: 5,
      text: "I am thinking of a word",
      answer: "WORD",
      hint: "Something you say",
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
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(mockValidatedRiddle);

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/classic");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", level);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: "classic-riddle-123",
        answerLength: 4,
        canonicalKey: "classic:5",
        locale: "en",
      });
      expect(result).toEqual(mockValidatedRiddle);
    });

    it("should return null when no classic riddle found", async () => {
      const mockSnapshot = {
        empty: true,
        docs: [],
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.fetchClassicRiddle(level);

      expect(result).toBeNull();
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
    });

    it("should return null when answer is missing", async () => {
      const incompleteRiddleData = {
        category: "classic",
        classicIndex: 5,
        text: "I am thinking of a word",
        hint: "Something you say",
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

      expect(mockWhere).toHaveBeenCalledWith("classicIndex", "==", negativeLevel);
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
          path: ["answer"],
          message: "Expected string, received number",
        },
      ]);

      mockGet.mockResolvedValue(mockSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchClassicRiddle(level)).rejects.toThrow(
        "Invalid data format. Please check your input.",
      );
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Database unavailable");
      mockGet.mockRejectedValue(error);

      await expect(riddleDataService.fetchClassicRiddle(level)).rejects.toThrow("Database unavailable");
    });
  });

  describe("fetchRiddleById", () => {
    const riddleId = "riddle-abc-123";
    const mockRiddleData = {
      category: "classic",
      text: "What flies but has no wings?",
      answer: "TIME",
      hint: "It moves fast",
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

      mockGetDoc.mockResolvedValue(mockDocumentSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockReturnValue(mockValidatedRiddle);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(mockDoc).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/classic", riddleId);
      expect(FirestoreRiddleSchema.parse).toHaveBeenCalledWith({
        ...mockRiddleData,
        riddleId: riddleId,
        locale: "en",
      });
      expect(result).toEqual(mockValidatedRiddle);
    });

    it("should throw error for empty riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById("")).rejects.toThrow("Riddle ID is required");
    });

    it("should throw error for null riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById(null as any)).rejects.toThrow("Riddle ID is required");
    });

    it("should throw error for undefined riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById(undefined as any)).rejects.toThrow("Riddle ID is required");
    });

    it("should return null when riddle document does not exist", async () => {
      const mockDocumentSnapshot = {
        exists: () => false,
        id: riddleId,
        data: () => null,
      };

      mockGetDoc.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
    });

    it("should return null when document exists but has no data", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => null,
      };

      mockGetDoc.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
    });

    it("should return null when document data is undefined", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => undefined,
      };

      mockGetDoc.mockResolvedValue(mockDocumentSnapshot);

      const result = await riddleDataService.fetchRiddleById(riddleId);

      expect(result).toBeNull();
    });

    it("should handle Zod validation errors", async () => {
      const mockDocumentSnapshot = {
        exists: () => true,
        id: riddleId,
        data: () => mockRiddleData,
      };

      const zodError = new ZodError([
        {
          code: "invalid_value",
          values: ["classic"],
          path: ["category"],
          message: "Invalid literal value, expected 'classic'",
        },
      ]);

      mockGetDoc.mockResolvedValue(mockDocumentSnapshot);
      (FirestoreRiddleSchema.parse as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await expect(riddleDataService.fetchRiddleById(riddleId)).rejects.toThrow("Invalid data format. Please check your input.");
    });

    it("should handle Firestore errors", async () => {
      const error = new Error("Document read failed");
      mockGetDoc.mockRejectedValue(error);

      await expect(riddleDataService.fetchRiddleById(riddleId)).rejects.toThrow("Document read failed");
    });

    it("should handle whitespace-only riddleId", async () => {
      await expect(riddleDataService.fetchRiddleById("   ")).rejects.toThrow("Riddle ID is required");
    });
  });

  describe("getClassicRiddleCount", () => {
    it("should get classic riddle count successfully", async () => {
      const mockSnapshot = {
        size: 25,
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const result = await riddleDataService.getClassicRiddleCount();

      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/classic");
      expect(mockWhere).toHaveBeenCalledWith("classicIndex", ">=", 0);
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

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow("Query failed");
    });

    it("should handle permission errors", async () => {
      const permissionError = new Error("Permission denied");
      mockGet.mockRejectedValue(permissionError);

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow("Permission denied");
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      mockGet.mockRejectedValue(networkError);

      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow("Network error");
    });
  });

  describe("Service Integration", () => {
    it("should implement IRiddleDataService interface", () => {
      // Test that the service has all required methods
      expect(typeof riddleDataService.fetchDailyRiddle).toBe("function");
      expect(typeof riddleDataService.fetchClassicRiddle).toBe("function");
      expect(typeof riddleDataService.fetchRiddleById).toBe("function");
      expect(typeof riddleDataService.getClassicRiddleCount).toBe("function");
    });

    it("should use correct Firebase app instance", async () => {
      mockGet.mockResolvedValue({size: 0});

      await riddleDataService.getClassicRiddleCount();

      expect(getFirestore).toHaveBeenCalled();
    });

    it("should handle service instantiation correctly", () => {
      const newService = new RiddleDataService();
      expect(newService).toBeInstanceOf(RiddleDataService);
      expect(typeof newService.fetchDailyRiddle).toBe("function");
    });

    it("should maintain consistent collection reference across methods", async () => {
      mockGet.mockResolvedValue({size: 0, empty: true, docs: []});

      // Test multiple methods use same collection
      await riddleDataService.getClassicRiddleCount();
      await riddleDataService.getClassicRiddleCount();

      // Verify all calls used the same collection name
      expect(mockCollection).toHaveBeenCalledWith(expect.any(Object), "localizedRiddles/en/classic");
      expect(mockCollection).toHaveBeenCalledTimes(2);
    });

    it("should handle concurrent operations gracefully", async () => {
      mockGet.mockResolvedValue({size: 5});

      // Simulate concurrent operations
      const operations = [riddleDataService.getClassicRiddleCount(), riddleDataService.getClassicRiddleCount()];

      const results = await Promise.all(operations);

      expect(results).toEqual([5, 5]);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should handle service recovery from errors", async () => {
      // First operation fails
      mockGet.mockRejectedValueOnce(new Error("Temporary failure"));

      // Second operation succeeds
      mockGet.mockResolvedValueOnce({size: 10});

      // First call should fail
      await expect(riddleDataService.getClassicRiddleCount()).rejects.toThrow("Temporary failure");

      // Service should still work for subsequent calls
      const result = await riddleDataService.getClassicRiddleCount();
      expect(result).toBe(10);

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});

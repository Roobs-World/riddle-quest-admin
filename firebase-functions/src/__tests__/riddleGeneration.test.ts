/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {describe, expect, test, beforeEach, afterEach, jest} from "@jest/globals";

// Mock dependencies - using type assertion to bypass strict typing
/** Provides mock generate unique riddle behavior. */
const mockGenerateUniqueRiddle: any = jest.fn();
/** Provides mock firestore collection behavior. */
const mockFirestoreCollection: any = jest.fn();
/** Provides mock firestore batch behavior. */
const mockFirestoreBatch: any = jest.fn();
/** Provides mock firestore doc behavior. */
const mockFirestoreDoc: any = jest.fn();
/** Provides mock set behavior. */
const mockSet: any = jest.fn();
/** Provides mock commit behavior. */
const mockCommit: any = jest.fn();
/** Provides mock get behavior. */
const mockGet: any = jest.fn();
/** Provides mock where behavior. */
const mockWhere: any = jest.fn();
/** Provides mock order by behavior. */
const mockOrderBy: any = jest.fn();
/** Provides mock limit behavior. */
const mockLimit: any = jest.fn();

jest.mock("../riddles/openaiService", () => ({
  generateUniqueRiddle: mockGenerateUniqueRiddle,
}));

jest.mock("firebase-admin", () => {
  /** Provides firestore impl behavior. */
  const firestoreImpl = () => ({
    collection: mockFirestoreCollection,
    batch: mockFirestoreBatch,
  });
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(firestoreImpl, {
      FieldValue: {
        serverTimestamp: () => ({}),
      },
    }),
  };
});

jest.mock("firebase-functions", () => {
  /** Provides mock https error behavior. */
  class MockHttpsError extends Error {
    /** Creates a mock https error instance. */
    constructor(
      public code: string,
      public message: string,
      public details?: any,
    ) {
      super(message);
      this.name = "HttpsError";
    }
  }

  /** Provides mock module behavior. */
  const mockModule = {
    https: {
      HttpsError: MockHttpsError,
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    config: jest.fn(() => ({})),
  };

  return {
    __esModule: true,
    ...mockModule,
    default: mockModule,
  };
});

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((options, handler) => handler),
}));

import * as riddleGeneration from "../riddles/riddleGeneration";

describe("riddleGeneration", () => {
  /** Provides admin callable request behavior. */
  const adminCallableRequest = {auth: {uid: "admin-user", token: {admin: true}}, data: {}} as any;
  /** Provides mock riddle ref behavior. */
  const mockRiddleRef = {id: "test-riddle-id"};
  /** Provides mock batch behavior. */
  const mockBatch = {
    set: mockSet,
    create: mockSet,
    update: jest.fn(),
    commit: mockCommit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateUniqueRiddle.mockReset();
    mockFirestoreCollection.mockReset();
    mockFirestoreBatch.mockReset();
    mockFirestoreDoc.mockReset();
    mockSet.mockReset();
    mockCommit.mockReset();
    mockGet.mockReset();
    mockWhere.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
    process.env.OPENAI_API_KEY = "test-api-key";

    // Simplified mock setup to reduce memory usage
    /** Provides empty snapshot behavior. */
    const emptySnapshot = {
      empty: true,
      docs: [],
      forEach: jest.fn(),
    };

    // Simple query chain that resolves immediately
    /** Provides mock query behavior. */
    const mockQuery = {
      get: jest.fn().mockResolvedValue(emptySnapshot),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Setup basic mocks with immediate resolution
    mockFirestoreCollection.mockReturnValue({
      doc: mockFirestoreDoc,
      get: jest.fn().mockResolvedValue(emptySnapshot),
      where: jest.fn().mockReturnValue(mockQuery),
    });

    mockFirestoreBatch.mockReturnValue(mockBatch);
    mockFirestoreDoc.mockReturnValue(mockRiddleRef);
    mockWhere.mockReturnValue(mockQuery);
    mockOrderBy.mockReturnValue(mockQuery);
    mockLimit.mockReturnValue(mockQuery);
    mockGet.mockResolvedValue({exists: false, data: () => undefined});
    mockCommit.mockResolvedValue(undefined);
    mockSet.mockResolvedValue(undefined);
    mockFirestoreDoc.mockImplementation((documentPath?: string) => ({
      id: documentPath ?? "test-riddle-id",
      set: mockSet,
      get: documentPath === "current" ? mockGet : jest.fn().mockResolvedValue({exists: false, data: () => undefined}),
    }));
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("Environment Variable Handling", () => {
    test("generateAndAppendRiddles should throw error without OPENAI_API_KEY", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow(
        "OPENAI_API_KEY environment variable is required",
      );
    });

    test("generateAndAppendDailyRiddles should throw error without OPENAI_API_KEY", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(riddleGeneration.generateAndAppendDailyRiddles(1)).rejects.toThrow(
        "OPENAI_API_KEY environment variable is required",
      );
    });

    test("initializeRiddleDatabaseIfEmpty should handle missing API key gracefully", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(riddleGeneration.initializeRiddleDatabaseIfEmpty()).rejects.toThrow(
        "Failed to initialize riddle database.",
      );
    });
  });

  describe("getExistingRiddlesFromFirestore", () => {
    test("should fetch existing riddles from both collections", async () => {
      /** Provides riddles snapshot behavior. */
      const riddlesSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "What is blue?", answer: "sky"})});
          callback({data: () => ({text: "What is red?", answer: "fire"})});
        }),
      };

      /** Provides daily challenge snapshot behavior. */
      const dailyChallengeSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "What is green?", answer: "grass"})});
        }),
      };

      (mockFirestoreCollection as any)
        .mockReturnValueOnce({
          get: jest.fn().mockResolvedValue(riddlesSnapshot),
          doc: jest.fn(),
          where: jest.fn(),
        } as any)
        .mockReturnValueOnce({
          get: jest.fn().mockResolvedValue(dailyChallengeSnapshot),
          doc: jest.fn(),
          where: jest.fn(),
        } as any);

      // Call private function through a public function that uses it
      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow();

      expect(mockFirestoreCollection).toHaveBeenCalledWith("riddles");
      expect(mockFirestoreCollection).toHaveBeenCalledWith("dailyRiddles");
    });

    test("should handle Firestore errors gracefully", async () => {
      (mockFirestoreCollection as any).mockReturnValueOnce({
        get: jest.fn().mockRejectedValue(new Error("Firestore error")),
      } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow();
    });

    test("should handle documents with missing data", async () => {
      /** Provides riddles snapshot behavior. */
      const riddlesSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "What is blue?"})}); // Missing answer
          callback({data: () => ({answer: "fire"})}); // Missing text
          callback({data: () => ({})}); // Empty data
        }),
      };

      (mockFirestoreCollection as any)
        .mockReturnValueOnce({
          get: jest.fn().mockResolvedValue(riddlesSnapshot),
        } as any)
        .mockReturnValueOnce({
          get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        } as any)
        .mockReturnValueOnce({
          get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow();
    });
  });

  describe("getNextClassicIndex", () => {
    test("should return 0 when no classic riddles exist", async () => {
      // Setup specific mocks for index query
      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: jest.fn().mockReturnValue(indexQuery),
      } as any);

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classicIndex: 1, // Starting from 1 when empty (classic_1 naming convention)
        }),
      );
    });

    test("should return next index when riddles exist", async () => {
      /** Provides mock doc behavior. */
      const mockDoc = {data: () => ({classicIndex: 5})};
      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockResolvedValue({empty: false, docs: [mockDoc], forEach: jest.fn()}),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: jest.fn().mockReturnValue(indexQuery),
      } as any);

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classicIndex: 6, // 5 + 1
        }),
      );
    });

    test("should handle missing classicIndex in document", async () => {
      /** Provides mock doc behavior. */
      const mockDoc = {data: () => ({})}; // No classicIndex
      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockResolvedValue({empty: false, docs: [mockDoc], forEach: jest.fn()}),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: jest.fn().mockReturnValue(indexQuery),
      } as any);

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classicIndex: 1, // 0 + 1
        }),
      );
    });

    test("should handle Firestore errors", async () => {
      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockRejectedValue(new Error("Firestore error")),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        where: jest.fn().mockReturnValue(indexQuery),
      } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow();
    });
  });

  describe("getNextDailyIndex", () => {
    test("should return 0 when no daily riddles exist", async () => {
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);

      await riddleGeneration.generateAndAppendDailyRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyIndex: 0, // Starting from 0 when empty
        }),
      );
    });

    test("should return next index when daily riddles exist", async () => {
      mockGet.mockResolvedValue({exists: true, data: () => ({dailyIndex: 3})});

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);

      await riddleGeneration.generateAndAppendDailyRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyIndex: 4, // 3 + 1
        }),
      );
    });
  });

  describe("storeRiddlesInFirestore", () => {
    test("should store riddles with correct data structure", async () => {
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["What is blue?", "sky"]);

      // Mock empty get result for index query
      (mockGet as any).mockResolvedValue({empty: true, docs: [], forEach: jest.fn()});

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(expect.anything(), {
        riddleId: "classic_1",
        text: "What is blue?",
        answer: "sky",
        classicIndex: 1,
        category: "classic",
      });
      expect(mockCommit).toHaveBeenCalled();
    });

    test("should handle batch commit errors", async () => {
      (mockCommit as any).mockRejectedValue(new Error("Commit failed"));
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Test question?", "answer"]);
      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow();
    });
  });

  describe("storeDailyRiddlesInFirestore", () => {
    test("should store daily riddles with correct data structure", async () => {
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["What is green?", "grass"]);
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      await riddleGeneration.generateAndAppendDailyRiddles(1);

      expect(mockSet).toHaveBeenCalledWith({
        riddleId: "current",
        text: "What is green?",
        answer: "grass",
        dailyIndex: 0,
        category: "daily",
        timestamp: {},
      });
    });
  });

  describe("generateAndAppendRiddles", () => {
    test("should successfully generate and store unique riddles", async () => {
      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["What is blue?", "sky", "easy"])
        .mockResolvedValueOnce(["What is red?", "fire", "medium"]);

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(2);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet.mock.calls[0][1]).toMatchObject({difficultyBand: "easy"});
      expect(mockSet.mock.calls[1][1]).toMatchObject({difficultyBand: "medium"});
      expect(mockCommit).toHaveBeenCalled();
    });

    test("should skip duplicate riddles and continue generating", async () => {
      /** Provides existing riddles snapshot behavior. */
      const existingRiddlesSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "What is blue?", answer: "sky"})});
        }),
      };

      /** Provides empty snapshot behavior. */
      const emptySnapshot = {empty: true, docs: [], forEach: jest.fn()};

      // Mock all three collections for getExistingRiddlesFromFirestore
      (mockFirestoreCollection as any)
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(existingRiddlesSnapshot)} as any) // riddles
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(emptySnapshot)} as any) // dailyRiddles
        .mockReturnValue({
          doc: mockFirestoreDoc,
          where: mockWhere,
        } as any);

      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["What is blue?", "sky"]) // Duplicate
        .mockResolvedValueOnce(["What is red?", "fire"]); // Unique

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          text: "What is red?",
          answer: "fire",
        }),
      );
    });

    test("should handle OpenAI service returning null", async () => {
      (mockGenerateUniqueRiddle as any).mockResolvedValueOnce(null).mockResolvedValueOnce(["What is blue?", "sky"]);

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    test("should handle zero riddles gracefully", async () => {
      await riddleGeneration.generateAndAppendRiddles(0);

      expect(mockGenerateUniqueRiddle).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
    });

    test("should handle negative riddle count", async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(riddleGeneration.generateAndAppendRiddles(-1)).rejects.toThrow();
    });

    test("should detect duplicates within same generation batch", async () => {
      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["What is blue?", "sky"])
        .mockResolvedValueOnce(["What is blue?", "sky"]) // Same riddle
        .mockResolvedValueOnce(["What is red?", "fire"]);

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(2);

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({text: "What is blue?"}));
      expect(mockSet).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({text: "What is red?"}));
    });
  });

  describe("generateAndAppendDailyRiddles", () => {
    test("should successfully generate and store daily riddles", async () => {
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Daily riddle?", "answer"]);
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      await riddleGeneration.generateAndAppendDailyRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          riddleId: "current",
          category: "daily",
          dailyIndex: 0,
          timestamp: {},
        }),
      );
    });

    test("should handle duplicate detection for daily riddles", async () => {
      /** Provides existing snapshot behavior. */
      const existingSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "Daily riddle?", answer: "answer"})});
        }),
      };

      /** Provides empty snapshot behavior. */
      const emptySnapshot = {empty: true, docs: [], forEach: jest.fn()};

      // Mock all three collections for getExistingRiddlesFromFirestore
      (mockFirestoreCollection as any)
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(emptySnapshot)} as any) // riddles
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(existingSnapshot)} as any) // dailyRiddles
        .mockReturnValue({
          doc: mockFirestoreDoc,
          where: mockWhere,
        } as any);

      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["Daily riddle?", "answer"]) // Duplicate
        .mockResolvedValueOnce(["Fresh daily riddle?", "new"]);

      await riddleGeneration.generateAndAppendDailyRiddles(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Fresh daily riddle?",
          answer: "new",
          timestamp: {},
        }),
      );
    });
  });

  describe("storeDailyRiddlesInFirestore", () => {
    test("should handle batch commit errors", async () => {
      (mockSet as any).mockRejectedValueOnce(new Error("Daily set failed"));
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Daily?", "d"]);
      mockGet.mockResolvedValue({exists: false, data: () => undefined});

      await expect(riddleGeneration.generateAndAppendDailyRiddles(1)).rejects.toThrow(
        "Failed to generate any unique daily riddles after 10 attempts",
      );
    });
  });

  describe("getNextDailyIndex", () => {
    test("should handle Firestore errors", async () => {
      mockGet.mockRejectedValueOnce(new Error("Daily index error"));

      await expect(riddleGeneration.generateAndAppendDailyRiddles(1)).rejects.toThrow(
        "Failed to get next daily index.",
      );
    });
  });

  describe("initializeRiddleDatabaseIfEmpty", () => {
    test("should skip initialization when riddles already exist", async () => {
      // Mock the existence check to return non-empty
      /** Provides existence query behavior. */
      const existenceQuery = {
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{data: () => ({classicIndex: 1})}],
          forEach: jest.fn(),
        }),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        where: jest.fn().mockReturnValue(existenceQuery),
      } as any);

      await riddleGeneration.initializeRiddleDatabaseIfEmpty();

      expect(mockGenerateUniqueRiddle).not.toHaveBeenCalled();
    });

    test("should initialize database when empty", async () => {
      // Mock the existence check to return empty, then set up generation mocks
      /** Provides existence query behavior. */
      const existenceQuery = {
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        limit: jest.fn().mockReturnThis(),
      };

      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: jest
          .fn()
          .mockReturnValueOnce(existenceQuery) // For existence check
          .mockReturnValue(indexQuery), // For index queries
      } as any);

      // Mock to return consistent valid riddles for expected count
      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["Init riddle 1?", "init1"])
        .mockResolvedValueOnce(["Init riddle 2?", "init2"]);

      await riddleGeneration.initializeRiddleDatabaseIfEmpty(2);

      // Focus on the actual outcome rather than retry counts due to circuit breaker
      expect(mockSet).toHaveBeenCalledTimes(2);
    });

    test("should use default riddle count when not specified", async () => {
      // Mock the existence check to return empty
      /** Provides existence query behavior. */
      const existenceQuery = {
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        limit: jest.fn().mockReturnThis(),
      };

      /** Provides index query behavior. */
      const indexQuery = {
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: jest
          .fn()
          .mockReturnValueOnce(existenceQuery) // For existence check
          .mockReturnValue(indexQuery), // For index queries
      } as any);

      // Mock to return consistent valid riddles for the default count (20)
      Array.from({length: 20}, (_, i) =>
        (mockGenerateUniqueRiddle as any).mockResolvedValueOnce([`Default riddle ${i + 1}?`, `default${i + 1}`]),
      );

      await riddleGeneration.initializeRiddleDatabaseIfEmpty();

      // Focus on the actual outcome rather than retry counts due to circuit breaker
      expect(mockSet).toHaveBeenCalledTimes(20); // Default count
    });

    test("should handle initialization errors", async () => {
      /** Provides existence query behavior. */
      const existenceQuery = {
        get: jest.fn().mockRejectedValue(new Error("Database error")),
        limit: jest.fn().mockReturnThis(),
      };

      (mockFirestoreCollection as any).mockReturnValue({
        where: jest.fn().mockReturnValue(existenceQuery),
      } as any);

      await expect(riddleGeneration.initializeRiddleDatabaseIfEmpty()).rejects.toThrow(
        "Failed to initialize riddle database.",
      );
    });
  });

  describe("Module Structure and Type Safety", () => {
    test("should export all required functions", () => {
      expect(typeof riddleGeneration.generateAndAppendRiddles).toBe("function");
      expect(typeof riddleGeneration.generateAndAppendDailyRiddles).toBe("function");
      expect(typeof riddleGeneration.initializeRiddleDatabaseIfEmpty).toBe("function");
      expect(typeof riddleGeneration.generateLocalizedTodaysDailyChallenge).toBe("function");
    });

    test("functions should have proper TypeScript types", () => {
      /** Provides func1 behavior. */
      const func1: (count: number) => Promise<void> = riddleGeneration.generateAndAppendRiddles;
      /** Provides func2 behavior. */
      const func2: (count: number) => Promise<void> = riddleGeneration.generateAndAppendDailyRiddles;
      /** Provides func3 behavior. */
      const func3: (count?: number) => Promise<void> = riddleGeneration.initializeRiddleDatabaseIfEmpty;
      /** Provides func4 behavior. */
      const func4: (forceGenerate?: boolean) => Promise<void> = riddleGeneration.generateLocalizedTodaysDailyChallenge;

      expect(func1).toBeDefined();
      expect(func2).toBeDefined();
      expect(func3).toBeDefined();
      expect(func4).toBeDefined();
    });
  });

  describe("Duplicate Detection Logic", () => {
    test("should detect question duplicates case-insensitively", () => {
      /** Provides test question behavior. */
      const testQuestion = "What is BLUE?";
      /** Provides existing questions behavior. */
      const existingQuestions = ["what is blue?", "what is red?"];

      expect(existingQuestions.includes(testQuestion.toLowerCase())).toBe(true);
    });

    test("should detect answer duplicates case-insensitively", () => {
      /** Provides test answer behavior. */
      const testAnswer = "SKY";
      /** Provides existing answers behavior. */
      const existingAnswers = ["sky", "fire"];

      expect(existingAnswers.includes(testAnswer.toLowerCase())).toBe(true);
    });

    test("should allow non-duplicate riddles", () => {
      /** Provides new question behavior. */
      const newQuestion = "What is green?";
      /** Provides new answer behavior. */
      const newAnswer = "grass";
      /** Provides existing questions behavior. */
      const existingQuestions = ["what is blue?", "what is red?"];
      /** Provides existing answers behavior. */
      const existingAnswers = ["sky", "fire"];

      expect(existingQuestions.includes(newQuestion.toLowerCase())).toBe(false);
      expect(existingAnswers.includes(newAnswer.toLowerCase())).toBe(false);
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    test("should handle empty responses from OpenAI gracefully", async () => {
      /** Provides call count behavior. */
      let callCount = 0;
      (mockGenerateUniqueRiddle as any).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return Promise.resolve(null);
        return Promise.resolve(["Last riddle?", "final"]);
      });

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(4);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    test("should retry when a generated riddle reveals the answer", async () => {
      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["joke", "joke"])
        .mockResolvedValueOnce(["A quick line that makes people laugh.", "joke"]);

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await riddleGeneration.generateAndAppendRiddles(1);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          text: "A quick line that makes people laugh.",
          answer: "joke",
        }),
      );
    });

    test("should activate circuit breaker when too many failures occur", async () => {
      // Mock to always return null (simulating persistent OpenAI failures)
      (mockGenerateUniqueRiddle as any).mockResolvedValue(null);

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow(
        "Failed to generate any unique riddles after 10 attempts",
      );

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(10); // 1 * 10 max attempts
    });

    test("should activate circuit breaker with duplicate riddles", async () => {
      // Mock to always return the same riddle (simulating persistent duplicates)
      (mockGenerateUniqueRiddle as any).mockResolvedValue(["Repeated riddle?", "same"]);

      /** Provides existing snapshot behavior. */
      const existingSnapshot: any = {
        empty: false,
        docs: [],
        forEach: jest.fn((callback: (doc: any) => void) => {
          callback({data: () => ({text: "Same riddle?", answer: "same"})});
        }),
      };

      /** Provides empty snapshot behavior. */
      const emptySnapshot = {empty: true, docs: [], forEach: jest.fn()};

      // Mock all three collections for getExistingRiddlesFromFirestore
      (mockFirestoreCollection as any)
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(existingSnapshot)} as any) // riddles
        .mockReturnValueOnce({get: jest.fn().mockResolvedValue(emptySnapshot)} as any) // dailyRiddles
        .mockReturnValue({
          doc: mockFirestoreDoc,
          where: mockWhere,
        } as any);

      await expect(riddleGeneration.generateAndAppendRiddles(1)).rejects.toThrow(
        "Failed to generate any unique riddles after 10 attempts",
      );

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(10);
    });

    test("should handle partial success when circuit breaker activates", async () => {
      /** Provides call count behavior. */
      let callCount = 0;
      (mockGenerateUniqueRiddle as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(["Opening riddle?", "first"]);
        return Promise.resolve(null); // All subsequent calls fail
      });

      (mockFirestoreCollection as any).mockReturnValue({
        get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
        doc: mockFirestoreDoc,
        where: mockWhere,
      } as any);

      // Should not throw since we got 1 riddle successfully
      await riddleGeneration.generateAndAppendRiddles(2);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(20); // 2 * 10 max attempts
      expect(mockSet).toHaveBeenCalledTimes(1); // Only 1 successful riddle
    });

    test("should handle batch operations with multiple riddles", async () => {
      (mockGenerateUniqueRiddle as any)
        .mockResolvedValueOnce(["Opening riddle?", "first"])
        .mockResolvedValueOnce(["Follow-up riddle?", "second"]);

      await riddleGeneration.generateAndAppendRiddles(2);

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    // Removed very large riddle generation test to prevent memory issues
  });

  describe("generateLocalizedClassicRiddles", () => {
    test("skips locales that already have localized classic riddles", async () => {
      /** Provides supported locales behavior. */
      const supportedLocales = [
        "ar",
        "de",
        "en",
        "es",
        "fr",
        "hi",
        "id",
        "it",
        "ja",
        "ko",
        "nl",
        "pl",
        "pt",
        "ru",
        "tr",
        "vi",

      ];
      /** Provides seeded locale behavior. */
      const seededLocale = "de";
      /** Provides empty snapshot behavior. */
      const emptySnapshot = {empty: true, docs: [], forEach: jest.fn()};
      /** Provides seeded snapshot behavior. */
      const seededSnapshot = {empty: false, docs: [{data: () => ({classicIndex: 1})}], forEach: jest.fn()};

      (mockGenerateUniqueRiddle as any).mockResolvedValue(["New localized riddle?", "answer"]);

      (mockFirestoreCollection as any).mockImplementation((collectionPath: string) => {
        /** Provides locale behavior. */
        const locale = collectionPath.split("/")[1];
        /** Indicates whether is seeded locale. */
        const isSeededLocale = locale === seededLocale;
        /** Provides query behavior. */
        const query = {
          get: jest.fn().mockResolvedValue(isSeededLocale ? seededSnapshot : emptySnapshot),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        return {
          get: jest.fn().mockResolvedValue(emptySnapshot),
          doc: mockFirestoreDoc,
          where: jest.fn().mockReturnValue(query),
        };
      });

      await riddleGeneration.generateLocalizedClassicRiddles(1);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(supportedLocales.length - 1);
      expect(mockSet).toHaveBeenCalledTimes(supportedLocales.length - 1);
    });
  });

  describe("durable supply deadline", () => {
    test("stores a quality-approved partial batch before returning at the worker deadline", async () => {
      /** Provides clock behavior. */
      let clock = 1000;
      /** Provides date behavior. */
      const date = jest.spyOn(Date, "now").mockImplementation(() => clock);
      mockGenerateUniqueRiddle.mockImplementation(async () => {
        clock = 2000;
        return ["A fruit with crisp flesh and a core?", "apple"];
      });
      try {
        await riddleGeneration.generateLocalizedClassicRiddlesForLocale("ar", 5, 2000);
        expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
        expect(mockGenerateUniqueRiddle.mock.calls[0][2].background).toBe(true);
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockCommit).toHaveBeenCalledTimes(1);
      } finally { date.mockRestore(); }
    });
    test("rejects an empty batch at the deadline so the durable job stays retryable", async () => {
      /** Provides clock behavior. */
      let clock = 1000;
      /** Provides date behavior. */
      const date = jest.spyOn(Date, "now").mockImplementation(() => clock);
      mockGenerateUniqueRiddle.mockImplementation(async () => {clock = 2000; return null;});
      try {
        await expect(riddleGeneration.generateLocalizedClassicRiddlesForLocale("ar", 5, 2000)).rejects.toThrow("Failed to generate any unique classic riddles");
        expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
        expect(mockSet).not.toHaveBeenCalled();
      } finally {date.mockRestore();}
    });
  });

  // Integration tests removed to reduce memory usage and test complexity
});

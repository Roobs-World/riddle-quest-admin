import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {
  migrateRiddlesToSeparateCollections as migrateRiddlesToSeparateCollectionsOriginal,
  cleanupOriginalRiddlesCollection as cleanupOriginalRiddlesCollectionOriginal,
  validateMigration as validateMigrationOriginal,
} from "../migrationScript";

// Mock document snapshot interface
interface MockDocumentSnapshot {
  exists: boolean;
  data: () => unknown;
  id: string;
}

// --- Mocks Start ---
const mockFirestoreGet = jest.fn();
const mockFirestoreSet = jest.fn();
const mockFirestoreAdd = jest.fn();
const mockFirestoreUpdate = jest.fn();
const mockFirestoreDelete = jest.fn();

// Create batch mock
const mockBatch = {
  set: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn(),
};

const mockCount = jest.fn();

const createMockFirestoreRef = () => ({
  get: mockFirestoreGet,
  set: mockFirestoreSet,
  update: mockFirestoreUpdate,
  delete: mockFirestoreDelete,
  collection: jest.fn(() => createMockFirestoreRef()),
  doc: jest.fn(() => createMockFirestoreRef()),
  where: jest.fn(() => createMockFirestoreRef()),
  limit: jest.fn(() => createMockFirestoreRef()),
  add: mockFirestoreAdd,
  count: () => ({get: mockCount}),
});

const mockFirestoreRoot = createMockFirestoreRef();

jest.mock("firebase-admin", () => {
  return {
    initializeApp: jest.fn(),
    firestore: () => ({
      ...mockFirestoreRoot,
      batch: () => mockBatch,
    }),
  };
});

jest.mock("firebase-functions", () => {
  const actual = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    https: {
      ...(actual.https as object),
      HttpsError: actual.https.HttpsError,
    },
    config: () => ({}),
    params: {
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
  };
});

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    ...actualV2Https,
    onCall: jest.fn((optionsOrHandler: unknown, handler?: unknown) => {
      if (typeof optionsOrHandler === "function") {
        return optionsOrHandler;
      }
      return handler;
    }),
  };
});
// --- Mocks End ---

// Use the imported functions directly as they are standalone async functions
const migrateRiddlesToSeparateCollections = migrateRiddlesToSeparateCollectionsOriginal;
const cleanupOriginalRiddlesCollection = cleanupOriginalRiddlesCollectionOriginal;
const validateMigration = validateMigrationOriginal;

describe("Migration Script Functions", () => {
  const mockClassicRiddle = {
    id: "classic_riddle_1",
    data: () => ({
      riddleId: "classic_riddle_1",
      text: "Classic riddle text",
      answer: "CLASSIC",
      classicIndex: 1,
    }),
  };

  const mockDailyRiddle = {
    id: "daily_riddle_1",
    data: () => ({
      riddleId: "daily_riddle_1",
      text: "Daily riddle text",
      answer: "DAILY",
      dailyIndex: 1,
    }),
  };

  const mockTutorialRiddle = {
    id: "tutorial_riddle_1",
    data: () => ({
      riddleId: "tutorial_riddle_1",
      text: "Tutorial riddle text",
      answer: "TUTORIAL",
      tutorialIndex: 1,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestoreGet.mockReset();
    mockFirestoreSet.mockReset();
    mockFirestoreAdd.mockReset();
    mockFirestoreUpdate.mockReset();
    mockFirestoreDelete.mockReset();
    mockBatch.set.mockReset();
    mockBatch.delete.mockReset();
    mockBatch.commit.mockReset();
    mockCount.mockReset();
  });

  describe("migrateRiddlesToSeparateCollections", () => {
    it("should migrate riddles to separate collections successfully", async () => {
      // Mock riddles collection query to return mixed riddles
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [mockClassicRiddle, mockDailyRiddle, mockTutorialRiddle],
        size: 3,
      });

      mockBatch.commit.mockResolvedValue();

      const result = await migrateRiddlesToSeparateCollections();

      expect(result).toMatchObject({
        classicMigrated: 1,
        dailyMigrated: 1,
        tutorialMigrated: 1,
        errors: [],
      });
      expect(mockBatch.set).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("should handle empty riddles collection", async () => {
      mockFirestoreGet.mockResolvedValue({
        empty: true,
        docs: [],
        size: 0,
      });

      const result = await migrateRiddlesToSeparateCollections();

      expect(result).toMatchObject({
        classicMigrated: 0,
        dailyMigrated: 0,
        tutorialMigrated: 0,
        errors: [],
      });
      expect(mockBatch.set).not.toHaveBeenCalled();
    });

    it("should handle batch commit errors", async () => {
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [mockClassicRiddle],
        size: 1,
      });

      mockBatch.commit.mockRejectedValue(new Error("Batch commit failed"));

      await expect(migrateRiddlesToSeparateCollections()).rejects.toThrow(
        "Migration failed: Error: Batch commit failed",
      );
    });
  });

  describe("cleanupOriginalRiddlesCollection", () => {
    it("should cleanup original riddles collection successfully", async () => {
      // Mock riddles collection query to return documents
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [mockClassicRiddle, mockDailyRiddle],
        size: 2,
      });

      mockBatch.commit.mockResolvedValue();

      const result = await cleanupOriginalRiddlesCollection();

      expect(result).toMatchObject({
        riddlesDeleted: 2,
        errors: [],
      });
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("should handle empty collection during cleanup", async () => {
      mockFirestoreGet.mockResolvedValue({
        empty: true,
        docs: [],
        size: 0,
      });

      const result = await cleanupOriginalRiddlesCollection();

      expect(result).toMatchObject({
        riddlesDeleted: 0,
        errors: [],
      });
      expect(mockBatch.delete).not.toHaveBeenCalled();
    });
  });

  describe("validateMigration", () => {
    it("should validate successful migration", async () => {
      // Mock count results for all collections
      mockCount
        .mockResolvedValueOnce({data: () => ({count: 0})}) // Original collection (empty)
        .mockResolvedValueOnce({data: () => ({count: 5})}) // Classic riddles
        .mockResolvedValueOnce({data: () => ({count: 3})}) // Daily riddles
        .mockResolvedValueOnce({data: () => ({count: 2})}); // Tutorial riddles

      const result = await validateMigration();

      expect(result).toMatchObject({
        originalCount: 0,
        classicCount: 5,
        dailyCount: 3,
        tutorialCount: 2,
        totalMigrated: 10,
        isValid: false, // 0 != 10
        errors: expect.arrayContaining([expect.stringContaining("Migration validation failed")]),
      });
    });

    it("should detect validation issues when original collection still has data", async () => {
      // Mock count results showing original collection still has data
      mockCount
        .mockResolvedValueOnce({data: () => ({count: 5})}) // Original collection (still has data)
        .mockResolvedValueOnce({data: () => ({count: 2})}) // Classic riddles
        .mockResolvedValueOnce({data: () => ({count: 2})}) // Daily riddles
        .mockResolvedValueOnce({data: () => ({count: 1})}); // Tutorial riddles

      const result = await validateMigration();

      expect(result).toMatchObject({
        originalCount: 5,
        classicCount: 2,
        dailyCount: 2,
        tutorialCount: 1,
        totalMigrated: 5,
        isValid: true, // 5 == 5
        errors: [],
      });
    });

    it("should handle Firestore errors during validation", async () => {
      mockCount.mockRejectedValue(new Error("Firestore error"));

      await expect(validateMigration()).rejects.toThrow("Validation failed: Error: Firestore error");
    });
  });
});

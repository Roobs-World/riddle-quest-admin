/* eslint-disable */
// @ts-nocheck
// Mock Firebase Admin SDK
const mockFirestoreGet = jest.fn();
const mockFirestoreSet = jest.fn();
const mockFirestoreDoc = jest.fn(() => ({
  id: "mock-riddle-id",
  set: mockFirestoreSet,
}));
const mockFirestoreCollection = jest.fn(() => ({
  doc: mockFirestoreDoc,
  get: mockFirestoreGet,
  where: jest.fn(() => ({
    orderBy: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: mockFirestoreGet,
      })),
    })),
    get: mockFirestoreGet,
  })),
}));
const mockFirestoreBatchCommit = jest.fn();
const mockFirestoreBatchSet = jest.fn();
const mockFirestoreBatch = jest.fn(() => ({
  set: mockFirestoreBatchSet,
  commit: mockFirestoreBatchCommit,
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: mockFirestoreCollection,
    batch: mockFirestoreBatch,
  })),
}));

// Mock OpenAI service
const mockGenerateUniqueRiddle = jest.fn();
jest.mock("../openaiService", () => ({
  generateUniqueRiddle: mockGenerateUniqueRiddle,
}));

// Mock environment variables
const originalEnv = process.env;

import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {generateAndAppendRiddles} from "../generateRiddles";

describe("generateRiddles - Firestore Implementation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "test-openai-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateAndAppendRiddles", () => {
    it("should generate and store riddles successfully in Firestore", async () => {
      const numberOfRiddles = 2;

      // Mock existing riddles query (empty result)
      mockFirestoreGet.mockResolvedValueOnce({
        forEach: jest.fn((_callback: unknown) => {
          // No existing riddles
        }),
      });

      // Mock next classic index query (empty result, so start from 0)
      mockFirestoreGet.mockResolvedValueOnce({
        empty: true,
      });

      // Mock riddle generation
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(["What has keys but no locks?", "keyboard"])
        .mockResolvedValueOnce(["What runs but never walks?", "river"]);

      // Mock batch operations
      mockFirestoreBatchCommit.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles);
      expect(mockFirestoreBatchSet).toHaveBeenCalledTimes(numberOfRiddles);
      expect(mockFirestoreBatchCommit).toHaveBeenCalledTimes(1);

      // Verify the riddle data structure
      expect(mockFirestoreBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          riddleId: "mock-riddle-id",
          text: "What has keys but no locks?",
          answer: "keyboard",
          classicIndex: 0,
          category: "classic",
        }),
      );
    });

    it("should handle duplicate riddles and retry", async () => {
      const numberOfRiddles = 1;

      // Mock existing riddles query with one existing riddle
      mockFirestoreGet.mockResolvedValueOnce({
        forEach: jest.fn((callback) => {
          callback({
            data: () => ({
              text: "existing question",
              answer: "existing answer",
            }),
          });
        }),
      });

      // Mock next classic index query
      mockFirestoreGet.mockResolvedValueOnce({
        empty: true,
      });

      // Mock riddle generation - first is duplicate, second is unique
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(["existing question", "existing answer"]) // Duplicate
        .mockResolvedValueOnce(["What has keys but no locks?", "keyboard"]); // Unique

      mockFirestoreBatchCommit.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockFirestoreBatchSet).toHaveBeenCalledTimes(1);
      expect(mockFirestoreBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("should get correct next classic index when riddles exist", async () => {
      const numberOfRiddles = 1;

      // Mock existing riddles query (empty for duplicate check)
      mockFirestoreGet.mockResolvedValueOnce({
        forEach: jest.fn((callback) => {
          // No existing riddles for duplicate check
        }),
      });

      // Mock next classic index query with existing riddle at index 5
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({classicIndex: 5}),
          },
        ],
      });

      mockGenerateUniqueRiddle.mockResolvedValueOnce(["What has keys but no locks?", "keyboard"]);
      mockFirestoreBatchCommit.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      // Should start from index 6 (5 + 1)
      expect(mockFirestoreBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          classicIndex: 6,
        }),
      );
    });

    it("should handle generation failures (null returns)", async () => {
      const numberOfRiddles = 1;

      mockFirestoreGet.mockResolvedValueOnce({
        forEach: jest.fn((callback) => {
          // No existing riddles
        }),
      });

      mockFirestoreGet.mockResolvedValueOnce({
        empty: true,
      });

      // Mock riddle generation - first fails, second succeeds
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(null) // Failure
        .mockResolvedValueOnce(["What has keys but no locks?", "keyboard"]); // Success

      mockFirestoreBatchCommit.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockFirestoreBatchSet).toHaveBeenCalledTimes(1);
    });

    it("should throw error when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateAndAppendRiddles(1)).rejects.toThrow("OPENAI_API_KEY environment variable is required");
    });

    it("should handle Firestore errors gracefully", async () => {
      process.env.OPENAI_API_KEY = "test-key";

      // Mock Firestore error
      mockFirestoreGet.mockRejectedValueOnce(new Error("Firestore connection failed"));

      await expect(generateAndAppendRiddles(1)).rejects.toThrow("Failed to fetch existing riddles from Firestore.");
    });

    it("should handle batch commit errors", async () => {
      const numberOfRiddles = 1;

      mockFirestoreGet.mockResolvedValueOnce({
        forEach: jest.fn((callback) => {
          // No existing riddles
        }),
      });

      mockFirestoreGet.mockResolvedValueOnce({
        empty: true,
      });

      mockGenerateUniqueRiddle.mockResolvedValueOnce(["What has keys but no locks?", "keyboard"]);

      // Mock batch commit error
      mockFirestoreBatchCommit.mockRejectedValueOnce(new Error("Batch commit failed"));

      await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow("Failed to store riddles in Firestore.");
    });
  });
});

import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as originalFunctions from "firebase-functions";

// Import the function to test
import {generateAndAppendRiddles} from "../generateRiddles.js";

// Mock service dependencies
const mockGetExistingRiddles = jest.fn<() => Promise<{questions: string[]; answers: string[]}>>();
const mockAppendRiddlesToSheet = jest.fn<() => Promise<void>>();
const mockGenerateUniqueRiddle = jest.fn<() => Promise<[string, string] | null>>();

jest.mock("../sheetsService.js", () => ({
  getExistingRiddles: mockGetExistingRiddles,
  appendRiddlesToSheet: mockAppendRiddlesToSheet,
}));

jest.mock("../openaiService.js", () => ({
  generateUniqueRiddle: mockGenerateUniqueRiddle,
}));

// Mock Firebase functions config
const mockConfigData = {
  sheets: {
    spreadsheet_id: "test-spreadsheet-id",
    google_sheets_client_email: "test-client-email@example.com",
    google_sheets_private_key: "test-private-key",
  },
  openai: {
    api_key: "test-openai-key",
  },
};

jest.mock("firebase-functions", () => {
  const actualFunctions = jest.requireActual("firebase-functions") as typeof originalFunctions;
  return {
    ...actualFunctions,
    config: () => mockConfigData,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, "log").mockImplementation(() => {}),
  warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
  error: jest.spyOn(console, "error").mockImplementation(() => {}),
};

describe("generateRiddles - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExistingRiddles.mockReset();
    mockAppendRiddlesToSheet.mockReset();
    mockGenerateUniqueRiddle.mockReset();
    Object.values(consoleSpy).forEach((spy) => spy.mockClear());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateAndAppendRiddles", () => {
    it("should generate and append riddles successfully", async () => {
      const numberOfRiddles = 2;
      mockGetExistingRiddles.mockResolvedValue({questions: ["existing q1"], answers: ["existing a1"]});
      mockGenerateUniqueRiddle.mockResolvedValueOnce(["New Q1", "New A1"]).mockResolvedValueOnce(["New Q2", "New A2"]);
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGetExistingRiddles).toHaveBeenCalledWith("test-spreadsheet-id", "classic!A:B");
      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles);
      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([
        {question: "New Q1", answer: "New A1"},
        {question: "New Q2", answer: "New A2"},
      ]);
      expect(consoleSpy.log).toHaveBeenCalledWith("Generating 2 new riddles...");
      expect(consoleSpy.log).toHaveBeenCalledWith("Successfully appended 2 new riddles to Google Sheet.");
    });

    it("should handle duplicate riddles from existing data", async () => {
      const numberOfRiddles = 1;
      mockGetExistingRiddles.mockResolvedValue({questions: ["existing q1"], answers: ["existing a1"]});
      // First attempt is a duplicate (case-insensitive), second is unique
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(["Existing Q1", "Existing A1"]) // Duplicate (case-insensitive)
        .mockResolvedValueOnce(["New Q1", "New A1"]); // Unique
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([{question: "New Q1", answer: "New A1"}]);
      expect(consoleSpy.warn).toHaveBeenCalledWith("Generated riddle is a duplicate, trying again...");
    });

    it("should handle internally generated duplicates", async () => {
      const numberOfRiddles = 2;
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(["New Q1", "New A1"]) // First unique
        .mockResolvedValueOnce(["New Q1", "New A1"]) // Duplicate of first
        .mockResolvedValueOnce(["New Q2", "New A2"]); // Second unique
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(3);
      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([
        {question: "New Q1", answer: "New A1"},
        {question: "New Q2", answer: "New A2"},
      ]);
    });

    it("should handle generation failures (null returns)", async () => {
      const numberOfRiddles = 1;
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(null) // Generation failure
        .mockResolvedValueOnce(["New Q1", "New A1"]); // Success
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2);
      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([{question: "New Q1", answer: "New A1"}]);
      expect(consoleSpy.warn).toHaveBeenCalledWith("Failed to generate unique riddle, retrying...");
    });

    it("should throw error when max generation attempts reached", async () => {
      const numberOfRiddles = 1;
      mockGetExistingRiddles.mockResolvedValue({questions: ["existing"], answers: ["existing"]});
      // Always return duplicates
      mockGenerateUniqueRiddle.mockResolvedValue(["existing", "existing"]);

      await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(
        "Failed to generate enough unique riddles due to excessive duplicates or generation failures.",
      );

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5); // MAX_GENERATION_ATTEMPTS
      expect(mockAppendRiddlesToSheet).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "Reached maximum generation attempts without generating enough unique riddles.",
      );
    });

    it("should handle case where no riddles are generated but max attempts not reached", async () => {
      const numberOfRiddles = 1;
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      // Return null (generation failures) but not enough to hit max attempts
      mockGenerateUniqueRiddle.mockResolvedValue(null);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
      expect(mockAppendRiddlesToSheet).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith("No new unique riddles were generated.");
    });

    it("should handle empty existing riddles", async () => {
      const numberOfRiddles = 1;
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      mockGenerateUniqueRiddle.mockResolvedValueOnce(["New Q1", "New A1"]);
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([{question: "New Q1", answer: "New A1"}]);
    });

    it("should throw error for missing spreadsheet_id config", async () => {
      jest.resetModules();
      jest.doMock("firebase-functions", () => ({
        config: () => ({
          sheets: {
            // spreadsheet_id missing
            google_sheets_client_email: "test-client-email@example.com",
            google_sheets_private_key: "test-private-key",
          },
          openai: {
            api_key: "test-openai-key",
          },
        }),
      }));

      const {generateAndAppendRiddles: testFunction} = await import("../generateRiddles.js");

      await expect(testFunction(1)).rejects.toThrow(
        "Missing required environment variables: SPREADSHEET_ID (via functions.config().sheets.spreadsheet_id)",
      );
    });

    it("should throw error for missing openai api_key config", async () => {
      jest.resetModules();
      jest.doMock("firebase-functions", () => ({
        config: () => ({
          sheets: {
            spreadsheet_id: "test-spreadsheet-id",
            google_sheets_client_email: "test-client-email@example.com",
            google_sheets_private_key: "test-private-key",
          },
          openai: {
            // api_key missing
          },
        }),
      }));

      const {generateAndAppendRiddles: testFunction} = await import("../generateRiddles.js");

      await expect(testFunction(1)).rejects.toThrow(
        "Missing required environment variables: OPENAI_API_KEY (via functions.config().openai.api_key)",
      );
    });

    it("should throw error for multiple missing configs", async () => {
      jest.resetModules();
      jest.doMock("firebase-functions", () => ({
        config: () => ({
          sheets: {
            // All missing
          },
          openai: {
            // api_key missing
          },
        }),
      }));

      const {generateAndAppendRiddles: testFunction} = await import("../generateRiddles.js");

      await expect(testFunction(1)).rejects.toThrow("Missing required environment variables:");
    });

    it("should correctly update existing arrays to prevent internal duplicates", async () => {
      const numberOfRiddles = 2;
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      mockGenerateUniqueRiddle
        .mockResolvedValueOnce(["Q1", "A1"])
        .mockResolvedValueOnce(["Q1", "A1"]) // This should be detected as duplicate
        .mockResolvedValueOnce(["Q2", "A2"]);
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await generateAndAppendRiddles(numberOfRiddles);

      expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(3);
      expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([
        {question: "Q1", answer: "A1"},
        {question: "Q2", answer: "A2"},
      ]);
    });
  });
});

// Import necessary testing libraries and modules
import {describe, it, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
// Import * as functions to allow mocking specific parts later
import * as originalFunctions from "firebase-functions";

// Import the function to test
import {generateAndAppendRiddles} from "../generateRiddles"; // Removed .js extension

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

// Initialize firebase-functions-test
const testEnv = functionsTest();

// Mock Firebase app and config before any other imports or describe blocks
if (!admin.apps.length) {
  admin.initializeApp();
}

// Mock functions.config()
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
  // Import original module
  const actualFunctions = jest.requireActual("firebase-functions") as typeof originalFunctions;
  return {
    // Preserve all original exports
    ...actualFunctions,
    // Override specific parts
    config: () => mockConfigData,
    // Mock logger if generateRiddles uses it, otherwise it can be omitted
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

describe("generateAndAppendRiddles - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations for each test
    mockGetExistingRiddles.mockReset();
    mockAppendRiddlesToSheet.mockReset();
    mockGenerateUniqueRiddle.mockReset();
  });

  afterEach(() => {
    // Restore all mocks to their original state
    jest.restoreAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

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
  });

  it("should handle duplicate riddles from openaiService and retry", async () => {
    const numberOfRiddles = 1;
    mockGetExistingRiddles.mockResolvedValue({questions: ["existing q1"], answers: ["existing a1"]});
    // First attempt is a duplicate of existing
    mockGenerateUniqueRiddle
      .mockResolvedValueOnce(["existing q1", "existing a1"])
      .mockResolvedValueOnce(["New Q1", "New A1"]); // Second attempt is unique
    mockAppendRiddlesToSheet.mockResolvedValue(undefined);

    await generateAndAppendRiddles(numberOfRiddles);

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(2); // Called twice
    expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([{question: "New Q1", answer: "New A1"}]);
  });

  it("should handle internally generated duplicates and retry", async () => {
    const numberOfRiddles = 2;
    mockGetExistingRiddles.mockResolvedValue({questions: ["existing q1"], answers: ["existing a1"]});
    mockGenerateUniqueRiddle
      .mockResolvedValueOnce(["New Q1", "New A1"]) // Unique
      .mockResolvedValueOnce(["New Q1", "New A1"]) // Duplicate of the first new one
      .mockResolvedValueOnce(["New Q2", "New A2"]); // Unique
    mockAppendRiddlesToSheet.mockResolvedValue(undefined);

    await generateAndAppendRiddles(numberOfRiddles);

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(3); // Called three times
    expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([
      {question: "New Q1", answer: "New A1"},
      {question: "New Q2", answer: "New A2"},
    ]);
  });

  it("should throw an error if MAX_GENERATION_ATTEMPTS is reached", async () => {
    const numberOfRiddles = 1;
    mockGetExistingRiddles.mockResolvedValue({questions: ["q1"], answers: ["a1"]});
    // Always return a duplicate
    mockGenerateUniqueRiddle.mockResolvedValue(["q1", "a1"]);

    await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(
      "Failed to generate enough unique riddles due to excessive duplicates or generation failures.",
    );
    // MAX_GENERATION_ATTEMPTS is numberOfRiddles * 5
    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
    expect(mockAppendRiddlesToSheet).not.toHaveBeenCalled();
  });

  it("should not append if no unique riddles are generated but MAX_ATTEMPTS not reached (e.g., openaiService returns null)", async () => {
    const numberOfRiddles = 1;
    mockGetExistingRiddles.mockResolvedValue({questions: ["q1"], answers: ["a1"]});
    mockGenerateUniqueRiddle.mockResolvedValue(null); // Simulate generation failure

    await generateAndAppendRiddles(numberOfRiddles);

    // MAX_GENERATION_ATTEMPTS is numberOfRiddles * 5
    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
    expect(mockAppendRiddlesToSheet).not.toHaveBeenCalled();
  });

  it("should correctly use environment variables for service calls", async () => {
    const numberOfRiddles = 1;
    mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
    mockGenerateUniqueRiddle.mockResolvedValueOnce(["Test Q", "Test A"]);
    mockAppendRiddlesToSheet.mockResolvedValue(undefined);

    // We need to use jest.isolateModules to test the config effectively,
    // as generateRiddles.ts reads config at the module level.
    let isolatedGenerateAndAppendRiddles: (num: number) => Promise<void>;

    await jest.isolateModules(async () => {
      const isolatedMockConfigData = {
        sheets: {
          spreadsheet_id: "isolated-spreadsheet-id",
          google_sheets_client_email: "isolated-client-email",
          google_sheets_private_key: "isolated-private-key",
        },
        openai: {
          api_key: "isolated-openai-key",
        },
      };
      // This mock will be active only within this isolateModules block
      jest.mock("firebase-functions", () => {
        const actualFunctionsIsolated = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
        return {
          ...actualFunctionsIsolated,
          config: () => isolatedMockConfigData,
          logger: {
            // Ensure logger is also mocked in isolated context
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        };
      });
      // Re-import generateRiddles from within the isolated context
      const module = await import("../generateRiddles.js"); // Re-added .js extension for dynamic import
      isolatedGenerateAndAppendRiddles = module.generateAndAppendRiddles;

      // Clear mocks that might have been called during the top-level import by the outer scope
      mockGetExistingRiddles.mockClear();
      mockAppendRiddlesToSheet.mockClear();
      mockGenerateUniqueRiddle.mockClear();

      // Reset implementations for this isolated test
      mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []});
      mockGenerateUniqueRiddle.mockResolvedValueOnce(["Test Q", "Test A"]);
      mockAppendRiddlesToSheet.mockResolvedValue(undefined);

      await isolatedGenerateAndAppendRiddles(numberOfRiddles);

      expect(mockGetExistingRiddles).toHaveBeenCalledWith("isolated-spreadsheet-id", "classic!A:B");
      // openaiService and sheetsService don't directly take keys/ids in their mocked functions here,
      // but the principle is that generateRiddles was configured with these isolated values.
      // The critical part is that `generateRiddles` itself didn't throw due to missing config.
    });

    // Ensure mocks are reset for subsequent tests outside isolateModules
    mockGetExistingRiddles.mockClear();
    mockAppendRiddlesToSheet.mockClear();
    mockGenerateUniqueRiddle.mockClear();
  });

  it("should handle empty existing riddles", async () => {
    const numberOfRiddles = 1;
    mockGetExistingRiddles.mockResolvedValue({questions: [], answers: []}); // No existing riddles
    mockGenerateUniqueRiddle.mockResolvedValueOnce(["New Q1", "New A1"]);
    mockAppendRiddlesToSheet.mockResolvedValue(undefined);

    await generateAndAppendRiddles(numberOfRiddles);

    expect(mockGenerateUniqueRiddle).toHaveBeenCalledTimes(1);
    expect(mockAppendRiddlesToSheet).toHaveBeenCalledWith([{question: "New Q1", answer: "New A1"}]);
  });
});

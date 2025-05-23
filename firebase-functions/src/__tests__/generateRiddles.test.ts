import {describe, test, expect, jest, beforeEach, afterEach} from "@jest/globals";
import {generateAndAppendRiddles} from "../generateRiddles.js";
import * as sheetsService from "../sheetsService.js";
import * as openaiService from "../openaiService.js";

// Mock firebase-functions - this will be overridden in the env var specific tests
jest.mock("firebase-functions", () => ({
  config: () => ({
    sheets: {
      spreadsheet_id: "test-spreadsheet-id",
      google_sheets_client_email: "test-client-email",
      google_sheets_private_key: "test-private-key",
    },
    openai: {
      api_key: "test-openai-key",
    },
  }),
}));

// Mock sheetsService with explicit return types
jest.mock("../sheetsService.js", () => ({
  getExistingRiddles: jest.fn<() => Promise<{questions: string[]; answers: string[]}>>(),
  appendRiddlesToSheet: jest.fn<() => Promise<void>>(),
}));

// Mock openaiService with explicit return types
jest.mock("../openaiService.js", () => ({
  generateUniqueRiddle: jest.fn<() => Promise<[string, string] | null>>(),
}));

describe("generateAndAppendRiddles", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Suppress console logs for cleaner test output
    jest.spyOn(console, "log").mockImplementation(() => {
      /* suppress logs */
    });
    jest.spyOn(console, "warn").mockImplementation(() => {
      /* suppress logs */
    });
    jest.spyOn(console, "error").mockImplementation(() => {
      /* suppress logs */
    });
  });

  afterEach(() => {
    // Restore console logs
    jest.restoreAllMocks();
  });

  test("should generate and append the specified number of unique riddles", async () => {
    const numberOfRiddles = 2;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: ["existing question 1"],
        answers: ["existing answer 1"],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock)
      .mockResolvedValueOnce(Promise.resolve(["new question 1", "new answer 1"]))
      .mockResolvedValueOnce(Promise.resolve(["new question 2", "new answer 2"]));

    await generateAndAppendRiddles(numberOfRiddles);

    expect(sheetsService.getExistingRiddles).toHaveBeenCalledWith("test-spreadsheet-id", "classic!A:B");
    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles);
    expect(sheetsService.appendRiddlesToSheet).toHaveBeenCalledWith([
      {question: "new question 1", answer: "new answer 1"},
      {question: "new question 2", answer: "new answer 2"},
    ]);
  });

  test("should handle duplicate riddles and retry generation", async () => {
    const numberOfRiddles = 1;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: ["existing q"],
        answers: ["existing a"],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock)
      .mockResolvedValueOnce(Promise.resolve(["existing q", "existing a"]))
      .mockResolvedValueOnce(Promise.resolve(["new unique q", "new unique a"]));

    await generateAndAppendRiddles(numberOfRiddles);

    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(2);
    expect(sheetsService.appendRiddlesToSheet).toHaveBeenCalledWith([
      {question: "new unique q", answer: "new unique a"},
    ]);
  });

  test("should throw an error if MAX_GENERATION_ATTEMPTS is reached", async () => {
    const numberOfRiddles = 1;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: ["q1"],
        answers: ["a1"],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock).mockResolvedValue(Promise.resolve(["q1", "a1"]));

    await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(
      "Failed to generate enough unique riddles due to excessive duplicates or generation failures.",
    );
    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
    expect(sheetsService.appendRiddlesToSheet).not.toHaveBeenCalled();
  });

  test("should not append if no new unique riddles were generated but MAX_ATTEMPTS not reached", async () => {
    const numberOfRiddles = 1;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: ["q1"],
        answers: ["a1"],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock).mockResolvedValue(Promise.resolve(null));

    await generateAndAppendRiddles(numberOfRiddles);

    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
    expect(sheetsService.appendRiddlesToSheet).not.toHaveBeenCalled();
  });

  test("should correctly handle empty existing riddles", async () => {
    const numberOfRiddles = 1;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: [],
        answers: [],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock).mockResolvedValueOnce(Promise.resolve(["new q", "new a"]));

    await generateAndAppendRiddles(numberOfRiddles);

    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(1);
    expect(sheetsService.appendRiddlesToSheet).toHaveBeenCalledWith([{question: "new q", answer: "new a"}]);
  });

  test("should handle case insensitivity for duplicate checking", async () => {
    const numberOfRiddles = 1;
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(
      Promise.resolve({
        questions: ["Existing Question"],
        answers: ["Existing Answer"],
      }),
    );
    (openaiService.generateUniqueRiddle as jest.Mock)
      .mockResolvedValueOnce(Promise.resolve(["existing question", "existing answer"]))
      .mockResolvedValueOnce(Promise.resolve(["New Unique Q", "New Unique A"]));

    await generateAndAppendRiddles(numberOfRiddles);

    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(2);
    expect(sheetsService.appendRiddlesToSheet).toHaveBeenCalledWith([
      {question: "New Unique Q", answer: "New Unique A"},
    ]);
  });

  test("should throw an error if getExistingRiddles fails", async () => {
    const numberOfRiddles = 1;
    const sheetsError = new Error("Failed to get existing riddles");
    (sheetsService.getExistingRiddles as jest.Mock).mockRejectedValue(sheetsError);

    await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(sheetsError);
    expect(sheetsService.getExistingRiddles).toHaveBeenCalledWith("test-spreadsheet-id", "classic!A:B");
    expect(openaiService.generateUniqueRiddle).not.toHaveBeenCalled();
    expect(sheetsService.appendRiddlesToSheet).not.toHaveBeenCalled();
  });

  test("should throw an error if generateUniqueRiddle consistently throws errors", async () => {
    const numberOfRiddles = 1;
    const openaiError = new Error("OpenAI API error");
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(Promise.resolve({questions: [], answers: []}));
    (openaiService.generateUniqueRiddle as jest.Mock).mockRejectedValue(Promise.reject(openaiError));

    await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(
      "Failed to generate enough unique riddles due to excessive duplicates or generation failures.",
    );
    expect(sheetsService.getExistingRiddles).toHaveBeenCalledTimes(1);
    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(numberOfRiddles * 5);
    expect(sheetsService.appendRiddlesToSheet).not.toHaveBeenCalled();
  });

  test("should throw an error if appendRiddlesToSheet fails", async () => {
    const numberOfRiddles = 1;
    const appendError = new Error("Failed to append riddles");
    (sheetsService.getExistingRiddles as jest.Mock).mockResolvedValue(Promise.resolve({questions: [], answers: []}));
    (openaiService.generateUniqueRiddle as jest.Mock).mockResolvedValueOnce(Promise.resolve(["new q", "new a"]));
    (sheetsService.appendRiddlesToSheet as jest.Mock).mockRejectedValue(Promise.reject(appendError));

    await expect(generateAndAppendRiddles(numberOfRiddles)).rejects.toThrow(appendError);
    expect(sheetsService.getExistingRiddles).toHaveBeenCalledTimes(1);
    expect(openaiService.generateUniqueRiddle).toHaveBeenCalledTimes(1);
    expect(sheetsService.appendRiddlesToSheet).toHaveBeenCalledWith([{question: "new q", answer: "new a"}]);
  });
});

describe("generateAndAppendRiddles - environment variable checks", () => {
  let generateRiddlesModule: {generateAndAppendRiddles: (count: number) => Promise<void>} | undefined;

  beforeEach(() => {
    jest.resetModules(); // Vital to allow re-importing with different mock configs
    jest.spyOn(console, "log").mockImplementation(() => {
      /* suppress logs */
    });
    jest.spyOn(console, "warn").mockImplementation(() => {
      /* suppress logs */
    });
    jest.spyOn(console, "error").mockImplementation(() => {
      /* suppress logs */
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules(); // Ensure modules are reset after these tests too
  });

  const loadModuleWithMockConfig = async (mockConfigData: Record<string, unknown>) => {
    jest.doMock("firebase-functions", () => ({
      config: () => mockConfigData,
    }));
    generateRiddlesModule = await import("../generateRiddles.js");
  };

  test("should throw error if SPREADSHEET_ID is missing", () => {
    expect(() =>
      loadModuleWithMockConfig({
        sheets: {google_sheets_client_email: "e", google_sheets_private_key: "k"},
        openai: {api_key: "o"},
      }),
    ).toThrow("SPREADSHEET_ID");
  });

  test("should throw error if GOOGLE_SHEETS_CLIENT_EMAIL is missing", () => {
    expect(() =>
      loadModuleWithMockConfig({
        sheets: {spreadsheet_id: "id", google_sheets_private_key: "k"},
        openai: {api_key: "o"},
      }),
    ).toThrow("GOOGLE_SHEETS_CLIENT_EMAIL");
  });

  test("should throw error if GOOGLE_SHEETS_PRIVATE_KEY is missing", () => {
    expect(() =>
      loadModuleWithMockConfig({
        sheets: {spreadsheet_id: "id", google_sheets_client_email: "e"},
        openai: {api_key: "o"},
      }),
    ).toThrow("GOOGLE_SHEETS_PRIVATE_KEY");
  });

  test("should throw error if OPENAI_API_KEY is missing", () => {
    expect(() =>
      loadModuleWithMockConfig({
        sheets: {spreadsheet_id: "id", google_sheets_client_email: "e", google_sheets_private_key: "k"},
        openai: {}, // api_key missing
      }),
    ).toThrow("OPENAI_API_KEY");
  });

  test("should throw with all missing keys in message", () => {
    expect(() => loadModuleWithMockConfig({sheets: {}, openai: {}})).toThrow(
      "SPREADSHEET_ID (via functions.config().sheets.spreadsheet_id), GOOGLE_SHEETS_CLIENT_EMAIL (via functions.config().sheets.google_sheets_client_email), GOOGLE_SHEETS_PRIVATE_KEY (via functions.config().sheets.google_sheets_private_key), OPENAI_API_KEY (via functions.config().openai.api_key)",
    );
  });

  test("should not throw if all env vars are present", () => {
    expect(() =>
      loadModuleWithMockConfig({
        sheets: {
          spreadsheet_id: "test-spreadsheet-id",
          google_sheets_client_email: "test-client-email",
          google_sheets_private_key: "test-private-key",
        },
        openai: {
          api_key: "test-openai-key",
        },
      }),
    ).not.toThrow();
    expect(generateRiddlesModule).toBeDefined();
    expect(typeof generateRiddlesModule.generateAndAppendRiddles).toBe("function");
  });
});

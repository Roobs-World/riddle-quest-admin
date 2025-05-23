import {vi, describe, it, expect, beforeEach, afterEach} from "vitest";
import {getExistingRiddles, appendRiddlesToSheet, getRiddleDataFromSheetGoogleApis} from "../sheetsService";
import * as functions from "firebase-functions";
import {google} from "googleapis";

// Mock firebase-functions
vi.mock("firebase-functions", () => ({
  config: () => ({
    sheets: {
      spreadsheet_id: "test-spreadsheet-id",
      google_sheets_client_email: "test-email@example.com",
      google_sheets_private_key: "test-private-key\\npart2",
    },
  }),
}));

const mockJWTConstructor = vi.fn();

// Mock googleapis
const mockGet = vi.fn();
const mockAppend = vi.fn();
vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: mockJWTConstructor.mockImplementation(() => ({})),
    },
    sheets: vi.fn(() => ({
      spreadsheets: {
        values: {
          get: mockGet,
          append: mockAppend,
        },
      },
    })),
  },
}));

describe("sheetsService", () => {
  let originalConsole: Console;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJWTConstructor.mockClear();
    originalConsole = global.console;
    global.console = {log: vi.fn(), warn: vi.fn(), error: vi.fn()} as unknown as Console;
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  describe("Initialization", () => {
    it("should initialize JWT client with correctly formatted private key", async () => {
      // This dynamic import will trigger the module initialization
      // @ts-expect-error TS(2307) Current tools cannot infer type for dynamically imported JS
      await import("../../lib/sheetsService.js");

      expect(google.auth.JWT).toHaveBeenCalledTimes(1);
      expect(mockJWTConstructor).toHaveBeenCalledWith("test-email@example.com", undefined, "test-private-key\npart2", [
        "https://www.googleapis.com/auth/spreadsheets",
      ]);
    });
  });

  describe("getExistingRiddles", () => {
    it("should fetch and process existing riddles correctly", async () => {
      mockGet.mockResolvedValue({
        data: {
          values: [
            ["Question 1", "Answer1"],
            ["question 2", "ANSWER2"],
          ],
        },
      });

      const result = await getExistingRiddles("test-id", "Sheet1!A:B");

      expect(result).toEqual({
        questions: ["question 1", "question 2"],
        answers: ["answer1", "answer2"],
      });
      expect(mockGet).toHaveBeenCalledWith({spreadsheetId: "test-id", range: "Sheet1!A:B"});
    });

    it("should return empty arrays if no rows are found", async () => {
      mockGet.mockResolvedValue({data: {values: []}});
      const result = await getExistingRiddles("test-id", "Sheet1!A:B");
      expect(result).toEqual({questions: [], answers: []});
    });

    it("should return empty arrays if values are null", async () => {
      mockGet.mockResolvedValue({data: {values: null}});
      const result = await getExistingRiddles("test-id", "Sheet1!A:B");
      expect(result).toEqual({questions: [], answers: []});
    });

    it("should handle rows with missing question or answer gracefully", async () => {
      mockGet.mockResolvedValue({
        data: {
          values: [
            ["Question 1", "Answer1"],
            [null, "Answer2"], // Missing question
            ["Question 3", undefined], // Missing answer
          ],
        },
      });
      const result = await getExistingRiddles("test-id", "Sheet1!A:B");
      expect(result).toEqual({
        questions: ["question 1", "", "question 3"],
        answers: ["answer1", "answer2", ""],
      });
    });

    it("should throw an error if fetching fails", async () => {
      mockGet.mockRejectedValue(new Error("API Error"));
      await expect(getExistingRiddles("test-id", "Sheet1!A:B")).rejects.toThrow(
        "Failed to fetch existing riddles from Google Sheet.",
      );
      expect(console.error).toHaveBeenCalledWith("Error fetching existing riddles:", expect.any(Error));
    });
  });

  describe("appendRiddlesToSheet", () => {
    it("should append riddles correctly", async () => {
      mockAppend.mockResolvedValue({data: {updates: {updatedCells: 2}}});
      const riddles = [{question: "Q1", answer: "A1"}];
      await appendRiddlesToSheet(riddles);

      expect(mockAppend).toHaveBeenCalledWith({
        spreadsheetId: "test-spreadsheet-id", // From mock config
        range: "classic!A:B",
        valueInputOption: "USER_ENTERED",
        requestBody: {values: [["Q1", "A1"]]},
      });
      expect(console.log).toHaveBeenCalledWith("2 cells appended.");
    });

    it("should log 0 cells if updates or updatedCells is missing", async () => {
      mockAppend.mockResolvedValue({data: {}}); // No updates field
      await appendRiddlesToSheet([{question: "Q1", answer: "A1"}]);
      expect(console.log).toHaveBeenCalledWith("0 cells appended.");

      mockAppend.mockResolvedValue({data: {updates: {}}}); // No updatedCells field
      await appendRiddlesToSheet([{question: "Q1", answer: "A1"}]);
      expect(console.log).toHaveBeenCalledWith("0 cells appended.");
    });

    it("should throw an error if appending fails", async () => {
      mockAppend.mockRejectedValue(new Error("API Error"));
      await expect(appendRiddlesToSheet([])).rejects.toThrow("Failed to append riddles to Google Sheet.");
      expect(console.error).toHaveBeenCalledWith("Error appending to Google Sheet:", expect.any(Error));
    });
  });

  describe("getRiddleDataFromSheetGoogleApis", () => {
    it("should fetch a specific riddle correctly", async () => {
      mockGet.mockResolvedValue({
        data: {
          values: [["Specific Q", "Specific A"]],
        },
      });

      const result = await getRiddleDataFromSheetGoogleApis("Classic", 1);
      expect(result).toEqual(["Specific Q", "Specific A"]);
      expect(mockGet).toHaveBeenCalledWith({
        spreadsheetId: "test-spreadsheet-id", // From mock config
        range: "Classic!A1:B1",
      });
    });

    it("should return null if no data is found", async () => {
      mockGet.mockResolvedValue({data: {values: []}});
      const result = await getRiddleDataFromSheetGoogleApis("Daily", 2);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        "Missing or malformed data from Google Sheets for gameMode: Daily, index: 2",
      );
    });

    it("should return null if row data is malformed (not enough columns)", async () => {
      mockGet.mockResolvedValue({data: {values: [["Only Question"]]}}); // Only one column
      const result = await getRiddleDataFromSheetGoogleApis("Test", 3);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        "Missing or malformed data from Google Sheets for gameMode: Test, index: 3",
      );
    });

    it("should return null if rowData itself is null", async () => {
      mockGet.mockResolvedValue({data: {values: null}});
      const result = await getRiddleDataFromSheetGoogleApis("Test", 3);
      expect(result).toBeNull();
    });

    it("should return null if rowData[0] is null", async () => {
      mockGet.mockResolvedValue({data: {values: [null]}}); // rowData[0] is null
      const result = await getRiddleDataFromSheetGoogleApis("Test", 3);
      expect(result).toBeNull();
    });

    it("should throw an error if fetching specific riddle fails", async () => {
      mockGet.mockRejectedValue(new Error("API Error"));
      await expect(getRiddleDataFromSheetGoogleApis("Classic", 1)).rejects.toThrow(
        "Failed to fetch riddle data from sheet for Classic at index 1 using googleapis.",
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching riddle data from Google Sheets using googleapis: Error: API Error",
        {gameMode: "Classic", index: 1},
      );
    });
  });
});

describe("sheetsService - Environment Variable Checks", () => {
  let originalConsole: Console;
  const originalConfig = functions.config(); // Store the original config

  beforeEach(() => {
    vi.resetModules(); // Crucial to re-evaluate module top-level code for env var checks
    originalConsole = global.console;
    global.console = {log: vi.fn(), warn: vi.fn(), error: vi.fn()} as unknown as Console;
  });

  afterEach(() => {
    // Restore the original config mock after each test in this describe block
    vi.doMock("firebase-functions", () => ({config: () => originalConfig}));
    global.console = originalConsole;
  });

  it("should throw error if SPREADSHEET_ID is missing", async () => {
    vi.doMock("firebase-functions", () => ({
      config: () => ({
        sheets: {
          // spreadsheet_id is missing
          google_sheets_client_email: "test-email",
          google_sheets_private_key: "test-key",
        },
      }),
    }));
    // @ts-expect-error TS(2307) Current tools cannot infer type for dynamically imported JS
    await expect(import("../../lib/sheetsService.js")).rejects.toThrow(
      "Missing required environment variables for Google Sheets.",
    );
  });

  it("should throw error if GOOGLE_SHEETS_CLIENT_EMAIL is missing", async () => {
    vi.doMock("firebase-functions", () => ({
      config: () => ({
        sheets: {
          spreadsheet_id: "test-id",
          // google_sheets_client_email is missing
          google_sheets_private_key: "test-key",
        },
      }),
    }));
    // @ts-expect-error TS(2307) Current tools cannot infer type for dynamically imported JS
    await expect(import("../../lib/sheetsService.js")).rejects.toThrow(
      "Missing required environment variables for Google Sheets.",
    );
  });

  it("should throw error if GOOGLE_SHEETS_PRIVATE_KEY is missing", async () => {
    vi.doMock("firebase-functions", () => ({
      config: () => ({
        sheets: {
          spreadsheet_id: "test-id",
          google_sheets_client_email: "test-email",
          // google_sheets_private_key is missing
        },
      }),
    }));
    // @ts-expect-error TS(2307) Current tools cannot infer type for dynamically imported JS
    await expect(import("../../lib/sheetsService.js")).rejects.toThrow(
      "Missing required environment variables for Google Sheets.",
    );
  });

  it("should throw error if sheets config itself is missing", async () => {
    vi.doMock("firebase-functions", () => ({
      config: () => ({}), // sheets object is missing
    }));
    // @ts-expect-error TS(2307) Current tools cannot infer type for dynamically imported JS
    await expect(import("../../lib/sheetsService.js")).rejects.toThrow(
      "Missing required environment variables for Google Sheets.",
    );
  });
});

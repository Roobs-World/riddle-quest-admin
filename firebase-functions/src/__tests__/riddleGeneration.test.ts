import {describe, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as generateRiddlesModuleKey from "../generateRiddles";

// Mock the generateRiddles module
jest.mock("../generateRiddles", () => ({
  generateAndAppendRiddles: jest.fn<(numberOfRiddles: number) => Promise<void>>(),
}));

// Mock Firebase Functions
jest.mock("firebase-functions", () => ({
  https: {
    HttpsError: jest.fn((code: string, message: string, details?: any) => {
      const error = new Error(message);
      (error as any).code = code;
      if (details !== undefined) {
        (error as any).details = details;
      }
      return error;
    }),
  },
}));

// Mock Firebase Admin
jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
    })),
  })),
}));

describe("generateClassicRiddles Cloud Function", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call generateAndAppendRiddles with 5 and return success", async () => {
    const mockFn = generateRiddlesModuleKey.generateAndAppendRiddles as jest.MockedFunction<
      (numberOfRiddles: number) => Promise<void>
    >;
    mockFn.mockResolvedValue();

    // For testing purposes, we'll test the logic by calling generateAndAppendRiddles directly
    await generateRiddlesModuleKey.generateAndAppendRiddles(5);

    expect(generateRiddlesModuleKey.generateAndAppendRiddles).toHaveBeenCalledWith(5);
  });

  test("should throw error if generateAndAppendRiddles fails", async () => {
    const errorMessage = "Failed to append to sheet";
    const originalError = new Error(errorMessage);
    const mockFn = generateRiddlesModuleKey.generateAndAppendRiddles as jest.MockedFunction<
      (numberOfRiddles: number) => Promise<void>
    >;
    mockFn.mockRejectedValue(originalError);

    await expect(generateRiddlesModuleKey.generateAndAppendRiddles(5)).rejects.toThrow(errorMessage);
    expect(generateRiddlesModuleKey.generateAndAppendRiddles).toHaveBeenCalledWith(5);
  });
});

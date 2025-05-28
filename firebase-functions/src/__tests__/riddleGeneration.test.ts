import {describe, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as functions from "firebase-functions"; // For types like CallableRequest
import * as generateRiddlesModuleKey from "../generateRiddles"; // SUT dependency

const mockOnCall_v2_https = jest.fn(); // Renamed to start with mock

// Mock other SUT dependencies (these are hoisted)
jest.mock("../generateRiddles", () => ({
  generateAndAppendRiddles: jest.fn<() => Promise<void>>(),
}));

// THIS TOP LEVEL MOCK IS HOISTED
jest.mock("firebase-functions", () => {
  const originalFunctions = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
  return {
    ...originalFunctions, // Spread actual functions first
    logger: {info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()},
    https: {
      // Ensure https is explicitly defined
      ...originalFunctions.https, // Spread actual https if it exists and has other properties
      HttpsError: jest.fn((code, msg) => {
        // Override HttpsError
        const e = new Error(msg as string);
        (e as any).code = code;
        return e;
      }),
    },
  };
});

// Use jest.doMock for firebase-functions/v2/https immediately before SUT import
jest.doMock("firebase-functions/v2/https", () => {
  const originalModule = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    __esModule: true,
    ...originalModule,
    onCall: mockOnCall_v2_https, // Use the module-scoped mock here
    HttpsError: originalModule.HttpsError, // Keep original HttpsError from v2/https
  };
});

// Import SUT after mocks are defined. Its 'onCall' will be the one from the factory.
// const {generateClassicRiddles} = require("../riddleGeneration");

describe("generateClassicRiddles Cloud Function", () => {
  let actualHandlerToTest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnCall_v2_https.mockImplementation((handler: any) => {
      console.log("[TEST DEBUG] mockOnCall_v2_https used. Handler type:", typeof handler);
      actualHandlerToTest = handler;
      return handler;
    });

    jest.resetModules();
    // Re-apply doMocks after resetModules
    jest.doMock("firebase-functions/v2/https", () => {
      const originalModule = jest.requireActual(
        "firebase-functions/v2/https",
      ) as typeof import("firebase-functions/v2/https");
      return {
        __esModule: true,
        ...originalModule,
        onCall: mockOnCall_v2_https,
        HttpsError: originalModule.HttpsError,
      };
    });
    jest.doMock("../generateRiddles", () => ({
      generateAndAppendRiddles: generateRiddlesModuleKey.generateAndAppendRiddles,
    }));
    // THIS doMock is what the SUT will see when required after resetModules
    jest.doMock("firebase-functions", (): typeof import("firebase-functions") => {
      const MockHttpsError = jest.fn((code: string, message: string, details?: any) => {
        const error = new Error(message);
        (error as any).code = code;
        if (details !== undefined) {
          (error as any).details = details;
        }
        return error;
      }) as any; // Cast to any to allow assignment to HttpsError type

      return {
        logger: {
          info: jest.fn<(...args: any[]) => void>(),
          error: jest.fn<(...args: any[]) => void>(),
          warn: jest.fn<(...args: any[]) => void>(),
          debug: jest.fn<(...args: any[]) => void>(),
        },
        https: {
          HttpsError: MockHttpsError,
        },
        config: jest.fn<() => any>(() => ({})),
        // Provide other minimal mocks for firebase-functions top-level exports if needed by SUT
        // Casting the whole object to the module type to satisfy TypeScript
      } as typeof import("firebase-functions");
    });

    const SUT_MODULE = require("../riddleGeneration");
    actualHandlerToTest = SUT_MODULE.generateClassicRiddles;

    jest.spyOn(console, "log").mockImplementation((..._args: any[]): void => {});
    jest.spyOn(console, "error").mockImplementation((..._args: any[]): void => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test("should call generateAndAppendRiddles with 5 and return success", async () => {
    (generateRiddlesModuleKey.generateAndAppendRiddles as jest.Mock).mockResolvedValue(undefined);
    const request = {data: {}} as functions.https.CallableRequest;
    if (typeof actualHandlerToTest !== "function") {
      throw new Error("Test setup error: actualHandlerToTest was not a function.");
    }
    const result = await actualHandlerToTest(request);
    expect(generateRiddlesModuleKey.generateAndAppendRiddles).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      success: true,
      message: "New Classic Mode riddles generated and added to Firestore.",
    });
    expect(console.log).toHaveBeenCalledWith("Client requested Classic Mode riddle generation.");
    expect(console.log).toHaveBeenCalledWith("Classic Mode riddles generated and stored in Firestore.");
  });

  test("should throw HttpsError if generateAndAppendRiddles fails", async () => {
    const errorMessage = "Failed to append to sheet";
    const originalError = new Error(errorMessage);
    (generateRiddlesModuleKey.generateAndAppendRiddles as jest.Mock).mockRejectedValue(originalError);
    const request = {data: {}} as functions.https.CallableRequest;
    if (typeof actualHandlerToTest !== "function") {
      throw new Error("Test setup error: actualHandlerToTest was not a function.");
    }

    try {
      await actualHandlerToTest(request);
      // If the above line does not throw, this test should fail.
      throw new Error("actualHandlerToTest did not throw as expected");
    } catch (e: any) {
      expect(e.code).toBe("internal");
      expect(e.message).toBe("Failed to generate new classic riddles.");
      // Based on the current SUT behavior, it passes originalError as 'details'.
      expect(e.details).toBe(originalError);
    }

    expect(generateRiddlesModuleKey.generateAndAppendRiddles).toHaveBeenCalledWith(5);
    expect(console.error).toHaveBeenCalledWith("Error generating Classic Mode riddles:", originalError);
  });
});

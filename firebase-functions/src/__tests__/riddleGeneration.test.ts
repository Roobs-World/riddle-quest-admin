import * as functions from "firebase-functions";
import {https} from "firebase-functions"; // For HttpsError
import * as generateRiddles from "../generateRiddles.js"; // Mock this module

// Mock the generateRiddles module
jest.mock("../generateRiddles.js", () => ({
  generateAndAppendRiddles: jest.fn(),
}));

// Global mock for firebase-functions/v2/https
let actualOnCallHandlerForRiddleGen: ((request: functions.https.CallableRequest) => unknown) | null = null;
const mockCallableFunctionForRiddleGen = jest.fn(async (dataOrRequest?: unknown) => {
  if (actualOnCallHandlerForRiddleGen) {
    const request =
      dataOrRequest && typeof (dataOrRequest as {auth?: unknown}).auth !== "undefined"
        ? dataOrRequest
        : {data: dataOrRequest, auth: undefined}; // Default to unauthenticated
    return actualOnCallHandlerForRiddleGen(request as functions.https.CallableRequest);
  }
  throw new Error("onCall handler not captured for riddleGeneration");
});

jest.mock("firebase-functions/v2/https", async () => {
  const actualHttps = (await jest.requireActual("firebase-functions/v2/https")) as Record<string, unknown>;
  return {
    ...actualHttps,
    onCall: (handler: (request: functions.https.CallableRequest) => unknown) => {
      actualOnCallHandlerForRiddleGen = handler; // Capture the handler
      return mockCallableFunctionForRiddleGen; // Return a callable mock
    },
    HttpsError: actualHttps.HttpsError, // Ensure HttpsError from v2/https is available
  };
});

// Import the function to test AFTER mocks are set up
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {generateClassicRiddles} from "../riddleGeneration.js";

describe("generateClassicRiddles Cloud Function", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure the handler is captured for each test suite run, especially after jest.resetModules()
    if (!actualOnCallHandlerForRiddleGen) {
      jest.resetModules(); // Reset modules to re-capture the handler
      // Re-mock generateRiddles before re-importing riddleGeneration
      jest.doMock("../generateRiddles.js", () => ({
        generateAndAppendRiddles: jest.fn(),
      }));
      void import("../riddleGeneration.js"); // Re-trigger import and onCall mock
      if (!actualOnCallHandlerForRiddleGen) {
        throw new Error("Failed to capture onCall handler for generateClassicRiddles after reset");
      }
    }
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    actualOnCallHandlerForRiddleGen = null; // Clean up captured handler
    jest.resetModules(); // Clean slate
  });

  test("should call generateAndAppendRiddles with 5 and return success", async () => {
    (generateRiddles.generateAndAppendRiddles as jest.Mock).mockResolvedValue(undefined);
    const request = {data: {}} as functions.https.CallableRequest; // No specific data needed

    const result = await actualOnCallHandlerForRiddleGen!(request);

    expect(generateRiddles.generateAndAppendRiddles).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      success: true,
      message: "New Classic Mode riddles generated and added to Sheets.",
    });
    expect(console.log).toHaveBeenCalledWith("Client requested Classic Mode riddle generation.");
    expect(console.log).toHaveBeenCalledWith("Classic Mode riddles generated and appended to Google Sheets.");
  });

  test("should throw HttpsError if generateAndAppendRiddles fails", async () => {
    const errorMessage = "Failed to append to sheet";
    const originalError = new Error(errorMessage);
    (generateRiddles.generateAndAppendRiddles as jest.Mock).mockRejectedValue(originalError);
    const request = {data: {}} as functions.https.CallableRequest;

    await expect(actualOnCallHandlerForRiddleGen!(request)).rejects.toThrow(
      new https.HttpsError("internal", "Failed to generate new classic riddles.", originalError),
    );
    expect(generateRiddles.generateAndAppendRiddles).toHaveBeenCalledWith(5);
    expect(console.error).toHaveBeenCalledWith("Error generating Classic Mode riddles:", originalError);
  });
});

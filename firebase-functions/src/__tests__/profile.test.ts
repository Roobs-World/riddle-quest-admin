import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {PlayerSchema} from "../validation/firestoreSchemas.js"; // Adjust path as needed
import {https} from "firebase-functions"; // For HttpsError

// Initialize Firebase Admin SDK for testing, if not already done
// This might be done in a global setup file for all tests
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Mock Firebase Admin Update function
let mockUpdate: jest.Mock<() => Promise<void>>;

// Mock the entire firebase-admin SDK
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [], // Simulate no apps initialized by default for the test check
  firestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnThis(), // Make collection chainable
    doc: jest.fn().mockReturnThis(), // Make doc chainable
    update: jest.fn(),
    // Add other Firestore methods if your functions use them
  }),
  // Mock other admin services if needed (e.g., auth, storage)
}));

// Global mock for firebase-functions/v2/https
// This will capture the handler passed to onCall
let actualOnCallHandler: ((request: functions.https.CallableRequest) => unknown) | null = null;
const mockCallableFunction = jest.fn(async (dataOrRequest?: unknown) => {
  if (actualOnCallHandler) {
    const request =
      dataOrRequest && typeof (dataOrRequest as {auth?: unknown}).auth !== "undefined"
        ? dataOrRequest
        : {data: dataOrRequest, auth: undefined};
    return actualOnCallHandler(request as functions.https.CallableRequest);
  }
  throw new Error("onCall handler not captured by mock");
});
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (handler: (request: functions.https.CallableRequest) => unknown) => {
    actualOnCallHandler = handler; // Capture the handler
    // The function returned by onCall is what Firebase invokes.
    // So, our mock for onCall should return a function that, when called by Firebase (or our tests),
    // executes the `handler` with the request.
    // The `mockCallableFunction` above already does this if we ensure it uses the latest `actualOnCallHandler`.
    // For simplicity and directness in testing the handler, we can also just grab `actualOnCallHandler`.
    return mockCallableFunction; // Tests can call this, or `actualOnCallHandler` directly.
  },
}));

// Import the resetStats function after mocks are set up - this will trigger onCall and populate actualOnCallHandler
import "../profile.js";

describe("resetStats", () => {
  let originalConsole: Console;

  beforeEach(() => {
    jest.clearAllMocks(); // Clears mockCallableFunction as well
    originalConsole = global.console;
    global.console = {log: jest.fn(), warn: jest.fn(), error: jest.fn()} as unknown as Console;
    // mockCallableFunction.mockClear(); // Already cleared by jest.clearAllMocks()
    (admin.firestore as unknown as jest.Mock).mockClear();

    // Re-initialize mock with proper typing
    mockUpdate = jest.fn<() => Promise<void>>();
    mockUpdate.mockResolvedValue(undefined);

    (admin.firestore as unknown as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnValue({update: mockUpdate}),
    });

    // jest.spyOn(console, "log").mockImplementation(() => {}); // These are covered by global.console mock
    // jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.console = originalConsole;
    jest.restoreAllMocks();
    actualOnCallHandler = null; // Reset for subsequent describe blocks if any
  });

  it("should reset user stats successfully when authenticated", async () => {
    const mockRequest = {
      auth: {uid: "test-user-id"},
      data: {},
    } as functions.https.CallableRequest;

    if (!actualOnCallHandler) {
      throw new Error("onCall handler was not captured properly");
    }

    await actualOnCallHandler(mockRequest);

    expect(admin.firestore().collection("users").doc).toHaveBeenCalledWith("test-user-id");
    expect(mockUpdate).toHaveBeenCalledWith({stats: PlayerSchema.parse({})});
    expect(console.log).toHaveBeenCalledWith("Resetting stats for user: test-user-id");
    expect(console.log).toHaveBeenCalledWith("User test-user-id stats reset successfully.");
  });

  it("should throw unauthenticated error if not authenticated", async () => {
    const mockRequest = {
      auth: undefined, // Not authenticated
      data: {},
    } as functions.https.CallableRequest;

    if (!actualOnCallHandler) {
      throw new Error("onCall handler was not captured properly");
    }

    await expect(actualOnCallHandler(mockRequest)).rejects.toThrow(
      new https.HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should throw internal error if Firestore update fails", async () => {
    const mockRequest = {
      auth: {uid: "test-user-id"},
      data: {},
    } as functions.https.CallableRequest;
    const firestoreError = new Error("Firestore update failed");
    mockUpdate.mockRejectedValue(firestoreError);

    if (!actualOnCallHandler) {
      throw new Error("onCall handler was not captured properly");
    }

    await expect(actualOnCallHandler(mockRequest)).rejects.toThrow(
      new https.HttpsError("internal", "An error occurred while resetting stats.", firestoreError),
    );
    expect(console.error).toHaveBeenCalledWith("Error resetting stats for user test-user-id:", firestoreError);
  });
});

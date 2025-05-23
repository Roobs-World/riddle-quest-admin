import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import * as admin from "firebase-admin";
import {PlayerSchema} from "../validation/firestoreSchemas.js"; // Adjust path as needed
import {HttpsError as HttpsErrorV2, CallableRequest} from "firebase-functions/v2/https";

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
let capturedResetStatsHandler: ((request: CallableRequest<any>) => Promise<any>) | null = null;

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: (handler: (request: CallableRequest<any>) => Promise<any>) => {
      if (!capturedResetStatsHandler) {
        // Capture the first handler (resetStats)
        capturedResetStatsHandler = handler;
      }
      // Return a structure that resembles a Firebase HttpsFunction but isn't necessarily invoked by these tests
      return jest.fn(async (request?: any) => {
        if (capturedResetStatsHandler && request) {
          // Ensure handler and request exist
          return capturedResetStatsHandler(request);
        }
        // This path shouldn't ideally be hit if tests use capturedResetStatsHandler directly
        // console.warn("Mocked HttpsFunction called without captured handler or request");
        // return Promise.resolve({});
      });
    },
    HttpsError: actualV2Https.HttpsError,
  };
});

// Import the SUT to trigger the onCall mock.
// resetStats itself is not directly used from this import in tests, capturedResetStatsHandler is.
import "../profile";

describe("resetStats", () => {
  let originalConsole: Console;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsole = global.console;
    global.console = {log: jest.fn(), warn: jest.fn(), error: jest.fn()} as unknown as Console;
    (admin.firestore as unknown as jest.Mock).mockClear();

    mockUpdate = jest.fn<() => Promise<void>>();
    mockUpdate.mockResolvedValue(undefined);

    (admin.firestore as unknown as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnValue({update: mockUpdate}),
    });

    // Crucially, ensure capturedResetStatsHandler is reset if necessary or that it's correctly set by the import
    // For this setup, it's captured once at module load time. If tests interfere, use jest.resetModules().
    if (!capturedResetStatsHandler) {
      throw new Error("resetStats handler was not captured by the mock. Check module import and mock order.");
    }
  });

  afterEach(() => {
    global.console = originalConsole;
    jest.restoreAllMocks();
    // capturedResetStatsHandler = null; // No! This would break subsequent tests if not re-imported.
    // It's okay for it to persist as it's the correct handler.
  });

  it("should reset user stats successfully when authenticated", async () => {
    const mockRequest = {
      auth: {uid: "test-user-id"},
      data: {},
    } as CallableRequest;

    const result = await capturedResetStatsHandler!(mockRequest);
    expect(result).toEqual({success: true, message: "Stats reset successfully."});

    expect(admin.firestore().collection("users").doc).toHaveBeenCalledWith("test-user-id");
    expect(mockUpdate).toHaveBeenCalledWith({stats: PlayerSchema.parse({})});
    expect(console.log).toHaveBeenCalledWith("Resetting stats for user: test-user-id");
    expect(console.log).toHaveBeenCalledWith("User test-user-id stats reset successfully.");
  });

  it("should throw unauthenticated error if not authenticated", async () => {
    const mockRequest = {
      auth: undefined,
      data: {},
    } as CallableRequest;

    await expect(capturedResetStatsHandler!(mockRequest)).rejects.toThrow(
      new HttpsErrorV2("unauthenticated", "The function must be called while authenticated."),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should throw internal error if Firestore update fails", async () => {
    const mockRequest = {
      auth: {uid: "test-user-id"},
      data: {},
    } as CallableRequest;
    const firestoreError = new Error("Firestore update failed");
    mockUpdate.mockRejectedValue(firestoreError);

    await expect(capturedResetStatsHandler!(mockRequest)).rejects.toThrow(
      new HttpsErrorV2("internal", "An error occurred while resetting stats.", firestoreError),
    );
    expect(console.error).toHaveBeenCalledWith("Error resetting stats for user test-user-id:", firestoreError);
  });
});

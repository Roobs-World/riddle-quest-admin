import {describe, test, expect, jest, beforeAll, afterAll} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {initializeIapConfig} from "../iapConfig";

// Mock firebase-admin to prevent initializeApp from running multiple times
if (admin.apps.length === 0) {
  jest.spyOn(admin, "initializeApp").mockImplementation(
    () =>
      ({
        // Return a mock App instance properties if needed
        name: "[DEFAULT]",
        options: {projectId: "test-project"},
        delete: jest.fn(),
        // Add other App properties your code might use, with mock implementations
        appCheck: jest.fn(),
        auth: jest.fn(),
        database: jest.fn(),
        firestore: jest.fn(),
        instanceId: jest.fn(),
        machineLearning: jest.fn(),
        projectManagement: jest.fn(),
        remoteConfig: jest.fn(),
        securityRules: jest.fn(),
        storage: jest.fn(),
      }) as unknown as admin.app.App,
  ); // Explicitly cast to admin.app.App
}

// Mock specific admin services if needed, e.g., Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn<() => Promise<admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>>>(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  runTransaction: jest.fn((callback: (transaction: admin.firestore.Transaction) => Promise<unknown>) =>
    callback({
      // Mock runTransaction
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as admin.firestore.Transaction),
  ), // Basic transaction mock
  batch: jest.fn().mockReturnThis(), // for batched writes
  commit: jest.fn().mockResolvedValue(undefined as never), // for batched writes
};

const mockAuth = {
  // Mock auth methods as needed
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};

// Mock the firestore and auth getters on the admin object
jest.spyOn(admin, "firestore").mockReturnValue(mockFirestore as unknown as admin.firestore.Firestore);
jest.spyOn(admin, "auth").mockReturnValue(mockAuth as unknown as admin.auth.Auth);

// If you use other services like storage, pubsub, etc., mock them similarly
// jest.spyOn(admin, "storage").mockReturnValue(mockStorage as unknown as admin.storage.Storage);

// Mocking firebase-functions config and logger
jest.mock("firebase-functions", () => {
  const original = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
  const originalV1Module = jest.requireActual("firebase-functions/v1") as typeof import("firebase-functions/v1"); // Cast to more specific type
  const originalV1Https = originalV1Module.https; // Access https property

  return {
    ...original,
    config: () => ({
      // Note: sheets config removed as part of migration to Firestore-only storage
      openai: {
        api_key: "test-openai-key",
      },
      iap: {
        apple_shared_secret: "test-apple-secret",
        google_service_account: JSON.stringify({type: "service_account", project_id: "test-project"}),
      },
      applovin: {
        sdk_key: "test-sdk-key",
        interstitial_ad_unit_id: "test-interstitial-id",
        rewarded_ad_unit_id: "test-rewarded-id",
      },
    }),
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    https: {
      ...(original.https as object),
      HttpsError: originalV1Https.HttpsError,
    },
    params: {
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
  };
});

// Add mock for firebase-functions/v2
jest.mock("firebase-functions/v2", () => {
  const actualV2 = jest.requireActual("firebase-functions/v2") as typeof import("firebase-functions/v2");
  return {
    ...actualV2, // Spread actual v2 to keep non-mocked parts
    logger: {
      // Mock logger if imported from v2 directly
      ...(actualV2.logger as object),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    https: {
      // Mock https if imported from v2 directly
      ...(actualV2.https as object),
      // Mock onCall to return a function that can be wrapped by testEnv.wrap
      onCall: jest.fn((optsOrHandler: any, handler?: any) => {
        let actualHandler: any;
        if (typeof optsOrHandler === "function") {
          actualHandler = optsOrHandler;
        } else {
          actualHandler = handler;
        }
        // Return an object that mimics a CloudFunction for testEnv.wrap
        return {
          // Provide the function that testEnv.wrap will execute
          // The type assertion 'as any' is needed here because the mock doesn't fully satisfy CloudFunction type
          run: jest.fn(actualHandler) as any,
          // You might need to add other properties that testEnv.wrap expects or uses
          // For a simple callable function mock, 'run' might be sufficient.
        } as any; // Cast the returned object to any for compatibility with testEnv.wrap
      }),
      HttpsError: actualV2.https.HttpsError, // v2 HttpsError
    },
    params: {
      // Mock params if imported from v2
      ...(actualV2.params as object),
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
    // Mock other v2 services if necessary (e.g., eventarc, tasks)
  };
});

// Import the index file AFTER all mocks are set up
import * as myFunctions from "../index";

describe("Firebase Functions", () => {
  let testEnv: ReturnType<typeof functionsTest>;

  beforeAll(() => {
    testEnv = functionsTest();
    initializeIapConfig();
  });

  describe("Exported Functions Existence", () => {
    const expectedCallableFunctions = [
      "awardedAdCallback",
      "validatePurchase",
      "getHint",
      "spendCoins",
      "skipRiddle",
      "setCompletedDailyChallenge",
      "hasCompletedDailyChallenge",
      "generateClassicRiddles",
      "resetStats",
      "submitGuess",
    ];

    expectedCallableFunctions.forEach((funcName) => {
      test(`should have callable function ${funcName} exported`, () => {
        expect((myFunctions as Record<string, unknown>)[funcName]).toBeDefined();
        expect(typeof (myFunctions as Record<string, unknown>)[funcName]).toBe("function");
      });
    });

    // Example for a scheduled function (if you have one named scheduledTask)
    // test("should have scheduled function scheduledTask exported", () => {
    //   expect(myFunctions.scheduledTask).toBeDefined();
    // });

    // Example for a Firestore triggered function (if you have one named onUserCreate)
    // test("should have Firestore trigger onUserCreate exported", () => {
    //   expect(myFunctions.onUserCreate).toBeDefined();
    // });
  });

  // Example test for a callable function (resetStats)
  describe("resetStats", () => {
    // Correctly type the wrapped function for v2 onCall
    let wrappedResetStats: (request: {
      data: Record<string, unknown>;
      auth?: {uid: string} | null;
      rawRequest: {headers: object; body: object};
    }) => Promise<unknown>;

    beforeAll(() => {
      const resetStatsFunction = (myFunctions as Record<string, unknown>)["resetStats"];
      if (resetStatsFunction && typeof resetStatsFunction === "function") {
        // Check if the function exists on the import
        // Wrap the function directly
        // The function exported from index is expected to be the CloudFunction object returned by the mocked onCall
        wrappedResetStats = testEnv.wrap(resetStatsFunction as any) as (request: {
          data: Record<string, unknown>;
          auth?: {uid: string} | null;
          rawRequest: {headers: object; body: object};
        }) => Promise<unknown>; // Explicitly type the wrapped function result
      }
    });

    test("should reset user stats for authenticated request", async () => {
      if (!wrappedResetStats) {
        // eslint-disable-next-line no-console
        console.warn("resetStats function not found or not wrapped, skipping test.");
        return;
      }

      const mockUserId = "test-user-123";

      // Mock Firestore update method for this specific test
      mockFirestore.update.mockResolvedValueOnce(undefined as never);

      const request = {
        data: {},
        auth: {uid: mockUserId},
        rawRequest: {headers: {}, body: {}},
      };

      const result = await wrappedResetStats(request);

      expect(result).toEqual({success: true, message: "Stats reset successfully."});
      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockFirestore.doc).toHaveBeenCalledWith(mockUserId);
      expect(mockFirestore.update).toHaveBeenCalled(); // Verify update on the specific doc was called
    });

    test("should throw error if user is not authenticated", async () => {
      if (!wrappedResetStats) return; // Skip if not available

      const request = {
        data: {},
        auth: null, // No auth context
        rawRequest: {headers: {}, body: {}},
      };

      await expect(wrappedResetStats(request)).rejects.toThrow(/authenticated/i);
    });
  });

  // Add more describe blocks for other functions...

  afterAll(() => {
    testEnv.cleanup();
    jest.restoreAllMocks(); // Restore all mocks
  });
});

import {describe, test, expect, jest, beforeAll, afterAll} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {CallableContextOptions} from "firebase-functions-test/lib/main";

// Mock firebase-admin to prevent initializeApp from running multiple times
if (admin.apps.length === 0) {
  jest.spyOn(admin, "initializeApp").mockImplementation(() => {});
}

// Mock specific admin services if needed, e.g., Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  runTransaction: jest.fn(),
  batch: jest.fn().mockReturnThis(), // for batched writes
  commit: jest.fn(), // for batched writes
};

const mockAuth = {
  // Mock auth methods as needed
  getUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
};

jest.spyOn(admin, "firestore", "get").mockReturnValue(mockFirestore as unknown as admin.firestore.Firestore);
jest.spyOn(admin, "auth", "get").mockReturnValue(mockAuth as unknown as admin.auth.Auth);

// If you use other services like storage, pubsub, etc., mock them similarly
// jest.spyOn(admin, "storage", "get").mockReturnValue(mockStorage as unknown as admin.storage.Storage);

// Mocking firebase-functions config and logger
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
    iap: {
      apple_shared_secret: "test-apple-secret",
      google_service_account: JSON.stringify({type: "service_account", project_id: "test-project"}),
    },
    applovin: {
      sdk_key: "test-sdk-key",
      interstitial_ad_unit_id: "test-interstitial-id",
      rewarded_ad_unit_id: "test-rewarded-id",
    },
    // Add any other config your functions might need
  }),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  // Mock any other firebase-functions exports your index file might use directly
  // For example, if you use https.HttpsError:
  https: {
    HttpsError: jest.fn().mockImplementation((code, message) => {
      const error = new Error(message);
      (error as {code: string}).code = code;
      return error;
    }),
  },
}));

// Import the index file AFTER all mocks are set up
import * as myFunctions from "../index.js";

describe("Firebase Functions", () => {
  let testEnv: ReturnType<typeof functionsTest>;

  beforeAll(() => {
    testEnv = functionsTest();
  });

  describe("Exported Functions Existence", () => {
    const expectedCallableFunctions = [
      "recordAdImpression",
      "rewardUser",
      "getDailyChallenge",
      "submitDailyChallengeGuess",
      "skipClassicLevel",
      "submitClassicGuess",
      "generateClassicRiddles",
      "getUserProfile",
      "updateUserProfile",
      "verifyAndroidReceipt",
      "verifyAppleReceipt",
      "deleteUserData",
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

  // Example test for a callable function (getUserProfile)
  describe("getUserProfile", () => {
    let wrappedGetUserProfile: (data: Record<string, unknown>, context?: CallableContextOptions) => Promise<unknown>;

    beforeAll(() => {
      if ((myFunctions as Record<string, unknown>).getUserProfile) {
        wrappedGetUserProfile = testEnv.wrap(
          (myFunctions as Record<string, unknown>).getUserProfile as (...args: unknown[]) => unknown,
        );
      }
    });

    test("should return user profile for authenticated request", async () => {
      if (!wrappedGetUserProfile) {
        // eslint-disable-next-line no-console
        console.warn("getUserProfile function not found or not wrapped, skipping test.");
        return;
      }

      const mockUserId = "test-user-123";
      const mockUserData = {displayName: "Test User", email: "test@example.com"};

      // Mock Firestore get method for this specific test
      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => mockUserData,
      });

      const context: CallableContextOptions = {
        auth: {
          uid: mockUserId,
          token: {uid: mockUserId, firebase: {sign_in_provider: "custom"} as Record<string, unknown>},
        },
      };

      const result = await wrappedGetUserProfile({}, context);

      expect(result).toEqual(mockUserData);
      expect(mockFirestore.collection).toHaveBeenCalledWith("users");
      expect(mockFirestore.doc).toHaveBeenCalledWith(mockUserId);
      expect(mockFirestore.get).toHaveBeenCalled();
    });

    test("should throw error if user is not authenticated", async () => {
      if (!wrappedGetUserProfile) return; // Skip if not available

      const context: CallableContextOptions = {}; // No auth context

      await expect(wrappedGetUserProfile({}, context)).rejects.toThrow(/authentication/i);
    });

    test("should return null or error if user profile does not exist", async () => {
      if (!wrappedGetUserProfile) return;

      const mockUserId = "non-existent-user-456";
      mockFirestore.get.mockResolvedValueOnce({exists: false});

      const context: CallableContextOptions = {
        auth: {
          uid: mockUserId,
          token: {uid: mockUserId, firebase: {sign_in_provider: "custom"} as Record<string, unknown>},
        },
      };
      // Depending on your function's implementation, it might throw or return null/empty
      // Adjust the expectation accordingly.
      // For this example, let's assume it throws an error.
      await expect(wrappedGetUserProfile({}, context)).rejects.toThrow(/not found/i);
    });
  });

  // Add more describe blocks for other functions...

  afterAll(() => {
    testEnv.cleanup();
    jest.restoreAllMocks(); // Restore all mocks
  });
});

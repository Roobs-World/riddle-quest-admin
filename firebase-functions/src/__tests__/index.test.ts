import {describe, test, expect, jest, beforeAll, afterAll} from "@jest/globals";
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import {CallableContextOptions} from "firebase-functions-test/lib/main";

// Mock firebase-admin to prevent initializeApp from running multiple times
if (admin.apps.length === 0) {
  jest.spyOn(admin, "initializeApp").mockImplementation(
    () =>
      ({
        // Return a mock App instance properties if needed
        name: "[DEFAULT]",
        options: {projectId: "test-project"},
        delete: jest.fn().mockResolvedValue(undefined as never),
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
  const original = jest.requireActual("firebase-functions") as Record<string, unknown>;
  const originalV1Module = jest.requireActual("firebase-functions/v1") as any; // Cast to any
  const originalV1Https = originalV1Module.https; // Access https property

  return {
    ...original, // Spread original module to keep non-mocked parts
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
      ...(original.https as Record<string, unknown> | undefined), // Allow undefined if not present
      HttpsError: originalV1Https.HttpsError, // Use the actual HttpsError for the mock implementation
    },
    params: {
      // Mock params if it's accessed
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
  };
});

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
    // Correctly type the wrapped function
    let wrappedGetUserProfile: (data: Record<string, unknown>, context?: CallableContextOptions) => Promise<unknown>;

    beforeAll(() => {
      const getUserProfileFunction = (myFunctions as Record<string, unknown>)["getUserProfile"];
      if (getUserProfileFunction && typeof getUserProfileFunction === "function") {
        // Check if the function exists on the import
        // Wrap the function directly
        wrappedGetUserProfile = testEnv.wrap(getUserProfileFunction as any) as (
          data: Record<string, unknown>,
          context?: CallableContextOptions,
        ) => Promise<unknown>; // Explicitly type the wrapped function result
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
        id: "test-user-123",
        ref: {} as admin.firestore.DocumentReference<admin.firestore.DocumentData>,
        readTime: admin.firestore.Timestamp.now(),
        createTime: admin.firestore.Timestamp.now(),
        updateTime: admin.firestore.Timestamp.now(),
        isEqual: (other: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>) =>
          other.id === "test-user-123",
        get: jest.fn((fieldPath: string | admin.firestore.FieldPath) => undefined), // Added mock get
      } as unknown as admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>);

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
      expect(mockFirestore.get).toHaveBeenCalled(); // Verify get on the specific doc was called
    });

    test("should throw error if user is not authenticated", async () => {
      if (!wrappedGetUserProfile) return; // Skip if not available

      const context: CallableContextOptions = {}; // No auth context

      await expect(wrappedGetUserProfile({}, context)).rejects.toThrow(/authentication/i);
    });

    test("should return null or error if user profile does not exist", async () => {
      if (!wrappedGetUserProfile) return;

      const mockUserId = "non-existent-user-456";
      mockFirestore.get.mockResolvedValueOnce({
        exists: false,
        id: "non-existent-user-456",
        ref: {} as admin.firestore.DocumentReference<admin.firestore.DocumentData>,
        readTime: admin.firestore.Timestamp.now(),
        createTime: admin.firestore.Timestamp.now(),
        updateTime: admin.firestore.Timestamp.now(),
        isEqual: (other: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>) =>
          other.id === "non-existent-user-456",
        data: () => undefined,
        get: jest.fn((fieldPath: string | admin.firestore.FieldPath) => undefined), // Added mock get
      } as unknown as admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>);

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

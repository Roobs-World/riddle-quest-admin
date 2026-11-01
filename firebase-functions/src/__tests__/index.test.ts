import {describe, test, expect, jest, afterAll} from "@jest/globals";

// Define types for Firebase Functions v2 mocking
/** Describes callable options. */
type CallableOptions = {
  /** Stores cors. */
  cors?: boolean | string | string[];
  /** Stores enforce app check. */
  enforceAppCheck?: boolean;
  /** Stores memory. */
  memory?: string;
  /** Stores timeout seconds. */
  timeoutSeconds?: number;
  /** Stores max instances. */
  maxInstances?: number;
  /** Stores min instances. */
  minInstances?: number;
  /** Stores concurrency. */
  concurrency?: number;
  /** Stores labels. */
  labels?: Record<string, string>;
  /** Stores secrets. */
  secrets?: string[];
  /** Stores invoker. */
  invoker?: string | string[];
};

/** Describes callable handler. */
type CallableHandler<T = unknown, R = unknown> = (request: {
  /** Stores data. */
  data: T;
  /** Stores auth. */
  auth?: {
    /** Stores uid. */
    uid: string;
  } | null;
  /** Stores raw request. */
  rawRequest: {
    /** Stores headers. */
    headers: Record<string, string>; /** Stores body. */
    /** Stores body. */
    body: Record<string, unknown>;
  };
}) => Promise<R>;

/** Describes cloud function. */
type CloudFunction = {
  /** Stores run. */
  run: jest.MockedFunction<CallableHandler>;
};

// Mocking firebase-functions config and logger
jest.mock("firebase-functions", () => {
  /** Provides original behavior. */
  const original = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
  /** Provides original v1 module behavior. */
  const originalV1Module = jest.requireActual("firebase-functions/v1") as typeof import("firebase-functions/v1"); // Cast to more specific type
  /** Provides original v1 https behavior. */
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
  /** Provides actual v2 behavior. */
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
      onCall: jest.fn((optsOrHandler: CallableOptions | CallableHandler, handler?: CallableHandler): CloudFunction => {
        /** Provides actual handler behavior. */
        let actualHandler: CallableHandler;
        if (typeof optsOrHandler === "function") {
          actualHandler = optsOrHandler;
        } else {
          actualHandler = handler!;
        }
        // Return an object that mimics a CloudFunction for testEnv.wrap
        return {
          // Provide the function that testEnv.wrap will execute
          run: jest.fn(actualHandler) as jest.MockedFunction<CallableHandler>,
          // You might need to add other properties that testEnv.wrap expects or uses
          // For a simple callable function mock, 'run' might be sufficient.
        } as CloudFunction;
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
  describe("Exported Functions Existence", () => {
    /** Provides expected functions behavior. */
    const expectedFunctions = [
      "spendCoins",
      "getCurrentDailyChallenge",
      "getCurrentClassicRiddle",
      "completeGame",
      "updateUsername",
      "exchangeJestIdentity",
      "grantJestPurchase",
      "retryJestAccountDeletion",
      "verifyJestReferrals",
      "provisionAndroidAccount",
      "redditGameplay",
    ];

    expectedFunctions.forEach((funcName) => {
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

  // Add more describe blocks for other functions...

  afterAll(() => {
    jest.restoreAllMocks(); // Restore all mocks
  });
});

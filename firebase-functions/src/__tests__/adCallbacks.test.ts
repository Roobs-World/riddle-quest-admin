// 1. ALL mock variable declarations
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockGet = jest.fn<() => Promise<{exists: boolean}>>();
const mockSet = jest.fn<() => Promise<void>>();

// Firestore chained mocks setup
let mockFirestoreChainable: any;
const mockDoc = jest.fn((_id?: string) => mockFirestoreChainable);
const mockCollection = jest.fn((_path?: string) => mockFirestoreChainable);
mockFirestoreChainable = {
  get: mockGet,
  set: mockSet,
  doc: mockDoc, // .collection(...).doc(...)
  collection: mockCollection, // .doc(...).collection(...)
  update: jest.fn(), // Add other methods if needed by SUT
};

const mockUpdate = jest.fn<(...args: any[]) => any>(); // Used by crypto mock
const mockDigest = jest.fn<(...args: any[]) => string>(); // Used by crypto mock
const mockUpdateUserCoins = jest.fn<(userId: string, amount: number, transaction?: any) => Promise<void>>(); // For firestoreService mock

// 2. ALL import statements for types and Jest globals
import {describe, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as cryptoTypes from "crypto"; // For types

// 3. ALL jest.mock calls
jest.mock("firebase-functions", () => ({
  config: () => ({
    applovin: {
      sdk_key: "test_sdk_key",
    },
  }),
  logger: {
    info: (...args: any[]) => mockLoggerInfo(...args),
    warn: (...args: any[]) => mockLoggerWarn(...args),
    error: (...args: any[]) => mockLoggerError(...args),
  },
  https: {
    onRequest: (handler: any) => handler, // So we can call it directly
  },
}));

jest.mock("../firestoreService", () => ({
  updateUserCoins: (userId: string, amount: number, transaction?: any) =>
    mockUpdateUserCoins(userId, amount, transaction),
}));

jest.mock("firebase-admin", () => {
  const actualAdmin = jest.requireActual("firebase-admin") as typeof import("firebase-admin");
  return {
    ...(actualAdmin as object),
    initializeApp: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: (path: string) => mockCollection(path),
        doc: (id: string) => mockDoc(id),
      })),
      {
        FieldValue: {
          serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP"),
          // Add other FieldValue static members if needed by SUT, e.g., increment, arrayUnion
          increment: jest.fn((val: number) => `increment(${val})`),
          arrayUnion: jest.fn((...elements: any[]) => `arrayUnion(${elements.join(",")})`),
          arrayRemove: jest.fn((...elements: any[]) => `arrayRemove(${elements.join(",")})`),
          delete: jest.fn(() => "MOCK_FIELD_DELETE"),
        },
        // Timestamp might also be needed if SUT uses admin.firestore.Timestamp
        Timestamp: actualAdmin.firestore.Timestamp, // Use actual if not creating new ones, or mock too
      },
    ),
  };
});

jest.mock("crypto", () => ({
  createHash: jest.fn(() => ({
    update: mockUpdate.mockReturnThis(),
    digest: mockDigest,
  })),
}));

// 4. Import the module under test
import {awardedAdCallback} from "../adCallbacks";

// 5. describe block...
describe("awardedAdCallback", () => {
  let mockReq: any;
  let mockRes: any;
  // let cryptoModule: { createHash: jest.Mock }; // cryptoModule not used directly for assertions, createHash is used

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set environment variable for APPLOVIN_SDK_KEY
    process.env.APPLOVIN_SDK_KEY = "test_sdk_key";

    // cryptoModule = require("crypto"); // Not strictly needed as we don't assert on cryptoModule itself

    mockReq = {
      method: "POST",
      body: {
        user_id: "testUser123",
        amount: "100",
        trans_id: "testTransId123",
        ad_token: "testAdToken123",
        signature: "valid_signature",
        event: "rewarded_video_completed",
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockGet.mockResolvedValue({exists: false});
    mockSet.mockResolvedValue(undefined);
    mockUpdateUserCoins.mockResolvedValue(undefined);

    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return "valid_signature";
      }
      return "";
    });
  });

  const calculateExpectedSignature = (body: any, hashedSdkKey: string) => {
    const dataToHash = `${body.ad_token}${body.trans_id}${body.amount}${body.user_id}${hashedSdkKey}`;
    const realCrypto = jest.requireActual("crypto") as typeof cryptoTypes;
    return realCrypto.createHash("sha256").update(dataToHash).digest("hex");
  };

  it("should return 405 if method is not POST", async () => {
    mockReq.method = "GET";
    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Method Not Allowed"});
  });

  it("should return 400 if missing required parameters", async () => {
    mockReq.body.user_id = undefined;
    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Missing required parameters."});
    expect(mockLoggerWarn).toHaveBeenCalledWith("Missing required AppLovin postback parameters.");
  });

  it("should return 401 if signature verification fails", async () => {
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return "calculated_incorrect_signature_by_mock";
      }
      return "";
    });
    mockReq.body.signature = "provided_wrong_signature";

    await awardedAdCallback(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Validation failed."});
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      `AppLovin callback validation failed for user ${mockReq.body.user_id}. Token: ${mockReq.body.trans_id}. Event: ${mockReq.body.event}. Signature: ${mockReq.body.signature}`,
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `AppLovin signature verification failed for user ${mockReq.body.user_id}, token ${mockReq.body.trans_id}. Expected: calculated_incorrect_signature_by_mock, Received: ${mockReq.body.signature}`,
    );
  });

  it("should return 401 if transaction token is already processed (replay attack)", async () => {
    mockGet.mockResolvedValue({exists: true});
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Validation failed."});
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      `AppLovin transaction token ${mockReq.body.trans_id} already processed for user ${mockReq.body.user_id}. Potential replay attack.`,
    );
  });

  it("should return 400 if event type is not rewarded_video_completed", async () => {
    mockReq.body.event = "some_other_event";
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Unexpected event type."});
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      `Received unexpected AppLovin event type: ${mockReq.body.event} for user ${mockReq.body.user_id}.`,
    );
  });

  it("should return 400 if reward amount is invalid (NaN)", async () => {
    mockReq.body.amount = "not_a_number";
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});
    expect(mockLoggerError).toHaveBeenCalledWith(
      `Invalid amount received in AppLovin postback for user ${mockReq.body.user_id}: ${mockReq.body.amount}`,
    );
  });

  it("should return 400 if reward amount is zero or negative", async () => {
    mockReq.body.amount = "0";
    let expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        const currentExpectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
        return currentExpectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});

    mockReq.body.amount = "-10";
    expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});
  });

  it("should successfully process valid callback, update coins, and mark transaction", async () => {
    const coinsToAward = parseInt(mockReq.body.amount, 10);
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);

    expect(mockUpdateUserCoins).toHaveBeenCalledWith(mockReq.body.user_id, coinsToAward, undefined);
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockDoc).toHaveBeenCalledWith(mockReq.body.user_id);
    expect(mockCollection).toHaveBeenCalledWith("processedAdCallbacks");
    expect(mockDoc).toHaveBeenCalledWith(mockReq.body.trans_id);
    expect(mockSet).toHaveBeenCalledWith({processedAt: "MOCK_SERVER_TIMESTAMP"});

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith("OK");
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Awarded ${coinsToAward} coins to user ${mockReq.body.user_id} via AppLovin callback for token ${mockReq.body.trans_id}.`,
    );
  });

  it("should return 500 if updateUserCoins fails", async () => {
    mockUpdateUserCoins.mockRejectedValue(new Error("Coin update failed"));
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith({message: "An internal server error occurred."});
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Error processing AppLovin reward callback:",
      expect.objectContaining({message: "Coin update failed"}),
    );
  });

  it("should return 500 if markAdTransactionAsProcessed fails (Firestore set fails)", async () => {
    mockSet.mockRejectedValue(new Error("Firestore set failed"));
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: cryptoTypes.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith({message: "An internal server error occurred."});
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Error marking ad transaction as processed:",
      expect.objectContaining({message: "Firestore set failed"}),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Error processing AppLovin reward callback:",
      expect.objectContaining({message: "Firestore set failed"}),
    );
  });

  describe("SDK Key Configuration", () => {
    const originalProcessEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = {...originalProcessEnv};
    });

    afterEach(() => {
      process.env = originalProcessEnv;
    });

    it("should return 500 if APPLOVIN_SDK_KEY is not configured", async () => {
      // Remove the environment variable
      delete process.env.APPLOVIN_SDK_KEY;

      // Clear module cache and re-import to get the version without the env var
      jest.resetModules();
      const {awardedAdCallback: callbackWithMissingSdkKey} = await import("../adCallbacks");

      await callbackWithMissingSdkKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({message: "Server configuration error."});
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Missing required environment variable: APPLOVIN_SDK_KEY (from process.env)",
      );
    });
  });
});

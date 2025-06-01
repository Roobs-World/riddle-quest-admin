/* eslint-disable @typescript-eslint/no-explicit-any */
// Import Jest globals first before using jest.fn()
import {describe, expect, jest, beforeEach, afterEach} from "@jest/globals";
import * as cryptoTypes from "crypto"; // For types

// Store mock references
let mockLoggerInfo: jest.Mock<any>;
let mockLoggerWarn: jest.Mock<any>;
let mockLoggerError: jest.Mock<any>;
let mockUpdateUserCoins: jest.Mock<any>;
let mockGet: jest.Mock<any>;
let mockSet: jest.Mock<any>;
let mockDoc: jest.Mock<any>;
let mockCollection: jest.Mock<any>;
let mockUpdate: jest.Mock<any>;
let mockDigest: jest.Mock<any>;

// jest.mock calls - MUST be before importing the module under test
jest.mock("firebase-functions", () => {
  mockLoggerInfo = jest.fn();
  mockLoggerWarn = jest.fn();
  mockLoggerError = jest.fn();

  return {
    config: () => ({
      applovin: {
        sdk_key: "test_sdk_key",
      },
    }),
    logger: {
      info: mockLoggerInfo,
      warn: mockLoggerWarn,
      error: mockLoggerError,
    },
    https: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onRequest: (handler: any) => handler, // So we can call it directly
    },
  };
});

jest.mock("../firestoreService", () => {
  const updateUserCoinsMock = jest.fn<(userId: string, amount: number, transaction?: unknown) => Promise<void>>();
  mockUpdateUserCoins = updateUserCoinsMock;
  return {
    updateUserCoins: updateUserCoinsMock,
  };
});

jest.mock("firebase-admin", () => {
  const actualAdmin = jest.requireActual("firebase-admin") as typeof import("firebase-admin");
  mockGet = jest.fn<() => Promise<{exists: boolean}>>();
  mockSet = jest.fn<() => Promise<void>>();
  mockDoc = jest.fn();
  mockCollection = jest.fn();

  // Firestore chained mocks setup
  let mockFirestoreChainable: any;
  mockFirestoreChainable = {
    get: mockGet,
    set: mockSet,
    doc: mockDoc,
    collection: mockCollection,
    update: jest.fn(),
  };

  mockDoc.mockImplementation(() => mockFirestoreChainable);
  mockCollection.mockImplementation(() => mockFirestoreChainable);

  const firestoreMock = jest.fn(() => ({
    collection: mockCollection,
    doc: mockDoc,
  }));

  return {
    ...(actualAdmin as object),
    initializeApp: jest.fn(),
    firestore: Object.assign(firestoreMock, {
      FieldValue: {
        serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP"),
        increment: jest.fn((val: number) => `increment(${val})`),
        arrayUnion: jest.fn((...elements: unknown[]) => `arrayUnion(${elements.join(",")})`),
        arrayRemove: jest.fn((...elements: unknown[]) => `arrayRemove(${elements.join(",")})`),
        delete: jest.fn(() => "MOCK_FIELD_DELETE"),
      },
      Timestamp: actualAdmin.firestore.Timestamp,
    }),
  };
});

jest.mock("crypto", () => {
  mockUpdate = jest.fn<(data: string) => any>();
  mockDigest = jest.fn<(format?: string) => string>();

  return {
    createHash: jest.fn(() => ({
      update: mockUpdate.mockReturnThis(),
      digest: mockDigest,
    })),
  };
});

// Import the module under test
import {awardedAdCallback} from "../adCallbacks";

// Simple request/response mock interfaces
interface TestRequest {
  method: string;
  body: Record<string, unknown>;
}

interface TestResponse {
  status: jest.Mock;
  send: jest.Mock;
}

// 5. describe block...
describe("awardedAdCallback", () => {
  let mockReq: TestRequest;
  let mockRes: TestResponse;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set environment variable for APPLOVIN_SDK_KEY
    process.env.APPLOVIN_SDK_KEY = "test_sdk_key";

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

    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
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
    await awardedAdCallback(mockReq as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Method Not Allowed"});
  });

  it("should return 400 if missing required parameters", async () => {
    mockReq.body.user_id = undefined;
    await awardedAdCallback(mockReq as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Missing required parameters."});
    expect(mockLoggerWarn).toHaveBeenCalledWith("Missing required AppLovin postback parameters.");
  });

  it("should return 401 if signature verification fails", async () => {
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return "calculated_incorrect_signature_by_mock";
      }
      return "";
    });
    mockReq.body.signature = "provided_wrong_signature";

    await awardedAdCallback(mockReq as any, mockRes as any);

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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);

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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);
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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);
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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        const currentExpectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
        return currentExpectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});

    mockReq.body.amount = "-10";
    expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;

    await awardedAdCallback(mockReq as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});
  });

  it("should successfully process valid callback, update coins, and mark transaction", async () => {
    const coinsToAward = parseInt(mockReq.body.amount as string, 10);
    const expectedSig = calculateExpectedSignature(mockReq.body, "hashed_sdk_key_value");
    mockReq.body.signature = expectedSig;
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);

    expect(mockUpdateUserCoins).toHaveBeenCalledWith(mockReq.body.user_id, coinsToAward);
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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);
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
    mockDigest.mockImplementation((format?: string) => {
      if (format === "hex") {
        const lastUpdateCallArgs = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCallArgs && lastUpdateCallArgs.length > 0 && lastUpdateCallArgs[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        return expectedSig;
      }
      return "";
    });

    await awardedAdCallback(mockReq as any, mockRes as any);
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
      process.env = {...originalProcessEnv};
    });

    afterEach(() => {
      process.env = originalProcessEnv;
    });

    it("should return 500 if APPLOVIN_SDK_KEY is not configured", async () => {
      // Remove the environment variable
      delete process.env.APPLOVIN_SDK_KEY;

      // Test the function directly with the missing environment variable
      await awardedAdCallback(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({message: "Server configuration error."});
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Missing required environment variable: APPLOVIN_SDK_KEY (from process.env)",
      );
    });
  });
});

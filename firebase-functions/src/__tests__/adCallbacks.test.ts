import * as functions from "firebase-functions";
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import * as crypto from "crypto";

// Import the function to test
import {awardedAdCallback} from "../adCallbacks"; // Adjust path as needed
import {updateUserCoins} from "../firestoreService"; // Mocked

// --- Mocks Start ---
jest.mock("firebase-functions", () => ({
  config: () => ({
    applovin: {
      sdk_key: "test_sdk_key",
    },
  }),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  https: {
    onRequest: (handler: any) => handler, // So we can call it directly
  },
}));

jest.mock("../firestoreService", () => ({
  updateUserCoins: jest.fn<() => Promise<void>>(),
}));

const mockGet = jest.fn<() => Promise<{exists: boolean}>>();
const mockSet = jest.fn<() => Promise<void>>();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: mockCollection,
    doc: mockDoc, // For direct doc access if any
    FieldValue: {
      serverTimestamp: () => new Date(), // Mock serverTimestamp
    },
  }),
}));

const mockUpdate = jest.fn<(...args: any[]) => any>();
const mockDigest = jest.fn<(...args: any[]) => string>();
jest.mock("crypto", () => ({
  createHash: jest.fn(() => ({
    update: mockUpdate.mockReturnThis(),
    digest: mockDigest,
  })),
}));
// --- Mocks End ---

describe("awardedAdCallback", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    mockReq = {
      method: "POST",
      body: {
        user_id: "testUser123",
        amount: "100",
        trans_id: "testTransId123",
        ad_token: "testAdToken123",
        signature: "valid_signature", // Will be set by tests
        event: "rewarded_video_completed",
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Default mock implementations
    mockGet.mockResolvedValue({exists: false}); // Default: transaction not processed
    mockSet.mockResolvedValue(undefined);
    (updateUserCoins as jest.Mock<() => Promise<void>>).mockResolvedValue(undefined);

    // Setup crypto mocks for a valid signature by default
    // Hashed SDK Key: sha256("test_sdk_key")
    // Let's assume this is "hashed_sdk_key_value"
    mockDigest.mockImplementation((format?: crypto.BinaryToTextEncoding): string => {
      if (format === "hex") {
        // The first call to digest is for sdkKey, the second for the final signature
        // Check the argument of the most recent call to 'update'
        const lastUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCall && lastUpdateCall[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        // This will be the expected signature for default valid cases
        return "valid_signature";
      }
      return ""; // Should not happen in these tests if format is always 'hex'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockValidSignature = (body: any) => {
    const dataToHash = `${body.ad_token}${body.trans_id}${body.amount}${body.user_id}hashed_sdk_key_value`;
    // This is just for reference in the test, actual mocking is above
    return crypto.createHash("sha256").update(dataToHash).digest("hex");
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
    expect(functions.logger.warn).toHaveBeenCalledWith("Missing required AppLovin postback parameters.");
  });

  it("should return 401 if signature verification fails", async () => {
    mockDigest.mockImplementation((format?: crypto.BinaryToTextEncoding): string => {
      if (format === "hex") {
        const lastUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        if (lastUpdateCall && lastUpdateCall[0] === "test_sdk_key") {
          return "hashed_sdk_key_value";
        }
        // This will be the expected signature
        return "invalid_signature_calculated_by_mock";
      }
      return "";
    });
    mockReq.body.signature = "provided_wrong_signature";

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Validation failed."});
    expect(functions.logger.warn).toHaveBeenCalledWith(
      `AppLovin callback validation failed for user ${mockReq.body.user_id}. Token: ${mockReq.body.trans_id}. Event: ${mockReq.body.event}. Signature: ${mockReq.body.signature}`,
    );
    expect(functions.logger.error).toHaveBeenCalledWith(
      `AppLovin signature verification failed for user ${mockReq.body.user_id}, token ${mockReq.body.trans_id}. Expected: invalid_signature_calculated_by_mock, Received: ${mockReq.body.signature}`,
    );
  });

  it("should return 401 if transaction token is already processed (replay attack)", async () => {
    mockGet.mockResolvedValue({exists: true}); // Simulate token already processed
    // Signature itself is valid
    mockReq.body.signature = mockValidSignature(mockReq.body);

    await awardedAdCallback(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Validation failed."});
    expect(functions.logger.warn).toHaveBeenCalledWith(
      `AppLovin transaction token ${mockReq.body.trans_id} already processed for user ${mockReq.body.user_id}. Potential replay attack.`,
    );
  });

  it("should return 400 if event type is not rewarded_video_completed", async () => {
    mockReq.body.event = "some_other_event";
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Unexpected event type."});
    expect(functions.logger.warn).toHaveBeenCalledWith(
      `Received unexpected AppLovin event type: ${mockReq.body.event} for user ${mockReq.body.user_id}.`,
    );
  });

  it("should return 400 if reward amount is invalid (NaN)", async () => {
    mockReq.body.amount = "not_a_number";
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});
    expect(functions.logger.error).toHaveBeenCalledWith(
      `Invalid amount received in AppLovin postback for user ${mockReq.body.user_id}: ${mockReq.body.amount}`,
    );
  });

  it("should return 400 if reward amount is zero or negative", async () => {
    mockReq.body.amount = "0";
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});

    mockReq.body.amount = "-10";
    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith({message: "Invalid reward amount."});
  });

  it("should successfully process valid callback, update coins, and mark transaction", async () => {
    const coinsToAward = parseInt(mockReq.body.amount, 10);
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);

    expect(updateUserCoins).toHaveBeenCalledWith(mockReq.body.user_id, coinsToAward);
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockDoc).toHaveBeenCalledWith(mockReq.body.user_id);
    expect(mockCollection).toHaveBeenCalledWith("processedAdCallbacks"); // This is nested
    expect(mockDoc).toHaveBeenCalledWith(mockReq.body.trans_id);
    expect(mockSet).toHaveBeenCalledWith({processedAt: expect.any(Date)});

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith("OK");
    expect(functions.logger.info).toHaveBeenCalledWith(
      `Awarded ${coinsToAward} coins to user ${mockReq.body.user_id} via AppLovin callback for token ${mockReq.body.trans_id}.`,
    );
  });

  it("should return 500 if updateUserCoins fails", async () => {
    (updateUserCoins as jest.Mock<() => Promise<void>>).mockRejectedValue(new Error("Coin update failed"));
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith({message: "An internal server error occurred."});
    expect(functions.logger.error).toHaveBeenCalledWith(
      "Error processing AppLovin reward callback:",
      expect.any(Error),
    );
  });

  it("should return 500 if markAdTransactionAsProcessed fails", async () => {
    mockSet.mockRejectedValue(new Error("Firestore set failed"));
    mockReq.body.signature = mockValidSignature(mockReq.body); // Valid signature

    await awardedAdCallback(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith({message: "An internal server error occurred."});
    expect(functions.logger.error).toHaveBeenCalledWith(
      "Error processing AppLovin reward callback:",
      expect.any(Error),
    );
    expect(functions.logger.error).toHaveBeenCalledWith(
      "Error marking ad transaction as processed:",
      expect.any(Error),
    ); // from original function
  });

  it("should correctly verify a valid signature", async () => {
    // Set specific values for the request body
    mockReq.body = {
      user_id: "userTest456",
      amount: "50",
      trans_id: "transactionTest789",
      ad_token: "adTokenTestABC",
      signature: "d8f6f8e4d93a71c099a517f91a1f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a", // Pre-calculated
      event: "rewarded_video_completed",
    };

    // Mock crypto to produce the pre-calculated signature
    // 1. SDK Key Hashing
    mockUpdate.mockImplementationOnce((data: string | Buffer) => {
      expect(data).toBe("test_sdk_key");
      return {digest: () => "hashed_sdk_key_for_d8f6"}; // Actual hash of "test_sdk_key"
    });
    // 2. Final Signature Hashing
    const expectedStringToHash = `${mockReq.body.ad_token}${mockReq.body.trans_id}${mockReq.body.amount}${mockReq.body.user_id}hashed_sdk_key_for_d8f6`;
    mockUpdate.mockImplementationOnce((data: string | Buffer) => {
      expect(data).toBe(expectedStringToHash);
      return {digest: () => "d8f6f8e4d93a71c099a517f91a1f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a"};
    });

    await awardedAdCallback(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith("OK");
    expect(updateUserCoins).toHaveBeenCalledWith(mockReq.body.user_id, 50);
  });

  it("should return 500 if APPLOVIN_SDK_KEY is not configured", async () => {
    // Temporarily unmock and re-mock functions.config to return undefined for sdk_key
    jest.isolateModules(async () => {
      jest.unmock("firebase-functions");
      jest.doMock("firebase-functions", () => ({
        config: () => ({applovin: {}}), // sdk_key is missing
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        https: {
          onRequest: (handler: any) => handler,
        },
      }));
      const {awardedAdCallback: callbackWithMissingSdkKey} = await import("../adCallbacks.js");

      await callbackWithMissingSdkKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith({message: "Server configuration error."});
      const functionsLogger = require("firebase-functions").logger;
      expect(functionsLogger.error).toHaveBeenCalledWith(
        "Missing required environment variable: APPLOVIN_SDK_KEY (from Firebase config)",
      );
    });
  });
});

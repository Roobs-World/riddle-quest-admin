// / <reference types="jest" />

// 1. All mock const declarations
const mockSet = jest.fn<(...args: any[]) => Promise<any>>();
const mockGet = jest.fn<(...args: any[]) => Promise<any>>();
const mockServerTimestampFn = jest.fn(() => "SENTINEL_SERVER_TIMESTAMP_VALUE");

// 2. Jest/type imports
import {describe, expect, it, jest, beforeEach} from "@jest/globals";

// 3. jest.mock calls
jest.mock("firebase-admin", () => {
  // Note: mockSet, mockGet, mockServerTimestampFn are defined in the outer scope
  // but accessed here deferred via arrow functions to handle hoisting.
  const firestoreInstanceMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: (...args: any[]) => mockSet(...args),
    get: (...args: any[]) => mockGet(...args),
  };

  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => firestoreInstanceMock),
      {
        FieldValue: {
          serverTimestamp: () => mockServerTimestampFn(),
        },
      },
    ),
  };
});

// 4. Import the module under test AFTER mocks are set up
import {isPurchaseTokenAlreadyProcessed, markPurchaseTokenAsProcessed} from "../iapReceiptService";

// 5. Describe block
describe("iapReceiptService", () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockGet.mockClear();
    mockServerTimestampFn.mockClear();

    mockGet.mockResolvedValue({exists: false, data: () => undefined});
    mockServerTimestampFn.mockReturnValue("DEFAULT_SENTINEL_TIMESTAMP");
  });

  describe("isPurchaseTokenAlreadyProcessed", () => {
    it("should return true if token document exists", async () => {
      mockGet.mockResolvedValueOnce({exists: true, data: () => ({processedAt: new Date()})});
      const result = await isPurchaseTokenAlreadyProcessed("user123", "tokenABC");
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledTimes(1);
      const adminFirestore = require("firebase-admin").firestore;
      const firestoreInstance = adminFirestore();
      expect(firestoreInstance.collection).toHaveBeenCalledWith("users");
      expect(firestoreInstance.doc).toHaveBeenCalledWith("user123");
      expect(firestoreInstance.collection).toHaveBeenCalledWith("processedPurchases");
      expect(firestoreInstance.doc).toHaveBeenCalledWith("tokenABC");
    });

    it("should return false if token document does not exist", async () => {
      const result = await isPurchaseTokenAlreadyProcessed("user123", "tokenXYZ");
      expect(result).toBe(false);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return true and log error if Firestore get fails", async () => {
      const testError = new Error("Firestore get error");
      mockGet.mockRejectedValueOnce(testError);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await isPurchaseTokenAlreadyProcessed("userFailedUser", "tokenFail");

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error checking if IAP purchase token was processed:", testError);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("markPurchaseTokenAsProcessed", () => {
    it("should successfully mark purchase token as processed with correct data", async () => {
      const userId = "user789";
      const purchaseToken = "tokenDEF";
      const productId = "product001";
      const expectedTimestampSentinel = "MOCKED_SERVER_TIMESTAMP_SPECIFIC_TO_TEST";
      mockServerTimestampFn.mockReturnValueOnce(expectedTimestampSentinel);

      await markPurchaseTokenAsProcessed(userId, purchaseToken, productId);

      const adminFirestore = require("firebase-admin").firestore;
      const firestoreInstance = adminFirestore();
      expect(firestoreInstance.collection).toHaveBeenCalledWith("users");
      expect(firestoreInstance.doc).toHaveBeenCalledWith(userId);
      expect(firestoreInstance.collection).toHaveBeenCalledWith("processedPurchases");
      expect(firestoreInstance.doc).toHaveBeenCalledWith(purchaseToken);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith({
        processedAt: expectedTimestampSentinel,
        productId: productId,
      });
      expect(mockServerTimestampFn).toHaveBeenCalledTimes(1);
    });

    it("should throw error and log it if Firestore set fails", async () => {
      const testError = new Error("Firestore set error");
      mockSet.mockRejectedValueOnce(testError);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(markPurchaseTokenAsProcessed("user456", "tokenFAIL", "product002")).rejects.toThrow(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error marking IAP purchase token as processed:", testError);
      consoleErrorSpy.mockRestore();
    });
  });
});

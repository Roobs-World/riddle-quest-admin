// / <reference types="jest" />

// Define mock functions first, so they are in scope for the jest.mock factory
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockServerTimestampFn = jest.fn(() => "SENTINEL_SERVER_TIMESTAMP_VALUE");

import * as admin from "firebase-admin";
import {isPurchaseTokenAlreadyProcessed, markPurchaseTokenAsProcessed} from "../iapReceiptService";

// Define mock functions that can be spied on or have their implementations changed per test
// const mockSet = jest.fn();
// const mockGet = jest.fn();
// This specific mock is for the serverTimestamp *function itself*
// const mockServerTimestampFn = jest.fn(() => "SENTINEL_SERVER_TIMESTAMP_VALUE");

jest.mock("firebase-admin", () => {
  // This mock is for the admin.firestore() INSTANCE methods
  const firestoreInstanceMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: mockSet,
    get: mockGet,
  };

  return {
    initializeApp: jest.fn(),
    // admin.firestore is a function that returns an instance,
    // AND it also has static properties like FieldValue.
    firestore: Object.assign(
      jest.fn(() => firestoreInstanceMock), // This is for admin.firestore()
      {
        // This is for admin.firestore.FieldValue
        FieldValue: {
          serverTimestamp: mockServerTimestampFn,
        },
      },
    ),
  };
});

describe("iapReceiptService", () => {
  beforeEach(() => {
    // Clear mocks before each test to ensure test isolation
    mockSet.mockClear();
    mockGet.mockClear();
    mockServerTimestampFn.mockClear(); // Clear the serverTimestamp function mock

    // Reset implementation for mockGet for flexibility per test
    // Default to doc not existing unless overridden in a specific test
    mockGet.mockResolvedValue({exists: false, data: () => undefined});
    // Default for mockServerTimestampFn (can be overridden in tests if specific return needed)
    mockServerTimestampFn.mockReturnValue("DEFAULT_SENTINEL_TIMESTAMP");
  });

  describe("isPurchaseTokenAlreadyProcessed", () => {
    it("should return true if token document exists", async () => {
      mockGet.mockResolvedValueOnce({exists: true, data: () => ({processedAt: new Date()})});
      const result = await isPurchaseTokenAlreadyProcessed("user123", "tokenABC");
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledTimes(1);
      // Example of checking path (optional, can be complex)
      // const firestore = admin.firestore(); // Get the mocked firestore
      // expect(firestore.collection).toHaveBeenCalledWith("users");
      // expect(firestore.doc).toHaveBeenCalledWith("user123");
      // expect(firestore.collection).toHaveBeenCalledWith("processedPurchases");
      // expect(firestore.doc).toHaveBeenCalledWith("tokenABC");
    });

    it("should return false if token document does not exist", async () => {
      const result = await isPurchaseTokenAlreadyProcessed("user123", "tokenXYZ");
      expect(result).toBe(false);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("should return true and log error if Firestore get fails", async () => {
      const testError = new Error("Firestore get error");
      mockGet.mockRejectedValueOnce(testError);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {
        /* suppress error */
      });

      const result = await isPurchaseTokenAlreadyProcessed("userFailedUser", "tokenFail");

      expect(result).toBe(true); // As per SUT logic, it defaults to true on error to prevent reprocessing
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error checking if IAP purchase token was processed:", testError);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("markPurchaseTokenAsProcessed", () => {
    it("should successfully mark purchase token as processed", async () => {
      const userId = "user789";
      const purchaseToken = "tokenDEF";
      const productId = "product001";
      const expectedTimestampSentinel = "MOCKED_SERVER_TIMESTAMP";
      mockServerTimestampFn.mockReturnValueOnce(expectedTimestampSentinel);

      await markPurchaseTokenAsProcessed(userId, purchaseToken, productId);

      // Verify the path more explicitly for the set operation
      const firestore = admin.firestore(); // Get the mocked firestore
      expect(firestore.collection).toHaveBeenCalledWith("users");
      expect(firestore.doc).toHaveBeenCalledWith(userId);
      expect(firestore.collection).toHaveBeenCalledWith("processedPurchases");
      expect(firestore.doc).toHaveBeenCalledWith(purchaseToken);

      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith({
        processedAt: expectedTimestampSentinel, // Should use the sentinel from the mock
        productId: productId,
      });
    });

    it("should throw error and log it if Firestore set fails", async () => {
      const testError = new Error("Firestore set error");
      mockSet.mockRejectedValueOnce(testError);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {
        /* suppress error */
      });

      await expect(markPurchaseTokenAsProcessed("user456", "tokenFAIL", "product002")).rejects.toThrow(
        testError, // Expect the original error to be re-thrown by the SUT
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error marking IAP purchase token as processed:", testError);
      consoleErrorSpy.mockRestore();
    });
  });
});

// / <reference types="jest" />

// Define the mock function at the very top so it's hoisted and available when jest.mock factory runs.
const mockIapValidate = jest.fn();

// Mock in-app-purchase before importing the module
jest.mock("in-app-purchase", () => ({
  __esModule: true,
  default: {
    validate: mockIapValidate,
    APPLE: "apple",
    GOOGLE: "google",
  },
}));

import * as functions from "firebase-functions";
import {performPlatformValidation} from "../iapPlatformValidator";

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  https: {
    HttpsError: jest.fn((code, message, details) => {
      const err = new Error(message);
      Object.assign(err, {code});
      if (details) {
        Object.assign(err, {details});
      }
      return err;
    }),
  },
}));

describe("performPlatformValidation", () => {
  const mockPurchaseToken = "test_purchase_token";
  const mockProductId = "test_product_id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Successful Validations", () => {
    it("should validate successfully for iOS platform", async () => {
      const mockResponse = {status: 0, receipt: {}};

      // Mock the validate function to call callback with success
      mockIapValidate.mockImplementation((platform, token, callback) => {
        expect(platform).toBe("apple");
        expect(token).toBe(mockPurchaseToken);
        // Call callback immediately with success
        callback(null, mockResponse);
      });

      const result = await performPlatformValidation("ios", mockPurchaseToken, mockProductId);

      expect(result).toEqual(mockResponse);
      expect(mockIapValidate).toHaveBeenCalledTimes(1);
      expect(functions.https.HttpsError).not.toHaveBeenCalled();
    });

    it("should validate successfully for Android platform", async () => {
      const mockResponse = {status: 0, receipt: {}};

      // Mock the validate function to call callback with success
      mockIapValidate.mockImplementation((platform, data, callback) => {
        expect(platform).toBe("google");
        expect(data).toEqual({receipt: mockPurchaseToken, productId: mockProductId});
        // Call callback immediately with success
        callback(null, mockResponse);
      });

      const result = await performPlatformValidation("android", mockPurchaseToken, mockProductId);

      expect(result).toEqual(mockResponse);
      expect(mockIapValidate).toHaveBeenCalledTimes(1);
      expect(functions.https.HttpsError).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should throw HttpsError for unsupported platform", async () => {
      await expect(performPlatformValidation("windows", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "invalid-argument",
        message: "Unsupported platform for purchase validation.",
      });

      expect(functions.logger.error).toHaveBeenCalledWith("Unsupported platform for IAP validation:", "windows");
      expect(functions.https.HttpsError).toHaveBeenCalledWith(
        "invalid-argument",
        "Unsupported platform for purchase validation.",
      );
    });

    it("should throw HttpsError with code invalid-argument for iap.validate error with code INVALID_RECEIPT", async () => {
      const iapError = {code: "INVALID_RECEIPT", message: "Invalid receipt"};

      mockIapValidate.mockImplementation((platform, tokenOrData, callback) => {
        callback(iapError, null);
      });

      await expect(performPlatformValidation("ios", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "invalid-argument",
        message: "Invalid or expired purchase receipt.",
      });
    });

    it("should throw HttpsError with code unavailable for iap.validate error with code CONNECTION_ERROR", async () => {
      const iapError = {code: "CONNECTION_ERROR", message: "Connection failed"};

      mockIapValidate.mockImplementation((platform, tokenOrData, callback) => {
        callback(iapError, null);
      });

      await expect(performPlatformValidation("android", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "unavailable",
        message: "Could not connect to app store validation server.",
      });
    });

    it("should throw HttpsError with code internal for other iap.validate errors", async () => {
      const iapError = new Error("failed to validate purchase");

      mockIapValidate.mockImplementation((platform, tokenOrData, callback) => {
        callback(iapError, null);
      });

      await expect(performPlatformValidation("ios", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "internal",
        message: "An error occurred during app store validation.",
      });
    });

    it("should log the error details when iap.validate fails", async () => {
      const iapError = new Error("failed to validate purchase");

      mockIapValidate.mockImplementation((platform, tokenOrData, callback) => {
        callback(iapError, null);
      });

      try {
        await performPlatformValidation("ios", mockPurchaseToken, mockProductId);
      } catch {
        // Expected to throw
      }

      expect(functions.logger.error).toHaveBeenCalledWith(
        `Platform IAP validation failed for ios, token ${mockPurchaseToken}, product ${mockProductId}:`,
        iapError,
      );
    });
  });
});

// / <reference types="jest" />

// Define the mock function at the very top so it's hoisted and available when jest.mock factory runs.
const mockIapValidate = jest.fn();

import * as functions from "firebase-functions";
import {performPlatformValidation} from "../iapPlatformValidator.js";

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(), // Added warn just in case
  },
  https: {
    HttpsError: jest.fn((code, message) => {
      const err = new Error(message); // Create a real Error instance
      (err as unknown as {code: string; httpErrorCode: {canonicalName: string}}).code = code; // Add the 'code' property
      // To match HttpsError structure better for toMatchObject, ensure it has httpErrorCode.canonicalName
      // based on common HttpsError codes for testing.
      let canonicalName = "UNKNOWN";
      if (code === "invalid-argument") canonicalName = "INVALID_ARGUMENT";
      if (code === "unavailable") canonicalName = "UNAVAILABLE";
      if (code === "internal") canonicalName = "INTERNAL";
      // Add other common mappings as needed for tests
      (err as unknown as {code: string; httpErrorCode: {canonicalName: string}}).httpErrorCode = {canonicalName};
      return err;
    }),
  },
}));

// Mock in-app-purchase
jest.mock("in-app-purchase", () => ({
  __esModule: true,
  default: {
    validate: mockIapValidate,
    APPLE: "apple", // Mocked constant
    GOOGLE: "google", // Mocked constant
  },
}));

describe("performPlatformValidation", () => {
  const mockPurchaseToken = "test_purchase_token";
  const mockProductId = "test_product_id";

  beforeEach(() => {
    // Clear all mocks before each test
    mockIapValidate.mockReset();
    (functions.logger.error as jest.Mock).mockClear();
    (functions.https.HttpsError as unknown as jest.Mock).mockClear();
  });

  describe("Successful Validations", () => {
    it("should validate successfully for iOS platform", async () => {
      const mockResponse = {status: 0, receipt: {}};
      mockIapValidate.mockImplementationOnce((platform, token, callback) => {
        callback(null, mockResponse); // Simulate successful validation
      });

      const result = await performPlatformValidation("ios", mockPurchaseToken, mockProductId);

      expect(result).toEqual(mockResponse);
      expect(mockIapValidate).toHaveBeenCalledWith("apple", mockPurchaseToken, expect.any(Function));
    });

    it("should validate successfully for Android platform", async () => {
      const mockResponse = {status: 0, receipt: {}};
      mockIapValidate.mockImplementationOnce((platform, data, callback) => {
        callback(null, mockResponse); // Simulate successful validation
      });

      const result = await performPlatformValidation("android", mockPurchaseToken, mockProductId);

      expect(result).toEqual(mockResponse);
      expect(mockIapValidate).toHaveBeenCalledWith(
        "google",
        {receipt: mockPurchaseToken, productId: mockProductId},
        expect.any(Function),
      );
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
      mockIapValidate.mockImplementationOnce((platform, tokenOrData, callback) => {
        callback(iapError, null); // Simulate iap.validate error
      });

      await expect(performPlatformValidation("ios", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "invalid-argument",
        message: "Invalid or expired purchase receipt.",
      });
      expect(functions.https.HttpsError).toHaveBeenCalledWith(
        "invalid-argument",
        "Invalid or expired purchase receipt.",
        iapError,
      );
    });

    it("should throw HttpsError with code unavailable for iap.validate error with code CONNECTION_ERROR", async () => {
      const iapError = {code: "CONNECTION_ERROR", message: "Connection failed"};
      mockIapValidate.mockImplementationOnce((platform, tokenOrData, callback) => {
        callback(iapError, null); // Simulate iap.validate error
      });

      await expect(performPlatformValidation("android", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "unavailable",
        message: "Could not connect to app store validation server.",
      });
      expect(functions.https.HttpsError).toHaveBeenCalledWith(
        "unavailable",
        "Could not connect to app store validation server.",
        iapError,
      );
    });

    it("should throw HttpsError with code internal for other iap.validate errors", async () => {
      const iapError = {message: "Some other error"}; // No specific code
      mockIapValidate.mockImplementationOnce((platform, tokenOrData, callback) => {
        callback(iapError, null); // Simulate iap.validate error
      });

      await expect(performPlatformValidation("ios", mockPurchaseToken, mockProductId)).rejects.toMatchObject({
        code: "internal",
        message: "An error occurred during app store validation.",
      });
      expect(functions.https.HttpsError).toHaveBeenCalledWith(
        "internal",
        "An error occurred during app store validation.",
        iapError,
      );
    });

    it("should log the error details when iap.validate fails", async () => {
      const iapError = {message: "Test validation error"};
      mockIapValidate.mockImplementationOnce((platform, tokenOrData, callback) => {
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

import * as dotenv from "dotenv";
dotenv.config({path: ".env"}); // Load .env file from firebase-functions directory

// / <reference types="jest" />

// Mock in-app-purchase to prevent errors from iapConfig.ts's top-level iap.config() call
// This test suite is not concerned with iap.config behavior.
const mockIapValidate = jest.fn(); // This might be used if we directly test iap.validate calls here

// Define the mock functions that will be part of the default export
const mockIapConfig = jest.fn();
const mockIapIsValidated = jest.fn();
const mockIapGetPurchaseData = jest.fn();

jest.mock("in-app-purchase", () => ({
  __esModule: true,
  // The default export is an object containing the IAP methods
  default: {
    config: mockIapConfig,
    validate: mockIapValidate,
    isValidated: mockIapIsValidated,
    getPurchaseData: mockIapGetPurchaseData,
    // Keep constants as top-level exports if they are accessed that way,
    // or move them into default if accessed via iap.APPLE
    APPLE: "apple",
    GOOGLE: "google",
  },
  // Also export constants directly if they are imported like: import { APPLE } from 'in-app-purchase';
  // If SUT uses iap.APPLE, then they should be part of the default object above.
  // For now, assuming they might be top-level or part of default, this covers both.
  APPLE: "apple",
  GOOGLE: "google",
}));

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import * as functions from "firebase-functions"; // Ensure this import is present
import {https} from "firebase-functions"; // Also keep this for HttpsError

// Import the function to test
import {validatePurchase} from "../iapValidation";

// Import actual implementations needed for the test environment
import {NO_ADS_PRODUCT_ID, BACKEND_COIN_PRODUCT_DETAILS} from "../iapConfig";

// Mock dependencies
// performPlatformValidation is a critical external call that needs mocking for integration tests
jest.mock("../iapPlatformValidator", () => ({
  performPlatformValidation: jest.fn(),
}));
import {performPlatformValidation as mockPerformPlatformValidation} from "../iapPlatformValidator";

const FIREBASE_PROJECT_ID = "qwordly-6ba44";

// Initialize firebase-functions-test. This DOES NOT initialize admin.initializeApp()
// when used with a live project. We must do that manually.
const testEnv = functionsTest();

// Manually initialize Firebase Admin SDK for testing against the live project
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH;
  if (!serviceAccountPath) {
    console.error(
      "\n🚨 GOOGLE_APPLICATION_CREDENTIALS_PATH environment variable is not set in .env file. " +
        "This is required for tests connecting to live Firebase services. " +
        "Please set it in firebase-functions/.env to the path of your service account key file.🚨\n",
    );
    // Optionally, throw to prevent tests from running without credentials
    // throw new Error("GOOGLE_APPLICATION_CREDENTIALS_PATH is not set in .env.");
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath as string),
      projectId: FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error("🚨 Firebase Admin SDK initialization failed. Path used: ", serviceAccountPath, "Error: ", error);
    throw error; // Re-throw the error to fail the test run if initialization fails
  }
}

// const firestore = admin.firestore(); // Moved to beforeAll

describe("validatePurchase - Integration Tests", () => {
  const wrappedValidatePurchase = testEnv.wrap(validatePurchase);
  const testUserId = "testUser123";
  const testUserEmail = "testuser@example.com";
  let firestore: admin.firestore.Firestore;

  beforeAll(async () => {
    // Initialize Firestore instance after admin app is initialized.
    firestore = admin.firestore();
    // Optional: Verify GOOGLE_APPLICATION_CREDENTIALS_PATH is set for clarity during test runs
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH) {
      console.warn(
        "\n⚠️ GOOGLE_APPLICATION_CREDENTIALS_PATH is not set in .env. Tests will likely fail to connect to live Firestore. ⚠️\n",
      );
    }
  });

  beforeEach(async () => {
    // Reset mocks before each test
    (mockPerformPlatformValidation as jest.Mock).mockReset();
    // Reset the mock functions that are part of the default export
    mockIapConfig.mockReset();
    mockIapValidate.mockReset();
    mockIapIsValidated.mockReset();
    mockIapGetPurchaseData.mockReset();

    // Clear user data and processed purchases before each test to ensure idempotency
    const userDocRef = firestore.collection("users").doc(testUserId);
    const purchasesSnapshot = await userDocRef.collection("processedPurchases").get();
    const deletePromises = purchasesSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(deletePromises);
    // Delete user, ignore if not exists (hence the empty catch)
    await userDocRef.delete().catch(() => {
      /* ignore error if user doc doesn't exist */
    });

    // Create a test user
    await firestore.collection("users").doc(testUserId).set({
      email: testUserEmail,
      coins: 100, // Initial coins
      hasPurchasedApp: false,
    });
  });

  afterAll(() => {
    testEnv.cleanup(); // Clean up firebase-functions-test
  });

  // Helper to construct the request object for onCall v2 functions
  const constructOnCallRequest = (
    data: Record<string, unknown>,
    authContextArg?: {uid: string; token: {email: string}} | null,
  ): functions.https.CallableRequest => {
    // Default to an authenticated context if authContextArg is undefined
    const auth = authContextArg === undefined ? {uid: testUserId, token: {email: testUserEmail}} : authContextArg;
    return {
      data: data,
      auth: auth,
      rawRequest: {headers: {}, body: {}}, // Minimal rawRequest to satisfy type
      // acceptsStreaming: false, // Optional, defaults to false
    } as functions.https.CallableRequest;
  };

  it("should throw unauthenticated if called without authentication", async () => {
    // Pass null as the second argument to explicitly set auth to null
    await expect(wrappedValidatePurchase(constructOnCallRequest({}, null))).rejects.toThrowError(
      new https.HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("should throw invalid-argument for missing purchaseToken", async () => {
    const data = {productId: "testProd", platform: "ios"};
    await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
      new https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw invalid-argument for missing productId", async () => {
    const data = {purchaseToken: "testToken", platform: "ios"};
    await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
      new https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw invalid-argument for missing platform", async () => {
    const data = {purchaseToken: "testToken", productId: "testProd"};
    await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
      new https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw invalid-argument for invalid platform value", async () => {
    const data = {purchaseToken: "testToken", productId: "testProd", platform: "windows"};
    await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
      new https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw already-exists if purchase token was already processed", async () => {
    const purchaseToken = "processedToken123";
    const productId = "anyProduct";
    await firestore
      .collection("users")
      .doc(testUserId)
      .collection("processedPurchases")
      .doc(purchaseToken)
      .set({processedAt: admin.firestore.FieldValue.serverTimestamp(), productId});

    const data = {purchaseToken, productId, platform: "ios"};
    await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
      new https.HttpsError("already-exists", "This purchase has already been processed."),
    );
  });

  describe("Successful NO_ADS Purchase", () => {
    it("should validate, mark as processed, and set hasPurchasedApp to true for NO_ADS_PRODUCT_ID", async () => {
      const purchaseToken = "noAdsTokenValid";
      const productId = NO_ADS_PRODUCT_ID;
      const platform = "ios";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([{productId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId, platform};
      const result = await wrappedValidatePurchase(constructOnCallRequest(data));

      expect(result.success).toBe(true);
      expect(result.newCoins).toBe(100); // Coins should remain unchanged for no-ads

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.hasPurchasedApp).toBe(true);

      const processedDoc = await firestore
        .collection("users")
        .doc(testUserId)
        .collection("processedPurchases")
        .doc(purchaseToken)
        .get();
      expect(processedDoc.exists).toBe(true);
      expect(processedDoc.data()?.productId).toBe(productId);
      expect(mockPerformPlatformValidation).toHaveBeenCalledWith(platform, purchaseToken, productId);
    });
  });

  describe("Successful Coin Pack Purchase", () => {
    it("should validate, award coins, and mark as processed for a coin pack", async () => {
      const purchaseToken = "coinPackTokenValid";
      const productInfo = Object.values(BACKEND_COIN_PRODUCT_DETAILS)[0];
      const productId = productInfo.id;
      const coinsToAward = productInfo.coins;
      const platform = "android";
      const initialCoins = 100;

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([{productId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId, platform};
      const result = await wrappedValidatePurchase(constructOnCallRequest(data));

      expect(result.success).toBe(true);
      expect(result.newCoins).toBe(initialCoins + coinsToAward);

      const userDoc = await firestore.collection("users").doc(testUserId).get();
      expect(userDoc.data()?.coins).toBe(initialCoins + coinsToAward);
      expect(userDoc.data()?.hasPurchasedApp).toBe(false); // Ensure it's not accidentally set

      const processedDoc = await firestore
        .collection("users")
        .doc(testUserId)
        .collection("processedPurchases")
        .doc(purchaseToken)
        .get();
      expect(processedDoc.exists).toBe(true);
      expect(processedDoc.data()?.productId).toBe(productId);
      expect(mockPerformPlatformValidation).toHaveBeenCalledWith(platform, purchaseToken, productId);
    });
  });

  describe("Validation Failures and Edge Cases", () => {
    it("should throw if performPlatformValidation fails", async () => {
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";
      const platformError = new Error("Platform validation failed");

      (mockPerformPlatformValidation as jest.Mock).mockRejectedValue(platformError);

      const data = {purchaseToken, productId, platform};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "An unexpected error occurred during purchase processing."),
      );
      expect(mockPerformPlatformValidation).toHaveBeenCalledWith(platform, purchaseToken, productId);
      // Verify that subsequent steps were not called
      expect(mockIapIsValidated).not.toHaveBeenCalled();
      expect(mockIapGetPurchaseData).not.toHaveBeenCalled();
      // Note: We cannot easily verify that Firestore/iapReceiptService functions were not called
      // without mocking them, which we are avoiding in integration tests.
      // We rely on the function's internal logic and the error being thrown early.
    });

    it("should throw failed-precondition if iap.isValidated returns false", async () => {
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({}); // Simulate successful platform call
      mockIapIsValidated.mockReturnValue(false); // Simulate invalid purchase

      const data = {purchaseToken, productId, platform};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
      );
      expect(mockPerformPlatformValidation).toHaveBeenCalledWith(platform, purchaseToken, productId);
      expect(mockIapIsValidated).toHaveBeenCalledTimes(1);
      expect(mockIapGetPurchaseData).not.toHaveBeenCalled();
    });

    it("should throw internal error if iap.getPurchaseData returns null or undefined", async () => {
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue(null); // Simulate invalid data

      const data = {purchaseToken, productId, platform};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "Could not extract purchase data from validation response."),
      );
      expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    });

    it("should throw internal error if iap.getPurchaseData returns non-array", async () => {
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue({}); // Simulate non-array data

      const data = {purchaseToken, productId, platform};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "Could not extract purchase data from validation response."),
      );
      expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    });

    it("should throw failed-precondition if product ID from receipt does not match requested product ID", async () => {
      const purchaseToken = "token";
      const requestedProductId = "requested.prod.id";
      const receiptProductId = "different.prod.id"; // Mismatched product ID
      const platform = "ios";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([{productId: receiptProductId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId: requestedProductId, platform};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
      );
      expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    });

    it("should throw internal error if backend product config is missing for coin pack", async () => {
      const purchaseToken = "token";
      // Use a product ID that exists in the receipt but not in BACKEND_COIN_PRODUCT_DETAILS
      const unknownProductId = "com.qwordly.coins.unknown";
      const platform = "android";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([
        {productId: unknownProductId, quantity: 1, transactionId: purchaseToken},
      ]);

      const data = {purchaseToken, productId: unknownProductId, platform};

      // We need to mock iapConfig or use isolateModules here to control BACKEND_COIN_PRODUCT_DETAILS,
      // but since this is an integration test, we are relying on the actual iapConfig.ts.
      // We need to ensure that iapConfig.ts *does not* contain unknownProductId.
      // The current iapConfig.ts should not contain this, so the test should pass without mocking iapConfig itself.

      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "Product configuration error on backend."),
      );
      expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    });

    // TODO: Add tests for failures in Firestore/iapReceiptService operations if necessary
    // (e.g., errors during updateUserCoins, markPurchaseTokenAsProcessed).
    // These might require more advanced Firestore mocking within the test or ensuring emulator errors are handled correctly.
  });
});

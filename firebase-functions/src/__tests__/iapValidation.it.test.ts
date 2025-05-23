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

// Initialize firebase-functions-test in offline mode.
const testEnv = functionsTest();

// Ensure Firebase app is initialized before tests run, if not already.
// This is crucial because functionsTest() in offline mode might not initialize a default app
// in a way that admin.firestore() can immediately use, especially if other modules
// (like iapConfig through iapValidation) are loaded.
if (!admin.apps.length) {
  admin.initializeApp();
}

// Mock Firestore operations from firestoreService for some specific error cases if needed,
// but generally, we want to test the real Firestore interaction via emulators.
// For now, we rely on the real service for most cases.

// const firestore = admin.firestore(); // Moved to beforeAll

describe("validatePurchase - Integration Tests", () => {
  const wrappedValidatePurchase = testEnv.wrap(validatePurchase);
  const testUserId = "testUser123";
  const testUserEmail = "testuser@example.com";
  let firestore: admin.firestore.Firestore;

  beforeAll(async () => {
    // Check if Firestore emulator is configured
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.error(
        "\n🔥🔥🔥 FIRESTORE_EMULATOR_HOST is not set. Integration tests will likely time out or hit live Firestore. 🔥🔥🔥\n",
      );
      // Optionally, throw an error to halt tests if emulator is strictly required
      // throw new Error("FIRESTORE_EMULATOR_HOST not set. Ensure emulators are running and configured.");
    }
    // Initialize Firestore after testEnv is set up and admin app is ensured.
    firestore = admin.firestore();
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
      const purchaseToken = "platformValidationFailsToken";
      const productId = NO_ADS_PRODUCT_ID;
      (mockPerformPlatformValidation as jest.Mock).mockRejectedValue(
        new Error("Simulated platform validation network error"), // Test actual error thrown by service
      );

      const data = {purchaseToken, productId, platform: "ios"};
      // Expect the higher-level handler in validatePurchase to catch this and throw an HttpsError
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "An unexpected error occurred during purchase processing."),
      );
    });

    it("should throw if iap.isValidated returns false", async () => {
      const purchaseToken = "isValidatedFalseToken";
      const productId = NO_ADS_PRODUCT_ID;
      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true}); // Assume platform validation passes
      mockIapIsValidated.mockReturnValue(false); // This is the case being tested
      // mockIapGetPurchaseData doesn't need to be set up if isValidated is false

      const data = {purchaseToken, productId, platform: "ios"};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
      );
    });

    it("should throw if iap.getPurchaseData returns no matching product", async () => {
      const purchaseToken = "noMatchingProductToken";
      const requestedProductId = "requestedProdId";
      const validatedProductId = "validatedDifferentProdId";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true});
      mockIapIsValidated.mockReturnValue(true); // Assume validation and isValidated pass
      mockIapGetPurchaseData.mockReturnValue([{productId: validatedProductId, transactionId: purchaseToken}]); // Data with mismatching product ID

      const data = {purchaseToken, productId: requestedProductId, platform: "ios"};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
      );
    });

    it("should throw if iap.getPurchaseData returns an empty array", async () => {
      const purchaseToken = "emptyPurchaseDataToken";
      const productId = NO_ADS_PRODUCT_ID;

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([]); // Empty array is the case being tested

      const data = {purchaseToken, productId, platform: "ios"};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "Could not extract purchase data from validation response."),
      );
    });

    it("should throw if backend product config is missing for a validated coin pack ID", async () => {
      const purchaseToken = "missingBackendConfigToken";
      const unknownProductId = "com.qwordly.coins.unknown_pack";

      (mockPerformPlatformValidation as jest.Mock).mockResolvedValue({isValid: true});
      mockIapIsValidated.mockReturnValue(true);
      mockIapGetPurchaseData.mockReturnValue([{productId: unknownProductId, transactionId: purchaseToken}]); // Validated but unknown product

      const data = {purchaseToken, productId: unknownProductId, platform: "android"};
      await expect(wrappedValidatePurchase(constructOnCallRequest(data))).rejects.toThrowError(
        new https.HttpsError("internal", "Product configuration error on backend."),
      );
    });
  });
});

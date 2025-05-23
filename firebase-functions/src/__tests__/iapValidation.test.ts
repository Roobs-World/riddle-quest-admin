import {describe, expect, it, jest, beforeEach, afterEach} from "@jest/globals";
import * as functions from "firebase-functions";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Import the function to test
import {validatePurchase as originalValidatePurchase} from "../iapValidation";

// Explicitly type the imported function to match v2 callable signature
const validatePurchase: (
  request: CallableRequest<ValidatePurchaseData>,
) => Promise<{success: boolean; newCoins: number | undefined}> = originalValidatePurchase as any;

// Mock external dependencies
const mockGetUser = jest.fn<() => Promise<any>>(); // Use any for flexibility in testing different user states
const mockUpdateUserCoins = jest.fn<() => Promise<void>>();
jest.mock("../firestoreService.js", () => ({
  getUser: mockGetUser,
  updateUserCoins: mockUpdateUserCoins,
}));

const mockIsPurchaseTokenAlreadyProcessed = jest.fn<() => Promise<boolean>>();
const mockMarkPurchaseTokenAsProcessed = jest.fn<() => Promise<void>>();
jest.mock("../iapReceiptService.js", () => ({
  isPurchaseTokenAlreadyProcessed: mockIsPurchaseTokenAlreadyProcessed,
  markPurchaseTokenAsProcessed: mockMarkPurchaseTokenAsProcessed,
}));

const mockPerformPlatformValidation = jest.fn<() => Promise<any>>(); // Use any for flexibility with validation response structure
jest.mock("../iapPlatformValidator.js", () => ({
  performPlatformValidation: mockPerformPlatformValidation,
}));

const mockIapIsValidated = jest.fn<() => boolean>();
const mockIapGetPurchaseData = jest.fn<() => any>(); // Use any as the structure can vary
// Mock the in-app-purchase library
jest.mock("in-app-purchase", () => ({
  // Mock the default export object
  default: {
    // config is called on import, mock it to prevent errors
    config: jest.fn(),
    isValidated: mockIapIsValidated,
    getPurchaseData: mockIapGetPurchaseData,
    // Include constants if they are accessed via iap.CONSTANT
    APPLE: "apple",
    GOOGLE: "google",
  },
  // Include constants if they are imported directly { CONSTANT } from 'in-app-purchase'
  APPLE: "apple",
  GOOGLE: "google",
}));

// Mock firebase-admin for Firestore interactions
const mockFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockFirestoreGet = jest.fn<() => Promise<any>>(); // Use any for flexibility with doc data structure
const mockFirestoreDoc = jest.fn<() => any>(() => ({
  update: mockFirestoreUpdate,
  get: mockFirestoreGet,
  collection: jest.fn(() => mockFirestoreCollection), // Return mockCollection for chaining
  doc: jest.fn(() => mockFirestoreDoc()), // Return a new instance for chaining
  set: jest.fn<() => Promise<void>>(), // For processedPurchases.doc(token).set()
}));
const mockFirestoreCollection = jest.fn<() => any>(() => ({
  doc: mockFirestoreDoc,
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: mockFirestoreCollection,
    FieldValue: {
      serverTimestamp: jest.fn(),
    }, // Mock FieldValue if used (e.g., for timestamps)
  }),
}));

// Mock firebase-functions logger
jest.mock("firebase-functions", () => ({
  // ...jest.requireActual("firebase-functions"), // Use actual for other exports
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Define types for request data
interface ValidatePurchaseData {
  purchaseToken: string;
  productId: string;
  platform: string;
}

describe("validatePurchase - Unit Tests", () => {
  const testUserId = "testUser123";
  // This mock context object is not used by v2 callable functions and can be removed.
  // const mockContext = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset specific mocks
    mockGetUser.mockReset();
    mockUpdateUserCoins.mockReset();
    mockIsPurchaseTokenAlreadyProcessed.mockReset();
    mockMarkPurchaseTokenAsProcessed.mockReset();
    mockPerformPlatformValidation.mockReset();
    mockIapIsValidated.mockReset();
    mockIapGetPurchaseData.mockReset();
    mockFirestoreUpdate.mockReset();
    mockFirestoreGet.mockReset();

    // Re-implement chainable mocks after reset
    const mockFirestoreDocInstance = jest.fn<() => any>(() => ({
      update: mockFirestoreUpdate,
      get: mockFirestoreGet,
      collection: jest.fn(() => mockFirestoreCollectionInstance()),
      doc: jest.fn(() => mockFirestoreDocInstance()),
      set: jest.fn<() => Promise<void>>(),
    }));

    const mockFirestoreCollectionInstance = jest.fn<() => any>(() => ({
      doc: mockFirestoreDocInstance,
    }));

    // Assign the instances to the mocks used in the firebase-admin mock
    (mockFirestoreDoc as jest.Mock).mockImplementation(() => mockFirestoreDocInstance());
    (mockFirestoreCollection as jest.Mock).mockImplementation(() => mockFirestoreCollectionInstance());

    // Default mock implementations for successful path
    mockGetUser.mockResolvedValue({coins: 100, hasPurchasedApp: false});
    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(false);
    mockPerformPlatformValidation.mockResolvedValue({}); // Basic resolved value
    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue([{productId: "mock.product.id", transactionId: "mockToken"}]);
    mockUpdateUserCoins.mockResolvedValue(undefined); // Assume update is successful
    mockFirestoreUpdate.mockResolvedValue(undefined); // Assume update is successful
    // Mock user data after coin update - needs to match the shape expected by getUser after update
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: false}); // Initial call in function
    mockGetUser.mockResolvedValueOnce({coins: 200, hasPurchasedApp: false}); // Second call after updateUserCoins
    mockFirestoreGet.mockResolvedValue({exists: true, data: () => ({coins: 100, hasPurchasedApp: false})}); // Default mock for Firestore gets if needed elsewhere
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw unauthenticated error if called without authentication", async () => {
    const request: CallableRequest<ValidatePurchaseData> = {
      auth: undefined,
      data: {purchaseToken: "token", productId: "prod", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    } as any; // Cast to any to allow testing missing auth

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("should throw invalid-argument error for missing or invalid data fields", async () => {
    const auth = {uid: testUserId} as any;

    // Test missing purchaseToken
    let request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {productId: "prod", platform: "ios"} as any,
      rawRequest: {} as any,
      acceptsStreaming: false,
    };
    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );

    // Test missing productId
    request = {
      auth,
      data: {purchaseToken: "token", platform: "ios"} as any,
      rawRequest: {} as any,
      acceptsStreaming: false,
    };
    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );

    // Test missing platform
    request = {
      auth,
      data: {purchaseToken: "token", productId: "prod"} as any,
      rawRequest: {} as any,
      acceptsStreaming: false,
    };
    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );

    // Test invalid platform
    request = {
      auth,
      data: {purchaseToken: "token", productId: "prod", platform: "windows"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    } as any;
    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw already-exists error if purchase token is already processed", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "processedToken", productId: "prod", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(true);

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("already-exists", "This purchase has already been processed."),
    );

    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "processedToken");
    expect(mockPerformPlatformValidation).not.toHaveBeenCalled();
    expect(mockIapIsValidated).not.toHaveBeenCalled();
    expect(mockIapGetPurchaseData).not.toHaveBeenCalled();
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).not.toHaveBeenCalled();
  });

  it("should throw internal error if performPlatformValidation fails", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId: "prod", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };
    const platformError = new Error("Platform validation failed");

    mockPerformPlatformValidation.mockRejectedValue(platformError);

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("internal", "An unexpected error occurred during purchase processing."),
    );

    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("ios", "token", "prod");
    expect(mockIapIsValidated).not.toHaveBeenCalled();
    expect(mockIapGetPurchaseData).not.toHaveBeenCalled();
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).not.toHaveBeenCalled();
    expect(functions.logger.error).toHaveBeenCalledWith(
      `IAP validation process failed for user ${testUserId}, product prod:`,
      platformError,
    );
  });

  it("should throw failed-precondition if iap.isValidated returns false", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId: "prod", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIapIsValidated.mockReturnValue(false);

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );

    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledTimes(1);
    expect(mockPerformPlatformValidation).toHaveBeenCalledTimes(1);
    expect(mockIapIsValidated).toHaveBeenCalledTimes(1);
    expect(mockIapGetPurchaseData).not.toHaveBeenCalled();
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).not.toHaveBeenCalled();
    expect(functions.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Purchase validation failed or product ID mismatch"),
      expect.stringContaining("Validated: false"),
    );
  });

  it("should throw internal error if iap.getPurchaseData returns invalid data", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId: "prod", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue(null); // Simulate invalid data (not an array)

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("internal", "Could not extract purchase data from validation response."),
    );

    expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    expect(functions.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("iap.getPurchaseData did not return valid array"),
    );
  });

  it("should throw failed-precondition if product ID from receipt does not match requested product ID", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId: "requested.prod.id", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue([{productId: "different.prod.id", transactionId: "token"}]); // Mismatched product ID

    await expect(validatePurchase(request)).rejects.toThrow(
      new HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );

    expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    expect(functions.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Purchase validation failed or product ID mismatch"),
      expect.stringContaining("Expected requested.prod.id, got different.prod.id"),
    );
  });

  it("should handle successful NO_ADS purchase", async () => {
    const auth = {uid: testUserId} as any;
    const productId = "com.qwordly.noads"; // Assuming this is the NO_ADS_PRODUCT_ID
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId, platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue([{productId, transactionId: "token"}]);
    mockFirestoreUpdate.mockResolvedValue(undefined); // For userRef.update
    // Need to mock the getUser calls explicitly as they are called multiple times with potentially different data
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: false}); // First call in function (check initial user)
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: true}); // Second call (fetch user after hasPurchasedApp update)

    mockMarkPurchaseTokenAsProcessed.mockResolvedValue(undefined);

    const result = await validatePurchase(request);

    expect(result).toEqual({success: true, newCoins: 100});
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledTimes(1);
    expect(mockPerformPlatformValidation).toHaveBeenCalledTimes(1);
    expect(mockIapIsValidated).toHaveBeenCalledTimes(1);
    expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    expect(mockFirestoreDoc).toHaveBeenCalledWith(testUserId);
    expect(mockFirestoreUpdate).toHaveBeenCalledWith({hasPurchasedApp: true});
    expect(mockUpdateUserCoins).not.toHaveBeenCalled(); // Coins should not change for no-ads
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token", productId);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(functions.logger.info).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${productId}`,
    );
    expect(functions.logger.info).toHaveBeenCalledWith(`User ${testUserId} has purchased ad removal.`);
  });

  it("should handle successful coin pack purchase", async () => {
    const auth = {uid: testUserId} as any;
    const productId = "com.qwordly.coins.small"; // Assuming a coin pack product ID
    const coinsToAward = 50; // Corresponding coins
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId, platform: "android"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    // Mock BACKEND_COIN_PRODUCT_DETAILS lookup indirectly by setting up getPurchaseData mock
    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue([{productId, quantity: 1, transactionId: "token"}]);
    mockUpdateUserCoins.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: false}); // Initial user data
    mockGetUser.mockResolvedValueOnce({coins: 100 + coinsToAward, hasPurchasedApp: false}); // User data after coin update
    mockMarkPurchaseTokenAsProcessed.mockResolvedValue(undefined);

    // Mock product details lookup within the function
    // Need to use jest.isolateModules to mock iapConfig for a single test
    const iapValidationModule = (await jest.isolateModules(async () => {
      jest.mock("../iapConfig.js", () => ({
        NO_ADS_PRODUCT_ID: "com.qwordly.noads",
        BACKEND_COIN_PRODUCT_DETAILS: {
          small: {id: "com.qwordly.coins.small", coins: 50},
          medium: {id: "com.qwordly.coins.medium", coins: 100},
        },
      }));
      // Import the function within the isolated module context
      return import("../iapValidation.js");
    })) as any;

    const validatePurchaseWithMockConfig = iapValidationModule.validatePurchase as any;

    const result = await validatePurchaseWithMockConfig(request);

    expect(result).toEqual({success: true, newCoins: 100 + coinsToAward});
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledTimes(1);
    expect(mockPerformPlatformValidation).toHaveBeenCalledTimes(1);
    expect(mockIapIsValidated).toHaveBeenCalledTimes(1);
    expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    // expect(mockFirestoreDoc).toHaveBeenCalledWith(testUserId); // Not called for coin packs initially
    expect(mockFirestoreUpdate).not.toHaveBeenCalled(); // hasPurchasedApp not updated
    expect(mockUpdateUserCoins).toHaveBeenCalledWith(testUserId, coinsToAward);
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token", productId);
    expect(mockGetUser).toHaveBeenCalledTimes(2); // Once before updateUserCoins, once after
    expect(functions.logger.info).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${productId}`,
    );
    expect(functions.logger.info).toHaveBeenCalledWith(
      `Awarded ${coinsToAward} coins to user ${testUserId}. ` + `New balance: ${100 + coinsToAward}`,
    );
  });

  it("should throw internal error if backend product config is missing for coin pack", async () => {
    const auth = {uid: testUserId} as any;
    const unknownProductId = "com.qwordly.coins.unknown";
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "token", productId: unknownProductId, platform: "android"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    mockIapIsValidated.mockReturnValue(true);
    mockIapGetPurchaseData.mockReturnValue([{productId: unknownProductId, quantity: 1, transactionId: "token"}]);
    mockGetUser.mockResolvedValue({coins: 100, hasPurchasedApp: false}); // Initial user data

    // Mock iapConfig to NOT include the unknownProductId using isolateModules
    const iapValidationModule = (await jest.isolateModules(async () => {
      jest.mock("../iapConfig.js", () => ({
        NO_ADS_PRODUCT_ID: "com.qwordly.noads",
        BACKEND_COIN_PRODUCT_DETAILS: {
          small: {id: "com.qwordly.coins.small", coins: 50},
        }, // unknownProductId is missing here
      }));
      return import("../iapValidation.js");
    })) as any;

    const validatePurchaseWithMockConfig = iapValidationModule.validatePurchase as any;

    await expect(validatePurchaseWithMockConfig(request)).rejects.toThrow(
      new HttpsError("internal", "Product configuration error on backend."),
    );

    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledTimes(1);
    expect(mockPerformPlatformValidation).toHaveBeenCalledTimes(1);
    expect(mockIapIsValidated).toHaveBeenCalledTimes(1);
    expect(mockIapGetPurchaseData).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).not.toHaveBeenCalled();
    expect(functions.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Product details not found on backend for validated product ID"),
    );
  });

  it("should successfully validate a purchase and update user coins", async () => {
    const auth = {uid: testUserId} as any;
    const request: CallableRequest<ValidatePurchaseData> = {
      auth,
      data: {purchaseToken: "newToken", productId: "com.qwordly.coins.100", platform: "ios"},
      rawRequest: {} as any,
      acceptsStreaming: false,
    };

    const initialCoins = 100;
    const productCoins = 100; // Assuming "com.qwordly.coins.100" grants 100 coins
    const expectedCoinsAfterPurchase = initialCoins + productCoins;

    // Setup mocks for a successful scenario
    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(false);
    mockPerformPlatformValidation.mockResolvedValue({
      /* mock successful platform response */
    });
    mockIapIsValidated.mockReturnValue(true);
    // Mock iap.getPurchaseData to return data matching the requested product ID
    mockIapGetPurchaseData.mockReturnValue([{productId: "com.qwordly.coins.100", transactionId: "newToken"}]);
    mockGetUser.mockResolvedValue({coins: initialCoins, hasPurchasedApp: false});
    mockUpdateUserCoins.mockResolvedValue(undefined); // Simulate successful update
    mockMarkPurchaseTokenAsProcessed.mockResolvedValue(undefined); // Simulate successful processing

    // Call the function
    const result = await validatePurchase(request);

    // Assertions
    expect(result).toEqual({status: "success", newCoinBalance: expectedCoinsAfterPurchase});
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "newToken");
    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("ios", "newToken", "com.qwordly.coins.100");
    expect(mockIapIsValidated).toHaveBeenCalled();
    expect(mockIapGetPurchaseData).toHaveBeenCalled();
    // Verify getUser was called initially and after update to get the final coin balance
    expect(mockGetUser).toHaveBeenCalledTimes(2); // once at the beginning, once at the end
    expect(mockUpdateUserCoins).toHaveBeenCalledWith(testUserId, productCoins); // Verify coins are added
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "newToken");
    expect(functions.logger.info).toHaveBeenCalledWith(
      `Purchase validated and processed for user ${testUserId}. Product ID: com.qwordly.coins.100.`,
    );
  });
});

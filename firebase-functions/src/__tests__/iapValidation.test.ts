// Mock variables for 'in-app-purchase' declared at the top for hoisting
const mockIapIsValidated = jest.fn<() => boolean>();
const mockIapGetPurchaseData = jest.fn<() => unknown[] | null>();
const mockIapConfig = jest.fn<(...args: unknown[]) => void>();
const mockIapSetup = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockIapGetProducts = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapGetSubscriptions = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapFinishTransaction = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);

const mockGetCoinsForProduct = jest.fn<(...args: unknown[]) => Promise<number | undefined>>();
const mockIncrementCoinPackPurchaseCount = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockLogPurchaseAnalytic = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockUpdateRegionalSpendingStats = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);

// iapValidation.test.ts
// 1. Jest Globals and Types First
import {describe, expect, it, jest, beforeEach} from "@jest/globals";
import {CallableRequest} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";

// 2. Mock ../iapConfig FIRST
jest.mock("../iapConfig", () => {
  return {
    __esModule: true,
    NO_ADS_PRODUCT_ID: "com.roobsworld.riddlequest.noads.unitmock.v4",
    BACKEND_COIN_PRODUCT_DETAILS: {
      COIN_PACK_SMALL: {id: "com.roobsworld.riddlequest.coins.small.unitmock.v4", coins: 50},
      COIN_PACK_MEDIUM: {id: "com.roobsworld.riddlequest.coins.medium.unitmock.v4", coins: 250},
      COIN_PACK_LARGE: {id: "com.roobsworld.riddlequest.coins.large.unitmock.v4", coins: 600},
    },
    initializeIapConfig: jest.fn(),
  };
});

// 3. Define other top-level mock consts
const mockGetUser = jest.fn<(...args: unknown[]) => Promise<{coins: number; hasPurchasedApp: boolean} | null>>();
const mockUpdateUserCoins = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpdateUserProfile = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockMarkPurchaseTokenAsProcessed = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockIsPurchaseTokenAlreadyProcessed = jest.fn<(...args: unknown[]) => Promise<boolean>>();
const mockPerformPlatformValidation =
  jest.fn<(...args: unknown[]) => Promise<{isValid: boolean; productId: string; transactionId: string}>>();
const mockEvaluateAchievements = jest.fn<(...args: unknown[]) => Promise<string[]>>();

const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerWarn = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();
const mockCaptureException = jest.fn<(...args: unknown[]) => void>();
const mockWithSentrySpan = jest.fn<(...args: unknown[]) => unknown>();

// Firestore Mocks - Refactored
const mockFsUpdate = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockFsGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFsDoc = jest.fn<(...args: unknown[]) => unknown>(); // Returns an object with update/get
const mockFsCollection = jest.fn<(...args: unknown[]) => unknown>(); // Returns an object with doc

// Define mocks for 'in-app-purchase' methods at the top level
/*
const mockIapIsValidated = jest.fn<() => boolean>();
const mockIapGetPurchaseData = jest.fn<() => unknown[] | null>();
const mockIapConfig = jest.fn<(...args: unknown[]) => void>();
const mockIapSetup = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockIapGetProducts = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapGetSubscriptions = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapFinishTransaction = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
*/

interface ValidatePurchaseData {
  purchaseToken: string;
  productId: string;
  platform: string;
}

// 4. MOCK OTHER MODULES
jest.mock(
  "in-app-purchase",
  () => {
    return {
      __esModule: true,
      default: {
        isValidated: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapIsValidated.apply(this, arguments);
        },
        getPurchaseData: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapGetPurchaseData.apply(this, arguments);
        },
        config: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapConfig.apply(this, arguments);
        },
        setup: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapSetup.apply(this, arguments);
        },
        getProducts: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapGetProducts.apply(this, arguments);
        },
        getSubscriptions: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapGetSubscriptions.apply(this, arguments);
        },
        finishTransaction: function () {
          // eslint-disable-next-line prefer-rest-params
          return mockIapFinishTransaction.apply(this, arguments);
        },
      },
    };
  },
  {virtual: true},
);

jest.mock("firebase-functions", () => ({
  config: () => ({
    apple: {shared_secret: "test-apple-secret"},
    google: {
      service_account: {
        client_email: "test@firebase-adminsdk.iam.gserviceaccount.com",
        private_key: "TEST_PRIVATE_KEY",
      },
    },
  }),
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
  https: {
    HttpsError: class MockV1HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
        Object.setPrototypeOf(this, MockV1HttpsError.prototype); // Maintain prototype chain
      }
    },
  },
}));

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: jest.fn((optionsOrHandler, maybeHandler) => maybeHandler ?? optionsOrHandler),
    HttpsError: actualV2Https.HttpsError,
  };
});

jest.mock("../firestoreService", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  updateUserCoins: (...args: unknown[]) => mockUpdateUserCoins(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

jest.mock("../iapReceiptService", () => ({
  isPurchaseTokenAlreadyProcessed: (...args: unknown[]) => mockIsPurchaseTokenAlreadyProcessed(...args),
  markPurchaseTokenAsProcessed: (...args: unknown[]) => mockMarkPurchaseTokenAsProcessed(...args),
}));

jest.mock("../iapPlatformValidator", () => ({
  performPlatformValidation: (...args: unknown[]) => mockPerformPlatformValidation(...args),
}));

jest.mock("../achievements", () => ({
  evaluateAchievements: (...args: unknown[]) => mockEvaluateAchievements(...args),
}));

jest.mock("../productPricingService", () => ({
  getCoinsForProduct: (...args: unknown[]) => mockGetCoinsForProduct(...args),
  incrementCoinPackPurchaseCount: (...args: unknown[]) => mockIncrementCoinPackPurchaseCount(...args),
  logPurchaseAnalytic: (...args: unknown[]) => mockLogPurchaseAnalytic(...args),
  updateRegionalSpendingStats: (...args: unknown[]) => mockUpdateRegionalSpendingStats(...args),
}));

jest.mock("../sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  withSentrySpan: (...args: unknown[]) => mockWithSentrySpan(...args),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: mockFsCollection, // Use refactored mock
      // doc: mockFsDoc, // if admin.firestore().doc() is used directly
    })),
    {
      FieldValue: {serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP")},
    },
  ),
}));

// 5. IMPORT SUT
import {validatePurchase as originalValidatePurchase} from "../iapValidation";
import {NO_ADS_PRODUCT_ID, BACKEND_COIN_PRODUCT_DETAILS} from "../iapConfig";

// Define iapController to directly use the top-level mocks
const iapController = {
  isValidated: mockIapIsValidated,
  getPurchaseData: mockIapGetPurchaseData,
  config: mockIapConfig,
  setup: mockIapSetup,
  getProducts: mockIapGetProducts,
  getSubscriptions: mockIapGetSubscriptions,
  finishTransaction: mockIapFinishTransaction,
};

const validatePurchase = originalValidatePurchase as unknown as (
  request: CallableRequest<ValidatePurchaseData>,
) => Promise<{success: boolean; newCoins?: number; newlyUnlockedAchievementIds?: string[]}>;

const runSentrySpanCallback = (...args: unknown[]): unknown => {
  const callback = args[2] as () => unknown;
  return callback();
};

const getSpanAttributes = (name: string): Record<string, unknown> | undefined => {
  const call = mockWithSentrySpan.mock.calls.find(([spanName]) => spanName === name);
  return call?.[3] as Record<string, unknown> | undefined;
};

const expectNoRawPurchaseTokenInSpanAttributes = (): void => {
  for (const call of mockWithSentrySpan.mock.calls) {
    expect(JSON.stringify(call[3] ?? {})).not.toContain("token_");
  }
};

describe("validatePurchase - Unit Tests", () => {
  const testUserId = "testUser123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetUser.mockReset();
    mockUpdateUserCoins.mockReset();
    mockUpdateUserProfile.mockReset();
    mockIsPurchaseTokenAlreadyProcessed.mockReset();
    mockMarkPurchaseTokenAsProcessed.mockReset();
    mockPerformPlatformValidation.mockReset();
    mockEvaluateAchievements.mockReset();

    iapController.isValidated.mockReset();
    iapController.getPurchaseData.mockReset();
    iapController.config.mockReset();
    iapController.setup.mockReset();
    iapController.getProducts.mockReset();
    iapController.getSubscriptions.mockReset();
    iapController.finishTransaction.mockReset();

    // Reset refactored Firestore mocks
    mockFsUpdate.mockReset();
    mockFsGet.mockReset();
    mockFsDoc.mockReset();
    mockFsCollection.mockReset();

    // Setup return values for refactored Firestore mocks
    mockFsDoc.mockReturnValue({update: mockFsUpdate, get: mockFsGet});
    mockFsCollection.mockReturnValue({doc: mockFsDoc});

    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
    mockCaptureException.mockReset();
    mockWithSentrySpan.mockReset();
    mockWithSentrySpan.mockImplementation(runSentrySpanCallback);

    mockGetCoinsForProduct.mockReset();
    mockIncrementCoinPackPurchaseCount.mockReset();
    mockLogPurchaseAnalytic.mockReset();
    mockUpdateRegionalSpendingStats.mockReset();
    mockLogPurchaseAnalytic.mockResolvedValue(undefined);
    mockUpdateRegionalSpendingStats.mockResolvedValue(undefined);
    // Default: no Firestore pricing found, fall back to hardcoded map
    mockGetCoinsForProduct.mockResolvedValue(undefined);

    // Default mock implementations
    mockGetUser.mockResolvedValue({coins: 100, hasPurchasedApp: false});
    mockUpdateUserProfile.mockResolvedValue(undefined);
    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(false);
    mockPerformPlatformValidation.mockResolvedValue({
      isValid: true,
      productId: "mock.product.id",
      transactionId: "mockToken",
    });
    mockEvaluateAchievements.mockResolvedValue([]);

    iapController.isValidated.mockReturnValue(true);
    iapController.getPurchaseData.mockReturnValue([
      {productId: "mock.product.id", transactionId: "mockToken", originalTransactionIdIOS: "origMockTokenIOS"},
    ]);
    // setup, getProducts, getSubscriptions, finishTransaction have defaults from their declaration

    mockUpdateUserCoins.mockResolvedValue(undefined);
    mockIncrementCoinPackPurchaseCount.mockResolvedValue(undefined);
    mockFsUpdate.mockResolvedValue(undefined);
    mockFsGet.mockResolvedValue({exists: true, data: () => ({coins: 100, hasPurchasedApp: false})});
  });

  it("should throw unauthenticated error if called without authentication", async () => {
    const request = {
      auth: undefined,
      data: {purchaseToken: "token", productId: "prod", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;
    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("should handle successful NO_ADS purchase", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];

    const request = {
      auth,
      data: {purchaseToken: "token_noads", productId: NO_ADS_PRODUCT_ID, platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: true,
      productId: NO_ADS_PRODUCT_ID,
      transactionId: "token_noads_tx",
    });
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: false});
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: true});

    const result = await validatePurchase(request);

    expect(result).toEqual({
      success: true,
      newCoins: 100,
      newlyUnlockedAchievementIds: [],
    });
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "token_noads");
    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("ios", "token_noads", NO_ADS_PRODUCT_ID);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(testUserId, {hasPurchasedApp: true});
    expect(mockEvaluateAchievements).toHaveBeenCalledWith(testUserId, {
      gameMode: "classic",
      isCorrect: false,
      attempts: 0,
      gameOver: false,
    });
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockIncrementCoinPackPurchaseCount).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token_noads", NO_ADS_PRODUCT_ID);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${NO_ADS_PRODUCT_ID}`,
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(`User ${testUserId} has purchased ad removal.`);
    expect(getSpanAttributes("iap.validatePurchase.platformValidation")).toEqual({
      platform: "ios",
      productId: NO_ADS_PRODUCT_ID,
    });
    expect(getSpanAttributes("iap.validatePurchase.grantEntitlement")).toEqual({
      platform: "ios",
      productId: NO_ADS_PRODUCT_ID,
      entitlement: "no_ads",
    });
    expect(getSpanAttributes("iap.validatePurchase.markProcessed")).toEqual({
      platform: "ios",
      productId: NO_ADS_PRODUCT_ID,
    });
    expectNoRawPurchaseTokenInSpanAttributes();
  });

  it("should handle successful coin pack purchase", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];

    const coinProductDetails = BACKEND_COIN_PRODUCT_DETAILS.COIN_PACK_SMALL;
    const coinProductId = coinProductDetails.id;
    const coinsToAward = coinProductDetails.coins;

    const initialUserCoins = 100;
    const request = {
      auth,
      data: {purchaseToken: "token_coins", productId: coinProductId, platform: "android"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: true,
      productId: coinProductId,
      transactionId: "token_coins_tx",
    });
    mockGetCoinsForProduct.mockResolvedValueOnce(coinsToAward);
    mockGetUser.mockResolvedValueOnce({coins: initialUserCoins + coinsToAward, hasPurchasedApp: false});
    mockGetUser.mockResolvedValueOnce({coins: initialUserCoins + coinsToAward, hasPurchasedApp: false});

    const result = await validatePurchase(request);

    expect(result).toEqual({
      success: true,
      newCoins: initialUserCoins + coinsToAward,
      newlyUnlockedAchievementIds: [],
    });
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "token_coins");
    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("android", "token_coins", coinProductId);
    expect(mockUpdateUserCoins).toHaveBeenCalledWith(testUserId, coinsToAward);
    expect(mockIncrementCoinPackPurchaseCount).toHaveBeenCalledWith(coinProductId);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(testUserId, {hasPurchasedApp: true});
    expect(mockEvaluateAchievements).toHaveBeenCalledWith(testUserId, {
      gameMode: "classic",
      isCorrect: false,
      attempts: 0,
      gameOver: false,
    });
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token_coins", coinProductId);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${coinProductId}`,
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Awarded ${coinsToAward} coins to user ${testUserId}. New balance: ${initialUserCoins + coinsToAward}`,
    );
    expect(getSpanAttributes("iap.validatePurchase.platformValidation")).toEqual({
      platform: "android",
      productId: coinProductId,
    });
    expect(getSpanAttributes("iap.validatePurchase.grantEntitlement")).toEqual({
      platform: "android",
      productId: coinProductId,
      entitlement: "coins",
      coins: coinsToAward,
    });
    expect(getSpanAttributes("iap.validatePurchase.analytics")).toEqual({
      platform: "android",
      productId: coinProductId,
      coins: coinsToAward,
      currency: "USD",
    });
    expect(getSpanAttributes("iap.validatePurchase.evaluateAchievements")).toEqual({
      platform: "android",
      productId: coinProductId,
    });
    expect(getSpanAttributes("iap.validatePurchase.markProcessed")).toEqual({
      platform: "android",
      productId: coinProductId,
    });
    expectNoRawPurchaseTokenInSpanAttributes();
  });

  // New tests to cover missing lines
  it("should throw invalid-argument error if request.data is missing", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: undefined, // This covers line 28
    } as unknown as CallableRequest<ValidatePurchaseData>;

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw already-exists error if purchase token was already processed", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "duplicate_token", productId: "test_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(true); // This covers line 52

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("already-exists", "This purchase has already been processed."),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith("IAP purchase token already processed.", {
      userId: testUserId,
      productId: "test_product",
    });
  });

  it("should throw failed-precondition if platform validation does not return a product", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token_empty", productId: "test_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: true,
      productId: "",
      transactionId: "token_empty_tx",
    });

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );
  });

  it("should throw failed-precondition if platform validation is not valid", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token_not_array", productId: "test_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: false,
      productId: "test_product",
      transactionId: "token_not_array_tx",
    });

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );
  });

  it("should throw failed-precondition error if product ID validation fails", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token_mismatch", productId: "expected_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: true,
      productId: "different_product",
      transactionId: "token_mismatch_tx",
    });

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("Purchase validation failed or product ID mismatch"),
    );
  });

  it("should throw internal error if validated product is not found in backend configuration", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const unknownProductId = "com.unknown.product.id";
    const request = {
      auth,
      data: {purchaseToken: "token_unknown", productId: unknownProductId, platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: true,
      productId: unknownProductId,
      transactionId: "token_unknown_tx",
    });

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("internal", "Product configuration error on backend."),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("Product details not found for validated product ID"),
    );
  });

  it("should map a generic error from iap.validate to a default HttpsError", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token_error", productId: "test_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockRejectedValue(new Error("Network timeout")); // Generic error covers lines 126-142

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("internal", "An unexpected error occurred during purchase processing."),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("IAP validation process failed"),
      expect.objectContaining({
        userId: testUserId,
        productId: "test_product",
        platform: "ios",
        error: expect.any(Error),
      }),
    );
  });

  it("should throw invalid-argument error if purchaseToken is not a string", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: 12345, productId: "test_product", platform: "ios"},
    } as unknown as CallableRequest<ValidatePurchaseData>;

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw invalid-argument error if platform is not ios or android", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token", productId: "product", platform: "web"},
    } as CallableRequest<ValidatePurchaseData>;

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform."),
    );
  });

  it("should throw failed-precondition when platform validation returns invalid", async () => {
    const auth = {uid: testUserId} as CallableRequest<ValidatePurchaseData>["auth"];
    const request = {
      auth,
      data: {purchaseToken: "token_invalid", productId: "test_product", platform: "ios"},
    } as CallableRequest<ValidatePurchaseData>;

    mockPerformPlatformValidation.mockResolvedValueOnce({
      isValid: false,
      productId: "test_product",
      transactionId: "token_invalid_tx",
    });

    await expect(validatePurchase(request)).rejects.toThrow(
      new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch."),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("Purchase validation failed or product ID mismatch"),
    );
  });
});

// Mock variables for 'in-app-purchase' declared at the top for hoisting
const mockIapIsValidated = jest.fn<() => boolean>();
const mockIapGetPurchaseData = jest.fn<() => unknown[] | null>();
const mockIapConfig = jest.fn<(...args: unknown[]) => void>();
const mockIapSetup = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockIapGetProducts = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapGetSubscriptions = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
const mockIapFinishTransaction = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);

// iapValidation.test.ts
// 1. Jest Globals and Types First
import {describe, expect, it, jest, beforeEach} from "@jest/globals";
import {CallableRequest} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";

// 2. Mock ../iapConfig FIRST
jest.mock("../iapConfig", () => {
  return {
    __esModule: true,
    NO_ADS_PRODUCT_ID: "com.qwordly.noads.unitmock.v4",
    BACKEND_COIN_PRODUCT_DETAILS: {
      small: {id: "com.qwordly.coins.small.unitmock.v4", coins: 50},
    },
    initializeIapConfig: jest.fn(),
  };
});

// 3. Define other top-level mock consts
const mockGetUser = jest.fn<(...args: unknown[]) => Promise<{coins: number; hasPurchasedApp: boolean} | null>>();
const mockUpdateUserCoins = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockMarkPurchaseTokenAsProcessed = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockIsPurchaseTokenAlreadyProcessed = jest.fn<(...args: unknown[]) => Promise<boolean>>();
const mockPerformPlatformValidation = jest.fn<(...args: unknown[]) => Promise<{valid: boolean; data?: unknown}>>();

const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerWarn = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();

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
    onCall: jest.fn((handler) => handler),
    HttpsError: actualV2Https.HttpsError,
  };
});

jest.mock("../firestoreService", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  updateUserCoins: (...args: unknown[]) => mockUpdateUserCoins(...args),
}));

jest.mock("../iapReceiptService", () => ({
  isPurchaseTokenAlreadyProcessed: (...args: unknown[]) => mockIsPurchaseTokenAlreadyProcessed(...args),
  markPurchaseTokenAsProcessed: (...args: unknown[]) => mockMarkPurchaseTokenAsProcessed(...args),
}));

jest.mock("../iapPlatformValidator", () => ({
  performPlatformValidation: (...args: unknown[]) => mockPerformPlatformValidation(...args),
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
) => Promise<{success: boolean; newCoins?: number}>;

describe("validatePurchase - Unit Tests", () => {
  const testUserId = "testUser123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetUser.mockReset();
    mockUpdateUserCoins.mockReset();
    mockIsPurchaseTokenAlreadyProcessed.mockReset();
    mockMarkPurchaseTokenAsProcessed.mockReset();
    mockPerformPlatformValidation.mockReset();

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

    // Default mock implementations
    mockGetUser.mockResolvedValue({coins: 100, hasPurchasedApp: false});
    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(false);
    mockPerformPlatformValidation.mockResolvedValue({valid: true, data: "platform_validation_response"});

    iapController.isValidated.mockReturnValue(true);
    iapController.getPurchaseData.mockReturnValue([
      {productId: "mock.product.id", transactionId: "mockToken", originalTransactionIdIOS: "origMockTokenIOS"},
    ]);
    // setup, getProducts, getSubscriptions, finishTransaction have defaults from their declaration

    mockUpdateUserCoins.mockResolvedValue(undefined);
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

    iapController.getPurchaseData.mockReturnValue([
      {productId: NO_ADS_PRODUCT_ID, transactionId: "token_noads_tx", originalTransactionIdIOS: "token_noads_orig_tx"},
    ]);
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: false});
    mockGetUser.mockResolvedValueOnce({coins: 100, hasPurchasedApp: true});

    const result = await validatePurchase(request);

    expect(result).toEqual({success: true, newCoins: 100});
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "token_noads");
    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("ios", "token_noads", NO_ADS_PRODUCT_ID);
    expect(mockFsCollection).toHaveBeenCalledWith("users");
    expect(mockFsDoc).toHaveBeenCalledWith(testUserId);
    expect(mockFsUpdate).toHaveBeenCalledWith({hasPurchasedApp: true});
    expect(mockUpdateUserCoins).not.toHaveBeenCalled();
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token_noads", NO_ADS_PRODUCT_ID);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${NO_ADS_PRODUCT_ID}`,
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(`User ${testUserId} has purchased ad removal.`);
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

    iapController.getPurchaseData.mockReturnValue([{productId: coinProductId, transactionId: "token_coins_tx"}]);
    mockGetUser.mockResolvedValueOnce({coins: initialUserCoins + coinsToAward, hasPurchasedApp: false});
    mockGetUser.mockResolvedValueOnce({coins: initialUserCoins + coinsToAward, hasPurchasedApp: false});

    const result = await validatePurchase(request);

    expect(result).toEqual({success: true, newCoins: initialUserCoins + coinsToAward});
    expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, "token_coins");
    expect(mockPerformPlatformValidation).toHaveBeenCalledWith("android", "token_coins", coinProductId);
    expect(mockUpdateUserCoins).toHaveBeenCalledWith(testUserId, coinsToAward);
    expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, "token_coins", coinProductId);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Purchase validated and product ID matched for user ${testUserId}: ${coinProductId}`,
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Awarded ${coinsToAward} coins to user ${testUserId}. New balance: ${initialUserCoins + coinsToAward}`,
    );
  });
  // ... (rest of the tests, ensure NO_ADS_PRODUCT_ID and BACKEND_COIN_PRODUCT_DETAILS are correctly sourced if used)
});

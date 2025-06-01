/* eslint-disable @typescript-eslint/no-explicit-any */
import * as dotenv from "dotenv";
dotenv.config({path: ".env"});

// Jest/type imports - move to top before using jest.fn()
import {jest, beforeAll, beforeEach, afterAll, describe, it, expect} from "@jest/globals";

// Import Firebase Functions Test for proper function testing
import functionsTest from "firebase-functions-test";

// Initialize the test environment
const testEnv = functionsTest();

// 1. Global mock function instances for tests to control/assert
const mockIAPConfig_IT = jest.fn();
const mockIAPValidate_IT = jest.fn();
const mockIAPIsValidated_IT = jest.fn();
const mockIAPGetPurchaseData_IT = jest.fn();
const mockIAPSetup_IT = jest.fn<() => Promise<void>>();
const mockIAPGetProducts_IT = jest.fn<() => Promise<any[]>>();
const mockIAPGetSubscriptions_IT = jest.fn<() => Promise<any[]>>();
const mockIAPFinishTransaction_IT = jest.fn<() => Promise<void>>();

// 3. Mock all external dependencies BEFORE importing the function
jest.mock("../firestoreService", () => ({
  getUser: jest.fn(),
  updateUserCoins: jest.fn(),
  updateUserProfile: jest.fn(),
}));

jest.mock("../iapReceiptService", () => ({
  isPurchaseTokenAlreadyProcessed: jest.fn(),
  markPurchaseTokenAsProcessed: jest.fn(),
}));

// Mock Firebase Admin SDK
const mockUserDocUpdate = jest.fn<() => Promise<void>>();
const mockUserDocGet = jest.fn<() => Promise<any>>();
const mockUserDocRef = {
  update: mockUserDocUpdate,
  get: mockUserDocGet,
};
const mockFirestoreCollection = jest.fn(() => ({
  doc: jest.fn(() => mockUserDocRef),
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: mockFirestoreCollection,
  })),
}));

// Mock iapConfig to ensure initializeIapConfig is a clean no-op for these unit tests
// and to provide any other necessary exports like product IDs.
jest.mock("../iapConfig", () => {
  const actualIapConfigConstants = jest.requireActual<typeof import("../iapConfig")>("../iapConfig");
  return {
    __esModule: true,
    initializeIapConfig: jest.fn(() => {
      // console.log("[Mocked initializeIapConfig FOR REAL THIS TIME] Doing absolutely nothing.");
    }),
    // Make sure to export constants that are imported by the file under test (iapValidation.ts)
    NO_ADS_PRODUCT_ID: actualIapConfigConstants.NO_ADS_PRODUCT_ID,
    BACKEND_COIN_PRODUCT_DETAILS: actualIapConfigConstants.BACKEND_COIN_PRODUCT_DETAILS,
    // Add any other exports from iapConfig that iapValidation.ts might use directly
    getIapGoogleCredentials: jest.fn(),
    getAppleSharedSecret: jest.fn(),
  };
});

jest.doMock("in-app-purchase", () => {
  const iapInstance = {
    config: mockIAPConfig_IT.mockImplementation(() => {
      // console.log("[Mocked iap.config] Called but doing nothing");
    }),
    validate: mockIAPValidate_IT,
    isValidated: mockIAPIsValidated_IT,
    getPurchaseData: mockIAPGetPurchaseData_IT,
    setup: mockIAPSetup_IT.mockResolvedValue(undefined),
    getProducts: mockIAPGetProducts_IT.mockResolvedValue([]),
    getSubscriptions: mockIAPGetSubscriptions_IT.mockResolvedValue([]),
    finishTransaction: mockIAPFinishTransaction_IT.mockResolvedValue(undefined),
  };
  return {
    __esModule: true,
    default: iapInstance,
    APPLE: "apple",
    GOOGLE: "google",
  };
});

// 4. Import the function to test after mocks are set up
import {validatePurchase} from "../iapValidation";
import {initializeIapConfig, NO_ADS_PRODUCT_ID, BACKEND_COIN_PRODUCT_DETAILS} from "../iapConfig";

// Import the mocked functions to get proper typing
import * as firestoreService from "../firestoreService";
import * as iapReceiptService from "../iapReceiptService";

// Define the expected type for the user object returned by mockGetUser
interface MockUser {
  coins: number;
  hasPurchasedApp: boolean;
  // Add other properties of the user object if needed for these tests
}

const mockGetUser = firestoreService.getUser as jest.MockedFunction<() => Promise<MockUser | undefined>>;
const mockUpdateUserCoins = firestoreService.updateUserCoins as jest.MockedFunction<
  typeof firestoreService.updateUserCoins
>;
const mockUpdateUserProfile = firestoreService.updateUserProfile as jest.MockedFunction<
  typeof firestoreService.updateUserProfile
>;
const mockIsPurchaseTokenAlreadyProcessed = iapReceiptService.isPurchaseTokenAlreadyProcessed as jest.MockedFunction<
  typeof iapReceiptService.isPurchaseTokenAlreadyProcessed
>;
const mockMarkPurchaseTokenAsProcessed = iapReceiptService.markPurchaseTokenAsProcessed as jest.MockedFunction<
  typeof iapReceiptService.markPurchaseTokenAsProcessed
>;

// Silence Firebase Functions logger for this suite to reduce overhead and noise
jest.mock("firebase-functions", () => {
  const originalFunctions = jest.requireActual<typeof import("firebase-functions")>("firebase-functions");
  return {
    ...originalFunctions,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      write: jest.fn(),
    },
  };
});

// Wrap the function for testing
const wrappedValidatePurchase = testEnv.wrap(validatePurchase);

describe("validatePurchase - Unit Tests", () => {
  const testUserId = "testUserIntegration123";
  const testUserEmail = "testuser.integration@example.com";

  // Increase timeout for this test suite. Even with initializeIapConfig extensively mocked,
  // the overhead of firebase-functions-test and module loading for this specific suite
  // can exceed the default 5s timeout for the entire suite's describe block to complete.
  // Individual tests within are fast due to mocks.

  beforeAll(async () => {
    // This will now call the mocked version of initializeIapConfig
    // which is a no-op, ensuring fast setup for unit tests.
    initializeIapConfig();
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set default mock returns
    mockIAPIsValidated_IT.mockReturnValue(true);
    mockIAPGetPurchaseData_IT.mockReturnValue([]);

    // Mock iap.validate to return success responses
    mockIAPValidate_IT.mockImplementation((platform: any, tokenOrData: any, callback: any) => {
      if (typeof tokenOrData === "string") {
        // iOS
        callback(null, {
          status: 0,
          receipt: {},
          transactionId: "test-transaction",
          productId: "test-product",
          platform: "apple",
          environment: "sandbox",
        });
      } else {
        // Android
        callback(null, {
          receipt: {
            kind: "androidpublisher#productPurchase",
            purchaseTimeMillis: Date.now().toString(),
            purchaseState: 0,
            consumptionState: 0,
            developerPayload: "",
          },
          transactionId: "test-transaction",
          productId: tokenOrData.productId || "test-product",
          platform: "google",
        });
      }
    });

    mockGetUser.mockResolvedValue({coins: 100, hasPurchasedApp: false});
    mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(false);
    mockUpdateUserCoins.mockResolvedValue(undefined);
    mockUpdateUserProfile.mockResolvedValue(undefined);
    mockMarkPurchaseTokenAsProcessed.mockResolvedValue(undefined);

    // Set up Firebase admin mocks
    mockUserDocUpdate.mockResolvedValue(undefined);
    mockUserDocGet.mockResolvedValue({
      data: () => ({coins: 100, hasPurchasedApp: true}),
    });
  });

  afterAll(async () => {
    // Cleanup the test environment
    testEnv.cleanup();
  });

  interface MockAuthToken {
    email: string;
    name: string;
    user_id: string;
    email_verified: boolean;
    firebase: {
      sign_in_provider: string;
      identities: Record<string, unknown>;
      sign_in_second_factor?: string;
      second_factor_identifier?: string;
      tenant?: string;
    };
    aud: string;
    auth_time: number;
    exp: number;
    iat: number;
    iss: string;
    sub: string;
    uid: string;
  }

  interface MockAuthContext {
    uid: string;
    token: MockAuthToken;
  }

  // constructMockRequest now prepares arguments for testEnv.wrap
  const constructMockRequestArgs = (
    data: Record<string, unknown> | null | undefined,
    authContextArg?: MockAuthContext | null,
  ): {
    data: Record<string, unknown> | null | undefined;
    auth: MockAuthContext | undefined;
    rawRequest: any;
    acceptsStreaming: boolean;
  } => {
    const auth =
      authContextArg === undefined
        ? {
            uid: testUserId,
            token: {
              email: testUserEmail,
              name: "Integration User",
              user_id: testUserId,
              email_verified: true,
              firebase: {sign_in_provider: "custom", identities: {}},
              aud: "mock-aud",
              auth_time: Math.floor(Date.now() / 1000) - 60,
              exp: Math.floor(Date.now() / 1000) + 3600,
              iat: Math.floor(Date.now() / 1000) - 60,
              iss: "https://securetoken.google.com/mock-project-id",
              sub: testUserId,
              uid: testUserId,
            } as MockAuthToken,
          }
        : authContextArg;

    // testEnv.wrap for callable functions expects data as the first arg and context as the second
    return {
      data: data,
      auth: auth as MockAuthContext | undefined,
      rawRequest: {
        method: "POST",
        url: "/mock-callable",
        headers: {},
        body: data,
        rawBody: JSON.stringify(data),
        get: () => undefined,
        header: () => undefined,
      } as any,
      acceptsStreaming: false,
    };
  };

  describe("Input Validation", () => {
    it("should throw unauthenticated if called without authentication", async () => {
      const request = constructMockRequestArgs(null, null);
      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "The function must be called while authenticated.",
      );
    });

    it("should throw invalid-argument for missing purchaseToken", async () => {
      const data = {productId: "testProd", platform: "ios"};
      const request = constructMockRequestArgs(data);
      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Invalid purchase token, product ID, or platform.",
      );
    });

    it("should throw invalid-argument for missing productId", async () => {
      const data = {purchaseToken: "testToken", platform: "ios"};
      const request = constructMockRequestArgs(data);
      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Invalid purchase token, product ID, or platform.",
      );
    });

    it("should throw invalid-argument for missing platform", async () => {
      const data = {purchaseToken: "testToken", productId: "testProd"};
      const request = constructMockRequestArgs(data);
      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Invalid purchase token, product ID, or platform.",
      );
    });

    it("should throw invalid-argument for invalid platform value", async () => {
      const data = {purchaseToken: "testToken", productId: "testProd", platform: "windows"};
      const request = constructMockRequestArgs(data);
      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Invalid purchase token, product ID, or platform.",
      );
    });
  });

  describe("Purchase Token Validation", () => {
    it("should throw already-exists if purchase token was already processed", async () => {
      const purchaseToken = "processedToken123";
      const productId = "anyProduct";
      const platform = "ios";

      mockIsPurchaseTokenAlreadyProcessed.mockResolvedValue(true);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow("This purchase has already been processed.");
      expect(mockIsPurchaseTokenAlreadyProcessed).toHaveBeenCalledWith(testUserId, purchaseToken);
    });
  });

  describe("Platform Validation Tests", () => {
    it("should call performPlatformValidation with correct parameters", async () => {
      const purchaseToken = "testToken";
      const productId = NO_ADS_PRODUCT_ID;
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue([{productId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      const result = await wrappedValidatePurchase(request);

      expect(mockIAPValidate_IT).toHaveBeenCalled();
      expect(result.success).toBe(true);
    }, 60000);

    it("should handle performPlatformValidation failure", async () => {
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";
      const platformError = new Error("Platform validation failed");

      mockIAPValidate_IT.mockImplementation((platform: any, token: any, callback: any) => {
        callback(platformError, null);
      });

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "An error occurred during app store validation.",
      );
      expect(mockIAPValidate_IT).toHaveBeenCalled();
    }, 60000);

    it("should handle iap.isValidated returning false", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(false);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Purchase validation failed or product ID mismatch.",
      );
      expect(mockIAPValidate_IT).toHaveBeenCalled();
      expect(mockIAPIsValidated_IT).toHaveBeenCalled();
    }, 60000);

    it("should handle null purchase data", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue(null);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Could not extract purchase data from validation response.",
      );
      expect(mockIAPGetPurchaseData_IT).toHaveBeenCalled();
    }, 60000);

    it("should handle non-array purchase data", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "token";
      const productId = "prod";
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue({} as any);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Could not extract purchase data from validation response.",
      );
      expect(mockIAPGetPurchaseData_IT).toHaveBeenCalled();
    }, 60000);

    it("should handle product ID mismatch", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "token";
      const requestedProductId = "requested.prod.id";
      const receiptProductId = "different.prod.id";
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue([{productId: receiptProductId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId: requestedProductId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow(
        "Purchase validation failed or product ID mismatch.",
      );
      expect(mockIAPGetPurchaseData_IT).toHaveBeenCalled();
    }, 60000);

    it("should handle unknown product configuration", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "token";
      const unknownProductId = "com.qwordly.coins.unknown";
      const platform = "android";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue([
        {productId: unknownProductId, quantity: 1, transactionId: purchaseToken},
      ]);

      const data = {purchaseToken, productId: unknownProductId, platform};
      const request = constructMockRequestArgs(data);

      await expect(() => wrappedValidatePurchase(request)).rejects.toThrow("Product configuration error on backend.");
      expect(mockIAPGetPurchaseData_IT).toHaveBeenCalled();
    }, 60000);
  });

  describe("Successful Purchase Processing", () => {
    it("should process NO_ADS purchase successfully", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "noAdsToken";
      const productId = NO_ADS_PRODUCT_ID;
      const platform = "ios";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue([{productId: productId, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      const result = await wrappedValidatePurchase(request);

      expect(result.success).toBe(true);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(testUserId, {hasPurchasedApp: true});
      expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, purchaseToken, productId);
    }, 60000);

    it("should process coin pack purchase successfully", async () => {
      jest.setTimeout(60000);
      const purchaseToken = "coinPackToken";
      const productInfo = Object.values(BACKEND_COIN_PRODUCT_DETAILS)[0];
      const productId = productInfo.id;
      const platform = "android";

      mockIAPIsValidated_IT.mockReturnValue(true);
      mockIAPGetPurchaseData_IT.mockReturnValue([{productId, quantity: 1, transactionId: purchaseToken}]);

      const data = {purchaseToken, productId, platform};
      const request = constructMockRequestArgs(data);

      const result = await wrappedValidatePurchase(request);

      expect(result.success).toBe(true);
      expect(mockUpdateUserCoins).toHaveBeenCalledWith(testUserId, productInfo.coins);
      expect(mockMarkPurchaseTokenAsProcessed).toHaveBeenCalledWith(testUserId, purchaseToken, productId);
    }, 60000);
  });
});

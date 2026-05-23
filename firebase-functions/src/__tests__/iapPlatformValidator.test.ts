/* eslint-disable @typescript-eslint/no-explicit-any */
import {jest, beforeEach, describe, it, expect} from "@jest/globals";

const mockFirebaseFunctionsLoggerError = jest.fn();
const mockFirebaseFunctionsLoggerWarn = jest.fn();
const mockFirebaseFunctionsLoggerInfo = jest.fn();

const mockInitializeIapConfig = jest.fn();
const mockGetAppleSharedSecret = jest.fn<() => string | undefined>();
const mockGetIapGoogleCredentials = jest.fn<() => {clientEmail: string; privateKey: string} | undefined>();

const mockProductsGet = jest.fn<(...args: unknown[]) => Promise<{data: unknown}>>();
const mockAndroidPublisher = jest.fn(() => ({
  purchases: {
    products: {
      get: mockProductsGet,
    },
  },
}));
const mockJwt = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {
    error: mockFirebaseFunctionsLoggerError,
    warn: mockFirebaseFunctionsLoggerWarn,
    info: mockFirebaseFunctionsLoggerInfo,
  },
  https: {
    HttpsError: jest.fn().mockImplementation((code, message, details) => {
      const error = new Error(String(message)) as any;
      error.code = code;
      error.details = details;
      error.name = "HttpsError";
      return error;
    }),
  },
}));

jest.mock("../iapConfig", () => ({
  initializeIapConfig: mockInitializeIapConfig,
  getAppleSharedSecret: mockGetAppleSharedSecret,
  getIapGoogleCredentials: mockGetIapGoogleCredentials,
}));

jest.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: mockJwt,
    },
    androidpublisher: mockAndroidPublisher,
  },
}));

import {performPlatformValidation} from "../iapPlatformValidator";

describe("performPlatformValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppleSharedSecret.mockReturnValue("apple-secret");
    mockGetIapGoogleCredentials.mockReturnValue({
      clientEmail: "iap@example.com",
      privateKey: "private-key",
    });
    global.fetch = jest.fn() as any;
  });

  it("throws HttpsError for unsupported platform", async () => {
    await expect(performPlatformValidation("windows", "token", "product")).rejects.toMatchObject({
      name: "HttpsError",
      code: "invalid-argument",
      message: "Unsupported platform for purchase validation.",
    });
  });

  it("validates an iOS purchase with Apple verifyReceipt", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        environment: "Production",
        latest_receipt_info: [
          {
            product_id: "ios.product",
            transaction_id: "apple-tx",
            original_transaction_id: "apple-original",
          },
        ],
      }),
    });

    const result = await performPlatformValidation("ios", "receipt-data", "ios.product");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://buy.itunes.apple.com/verifyReceipt",
      expect.objectContaining({
        method: "POST",
        headers: {"Content-Type": "application/json"},
      }),
    );
    expect(result).toMatchObject({
      isValid: true,
      productId: "ios.product",
      transactionId: "apple-tx",
      platform: "apple",
      status: 0,
    });
  });

  it("retries iOS sandbox receipts when production returns 21007", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({status: 21007}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 0,
          receipt: {
            in_app: [{product_id: "ios.product", transaction_id: "sandbox-tx"}],
          },
        }),
      });

    const result = await performPlatformValidation("ios", "receipt-data", "ios.product");

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://sandbox.itunes.apple.com/verifyReceipt",
      expect.any(Object),
    );
    expect(result.transactionId).toBe("sandbox-tx");
  });

  it("throws failed-precondition when an iOS receipt does not contain the product", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        latest_receipt_info: [{product_id: "other.product", transaction_id: "apple-tx"}],
      }),
    });

    await expect(performPlatformValidation("ios", "receipt-data", "ios.product")).rejects.toMatchObject({
      name: "HttpsError",
      code: "failed-precondition",
    });
  });

  it("validates an Android purchase with Google Play Developer API", async () => {
    mockProductsGet.mockResolvedValueOnce({
      data: {
        kind: "androidpublisher#productPurchase",
        purchaseTimeMillis: "1",
        purchaseState: 0,
        consumptionState: 0,
        developerPayload: "",
        orderId: "google-order",
      },
    });

    const result = await performPlatformValidation("android", "purchase-token", "android.product");

    expect(mockJwt).toHaveBeenCalledWith({
      email: "iap@example.com",
      key: "private-key",
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    expect(mockProductsGet).toHaveBeenCalledWith({
      packageName: "com.roobsworld.riddlequest",
      productId: "android.product",
      token: "purchase-token",
    });
    expect(result).toMatchObject({
      isValid: true,
      productId: "android.product",
      transactionId: "google-order",
      platform: "google",
      status: 0,
    });
  });

  it("throws failed-precondition when Google credentials are missing", async () => {
    mockGetIapGoogleCredentials.mockReturnValueOnce(undefined);

    await expect(performPlatformValidation("android", "purchase-token", "android.product")).rejects.toMatchObject({
      name: "HttpsError",
      code: "failed-precondition",
    });
  });

  it("throws failed-precondition when Google purchase state is not purchased", async () => {
    mockProductsGet.mockResolvedValueOnce({
      data: {
        kind: "androidpublisher#productPurchase",
        purchaseTimeMillis: "1",
        purchaseState: 1,
        consumptionState: 0,
        developerPayload: "",
      },
    });

    await expect(performPlatformValidation("android", "purchase-token", "android.product")).rejects.toMatchObject({
      name: "HttpsError",
      code: "failed-precondition",
    });
  });
});

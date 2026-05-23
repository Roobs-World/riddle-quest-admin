import * as functions from "firebase-functions";
import { captureException } from "./sentry";
import {google} from "googleapis";
import {getAppleSharedSecret, getIapGoogleCredentials, initializeIapConfig} from "./iapConfig";

interface AppleReceiptInfo {
  quantity: string;
  product_id: string;
  transaction_id: string;
  original_transaction_id: string;
  purchase_date: string;
  purchase_date_ms: string;
  purchase_date_pst: string;
  original_purchase_date: string;
  original_purchase_date_ms: string;
  original_purchase_date_pst: string;
  expires_date?: string;
  expires_date_ms?: string;
  expires_date_pst?: string;
  web_order_line_item_id?: string;
  is_trial_period?: string;
  cancellation_date?: string;
  cancellation_date_ms?: string;
  cancellation_date_pst?: string;
}

interface GooglePurchaseReceipt {
  kind: string;
  purchaseTimeMillis: string;
  purchaseState: number;
  consumptionState: number;
  developerPayload: string;
  // Add other potential fields if needed based on Google Play Developer API
  orderId?: string;
}

export interface IapValidationResponse {
  isValid: boolean;
  transactionId: string;
  productId: string;
  platform: "apple" | "google";
  status?: number;
  rawResponse?: unknown;
}

interface IapValidationError extends Error {
  code?: string;
  // Add other potential fields if needed
}

function fingerprint(value: string): string {
  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Performs platform-specific IAP validation through Apple and Google APIs.
 *
 * @param {string} platform - Platform ('ios' or 'android').
 * @param {string} purchaseToken - The purchase token/receipt data.
 * @param {string} productId - Product ID (especially for Android validation).
 * @return {Promise<ValidationResponse>} Promise resolving with the validation response from the
 *   library.
 * @throws {functions.https.HttpsError} If validation fails or platform is
 *   unsupported.
 */
export async function performPlatformValidation(
  platform: string,
  purchaseToken: string,
  productId: string,
): Promise<IapValidationResponse> {
  // Handle unsupported platform first, outside the main try-catch for iap.validate
  if (platform !== "ios" && platform !== "android") {
    functions.logger.error("Unsupported platform for IAP validation:", platform);
    throw new functions.https.HttpsError("invalid-argument", "Unsupported platform for purchase validation.");
  }

  try {
    initializeIapConfig();

    if (platform === "ios") {
      const response = await verifyAppleReceipt(purchaseToken);
      if (response.status !== 0) {
        const error = new Error(`Apple validation failed with status ${response.status}`);
        (error as IapValidationError).code = `APPLE_VALIDATION_ERROR_${response.status}`;
        throw error;
      }

      const purchase = findApplePurchase(response, productId);
      if (!purchase) {
        throw new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch.");
      }

      return {
        isValid: true,
        productId,
        transactionId: purchase.transaction_id ?? purchase.original_transaction_id ?? purchaseToken,
        platform: "apple",
        status: response.status,
        rawResponse: response,
      };
    } else if (platform === "android") {
      const response = await verifyGooglePurchase(purchaseToken, productId);
      if (response.purchaseState !== 0) {
        throw new functions.https.HttpsError("failed-precondition", "Purchase validation failed or product ID mismatch.");
      }

      return {
        isValid: true,
        productId,
        transactionId: response.orderId ?? purchaseToken,
        platform: "google",
        status: 0,
        rawResponse: response,
      };
    }
    // Should not be reached due to the initial platform check
    // but as a fallback, or if logic changes, ensuring an error is thrown.
    throw new Error("Internal logic error: Platform should have been handled.");
  } catch (validationError: unknown) {
    functions.logger.error(
      `Platform IAP validation failed for ${platform}. ` +
        `Product=${productId}, TokenFingerprint=${fingerprint(purchaseToken)}.`,
      validationError,
    );
    captureException(validationError);

    if (
      validationError &&
      typeof validationError === "object" &&
      "code" in validationError &&
      "message" in validationError &&
      (validationError as {name?: string}).name === "HttpsError"
    ) {
      throw validationError;
    }

    // Determine HttpsError code based on the validationError from iap.validate
    let errorCode: functions.https.FunctionsErrorCode = "internal";
    let friendlyMessage = "An error occurred during app store validation.";

    // Check for specific error codes from the iap library
    if (validationError && typeof validationError === "object") {
      const error = validationError as IapValidationError;
      if (error.code === "INVALID_RECEIPT") {
        errorCode = "invalid-argument";
        friendlyMessage = "Invalid or expired purchase receipt.";
      } else if (error.code === "CONNECTION_ERROR") {
        errorCode = "unavailable";
        friendlyMessage = "Could not connect to app store validation server.";
      } else if (error.code && String(error.code).startsWith("APPLE_VALIDATION_ERROR_")) {
        // Handle specific Apple status errors caught and re-thrown
        errorCode = "invalid-argument"; // Assuming non-zero status implies invalid argument
        friendlyMessage = `App store validation failed with status code: ${error.code.split("_").pop()}.`;
      }
      // Add more specific error code checks for Google Play if needed
    }
    // Default to internal if no specific code matches

    throw new functions.https.HttpsError(errorCode, friendlyMessage, validationError);
  }
}

type AppleVerifyReceiptResponse = {
  status: number;
  latest_receipt_info?: AppleReceiptInfo[];
  receipt?: {
    in_app?: AppleReceiptInfo[];
  };
};

async function verifyAppleReceipt(receiptData: string): Promise<AppleVerifyReceiptResponse> {
  const password = getAppleSharedSecret();
  const payload = {
    "receipt-data": receiptData,
    ...(password ? {password} : {}),
    "exclude-old-transactions": true,
  };
  const production = await postAppleReceipt("https://buy.itunes.apple.com/verifyReceipt", payload);
  if (production.status === 21007) {
    return postAppleReceipt("https://sandbox.itunes.apple.com/verifyReceipt", payload);
  }
  return production;
}

async function postAppleReceipt(url: string, payload: Record<string, unknown>): Promise<AppleVerifyReceiptResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = new Error(`Apple receipt endpoint returned ${response.status}`);
    (error as IapValidationError).code = "CONNECTION_ERROR";
    throw error;
  }
  return response.json() as Promise<AppleVerifyReceiptResponse>;
}

function findApplePurchase(response: AppleVerifyReceiptResponse, productId: string): AppleReceiptInfo | undefined {
  return [...(response.latest_receipt_info ?? []), ...(response.receipt?.in_app ?? [])].find(
    (item) => item.product_id === productId,
  );
}

async function verifyGooglePurchase(purchaseToken: string, productId: string): Promise<GooglePurchaseReceipt> {
  const credentials = getIapGoogleCredentials();
  if (!credentials) {
    throw new functions.https.HttpsError("failed-precondition", "Google Play service account is not configured.");
  }

  const auth = new google.auth.JWT({
    email: credentials.clientEmail,
    key: credentials.privateKey,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const androidpublisher = google.androidpublisher({version: "v3", auth});
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.roobsworld.riddlequest";
  const result = await androidpublisher.purchases.products.get({
    packageName,
    productId,
    token: purchaseToken,
  });

  return result.data as GooglePurchaseReceipt;
}

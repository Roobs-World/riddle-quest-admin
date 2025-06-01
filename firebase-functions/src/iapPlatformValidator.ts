import * as functions from "firebase-functions";
import iap from "in-app-purchase";

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

interface AppleValidationResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  receipt: {[key: string]: any}; // Simplified as the structure can be complex
  latest_receipt_info?: AppleReceiptInfo[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pending_renewal_info?: {[key: string]: any}[]; // Simplified
  transactionId: string;
  productId: string;
  platform: "apple";
  environment: string;
  status: number; // Add status field from documentation
}

interface GooglePurchaseReceipt {
  kind: string;
  purchaseTimeMillis: string;
  purchaseState: number;
  consumptionState: number;
  developerPayload: string;
  // Add other potential fields if needed based on Google Play Developer API
}

interface GoogleValidationResponse {
  receipt: GooglePurchaseReceipt;
  transactionId: string;
  productId: string;
  platform: "google";
  // Add other potential fields if needed
  status?: number; // Add status field as seen in some examples
}

type ValidationResponse = AppleValidationResponse | GoogleValidationResponse;

interface IapValidationError extends Error {
  code?: string;
  // Add other potential fields if needed
}

/**
 * Performs platform-specific IAP validation using the 'in-app-purchase' library.
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
): Promise<ValidationResponse> {
  // Handle unsupported platform first, outside the main try-catch for iap.validate
  if (platform !== "ios" && platform !== "android") {
    functions.logger.error("Unsupported platform for IAP validation:", platform);
    throw new functions.https.HttpsError("invalid-argument", "Unsupported platform for purchase validation.");
  }

  try {
    if (platform === "ios") {
      const response: AppleValidationResponse = await new Promise((resolve, reject) => {
        iap.validate(iap.APPLE, purchaseToken, (err: Error | null, res: unknown) => {
          if (err) reject(err);
          else resolve(res as AppleValidationResponse);
        });
      });
      // Perform basic validation check for Apple
      if (response.status !== 0) {
        const error = new Error(`Apple validation failed with status ${response.status}`);
        (error as IapValidationError).code = `APPLE_VALIDATION_ERROR_${response.status}`;
        throw error;
      }
      return response;
    } else if (platform === "android") {
      // This condition is now guaranteed because of the check above, but kept for clarity
      const response: GoogleValidationResponse = await new Promise((resolve, reject) => {
        iap.validate(
          iap.GOOGLE,
          {
            receipt: purchaseToken, // This is the purchaseToken for Google
            productId: productId,
          },
          (err: Error | null, res: unknown) => {
            if (err) reject(err);
            else resolve(res as GoogleValidationResponse);
          },
        );
      });
      // Perform basic validation check for Google (status might not always be present or 0 for success in the same way as Apple)
      // Relying on the promise rejection for errors from the library itself for now.
      // Additional checks based on GooglePurchaseReceipt structure can be added here if needed.
      return response;
    }
    // Should not be reached due to the initial platform check
    // but as a fallback, or if logic changes, ensuring an error is thrown.
    throw new Error("Internal logic error: Platform should have been handled.");
  } catch (validationError: unknown) {
    functions.logger.error(
      `Platform IAP validation failed for ${platform}, ` + `token ${purchaseToken}, ` + `product ${productId}:`,
      validationError,
    );

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

import * as functions from "firebase-functions";
import iap from "in-app-purchase";

/**
 * Performs platform-specific IAP validation using the 'in-app-purchase' library.
 *
 * @param {string} platform - Platform ('ios' or 'android').
 * @param {string} purchaseToken - The purchase token/receipt data.
 * @param {string} productId - Product ID (especially for Android validation).
 * @return {Promise<any>} Promise resolving with the validation response from the
 *   library.
 * @throws {functions.https.HttpsError} If validation fails or platform is
 *   unsupported.
 */
export async function performPlatformValidation(
  platform: string,
  purchaseToken: string,
  productId: string,
): Promise<any> {
  // Handle unsupported platform first, outside the main try-catch for iap.validate
  if (platform !== "ios" && platform !== "android") {
    functions.logger.error("Unsupported platform for IAP validation:", platform);
    throw new functions.https.HttpsError("invalid-argument", "Unsupported platform for purchase validation.");
  }

  try {
    if (platform === "ios") {
      return await new Promise((resolve, reject) => {
        iap.validate(iap.APPLE, purchaseToken, (err: any, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    } else if (platform === "android") {
      // This condition is now guaranteed because of the check above, but kept for clarity
      return await new Promise((resolve, reject) => {
        iap.validate(
          iap.GOOGLE,
          {
            receipt: purchaseToken, // This is the purchaseToken for Google
            productId: productId,
          },
          (err: any, res: any) => {
            if (err) reject(err);
            else resolve(res);
          },
        );
      });
    }
    // Should not be reached due to the initial platform check
    // but as a fallback, or if logic changes, ensuring an error is thrown.
    throw new Error("Internal logic error: Platform should have been handled.");
  } catch (validationError: any) {
    functions.logger.error(
      `Platform IAP validation failed for ${platform}, ` + `token ${purchaseToken}, ` + `product ${productId}:`,
      validationError,
    );

    // Determine HttpsError code based on the validationError from iap.validate
    let errorCode: functions.https.FunctionsErrorCode = "internal";
    let friendlyMessage = "An error occurred during app store validation.";

    if (validationError && validationError.code === "INVALID_RECEIPT") {
      errorCode = "invalid-argument";
      friendlyMessage = "Invalid or expired purchase receipt.";
    } else if (validationError && validationError.code === "CONNECTION_ERROR") {
      errorCode = "unavailable";
      friendlyMessage = "Could not connect to app store validation server.";
    }
    // Default to internal if no specific code matches

    throw new functions.https.HttpsError(errorCode, friendlyMessage, validationError);
  }
}

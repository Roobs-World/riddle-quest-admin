import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import iap from "in-app-purchase"; // Keep for iap.isValidated and iap.getPurchaseData

import {getUser, updateUserCoins, updateUserProfile} from "./firestoreService";
// Import configurations, receipt service functions, and platform validator
import {NO_ADS_PRODUCT_ID, BACKEND_COIN_PRODUCT_DETAILS} from "./iapConfig";
import {isPurchaseTokenAlreadyProcessed, markPurchaseTokenAsProcessed} from "./iapReceiptService";
import {performPlatformValidation} from "./iapPlatformValidator";

/**
 * IAP Validation Module
 *
 * Environment variables required for IAP validation (configured in iapConfig.ts):
 * - APPLE_SHARED_SECRET: Required for iOS App Store receipt validation
 * - GOOGLE_SERVICE_ACCOUNT: JSON string containing Google Play service account credentials
 *
 * These should be set via Firebase Functions environment configuration:
 *   firebase functions:secrets:set APPLE_SHARED_SECRET
 *   firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
 *
 * Or via .env files for local development (ensure they are gitignored).
 */

/**
 * Callable function to validate an in-app purchase and award items.
 * @param data - The request data.
 * @param data.purchaseToken - The purchase token.
 * @param data.productId - The product ID.
 * @param data.platform - The platform of the purchase ('ios' or 'android').
 * @param context - The CallableContext object.
 * @return A Promise resolving to an object indicating success and potentially the new coin balance.
 */
export const validatePurchase = onCall(
  async (
    request: functions.https.CallableRequest<{
      purchaseToken: string;
      productId: string;
      platform: string;
    }>,
  ): Promise<{success: boolean; newCoins: number | undefined}> => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    if (!request.data) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform.");
    }

    const {purchaseToken, productId, platform} = request.data;
    const userId = request.auth.uid;

    if (
      typeof purchaseToken !== "string" ||
      typeof productId !== "string" ||
      typeof platform !== "string" ||
      (platform !== "ios" && platform !== "android")
    ) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform.");
    }

    functions.logger.info(
      `Attempting to validate purchase for user ${userId} on ${platform}: ` +
        `Token=${purchaseToken}, Product=${productId}`,
    );

    try {
      const alreadyProcessed = await isPurchaseTokenAlreadyProcessed(userId, purchaseToken);
      if (alreadyProcessed) {
        functions.logger.warn(`IAP purchase token ${purchaseToken} already processed for user ${userId}.`);
        throw new functions.https.HttpsError("already-exists", "This purchase has already been processed.");
      }

      const validationResponse = await performPlatformValidation(platform, purchaseToken, productId);

      let isPurchaseValid = false;
      let validatedProductIdFromReceipt: string | undefined;

      if (iap.isValidated(validationResponse)) {
        const purchaseDataList = iap.getPurchaseData(validationResponse);

        if (!Array.isArray(purchaseDataList) || purchaseDataList.length === 0) {
          functions.logger.error(
            `iap.getPurchaseData did not return valid array for user ${userId}, ` +
              `token ${purchaseToken}. Response: ` +
              `${JSON.stringify(validationResponse)}`,
          );
          throw new functions.https.HttpsError("internal", "Could not extract purchase data from validation response.");
        }

        const purchaseDetails = purchaseDataList.find((item) => (item as {productId: string}).productId === productId);

        if (purchaseDetails) {
          isPurchaseValid = true;
          validatedProductIdFromReceipt = purchaseDetails.productId;
        }
      }

      if (isPurchaseValid && validatedProductIdFromReceipt === productId) {
        functions.logger.info(`Purchase validated and product ID matched for user ${userId}: ${productId}`);

        let awardedCoins: number | undefined;

        if (validatedProductIdFromReceipt === NO_ADS_PRODUCT_ID) {
          await updateUserProfile(userId, {hasPurchasedApp: true});
          functions.logger.info(`User ${userId} has purchased ad removal.`);
          const updatedUser = await getUser(userId);
          awardedCoins = updatedUser?.coins;
        } else {
          const productInfo = Object.values(BACKEND_COIN_PRODUCT_DETAILS).find(
            (p) => p.id === validatedProductIdFromReceipt,
          );

          if (!productInfo) {
            functions.logger.error(
              "Product details not found on backend for validated product ID " +
                `${validatedProductIdFromReceipt} for user ${userId}.`,
            );
            throw new functions.https.HttpsError("internal", "Product configuration error on backend.");
          }
          awardedCoins = productInfo.coins;
          await updateUserCoins(userId, awardedCoins);

          const updatedUserForLog = await getUser(userId);
          functions.logger.info(
            `Awarded ${awardedCoins} coins to user ${userId}. ` + `New balance: ${updatedUserForLog?.coins}`,
          );
        }

        await markPurchaseTokenAsProcessed(userId, purchaseToken, validatedProductIdFromReceipt);

        const finalUser = await getUser(userId);
        const finalNewCoins = finalUser ? finalUser.coins : undefined;

        return {success: true, newCoins: finalNewCoins};
      } else {
        functions.logger.error(
          `Purchase validation failed or product ID mismatch for user ${userId}. ` +
            `Expected ${productId}, got ${validatedProductIdFromReceipt}. ` +
            `Validated: ${iap.isValidated(validationResponse)}. ` +
            `Response: ${JSON.stringify(validationResponse)}`,
        );
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Purchase validation failed or product ID mismatch.",
        );
      }
    } catch (error: unknown) {
      functions.logger.error(`IAP validation process failed for user ${userId}, product ${productId}:`, error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An unexpected error occurred during purchase processing.");
    }
  },
);

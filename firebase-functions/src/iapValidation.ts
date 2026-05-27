import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";

import {getUser, updateUserCoins, updateUserProfile} from "./firestoreService";
import {evaluateAchievements} from "./achievements";
// Import configurations, receipt service functions, and platform validator
import {NO_ADS_PRODUCT_ID, BACKEND_COIN_PRODUCT_DETAILS} from "./iapConfig";
import {isPurchaseTokenAlreadyProcessed, markPurchaseTokenAsProcessed} from "./iapReceiptService";
import {performPlatformValidation} from "./iapPlatformValidator";
import {
  getCoinsForProduct,
  incrementCoinPackPurchaseCount,
  logPurchaseAnalytic,
  updateRegionalSpendingStats,
} from "./productPricingService";
import {captureException, withSentrySpan} from "./sentry";
import {
  GrantDevCoinsForPurchaseRequestSchema,
  GrantDevCoinsForPurchaseResponseSchema,
  ValidatePurchaseRequest,
  ValidatePurchaseRequestSchema,
  ValidatePurchaseResponseSchema,
} from "./validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";

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
  {enforceAppCheck: true},
  async (
    request: functions.https.CallableRequest<ValidatePurchaseRequest>,
  ): Promise<{
    success: boolean;
    newCoins?: number;
    newlyUnlockedAchievementIds?: string[];
  }> => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    let purchaseRequest: ValidatePurchaseRequest;
    try {
      purchaseRequest = validateCallableRequest(
        ValidatePurchaseRequestSchema,
        request.data,
        "validatePurchase",
        "Invalid purchase token, product ID, or platform.",
      );
    } catch (error) {
      if ((error as {code?: string}).code === "invalid-argument") {
        throw new functions.https.HttpsError("invalid-argument", "Invalid purchase token, product ID, or platform.");
      }
      throw error;
    }
    const {purchaseToken, productId, platform} = purchaseRequest;
    const userId = request.auth.uid;

    functions.logger.info("Attempting to validate purchase.", {
      userId,
      platform,
      productId,
    });

    try {
      const alreadyProcessed = await withSentrySpan(
        "iap.validatePurchase.checkProcessed",
        "iap.receipt.check_processed",
        () => isPurchaseTokenAlreadyProcessed(userId, purchaseToken),
        {platform, productId},
      );
      if (alreadyProcessed) {
        functions.logger.warn("IAP purchase token already processed.", {userId, productId});
        throw new functions.https.HttpsError("already-exists", "This purchase has already been processed.");
      }

      const validationResponse = await withSentrySpan(
        "iap.validatePurchase.platformValidation",
        "iap.platform_validation",
        () => performPlatformValidation(platform, purchaseToken, productId),
        {platform, productId},
      );

      const isPurchaseValid = validationResponse.isValid === true;
      const validatedProductIdFromReceipt = validationResponse.productId;

      if (isPurchaseValid && validatedProductIdFromReceipt === productId) {
        functions.logger.info(`Purchase validated and product ID matched for user ${userId}: ${productId}`);

        let awardedCoins: number | undefined;
        let newlyUnlockedAchievementIds: string[] = [];

        if (validatedProductIdFromReceipt === NO_ADS_PRODUCT_ID) {
          await withSentrySpan(
            "iap.validatePurchase.grantEntitlement",
            "iap.entitlement.grant",
            async () => {
              await updateUserProfile(userId, {hasPurchasedApp: true});
            },
            {platform, productId: validatedProductIdFromReceipt, entitlement: "no_ads"},
          );
          functions.logger.info(`User ${userId} has purchased ad removal.`);
          const updatedUser = await getUser(userId);
          awardedCoins = updatedUser?.coins;
        } else {
          // Look up coin amount from Firestore productPricing first, fall back to hardcoded config
          awardedCoins = await withSentrySpan(
            "iap.validatePurchase.resolveCoins",
            "iap.pricing",
            () => getCoinsForProduct(validatedProductIdFromReceipt!, BACKEND_COIN_PRODUCT_DETAILS),
            {platform, productId: validatedProductIdFromReceipt},
          );

          if (awardedCoins === undefined) {
            functions.logger.error(
              "Product details not found for validated product ID " +
                `${validatedProductIdFromReceipt} for user ${userId}.`,
            );
            throw new functions.https.HttpsError("internal", "Product configuration error on backend.");
          }
          const resolvedAwardedCoins = awardedCoins;

          await withSentrySpan(
            "iap.validatePurchase.grantEntitlement",
            "iap.entitlement.grant",
            async () => {
              await updateUserCoins(userId, resolvedAwardedCoins);
              await incrementCoinPackPurchaseCount(validatedProductIdFromReceipt!);
              await updateUserProfile(userId, {hasPurchasedApp: true});
            },
            {
              platform,
              productId: validatedProductIdFromReceipt,
              entitlement: "coins",
              coins: resolvedAwardedCoins,
            },
          );

          const updatedUserForLog = await getUser(userId);
          functions.logger.info(
            `Awarded ${resolvedAwardedCoins} coins to user ${userId}. ` + `New balance: ${updatedUserForLog?.coins}`,
          );

          // Log purchase analytics (non-critical — errors don't fail the purchase)
          await withSentrySpan(
            "iap.validatePurchase.analytics",
            "iap.analytics",
            async () => {
              // Non-critical analytics helpers log and swallow their own failures.
              await logPurchaseAnalytic({
                userId,
                productId: validatedProductIdFromReceipt!,
                coinsReceived: resolvedAwardedCoins,
                amountPaid: 0, // actual amount not available from receipt validation
                currency: "USD",
                platform,
                country: "US", // country not available from receipt validation
                transactionId: purchaseToken,
                wasSpecialOffer: false,
              });

              await updateRegionalSpendingStats("US", "USD", 0);
            },
            {
              platform,
              productId: validatedProductIdFromReceipt,
              coins: resolvedAwardedCoins,
              currency: "USD",
            },
          );
        }

        try {
          newlyUnlockedAchievementIds = await withSentrySpan(
            "iap.validatePurchase.evaluateAchievements",
            "achievement.evaluate",
            () =>
              evaluateAchievements(userId, {
                gameMode: "classic",
                isCorrect: false,
                attempts: 0,
                gameOver: false,
              }),
            {platform, productId: validatedProductIdFromReceipt},
          );
        } catch (err) {
          functions.logger.error("Error evaluating achievements after purchase:", err);
          captureException(err);
        }

        await withSentrySpan(
          "iap.validatePurchase.markProcessed",
          "iap.receipt.mark_processed",
          () => markPurchaseTokenAsProcessed(userId, purchaseToken, validatedProductIdFromReceipt),
          {platform, productId: validatedProductIdFromReceipt},
        );

        const finalUser = await getUser(userId);
        const finalNewCoins = finalUser ? finalUser.coins : undefined;

        return validateCallableResponse(ValidatePurchaseResponseSchema, {
          success: true,
          newCoins: finalNewCoins,
          newlyUnlockedAchievementIds,
        }, "validatePurchase");
      } else {
        functions.logger.error(
          `Purchase validation failed or product ID mismatch for user ${userId}. ` +
            `Expected ${productId}, got ${validatedProductIdFromReceipt}. ` +
            `Validated: ${validationResponse.isValid}. ` +
            "Validation response omitted because it can contain receipt data.",
        );
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Purchase validation failed or product ID mismatch.",
        );
      }
    } catch (error: unknown) {
      functions.logger.error("IAP validation process failed.", {userId, productId, platform, error});
      captureException(error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "An unexpected error occurred during purchase processing.");
    }
  },
);

/**
 * Development-only fallback for coin pack purchases when native store integration is skipped.
 * This is intentionally gated to emulator or explicit opt-in via ALLOW_DEV_IAP_BYPASS=true.
 */
export const grantDevCoinsForPurchase = onCall(
  {enforceAppCheck: true},
  async (
    request: functions.https.CallableRequest<unknown>,
  ): Promise<{
    success: boolean;
    newCoins: number;
    coinsAwarded: number;
    newlyUnlockedAchievementIds?: string[];
  }> => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const explicitBypass = process.env.ALLOW_DEV_IAP_BYPASS === "true";
    if (!isEmulator && !explicitBypass) {
      throw new functions.https.HttpsError("permission-denied", "Dev purchase bypass is disabled.");
    }

    const {productId} = validateCallableRequest(
      GrantDevCoinsForPurchaseRequestSchema,
      request.data,
      "grantDevCoinsForPurchase",
    );

    const userId = request.auth.uid;
    const coinsToAward = await withSentrySpan(
      "iap.grantDevCoinsForPurchase.resolveCoins",
      "iap.pricing",
      () => getCoinsForProduct(productId, BACKEND_COIN_PRODUCT_DETAILS),
      {productId, devBypass: true},
    );
    if (coinsToAward === undefined) {
      throw new functions.https.HttpsError("invalid-argument", "Unknown product ID.");
    }

    await withSentrySpan(
      "iap.grantDevCoinsForPurchase.grantEntitlement",
      "iap.entitlement.grant",
      async () => {
        await updateUserCoins(userId, coinsToAward);
        await incrementCoinPackPurchaseCount(productId);
        await updateUserProfile(userId, {hasPurchasedApp: true});
      },
      {productId, coins: coinsToAward, entitlement: "coins", devBypass: true},
    );
    const newlyUnlockedAchievementIds = await withSentrySpan(
      "iap.grantDevCoinsForPurchase.evaluateAchievements",
      "achievement.evaluate",
      () =>
        evaluateAchievements(userId, {
          gameMode: "classic",
          isCorrect: false,
          attempts: 0,
          gameOver: false,
        }),
      {productId, devBypass: true},
    );
    const updatedUser = await getUser(userId);

    functions.logger.info(`Dev bypass awarded ${coinsToAward} coins to user ${userId} for ${productId}.`);

    return validateCallableResponse(GrantDevCoinsForPurchaseResponseSchema, {
      success: true,
      newCoins: updatedUser?.coins ?? 0,
      coinsAwarded: coinsToAward,
      newlyUnlockedAchievementIds,
    }, "grantDevCoinsForPurchase");
  },
);

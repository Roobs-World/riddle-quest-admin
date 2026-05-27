import * as RNIap from "react-native-iap";
import {Platform} from "react-native";
import {PurchaseValidationResponse} from "../types/Player";
import {logger} from "../utils/logger";
import {captureException, addBreadcrumb, withSentrySpan} from "../utils/sentry";
import {analyticsService} from "./AnalyticsService";
import {callValidatedFunction} from "../utils/firebaseFunctions";
import {
  GrantDevCoinsForPurchaseInputSchema,
  GrantDevCoinsForPurchaseOutputSchema,
  ValidatePurchaseInputSchema,
  ValidatePurchaseOutputSchema,
} from "../validation/cloudFunctionsSchemas";

// Interface for IAP error objects that have error codes
interface IapError extends Error {
  code?: string;
}

type PurchaseValidationResult = PurchaseValidationResponse & {
  newlyUnlockedAchievementIds?: string[];
};

export type PurchaseResult = RNIap.Purchase & {
  newCoins?: number;
  newlyUnlockedAchievementIds?: string[];
};

const PURCHASE_EVENT_TIMEOUT_MS = 1_500;

/**
 * Product IDs for coin packages.
 * These must match the product IDs configured in:
 * - App Store Connect (iOS)
 * - Google Play Console (Android)
 *
 * Format: com.roobsworld.riddlequest.coins{amount}
 */
const coinProductIds = [
  "com.roobsworld.riddlequest.coinpack1",
  "com.roobsworld.riddlequest.coinpack2",
  "com.roobsworld.riddlequest.coinpack3",
  "com.roobsworld.riddlequest.coinpack4",
  "com.roobsworld.riddlequest.coinpack5",
  "com.roobsworld.riddlequest.coinpack6",
];

/**
 * Coin product details mapping product IDs to coin amounts.
 * These values must match the backend configuration in firebase-functions/src/iapConfig.ts
 */
export const COIN_PRODUCT_DETAILS: {
  [key: string]: {id: string; coins: number};
} = {
  COIN_PACK_TINY: {id: "com.roobsworld.riddlequest.coinpack1", coins: 50},
  COIN_PACK_SMALL: {id: "com.roobsworld.riddlequest.coinpack2", coins: 100},
  COIN_PACK_MID: {id: "com.roobsworld.riddlequest.coinpack3", coins: 250},
  COIN_PACK_LARGE: {id: "com.roobsworld.riddlequest.coinpack4", coins: 500},
  COIN_PACK_HUGE: {id: "com.roobsworld.riddlequest.coinpack5", coins: 1000},
  COIN_PACK_MEGA: {id: "com.roobsworld.riddlequest.coinpack6", coins: 2000},
};

const COIN_PRODUCT_ALIASES: Record<string, string> = {
  "com.qwordly.coinpack1": "com.roobsworld.riddlequest.coinpack1",
  "com.qwordly.coinpack2": "com.roobsworld.riddlequest.coinpack2",
  "com.qwordly.coinpack3": "com.roobsworld.riddlequest.coinpack3",
  "com.qwordly.coinpack4": "com.roobsworld.riddlequest.coinpack4",
  "com.qwordly.coinpack5": "com.roobsworld.riddlequest.coinpack5",
  "com.qwordly.coinpack6": "com.roobsworld.riddlequest.coinpack6",
};

const toStoreProductId = (productId: unknown): string | undefined => {
  if (typeof productId !== "string" || productId.length === 0) {
    return undefined;
  }
  return COIN_PRODUCT_ALIASES[productId] ?? productId;
};

const getIapErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const code = (error as {code?: unknown}).code;
  return typeof code === "string" ? code : undefined;
};

const getIapErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? error : "";
  }
  const message = (error as {message?: unknown}).message;
  return typeof message === "string" ? message : "";
};

export const isExpectedIapInterruption = (error: unknown): boolean => {
  const code = getIapErrorCode(error);
  const message = getIapErrorMessage(error).toLowerCase();

  return (
    code === "E_USER_CANCELLED" ||
    code === "E_ITEM_UNAVAILABLE" ||
    code === "sku-not-found" ||
    message.includes("failed to initialize connection")
  );
};

/** Cached product list with a 5-minute TTL to avoid redundant store round-trips. */
let cachedProducts: RNIap.Product[] | null = null;
let cacheTimestamp = 0;
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

export const IapService = {
  async requestPurchaseWithListenerFallback(productId: string): Promise<RNIap.Purchase | null> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isSettled = false;
    let purchaseUpdatedSubscription: RNIap.EventSubscription | null = null;
    let purchaseErrorSubscription: RNIap.EventSubscription | null = null;

    const cleanup = () => {
      if (purchaseUpdatedSubscription) {
        purchaseUpdatedSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const listenerResult = new Promise<RNIap.Purchase | null>((resolve, reject) => {
      purchaseUpdatedSubscription = RNIap.purchaseUpdatedListener((purchase) => {
        if (isSettled) return;
        if (purchase.productId !== productId) return;

        isSettled = true;
        cleanup();
        resolve(purchase);
      });

      purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
        if (isSettled) return;

        isSettled = true;
        cleanup();
        reject(error);
      });

      timeoutHandle = setTimeout(() => {
        if (isSettled) return;

        isSettled = true;
        cleanup();
        resolve(null);
      }, PURCHASE_EVENT_TIMEOUT_MS);
    });

    try {
      const purchaseResult = await RNIap.requestPurchase({
        type: "in-app",
        request: {
          apple: {sku: productId},
          google: {skus: [productId]},
        },
      });

      const directPurchase = Array.isArray(purchaseResult) ? (purchaseResult[0] ?? null) : purchaseResult;
      if (directPurchase) {
        isSettled = true;
        cleanup();
        return directPurchase;
      }

      return await listenerResult;
    } catch (error) {
      isSettled = true;
      cleanup();
      throw error;
    }
  },

  async grantDevCoinsFallback(productId: string): Promise<{
    success: boolean;
    newCoins: number;
    coinsAwarded: number;
    newlyUnlockedAchievementIds?: string[];
  }> {
    const storeProductId = this.getStoreProductId(productId) ?? productId;
    const coins = this.getCoinsForProduct(storeProductId);
    if (!coins || coins <= 0) {
      logger.warn(
        `No local coin mapping found for dev fallback product: ${productId}; attempting backend fallback anyway.`,
      );
    }

    const result = await callValidatedFunction(
      "grantDevCoinsForPurchase",
      {productId: storeProductId},
      GrantDevCoinsForPurchaseInputSchema,
      GrantDevCoinsForPurchaseOutputSchema,
    );

    return {
      success: result.success === true,
      newCoins: result.newCoins ?? 0,
      coinsAwarded: result.coinsAwarded ?? 0,
      newlyUnlockedAchievementIds: result.newlyUnlockedAchievementIds ?? [],
    };
  },

  /**
   * Fetches a list of available in-app purchase products (coin packs).
   * Results are cached for 5 minutes to avoid redundant store round-trips.
   * @returns A Promise resolving to an array of product details.
   */
  async getProducts(): Promise<RNIap.Product[]> {
    const now = Date.now();
    if (cachedProducts && now - cacheTimestamp < PRODUCT_CACHE_TTL_MS) {
      logger.debug("Returning cached IAP products");
      return cachedProducts;
    }
    try {
      await RNIap.initConnection();

      if (Platform.OS === "android") {
        const availablePurchases = await RNIap.getAvailablePurchases();
        for (const purchase of availablePurchases) {
          await RNIap.finishTransaction({purchase: purchase});
        }
      }

      const products = (await RNIap.fetchProducts({
        skus: coinProductIds,
      })) as RNIap.Product[];
      logger.debug("Fetched products:", products);
      cachedProducts = products;
      cacheTimestamp = Date.now();
      return products;
    } catch (error) {
      if (isExpectedIapInterruption(error)) {
        logger.warn("IAP products are unavailable in the current runtime:", error);
      } else {
        logger.error("Error fetching products:", error);
        captureException(error);
      }
      throw error; // Rethrow the error for handling in the component
    }
  },

  /**
   * Initiates the purchase flow for a specific product.
   * @param productId - The ID of the product to purchase.
   * @returns A Promise resolving to the purchase result (likely ProductPurchase).
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult | null> {
    const storeProductId = this.getStoreProductId(productId) ?? productId;
    addBreadcrumb("iap", "Purchase initiated", {
      productId: storeProductId,
      selectedProductId: productId,
    });
    void analyticsService.logPurchaseEvent("initiated", {product_id: storeProductId});
    const isRunningUnderJest = typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID);
    const shouldUseDevFallback = __DEV__ && !isRunningUnderJest;
    try {
      if (shouldUseDevFallback) {
        logger.debug("Attempting dev purchase bypass via Firebase callable.");
        try {
          const fallbackResult = await this.grantDevCoinsFallback(storeProductId);
          if (fallbackResult.success) {
            addBreadcrumb("iap", "Dev purchase fallback succeeded", {productId: storeProductId});
            void analyticsService.logPurchaseEvent("completed", {
              product_id: storeProductId,
              coins: this.getCoinsForProduct(storeProductId) ?? 0,
              dev_fallback: true,
            });
            void analyticsService.logCoinPackPurchased({
              productId: storeProductId,
              coins: this.getCoinsForProduct(storeProductId) ?? 0,
              purchaseCount: 1,
            });

            return {
              productId: storeProductId,
              transactionId: `dev-${storeProductId}-${Date.now()}`,
              newCoins: fallbackResult.newCoins,
              newlyUnlockedAchievementIds: fallbackResult.newlyUnlockedAchievementIds ?? [],
            } as PurchaseResult;
          }

          logger.warn("Dev purchase fallback returned unsuccessful response.", {
            productId: storeProductId,
          });
          const localFallbackCoins = this.getCoinsForProduct(storeProductId);
          if (!localFallbackCoins || localFallbackCoins <= 0) {
            const unavailableError = new Error(
              `The selected product (${productId}) is not currently available.`,
            ) as IapError;
            unavailableError.code = "E_ITEM_UNAVAILABLE";
            throw unavailableError;
          }
          addBreadcrumb("iap", "Dev purchase local fallback activated", {
            productId: storeProductId,
            reason: "callable_returned_unsuccessful",
          });
          void analyticsService.logPurchaseEvent("completed", {
            product_id: storeProductId,
            coins: localFallbackCoins,
            dev_fallback_local: true,
          });
          return {
            productId: storeProductId,
            transactionId: `dev-local-${storeProductId}-${Date.now()}`,
            newlyUnlockedAchievementIds: [],
          } as unknown as PurchaseResult;
        } catch (fallbackError) {
          if ((fallbackError as IapError).code === "E_ITEM_UNAVAILABLE") {
            throw fallbackError;
          }
          logger.warn("Dev purchase fallback callable failed.", {
            productId: storeProductId,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
          const localFallbackCoins = this.getCoinsForProduct(storeProductId);
          if (!localFallbackCoins || localFallbackCoins <= 0) {
            const unavailableError = new Error(
              `The selected product (${productId}) is not currently available.`,
            ) as IapError;
            unavailableError.code = "E_ITEM_UNAVAILABLE";
            throw unavailableError;
          }
          addBreadcrumb("iap", "Dev purchase local fallback activated", {
            productId: storeProductId,
            reason: "callable_failed",
          });
          void analyticsService.logPurchaseEvent("completed", {
            product_id: storeProductId,
            coins: localFallbackCoins,
            dev_fallback_local: true,
          });
          return {
            productId: storeProductId,
            transactionId: `dev-local-${storeProductId}-${Date.now()}`,
            newlyUnlockedAchievementIds: [],
          } as unknown as PurchaseResult;
        }
      }

      const availableProducts = await this.getProducts();
      const availableProductIds = new Set(
        availableProducts
          .map((product) => product.id ?? (product as {productId?: string}).productId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      );
      if (availableProducts.length > 0 && !availableProductIds.has(storeProductId)) {
        logger.warn("Requested IAP product is not available on this device/account.", {
          requestedProductId: storeProductId,
          availableProductIds: Array.from(availableProductIds),
        });
        const unavailableError = new Error(
          `The selected product (${productId}) is not currently available.`,
        ) as IapError;
        unavailableError.code = "E_ITEM_UNAVAILABLE";
        throw unavailableError;
      }

      const purchase = await this.requestPurchaseWithListenerFallback(storeProductId);

      if (!purchase) {
        logger.debug("Purchase request did not return a purchase object.");
        return null; // Return null if no purchase object is obtained
      }

      logger.debug("Purchase successful:", purchase);

      const purchaseToken = purchase.purchaseToken;

      if (purchaseToken) {
        try {
          const validationResult = await withSentrySpan(
            "iap.validateAndFinishPurchase",
            "iap.validation",
            () => this.validatePurchase(purchaseToken, storeProductId),
            {productId: storeProductId},
          );
          const isValid = validationResult.success === true;

          if (isValid) {
            logger.debug("Server validation successful. Coins awarded (handled server-side).");
            addBreadcrumb("iap", "Purchase validated", {productId: storeProductId});
            void analyticsService.logPurchaseEvent("validated", {product_id: storeProductId});
            await RNIap.finishTransaction({purchase: purchase});
            addBreadcrumb("iap", "Purchase completed", {productId: storeProductId});
            void analyticsService.logPurchaseEvent("completed", {
              product_id: storeProductId,
              coins: this.getCoinsForProduct(storeProductId) ?? 0,
            });
            void analyticsService.logCoinPackPurchased({
              productId: storeProductId,
              coins: this.getCoinsForProduct(storeProductId) ?? 0,
              purchaseCount: 1,
            });
            return {
              ...purchase,
              newCoins: validationResult.newCoins,
              newlyUnlockedAchievementIds: validationResult.newlyUnlockedAchievementIds ?? [],
            }; // Return purchase details plus validation metadata.
          } else {
            logger.warn("Purchase validation failed for product:", storeProductId);
            // Do NOT finish the transaction if validation fails.
            throw new Error("Your purchase could not be validated. Please try again or contact support.");
          }
        } catch (validationError) {
          logger.error("Error during server validation:", validationError);
          captureException(validationError);
          // Do NOT finish the transaction if validation call fails.
          throw new Error(
            "A network error occurred during purchase validation. Please check your internet connection.",
          );
        }
      } else {
        logger.error("Purchase token is missing. Cannot proceed with validation.");
        throw new Error("Could not process purchase token. Please try purchasing again.");
      }
    } catch (error: unknown) {
      if (isExpectedIapInterruption(error)) {
        logger.warn("Expected IAP purchase interruption:", error);
      } else {
        logger.error("Error purchasing product:", error);
        captureException(error);
      }
      addBreadcrumb("iap", "Purchase failed", {productId: storeProductId}, "error");
      void analyticsService.logPurchaseEvent("failed", {
        product_id: storeProductId,
        error_code: (error as {code?: string}).code ?? "unknown",
      });
      // Refer to RNIap documentation for error codes.
      let userFriendlyMessage = "An unexpected error occurred during the purchase process. Please try again.";

      if ((error as IapError).code === "E_USER_CANCELLED") {
        logger.debug("Purchase cancelled by user.");
        userFriendlyMessage = "Purchase cancelled.";
      } else if ((error as IapError).code === "E_ALREADY_OWNED") {
        logger.debug("Item already owned.");
        userFriendlyMessage = "You already own this item.";
      } else if ((error as IapError).code === "E_DEVELOPER_ERROR") {
        logger.debug("Developer error.");
        userFriendlyMessage = "A system error occurred. Please contact support if this persists.";
      } else if ((error as IapError).code === "E_ITEM_UNAVAILABLE") {
        logger.debug("Item unavailable.");
        userFriendlyMessage = "This item is currently unavailable.";
      } else if ((error as IapError).code === "sku-not-found") {
        logger.debug("SKU not found for current store account.");
        userFriendlyMessage = "This item is currently unavailable.";
      } else if ((error as IapError).code === "E_NETWORK_ERROR") {
        logger.debug("Network error during purchase.");
        userFriendlyMessage = "Network error. Please check your connection and try again.";
      } else if (
        (error as Error).message === "Your purchase could not be validated. Please try again or contact support."
      ) {
        // This is an error from the validation catch block, re-thrown.
        userFriendlyMessage = (error as Error).message;
      } else if (
        (error as Error).message ===
        "A network error occurred during purchase validation. Please check your internet connection."
      ) {
        // This is an error from the validation catch block, re-thrown.
        userFriendlyMessage = (error as Error).message;
      } else if ((error as Error).message === "Could not process purchase token. Please try purchasing again.") {
        // This is an error from the missing purchase token catch block, re-thrown.
        userFriendlyMessage = (error as Error).message;
      }

      // Rethrow a new Error with a user-friendly message
      throw new Error(userFriendlyMessage);
    }
  },

  /**
   * Validates a purchase with the server-side Firebase Cloud Function.
   * The server verifies the purchase receipt with App Store/Google Play APIs
   * and awards coins to the user if valid.
   *
   * @param purchaseToken - The purchase receipt/token from the store
   * @param productId - The product ID that was purchased
   * @returns Promise resolving to true if validation succeeded, false otherwise
   * @throws Error if the validation request fails
   */
  async validatePurchase(purchaseToken: string, productId: string): Promise<PurchaseValidationResult> {
    // Call the Firebase Cloud Function for server-side validation
    // The server validates with App Store/Google Play and awards coins
    try {
      const purchasePlatform = Platform.OS === "ios" ? "ios" : "android";
      const result = await callValidatedFunction(
        "validatePurchase",
        {
          purchaseToken,
          productId,
          platform: purchasePlatform,
        },
        ValidatePurchaseInputSchema,
        ValidatePurchaseOutputSchema,
      );

      return {
        success: result.success === true,
        newCoins: result.newCoins,
        newlyUnlockedAchievementIds: result.newlyUnlockedAchievementIds ?? [],
      };
    } catch (error) {
      logger.error("Error calling validatePurchase Firebase Function:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Helper function to get the coin amount for a given product ID.
   * @param productId - The ID of the product.
   * @returns The number of coins for the product, or undefined if not found.
   */
  getCoinsForProduct(productId: string): number | undefined {
    const storeProductId = this.getStoreProductId(productId);
    if (!storeProductId) {
      return undefined;
    }
    const productDetail = Object.values(COIN_PRODUCT_DETAILS).find((detail) => detail.id === storeProductId);
    return productDetail?.coins;
  },

  /**
   * Returns the store/backend product ID for a selected shop product.
   */
  getStoreProductId(productId: string): string | undefined {
    return toStoreProductId(productId);
  },

  /** Clears the product cache. Intended for use in tests only. */
  clearCache(): void {
    cachedProducts = null;
    cacheTimestamp = 0;
  },
};

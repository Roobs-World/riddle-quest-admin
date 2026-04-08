import * as RNIap from "react-native-iap";
import { Platform } from "react-native";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { PurchaseValidationResponse } from "../types/Player";
import { logger } from "../utils/logger";
import { captureException, addBreadcrumb, startTransaction } from "../utils/sentry";
import { analyticsService } from "./AnalyticsService";

// Interface for IAP error objects that have error codes
interface IapError extends Error {
  code?: string;
}

/**
 * Product IDs for coin packages.
 * These must match the product IDs configured in:
 * - App Store Connect (iOS)
 * - Google Play Console (Android)
 *
 * Format: com.qwordly.coins{amount}
 */
const coinProductIds = [
  "com.qwordly.coinpack1",
  "com.qwordly.coinpack2",
  "com.qwordly.coinpack3",
  "com.qwordly.coinpack4",
  "com.qwordly.coinpack5",
];

/**
 * Coin product details mapping product IDs to coin amounts.
 * These values must match the backend configuration in firebase-functions/src/iapConfig.ts
 */
export const COIN_PRODUCT_DETAILS: {
  [key: string]: { id: string; coins: number };
} = {
  COIN_PACK_TINY:  { id: "com.qwordly.coinpack1", coins: 50 },
  COIN_PACK_SMALL: { id: "com.qwordly.coinpack2", coins: 100 },
  COIN_PACK_MID:   { id: "com.qwordly.coinpack3", coins: 250 },
  COIN_PACK_LARGE: { id: "com.qwordly.coinpack4", coins: 500 },
  COIN_PACK_HUGE:  { id: "com.qwordly.coinpack5", coins: 1000 },
};

/** Cached product list with a 5-minute TTL to avoid redundant store round-trips. */
let cachedProducts: RNIap.Product[] | null = null;
let cacheTimestamp = 0;
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

export const IapService = {
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
          await RNIap.finishTransaction({ purchase: purchase });
        }
      }

      const products = await RNIap.fetchProducts({
        skus: coinProductIds,
      }) as RNIap.Product[];
      logger.debug("Fetched products:", products);
      cachedProducts = products;
      cacheTimestamp = Date.now();
      return products;
    } catch (error) {
      logger.error("Error fetching products:", error);
      captureException(error);
      throw error; // Rethrow the error for handling in the component
    }
  },

  /**
   * Initiates the purchase flow for a specific product.
   * @param productId - The ID of the product to purchase.
   * @returns A Promise resolving to the purchase result (likely ProductPurchase).
   */
  async purchaseProduct(
    productId: string
  ): Promise<RNIap.Purchase | null> {
    addBreadcrumb("iap", "Purchase initiated", { productId });
    void analyticsService.logPurchaseEvent("initiated", { product_id: productId });
    try {
      const purchaseResult = await RNIap.requestPurchase({
        type: "in-app",
        request: {
          apple: { sku: productId },
          google: { skus: [productId] },
        },
      });

      const purchase = Array.isArray(purchaseResult)
        ? purchaseResult[0] // Take the first item if it's an array
        : purchaseResult; // Otherwise use the result directly

      if (!purchase) {
        logger.debug("Purchase request did not return a purchase object.");
        return null; // Return null if no purchase object is obtained
      }

      logger.debug("Purchase successful:", purchase);

      const purchaseToken = purchase.purchaseToken;

      if (purchaseToken) {
        const iapTxn = startTransaction("validatePurchase", "http.client");
        try {
          const isValid = await this.validatePurchase(purchaseToken, productId);

          if (isValid) {
            logger.debug(
              "Server validation successful. Coins awarded (handled server-side)."
            );
            addBreadcrumb("iap", "Purchase validated", { productId });
            void analyticsService.logPurchaseEvent("validated", { product_id: productId });
            await RNIap.finishTransaction({ purchase: purchase });
            addBreadcrumb("iap", "Purchase completed", { productId });
            void analyticsService.logPurchaseEvent("completed", {
              product_id: productId,
              coins: this.getCoinsForProduct(productId) ?? 0,
            });
            return purchase; // Return the purchase details
          } else {
            logger.warn("Purchase validation failed for product:", productId);
            // Do NOT finish the transaction if validation fails.
            throw new Error(
              "Your purchase could not be validated. Please try again or contact support."
            );
          }
        } catch (validationError) {
          logger.error("Error during server validation:", validationError);
          captureException(validationError);
          // Do NOT finish the transaction if validation call fails.
          throw new Error(
            "A network error occurred during purchase validation. Please check your internet connection."
          );
        } finally {
          iapTxn.finish();
        }
      } else {
        logger.error(
          "Purchase token is missing. Cannot proceed with validation."
        );
        throw new Error(
          "Could not process purchase token. Please try purchasing again."
        );
      }
    } catch (error: unknown) {
      logger.error("Error purchasing product:", error);
      captureException(error);
      addBreadcrumb("iap", "Purchase failed", { productId }, "error");
      void analyticsService.logPurchaseEvent("failed", {
        product_id: productId,
        error_code: (error as { code?: string }).code ?? "unknown",
      });
      // Refer to RNIap documentation for error codes.
      let userFriendlyMessage =
        "An unexpected error occurred during the purchase process. Please try again.";

      if ((error as IapError).code === "E_USER_CANCELLED") {
        logger.debug("Purchase cancelled by user.");
        userFriendlyMessage = "Purchase cancelled.";
      } else if ((error as IapError).code === "E_ALREADY_OWNED") {
        logger.debug("Item already owned.");
        userFriendlyMessage = "You already own this item.";
      } else if ((error as IapError).code === "E_DEVELOPER_ERROR") {
        logger.debug("Developer error.");
        userFriendlyMessage =
          "A system error occurred. Please contact support if this persists.";
      } else if ((error as IapError).code === "E_ITEM_UNAVAILABLE") {
        logger.debug("Item unavailable.");
        userFriendlyMessage = "This item is currently unavailable.";
      } else if ((error as IapError).code === "E_NETWORK_ERROR") {
        logger.debug("Network error during purchase.");
        userFriendlyMessage =
          "Network error. Please check your connection and try again.";
      } else if (
        (error as Error).message ===
        "Your purchase could not be validated. Please try again or contact support."
      ) {
        // This is an error from the validation catch block, re-thrown.
        userFriendlyMessage = (error as Error).message;
      } else if (
        (error as Error).message ===
        "A network error occurred during purchase validation. Please check your internet connection."
      ) {
        // This is an error from the validation catch block, re-thrown.
        userFriendlyMessage = (error as Error).message;
      } else if (
        (error as Error).message ===
        "Could not process purchase token. Please try purchasing again."
      ) {
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
  async validatePurchase(
    purchaseToken: string,
    productId: string
  ): Promise<boolean> {
    // Call the Firebase Cloud Function for server-side validation
    // The server validates with App Store/Google Play and awards coins
    try {
      const result = await httpsCallable<
        { purchaseToken: string; productId: string; platform: string },
        PurchaseValidationResponse
      >(getFunctions(getApp()), "validatePurchase")({
        purchaseToken,
        productId,
        platform: Platform.OS,
      });

      return result.data.success;
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
    const productDetail = Object.values(COIN_PRODUCT_DETAILS).find(
      (detail) => detail.id === productId
    );
    return productDetail?.coins;
  },

  /** Clears the product cache. Intended for use in tests only. */
  clearCache(): void {
    cachedProducts = null;
    cacheTimestamp = 0;
  },

  // ... existing code ...
};

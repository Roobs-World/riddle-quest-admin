import * as RNIap from "react-native-iap";
import { Platform } from "react-native";
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { PurchaseValidationResponse } from "../types/Player";

// Interface for IAP error objects that have error codes
interface IapError extends Error {
  code?: string;
}

const coinProductIds = [
  "com.yourgame.coinpack1",
  "com.yourgame.coinpack2",
  "com.yourgame.coinpack3",
];

export const COIN_PRODUCT_DETAILS: {
  [key: string]: { id: string; coins: number };
} = {
  COIN_PACK_SMALL: { id: "com.yourgame.coinpack1", coins: 100 },
  COIN_PACK_MEDIUM: { id: "com.yourgame.coinpack2", coins: 500 },
  COIN_PACK_LARGE: { id: "com.yourgame.coinpack3", coins: 1200 },
};

export const IapService = {
  /**
   * Fetches a list of available in-app purchase products (coin packs).
   * @returns A Promise resolving to an array of product details.
   */
  async getProducts(): Promise<RNIap.Product[]> {
    try {
      await RNIap.initConnection();

      if (Platform.OS === "android") {
        const purchaseHistory = await RNIap.getPurchaseHistory();
        for (const purchase of purchaseHistory) {
          await RNIap.finishTransaction({ purchase: purchase });
        }
      }

      const products = await RNIap.getProducts({
        skus: coinProductIds,
      });
      console.log("Fetched products:", products);
      return products;
    } catch (error) {
      console.error("Error fetching products:", error);
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
  ): Promise<RNIap.ProductPurchase | null> {
    try {
      const purchaseResult = await RNIap.requestPurchase({ sku: productId });

      const purchase = Array.isArray(purchaseResult)
        ? purchaseResult[0] // Take the first item if it's an array
        : purchaseResult; // Otherwise use the result directly

      if (!purchase) {
        console.log("Purchase request did not return a purchase object.");
        return null; // Return null if no purchase object is obtained
      }

      console.log("Purchase successful:", purchase);

      const purchaseToken = Platform.select({
        ios: purchase.transactionReceipt,
        android: purchase.purchaseToken,
      });

      if (purchaseToken) {
        try {
          const isValid = await this.validatePurchase(purchaseToken, productId);

          if (isValid) {
            console.log(
              "Server validation successful. Coins awarded (handled server-side)."
            );

            await RNIap.finishTransaction({ purchase: purchase });
            return purchase; // Return the purchase details
          } else {
            console.warn("Purchase validation failed for product:", productId);
            // Do NOT finish the transaction if validation fails.
            throw new Error(
              "Your purchase could not be validated. Please try again or contact support."
            );
          }
        } catch (validationError) {
          console.error("Error during server validation:", validationError);
          // Do NOT finish the transaction if validation call fails.
          throw new Error(
            "A network error occurred during purchase validation. Please check your internet connection."
          );
        }
      } else {
        console.error(
          "Purchase token is missing. Cannot proceed with validation."
        );
        throw new Error(
          "Could not process purchase token. Please try purchasing again."
        );
      }
    } catch (error: unknown) {
      console.error("Error purchasing product:", error);
      // Refer to RNIap documentation for error codes.
      let userFriendlyMessage =
        "An unexpected error occurred during the purchase process. Please try again.";

      if ((error as IapError).code === "E_USER_CANCELLED") {
        console.log("Purchase cancelled by user.");
        userFriendlyMessage = "Purchase cancelled.";
      } else if ((error as IapError).code === "E_ALREADY_OWNED") {
        console.log("Item already owned.");
        userFriendlyMessage = "You already own this item.";
      } else if ((error as IapError).code === "E_DEVELOPER_ERROR") {
        console.log("Developer error.");
        userFriendlyMessage =
          "A system error occurred. Please contact support if this persists.";
      } else if ((error as IapError).code === "E_ITEM_UNAVAILABLE") {
        console.log("Item unavailable.");
        userFriendlyMessage = "This item is currently unavailable.";
      } else if ((error as IapError).code === "E_NETWORK_ERROR") {
        console.log("Network error during purchase.");
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

  async validatePurchase(
    purchaseToken: string,
    productId: string
  ): Promise<boolean> {
    // This function should take the purchaseToken and productId,
    // verify them with the App Store/Google Play APIs on the server,
    // and update the user's coin balance in Firestore if valid.
    console.log(
      "Placeholder: Sending purchase for validation:",
      purchaseToken,
      productId
    );

    console.warn("validatePurchase is using a placeholder implementation.");

    // Call the Firebase Cloud Function for validation
    try {
      const result = await getFunctions(getApp()).httpsCallable<
        { purchaseToken: string; productId: string; platform: string },
        PurchaseValidationResponse
      >("validatePurchase")({
        purchaseToken,
        productId,
        platform: Platform.OS, // Pass platform to the backend
      });

      // Assuming the callable function returns { success: boolean, newCoins?: number }
      return result.data.success; // Return the success status from the backend
    } catch (error) {
      console.error("Error calling validatePurchase Firebase Function:", error);
      // Rethrow the error to be handled by the calling function (purchaseProduct)
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

  // ... existing code ...
};

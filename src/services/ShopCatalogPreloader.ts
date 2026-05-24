import { IapService } from "./IapService";
import { ProductPricingService } from "./ProductPricingService";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Warms up shop data caches during app startup so opening the coin shop is instant.
 */
export const preloadShopCatalog = async (): Promise<void> => {
  const shouldPreloadIapProducts =
    typeof __DEV__ === "undefined" || __DEV__ === false;
  const preloadTasks: Promise<unknown>[] = [
    ProductPricingService.getActiveProducts(),
  ];

  if (shouldPreloadIapProducts) {
    preloadTasks.unshift(IapService.getProducts());
  }

  const results = await Promise.allSettled(preloadTasks);
  const iapResult = shouldPreloadIapProducts ? results[0] : null;
  const pricingResult = shouldPreloadIapProducts ? results[1] : results[0];

  if (iapResult?.status === "rejected") {
    logger.warn(
      "Shop catalog preload: failed to preload IAP products",
      iapResult.reason
    );
    captureException(iapResult.reason, { context: "ShopCatalogPreloader.iap" });
  }

  if (pricingResult.status === "rejected") {
    logger.warn(
      "Shop catalog preload: failed to preload Firestore pricing",
      pricingResult.reason
    );
    captureException(pricingResult.reason, {
      context: "ShopCatalogPreloader.pricing",
    });
  }
};


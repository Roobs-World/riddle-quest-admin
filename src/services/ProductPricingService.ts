import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "@react-native-firebase/firestore";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {
  ProductPricingSchema,
  type ProductPricing,
  type RegionalPrice,
  type SpecialOffer,
} from "../validation/firestoreSchemas";
import {productPricingFirestoreConverter, withConverterIfAvailable} from "./firestoreConverters";
import {withSentrySpan} from "../utils/sentry";

export type {ProductPricing, RegionalPrice, SpecialOffer};

let cachedProducts: ProductPricing[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all active coin packs from Firestore productPricing collection.
 * Results are cached for 5 minutes to avoid redundant reads.
 */
export const ProductPricingService = {
  async getActiveProducts(): Promise<ProductPricing[]> {
    const now = Date.now();
    if (cachedProducts && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedProducts;
    }

    try {
      return await withSentrySpan(
        "firestore.read.productPricing",
        "db.firestore",
        async () => {
          const snapshot = await getDocs(
            query(
              withConverterIfAvailable(collection(getFirestore(), "productPricing"), productPricingFirestoreConverter),
              where("isActive", "==", true),
              orderBy("sortOrder"),
            ),
          );

          const products = snapshot.docs.map((doc) => ProductPricingSchema.parse(doc.data()));
          cachedProducts = products;
          cacheTimestamp = now;
          logger.debug(`Fetched ${products.length} active products from Firestore`);
          return products;
        },
        {operationName: "ProductPricingService.getActiveProducts"},
      );
    } catch (err) {
      logger.error("Failed to fetch productPricing from Firestore:", err);
      captureException(err);
      // Return cached data even if stale, rather than nothing
      return cachedProducts ?? [];
    }
  },

  /**
   * Returns the active special offer for a product if the offer is currently valid.
   */
  getActiveSpecialOffer(product: ProductPricing): SpecialOffer | undefined {
    const offer = product.specialOffer;
    if (!offer || !offer.isActive) return undefined;
    const now = Date.now();
    if (now < offer.validFrom || now > offer.validTo) return undefined;
    return offer;
  },

  /**
   * Returns the display price for a given currency code, or undefined if not found.
   */
  getPriceForCurrency(product: ProductPricing, currency: string): RegionalPrice | undefined {
    return product.regionalPrices.find((p) => p.currency === currency);
  },

  /**
   * Finds a Firestore product by its productId.
   */
  findByProductId(products: ProductPricing[], productId: string): ProductPricing | undefined {
    return products.find((p) => p.productId === productId);
  },

  /**
   * Returns products that have a featuredOrder, sorted by featuredOrder ascending.
   * These are shown in the hero/featured slots at the top of the coin shop.
   */
  getFeaturedProducts(products: ProductPricing[]): ProductPricing[] {
    return products
      .filter((p) => p.featuredOrder !== undefined && p.featuredOrder !== null)
      .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
  },

  /** Clears the local cache (useful for testing or forced refresh). */
  clearCache(): void {
    cachedProducts = null;
    cacheTimestamp = 0;
  },
};

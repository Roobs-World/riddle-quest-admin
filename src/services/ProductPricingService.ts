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

const DEFAULT_PRODUCT_PRICING: ProductPricing[] = [
  {
    productId: "com.roobsworld.riddlequest.coinpack1",
    productKey: "COIN_PACK_TINY",
    name: "Starter Pack",
    description: "A small refill for a quick hint or two.",
    coins: 250,
    isActive: true,
    sortOrder: 1,
    featuredOrder: 1,
    featuredBadge: "STARTER",
    regionalPrices: [{amount: 0.99, currency: "USD", displayPrice: "$0.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack2",
    productKey: "COIN_PACK_SMALL",
    name: "Small Pack",
    description: "A balanced refill for regular play.",
    coins: 550,
    isActive: true,
    sortOrder: 2,
    regionalPrices: [{amount: 1.99, currency: "USD", displayPrice: "$1.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack3",
    productKey: "COIN_PACK_MID",
    name: "Mid Pack",
    description: "A solid boost for a longer session.",
    coins: 900,
    isActive: true,
    sortOrder: 3,
    regionalPrices: [{amount: 2.99, currency: "USD", displayPrice: "$2.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack4",
    productKey: "COIN_PACK_LARGE",
    name: "Large Pack",
    description: "A popular option for extra flexibility.",
    coins: 1600,
    isActive: true,
    sortOrder: 4,
    featuredOrder: 2,
    featuredBadge: "POPULAR",
    regionalPrices: [{amount: 4.99, currency: "USD", displayPrice: "$4.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack5",
    productKey: "COIN_PACK_HUGE",
    name: "Huge Pack",
    description: "Strong value for players who keep coming back.",
    coins: 3400,
    isActive: true,
    sortOrder: 5,
    regionalPrices: [{amount: 9.99, currency: "USD", displayPrice: "$9.99", symbol: "$"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack6",
    productKey: "COIN_PACK_MEGA",
    name: "Mega Pack",
    description: "The best-value bundle for the long haul.",
    coins: 7000,
    isActive: true,
    sortOrder: 6,
    featuredOrder: 3,
    featuredBadge: "BEST VALUE",
    regionalPrices: [{amount: 19.99, currency: "USD", displayPrice: "$19.99", symbol: "$"}],
  },
];

const cloneDefaultProducts = (): ProductPricing[] =>
  DEFAULT_PRODUCT_PRICING.map((product) => ({
    ...product,
    regionalPrices: product.regionalPrices.map((price) => ({...price})),
  }));

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
          if (products.length === 0) {
            cachedProducts = cloneDefaultProducts();
            cacheTimestamp = now;
            logger.debug("Firestore productPricing was empty; using default product catalog");
            return cachedProducts;
          }
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
      return cachedProducts ?? cloneDefaultProducts();
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

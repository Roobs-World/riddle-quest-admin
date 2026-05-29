import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {captureException} from "./sentry";

let dbInstance: admin.firestore.Firestore;
function getDb(): admin.firestore.Firestore {
  if (!dbInstance) dbInstance = admin.firestore();
  return dbInstance;
}

export interface RegionalPrice {
  amount: number;
  currency: string;
  displayPrice: string;
  symbol: string;
}

export interface SpecialOffer {
  badgeText: string;
  description: string;
  discountPercentage: number;
  isActive: boolean;
  validFrom: number;
  validTo: number;
}

export interface ProductPricing {
  productId: string;
  productKey: string;
  name: string;
  description: string;
  coins: number;
  isActive: boolean;
  sortOrder: number;
  regionalPrices: RegionalPrice[];
  specialOffer?: SpecialOffer;
  featuredOrder?: number;
  featuredBadge?: string;
}

export interface PurchaseAnalyticRecord {
  userId: string;
  productId: string;
  coinsReceived: number;
  amountPaid: number;
  currency: string;
  platform: string;
  country: string;
  transactionId: string;
  wasSpecialOffer: boolean;
  discountApplied?: number;
}

const DEFAULT_PRODUCT_PRICING: ProductPricing[] = [
  {
    productId: "com.roobsworld.riddlequest.coinpack1",
    productKey: "COIN_PACK_TINY",
    name: "Starter Pack",
    description: "A small refill for a quick hint or two.",
    coins: 250,
    isActive: true,
    sortOrder: 1,
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

function cloneDefaultProducts(): ProductPricing[] {
  return DEFAULT_PRODUCT_PRICING.map((product) => ({
    ...product,
    regionalPrices: product.regionalPrices.map((price) => ({...price})),
  }));
}

/**
 * Fetches a single product's pricing config from Firestore.
 */
export async function getProductPricing(productId: string): Promise<ProductPricing | undefined> {
  try {
    const doc = await getDb().collection("productPricing").doc(productId).get();
    if (!doc.exists) {
      return DEFAULT_PRODUCT_PRICING.find((product) => product.productId === productId);
    }
    return doc.data() as ProductPricing;
  } catch (err) {
    functions.logger.error(`Failed to fetch productPricing for ${productId}:`, err);
    captureException(err);
    return DEFAULT_PRODUCT_PRICING.find((product) => product.productId === productId);
  }
}

/**
 * Fetches all active products sorted by sortOrder.
 */
export async function getAllActiveProducts(): Promise<ProductPricing[]> {
  try {
    const snapshot = await getDb()
      .collection("productPricing")
      .where("isActive", "==", true)
      .orderBy("sortOrder")
      .get();
    const products = snapshot.docs.map((doc) => doc.data() as ProductPricing);
    return products.length > 0 ? products : cloneDefaultProducts();
  } catch (err) {
    functions.logger.error("Failed to fetch active products:", err);
    captureException(err);
    return cloneDefaultProducts();
  }
}

/**
 * Looks up coin amount for a product ID, checking Firestore first then
 * falling back to the provided hardcoded map.
 */
export async function getCoinsForProduct(
  productId: string,
  fallbackMap: Record<string, {id: string; coins: number}>,
): Promise<number | undefined> {
  const pricing = await getProductPricing(productId);
  if (pricing) return pricing.coins;

  const fallback = Object.values(fallbackMap).find((p) => p.id === productId);
  return fallback?.coins;
}

/**
 * Logs a purchase event to the purchaseAnalytics collection.
 * Non-critical — failures are logged but do not affect purchase flow.
 */
export async function logPurchaseAnalytic(record: PurchaseAnalyticRecord): Promise<void> {
  try {
    await getDb()
      .collection("purchaseAnalytics")
      .add({
        ...record,
        purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
    functions.logger.info(`Purchase analytic logged for user ${record.userId}, product ${record.productId}`);
  } catch (err) {
    functions.logger.error("Failed to log purchaseAnalytic:", err);
    captureException(err);
  }
}

/**
 * Updates regional spending stats after a purchase.
 * Uses a transaction to safely increment aggregates.
 * Non-critical — failures are logged but do not affect purchase flow.
 */
export async function updateRegionalSpendingStats(region: string, currency: string, amountPaid: number): Promise<void> {
  try {
    const ref = getDb().collection("regionalSpendingStats").doc(region);
    await getDb().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists) {
        const data = doc.data()!;
        const newTotal = (data.totalRevenue || 0) + amountPaid;
        const newCount = (data.totalPurchases || 0) + 1;
        tx.update(ref, {
          totalRevenue: newTotal,
          totalPurchases: newCount,
          averageOrderValue: Math.round(newTotal / newCount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        tx.set(ref, {
          region,
          currency,
          totalRevenue: amountPaid,
          totalPurchases: 1,
          uniqueUsers: 1,
          averageOrderValue: amountPaid,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (err) {
    functions.logger.error(`Failed to update regionalSpendingStats for ${region}:`, err);
    captureException(err);
  }
}

/**
 * Increments the purchase counter for a specific coin pack.
 * Non-critical — failures are logged but do not affect purchase flow.
 */
export async function incrementCoinPackPurchaseCount(productId: string): Promise<void> {
  try {
    const ref = getDb().collection("productPricing").doc(productId);
    await ref.set(
      {
        productId,
        purchaseCount: admin.firestore.FieldValue.increment(1),
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  } catch (err) {
    functions.logger.error(`Failed to increment purchaseCount for product ${productId}:`, err);
    captureException(err);
  }
}

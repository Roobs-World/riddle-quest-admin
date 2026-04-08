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

/**
 * Fetches a single product's pricing config from Firestore.
 */
export async function getProductPricing(productId: string): Promise<ProductPricing | undefined> {
  try {
    const doc = await getDb().collection("productPricing").doc(productId).get();
    if (!doc.exists) return undefined;
    return doc.data() as ProductPricing;
  } catch (err) {
    functions.logger.error(`Failed to fetch productPricing for ${productId}:`, err);
    captureException(err);
    return undefined;
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
    return snapshot.docs.map((doc) => doc.data() as ProductPricing);
  } catch (err) {
    functions.logger.error("Failed to fetch active products:", err);
    captureException(err);
    return [];
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
    await getDb().collection("purchaseAnalytics").add({
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
export async function updateRegionalSpendingStats(
  region: string,
  currency: string,
  amountPaid: number,
): Promise<void> {
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

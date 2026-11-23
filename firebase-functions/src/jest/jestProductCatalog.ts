import {PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS, PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "@riddle-quest/core/pricing/catalog";

/** Defines the jest coin products value. */
export const JEST_COIN_PRODUCTS: Readonly<Record<string, number>> = Object.freeze({
  "com.roobsworld.riddlequest.coinpack1": 250,
  "com.roobsworld.riddlequest.coinpack2": 550,
  "com.roobsworld.riddlequest.coinpack3": 900,
  "com.roobsworld.riddlequest.coinpack4": 1600,
  "com.roobsworld.riddlequest.coinpack5": 3400,
  "com.roobsworld.riddlequest.coinpack6": 7000,
});

/** Defines the jest subscriptions value. */
export const JEST_SUBSCRIPTIONS = Object.freeze({
  "com.roobsworld.riddlequest.premium.monthly": "premium",
  "com.roobsworld.riddlequest.premium.yearly": "premium",
} as const);

/** One validated product purchase selected from a Jest-signed receipt. */
export interface ResolvedJestPurchase {
  /** Opaque platform token used for receipt idempotency. */
  purchaseToken: string;
  /** Trusted configured Jest product SKU. */
  productSku: string;
  /** Server-owned coin grant for the SKU. */
  coins: number;
}

/** One validated subscription entitlement from a Jest-signed catalog. */
export interface VerifiedJestSubscription {
  /** Trusted configured Jest subscription SKU. */
  sku: string;
  /** Current platform-reported entitlement state. */
  status: "active" | "inactive";
}

/** Returns whether an unknown value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Resolves one requested purchase from signed platform data and a fail-closed SKU allowlist. */
export function resolveJestSignedPurchase(
  payload: Record<string, unknown>,
  requestedToken: string,
  allowedSkus: ReadonlySet<string>,
): ResolvedJestPurchase {
  /** Provides candidates behavior. */
  const candidates = Array.isArray(payload.purchases) ? payload.purchases : payload.purchase ? [payload.purchase] : [];
  /** Provides purchase behavior. */
  const purchase = candidates.find((entry) => isRecord(entry) && entry.purchaseToken === requestedToken);
  if (!isRecord(purchase)) throw new Error("purchase-not-signed");
  /** Provides {purchase token, product sku} behavior. */
  const {purchaseToken, productSku} = purchase;
  if (typeof purchaseToken !== "string" || typeof productSku !== "string") throw new Error("invalid-purchase");
  if (!allowedSkus.has(productSku)) throw new Error("invalid-sku");
  /** Provides coins behavior. */
  const coins = JEST_COIN_PRODUCTS[productSku];
  if (!coins) throw new Error("invalid-sku");
  return {purchaseToken, productSku, coins};
}

/** Resolves exact active/inactive entitlements from signed platform data. */
export function resolveJestSignedSubscriptions(
  payload: Record<string, unknown>,
  allowedSkus: ReadonlySet<string>,
): VerifiedJestSubscription[] {
  /** Provides candidates behavior. */
  const candidates = Array.isArray(payload.subscriptions)
    ? payload.subscriptions
    : payload.subscription
      ? [payload.subscription]
      : [];
  return candidates.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("invalid-subscription");
    /** Provides {sku, status} behavior. */
    const {sku, status} = candidate;
    if (typeof sku !== "string" || (status !== "active" && status !== "inactive") || !allowedSkus.has(sku))
      throw new Error("invalid-subscription");
    return {sku, status};
  });
}

/** Finds configured SKUs blocked by an already-active equivalent entitlement. */
export function resolveJestConflictingSubscriptionSkus(
  activeSkus: readonly string[],
  allowedSkus: ReadonlySet<string>,
  entitlementCatalog: Readonly<Record<string, string>> = JEST_SUBSCRIPTIONS,
): string[] {
  /** Provides active entitlements behavior. */
  const activeEntitlements = new Set(
    activeSkus.map((sku) => entitlementCatalog[sku]).filter((value): value is string => typeof value === "string"),
  );
  return [...allowedSkus].filter((sku) => !activeSkus.includes(sku) && activeEntitlements.has(entitlementCatalog[sku]));
}

/**
 * Coins owed to a player for an active Premium subscription.
 *
 * A subscriber receives one grant on first verification, then another once at
 * least 30 days have passed since the previous grant. The caller stores `now`
 * as the new grant time whenever the result is above zero.
 */
export function resolvePremiumCoinGrant(
  active: boolean,
  lastGrantedAt: unknown,
  now: number,
  coins: number = PREMIUM_SUBSCRIPTION_MONTHLY_COINS,
  intervalMs: number = PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS,
): number {
  if (!active) return 0;
  if (typeof lastGrantedAt !== "number" || !Number.isFinite(lastGrantedAt)) return coins;
  return now - lastGrantedAt >= intervalMs ? coins : 0;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JEST_SUBSCRIPTIONS = exports.JEST_COIN_PRODUCTS = void 0;
exports.resolveJestSignedPurchase = resolveJestSignedPurchase;
exports.resolveJestSignedSubscriptions = resolveJestSignedSubscriptions;
exports.resolveJestConflictingSubscriptionSkus = resolveJestConflictingSubscriptionSkus;
exports.resolvePremiumCoinGrant = resolvePremiumCoinGrant;
const catalog_1 = require("@qwordly/core/pricing/catalog");
/** Defines the jest coin products value. */
exports.JEST_COIN_PRODUCTS = Object.freeze({
    "com.roobsworld.riddlequest.coinpack1": 250,
    "com.roobsworld.riddlequest.coinpack2": 550,
    "com.roobsworld.riddlequest.coinpack3": 900,
    "com.roobsworld.riddlequest.coinpack4": 1600,
    "com.roobsworld.riddlequest.coinpack5": 3400,
    "com.roobsworld.riddlequest.coinpack6": 7000,
});
/** Defines the jest subscriptions value. */
exports.JEST_SUBSCRIPTIONS = Object.freeze({
    "com.roobsworld.riddlequest.premium.monthly": "premium",
    "com.roobsworld.riddlequest.premium.yearly": "premium",
});
/** Returns whether an unknown value is a plain object. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Resolves one requested purchase from signed platform data and a fail-closed SKU allowlist. */
function resolveJestSignedPurchase(payload, requestedToken, allowedSkus) {
    /** Provides candidates behavior. */
    const candidates = Array.isArray(payload.purchases) ? payload.purchases : payload.purchase ? [payload.purchase] : [];
    /** Provides purchase behavior. */
    const purchase = candidates.find((entry) => isRecord(entry) && entry.purchaseToken === requestedToken);
    if (!isRecord(purchase))
        throw new Error("purchase-not-signed");
    /** Provides {purchase token, product sku} behavior. */
    const { purchaseToken, productSku } = purchase;
    if (typeof purchaseToken !== "string" || typeof productSku !== "string")
        throw new Error("invalid-purchase");
    if (!allowedSkus.has(productSku))
        throw new Error("invalid-sku");
    /** Provides coins behavior. */
    const coins = exports.JEST_COIN_PRODUCTS[productSku];
    if (!coins)
        throw new Error("invalid-sku");
    return { purchaseToken, productSku, coins };
}
/** Resolves exact active/inactive entitlements from signed platform data. */
function resolveJestSignedSubscriptions(payload, allowedSkus) {
    /** Provides candidates behavior. */
    const candidates = Array.isArray(payload.subscriptions)
        ? payload.subscriptions
        : payload.subscription
            ? [payload.subscription]
            : [];
    return candidates.map((candidate) => {
        if (!isRecord(candidate))
            throw new Error("invalid-subscription");
        /** Provides {sku, status} behavior. */
        const { sku, status } = candidate;
        if (typeof sku !== "string" || (status !== "active" && status !== "inactive") || !allowedSkus.has(sku))
            throw new Error("invalid-subscription");
        return { sku, status };
    });
}
/** Finds configured SKUs blocked by an already-active equivalent entitlement. */
function resolveJestConflictingSubscriptionSkus(activeSkus, allowedSkus, entitlementCatalog = exports.JEST_SUBSCRIPTIONS) {
    /** Provides active entitlements behavior. */
    const activeEntitlements = new Set(activeSkus.map((sku) => entitlementCatalog[sku]).filter((value) => typeof value === "string"));
    return [...allowedSkus].filter((sku) => !activeSkus.includes(sku) && activeEntitlements.has(entitlementCatalog[sku]));
}
/**
 * Coins owed to a player for an active Premium subscription.
 *
 * A subscriber receives one grant on first verification, then another once at
 * least 30 days have passed since the previous grant. The caller stores `now`
 * as the new grant time whenever the result is above zero.
 */
function resolvePremiumCoinGrant(active, lastGrantedAt, now, coins = catalog_1.PREMIUM_SUBSCRIPTION_MONTHLY_COINS, intervalMs = catalog_1.PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS) {
    if (!active)
        return 0;
    if (typeof lastGrantedAt !== "number" || !Number.isFinite(lastGrantedAt))
        return coins;
    return now - lastGrantedAt >= intervalMs ? coins : 0;
}
//# sourceMappingURL=jestProductCatalog.js.map
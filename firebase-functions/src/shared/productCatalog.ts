import {PREMIUM_SUBSCRIPTION_GRANT_INTERVAL_MS, PREMIUM_SUBSCRIPTION_MONTHLY_COINS} from "../../../src/core/pricing/catalog.js";

/** Shared Google Play and Jest SKU grants; provider receipt verification stays in each adapter. */
export const JEST_COIN_PRODUCTS: Readonly<Record<string, number>> = Object.freeze({
  "com.roobsworld.riddlequest.coinpack1": 250,
  "com.roobsworld.riddlequest.coinpack2": 550,
  "com.roobsworld.riddlequest.coinpack3": 900,
  "com.roobsworld.riddlequest.coinpack4": 1600,
  "com.roobsworld.riddlequest.coinpack5": 3400,
  "com.roobsworld.riddlequest.coinpack6": 7000,
});

/** Shared Google Play and Jest subscription SKU entitlement mapping. */
export const JEST_SUBSCRIPTIONS = Object.freeze({
  "com.roobsworld.riddlequest.premium.monthly": "premium",
  "com.roobsworld.riddlequest.premium.yearly": "premium",
} as const);

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

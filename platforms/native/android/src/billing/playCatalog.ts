import {DEFAULT_PRODUCT_PRICING} from "../../../../../src/commerce/pricing/catalog";
/** Google Play package that owns every purchase. */
export const ANDROID_PACKAGE_NAME = "com.roobsworld.riddlequest";
/** Badge shown on a featured coin pack. */
export type CoinPackBadge = "starter" | "popular" | "bestValue";
/** One coin pack in shop order. */
export type CoinPack = Readonly<{
  /** Play in-app product id, identical to the shared SKU. */
  productId: string;
  /** Coins the backend grants. */
  coins: number;
  /** Featured badge, if any. */
  badge: CoinPackBadge | null;
}>;
/** Maps the shared catalog's badge labels to copy keys. */
const BADGES: Readonly<Record<string, CoinPackBadge>> = {STARTER: "starter", POPULAR: "popular", "BEST VALUE": "bestValue"};
/** Coin packs sold on Android: the shared catalog's active packs in its order. */
export const ANDROID_COIN_PACKS: readonly CoinPack[] = DEFAULT_PRODUCT_PRICING.filter((pack) => pack.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((pack) => ({productId: pack.productId, coins: pack.coins, badge: BADGES[pack.featuredBadge ?? ""] ?? null}));
/** Premium subscriptions sold on Android, identical to the shared SKUs. */
export const ANDROID_PREMIUM_SUBSCRIPTIONS: readonly string[] = [
  "com.roobsworld.riddlequest.premium.monthly",
  "com.roobsworld.riddlequest.premium.yearly",
];

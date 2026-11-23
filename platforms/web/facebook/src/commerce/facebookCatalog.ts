import {DEFAULT_PRODUCT_PRICING} from "../../../../../src/commerce/pricing/catalog";

/** Describes facebook product. */
export type FacebookProduct = Readonly<{
  /** Stores product id. */
  productId: string;
  /** Stores kind. */
  kind: "consumable" | "durable";
  /** Stores base price usd cents. */
  basePriceUsdCents: number;
  /** Stores coins. */
  coins: number;
  /** Stores entitlement. */
  entitlement?: "remove_interstitial_ads";
}>;

/** Provides coin products behavior. */
const coinProducts = DEFAULT_PRODUCT_PRICING.map((product): [string, FacebookProduct] => {
  /** Provides usd prices behavior. */
  const usdPrices = product.regionalPrices.filter(({currency}) => currency === "USD");
  /** Provides amount behavior. */
  const amount = usdPrices[0]?.amount;
  /** Provides raw cents behavior. */
  const rawCents = typeof amount === "number" ? amount * 100 : Number.NaN;
  /** Provides cents behavior. */
  const cents = Math.round(rawCents);
  if (
    usdPrices.length !== 1 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(rawCents - cents) > 1e-9 ||
    product.coins <= 0
  ) {
    throw new Error(`invalid-facebook-source-product:${product.productId}`);
  }
  return [
    product.productId,
    Object.freeze({
      productId: product.productId,
      kind: "consumable",
      basePriceUsdCents: cents,
      coins: product.coins,
    }),
  ];
});

if (coinProducts.length !== 6 || new Set(coinProducts.map(([productId]) => productId)).size !== 6) {
  throw new Error("invalid-facebook-source-catalog");
}

/** Provides durable product behavior. */
const durableProduct = Object.freeze({
  productId: "com.roobsworld.riddlequest.remove_interstitial_ads",
  kind: "durable" as const,
  basePriceUsdCents: 499,
  coins: 0,
  entitlement: "remove_interstitial_ads" as const,
});

/** Shared immutable contract used by the Facebook client boundary and authoritative server ledger. */
export const FACEBOOK_PRODUCTS: Readonly<Record<string, FacebookProduct>> = Object.freeze({
  ...Object.fromEntries(coinProducts),
  [durableProduct.productId]: durableProduct,
});

/** Resolves facebook product. */
export function resolveFacebookProduct(productId: string): FacebookProduct {
  /** Provides product behavior. */
  const product = FACEBOOK_PRODUCTS[productId];
  if (!product) throw new Error("invalid-facebook-product");
  return product;
}

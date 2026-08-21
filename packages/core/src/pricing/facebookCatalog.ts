import {DEFAULT_PRODUCT_PRICING} from "./catalog";

/** Describes facebook product. */
export type FacebookProduct = Readonly<{
  productId: string;
  kind: "consumable" | "durable";
  basePriceUsdCents: number;
  coins: number;
  entitlement?: "remove_interstitial_ads";
}>;

/** Provides coin products behavior. */
const coinProducts = DEFAULT_PRODUCT_PRICING.map((product): [string, FacebookProduct] => {
  const usdPrices = product.regionalPrices.filter(({currency}) => currency === "USD");
  const amount = usdPrices[0]?.amount;
  const rawCents = typeof amount === "number" ? amount * 100 : Number.NaN;
  const cents = Math.round(rawCents);
  if (usdPrices.length !== 1 || !Number.isSafeInteger(cents) ||
    Math.abs(rawCents - cents) > 1e-9 || product.coins <= 0) {
    throw new Error(`invalid-facebook-source-product:${product.productId}`);
  }
  return [product.productId, Object.freeze({
    productId: product.productId,
    kind: "consumable",
    basePriceUsdCents: cents,
    coins: product.coins,
  })];
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
  const product = FACEBOOK_PRODUCTS[productId];
  if (!product) throw new Error("invalid-facebook-product");
  return product;
}

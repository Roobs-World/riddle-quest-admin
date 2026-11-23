import {DEFAULT_PRODUCT_PRICING} from "../../../../src/core/pricing/catalog.js";

/** Server-owned Stripe representation of one Yahoo coin product. */
export type YahooStripeProduct = Readonly<{
  /** Provides product id behavior. */
  productId: string;
  /** Provides name behavior. */
  name: string;
  /** Provides description behavior. */
  description: string;
  /** Provides coins behavior. */
  coins: number;
  /** Provides currency behavior. */
  currency: "usd";
  /** Provides unit amount behavior. */
  unitAmount: number;
}>;

/** Yahoo uses the shared coin catalog with fixed USD amounts. */
export const YAHOO_STRIPE_PRODUCTS: readonly YahooStripeProduct[] = DEFAULT_PRODUCT_PRICING.map((product) => {
  /** Provides price behavior. */
  const price = product.regionalPrices.find(({currency}) => currency === "USD");
  /** Provides unit amount behavior. */
  const unitAmount = Math.round((price?.amount ?? 0) * 100);
  if (!price || !Number.isSafeInteger(unitAmount) || unitAmount <= 0) throw new Error("invalid-yahoo-stripe-catalog");
  return {
    productId: product.productId,
    name: product.name,
    description: product.description,
    coins: product.coins,
    currency: "usd",
    unitAmount,
  };
});

/** Resolves only products fixed in the server-owned Yahoo catalog. */
export function resolveYahooStripeProduct(productId: string): YahooStripeProduct {
  /** Provides product behavior. */
  const product = YAHOO_STRIPE_PRODUCTS.find((candidate) => candidate.productId === productId);
  if (!product) throw new Error("invalid-yahoo-stripe-product");
  return product;
}

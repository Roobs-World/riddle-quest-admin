import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import {createYahooStripeCheckout} from "../firebase";
import {toProductSummaries, type ProductSummary, type PurchaseResult} from "../play/types";

/** Yahoo Stripe exposes the shared consumable coin catalog. */
export const yahooStripeProducts: ProductSummary[] = toProductSummaries(cloneProductPricingCatalog()).map(
  (product) => ({...product, productType: "consumable"}),
);

/** Starts Stripe-hosted checkout; successful grants are confirmed after the browser returns. */
export async function purchaseYahooStripeProduct(productId: string): Promise<PurchaseResult> {
  if (!yahooStripeProducts.some((product) => product.productId === productId)) {
    throw new Error("Unknown Yahoo product.");
  }
  /** Provides result behavior. */
  const result = await createYahooStripeCheckout({productId, checkoutAttemptId: crypto.randomUUID()});
  /** Provides url behavior. */
  const url = new URL(result.data.checkoutUrl);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
    throw new Error("Stripe returned an invalid checkout URL.");
  }
  globalThis.location.assign(url.toString());
  return new Promise<PurchaseResult>(() => undefined);
}

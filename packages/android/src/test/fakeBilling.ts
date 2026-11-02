import type {GrantAndroidPurchaseOutput, SyncAndroidSubscriptionsOutput} from "@riddle-quest/hosted";
import type {AndroidPurchaseBackend} from "../billing/androidCommerce";
import type {PlayBillingPort, PlayCheckoutResult, PlayProduct, PlayPurchase} from "../billing/playBilling";
/** Coin pack used across billing scenarios. */
export const PACK_ID = "com.roobsworld.riddlequest.coinpack2";
/** Monthly Premium plan. */
export const MONTHLY_ID = "com.roobsworld.riddlequest.premium.monthly";
/** Yearly Premium plan. */
export const YEARLY_ID = "com.roobsworld.riddlequest.premium.yearly";
/** Priced in-app product. */
export const inapp = (productId: string, price = "£1.99"): PlayProduct => ({productId, type: "inapp", price, offerToken: null, billingPeriod: null});
/** Priced subscription plan. */
export const subs = (productId: string, billingPeriod = "P1M", price = "£9.99"): PlayProduct => ({
  productId,
  type: "subs",
  price,
  offerToken: `offer-${productId}`,
  billingPeriod,
});
/** Completed purchase. */
export const owned = (purchaseToken: string, productId: string, state: PlayPurchase["state"] = "purchased"): PlayPurchase => ({
  purchaseToken,
  products: [productId],
  state,
});
/** Scripted Play behaviour. */
export type BillingScript = {
  /** Products Play prices, or an Error to reject. */
  products?: PlayProduct[] | Error;
  /** Successive checkout results; an Error rejects that checkout. */
  checkouts?: (PlayCheckoutResult | Error)[];
  /** Owned purchases by type. */
  ownedInapp?: PlayPurchase[];
  /** Owned subscriptions. */
  ownedSubs?: PlayPurchase[];
};
/** Fake Play port that records every call. */
export function createFakeBilling(script: BillingScript = {}): PlayBillingPort & {calls: string[]} {
  /** Recorded calls. */
  const calls: string[] = [];
  return {
    calls,
    async getProducts(inappIds, subsIds) {
      calls.push(`getProducts:${inappIds.length}+${subsIds.length}`);
      if (script.products instanceof Error) throw script.products;
      return script.products ?? [];
    },
    async purchase(product, accountUid) {
      calls.push(`purchase:${product.productId}:${accountUid}`);
      /** Next checkout. */
      const next = script.checkouts?.shift();
      if (!next) return {status: "cancelled"};
      if (next instanceof Error) throw next;
      return next;
    },
    async getOwnedPurchases(type) {
      calls.push(`owned:${type}`);
      return (type === "inapp" ? script.ownedInapp : script.ownedSubs) ?? [];
    },
    async consume(token) {
      calls.push(`consume:${token}`);
    },
    async manageSubscription(productId) {
      calls.push(`manage:${productId}`);
    },
  };
}
/** Fake backend whose grant and sync results are scripted. */
export function createFakePurchaseBackend(options: {
  /** Grant result per token; missing tokens reject. */
  grants?: Record<string, Partial<GrantAndroidPurchaseOutput>>;
  /** Sync result. */
  sync?: Partial<SyncAndroidSubscriptionsOutput> | Error;
} = {}): AndroidPurchaseBackend & {calls: string[]} {
  /** Recorded calls. */
  const calls: string[] = [];
  /** Tokens already granted, as the backend ledger remembers them. */
  const granted = new Set<string>();
  return {
    calls,
    async grant({productId, purchaseToken}) {
      calls.push(`grant:${purchaseToken}`);
      /** Scripted grant. */
      const grant = options.grants?.[purchaseToken];
      if (!grant) throw new Error("purchase-not-found");
      /** Whether an earlier call granted this token. */
      const alreadyProcessed = granted.has(purchaseToken);
      granted.add(purchaseToken);
      return {granted: true, alreadyProcessed, productId, coinsAwarded: 550, newCoins: 850, newlyUnlockedAchievementIds: [], consumed: true, ...grant};
    },
    async syncSubscriptions(tokens) {
      calls.push(`sync:${tokens.join(",")}`);
      if (options.sync instanceof Error) throw options.sync;
      return {verified: true, activeSkus: [], premiumCoinsAwarded: 0, newCoins: 300, ...options.sync};
    },
  };
}

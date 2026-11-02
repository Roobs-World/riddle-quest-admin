import type {
  GrantAndroidPurchaseInput,
  GrantAndroidPurchaseOutput,
  SyncAndroidSubscriptionsOutput,
} from "@riddle-quest/hosted";
import {ANDROID_COIN_PACKS} from "./catalog";
import type {PlayBillingPort, PlayProduct, PlayPurchase} from "./playBilling";
/** Server-authoritative purchase callables. */
export type AndroidPurchaseBackend = Readonly<{
  /** Verifies one coin purchase with Play and grants it exactly once. */
  grant(input: GrantAndroidPurchaseInput): Promise<GrantAndroidPurchaseOutput>;
  /** Verifies the given subscription tokens with Play and mirrors Premium onto the account. */
  syncSubscriptions(purchaseTokens: string[]): Promise<SyncAndroidSubscriptionsOutput>;
}>;
/** Outcome of one checkout. */
export type CheckoutOutcome =
  | {
      /** Coins were granted. */
      kind: "coins";
      /** Coins this checkout added. */
      coinsAwarded: number;
      /** Confirmed balance. */
      newCoins: number;
    }
  | {
      /** A subscription was verified. */
      kind: "premium";
      /** Subscriptions now active. */
      activeSkus: readonly string[];
      /** Premium coins granted by the verification. */
      premiumCoinsAwarded: number;
      /** Confirmed balance. */
      newCoins: number;
    }
  | {
      /** Play is waiting for the payment to clear. */
      kind: "pending";
    }
  | {
      /** The player closed the checkout. */
      kind: "cancelled";
    };
/** Outcome of restoring owned purchases. */
export type RestoreOutcome = Readonly<{
  /** Coins granted for purchases that had not been granted yet. */
  coinsAwarded: number;
  /** Subscriptions now active. */
  activeSkus: readonly string[];
  /** Confirmed balance, when the backend reported one. */
  newCoins: number | null;
}>;
/** Shop operations over Play and the backend. */
export type AndroidCommerce = Readonly<{
  /** Runs Play's checkout for a product and settles it with the backend. */
  checkout(product: PlayProduct, accountUid: string): Promise<CheckoutOutcome>;
  /** Grants owned coin purchases that were never settled and re-verifies subscriptions. */
  restore(): Promise<RestoreOutcome>;
  /** Re-verifies subscriptions only. */
  syncSubscriptions(): Promise<SyncAndroidSubscriptionsOutput>;
}>;
/** Coin products the backend can grant. */
const COIN_PRODUCT_IDS = new Set(ANDROID_COIN_PACKS.map((pack) => pack.productId));
/** Most subscription tokens the backend verifies per call. */
const MAX_SUBSCRIPTION_TOKENS = 8;
/**
 * Creates the Android shop flow.
 *
 * @remarks
 * Play only reports purchases; coins and Premium come from the backend, which
 * verifies every token with the Play Developer API. A purchase interrupted
 * between checkout and grant stays owned by the Play account, so {@link
 * AndroidCommerce.restore} on launch settles it. The backend consumes granted
 * tokens; the app consumes only when the backend reports that it could not.
 */
export function createAndroidCommerce(billing: PlayBillingPort, backend: AndroidPurchaseBackend): AndroidCommerce {
  /** Grants every completed coin purchase in a list. */
  const grantCoins = async (purchases: readonly PlayPurchase[]): Promise<{coinsAwarded: number; newCoins: number | null}> => {
    /** Coins newly granted. */
    let coinsAwarded = 0;
    /** Latest confirmed balance. */
    let newCoins: number | null = null;
    for (const purchase of purchases) {
      if (purchase.state !== "purchased") continue;
      /** Coin product the purchase covers. */
      const productId = purchase.products.find((id) => COIN_PRODUCT_IDS.has(id));
      if (!productId) continue;
      /** Backend settlement. */
      const grant = await backend.grant({productId, purchaseToken: purchase.purchaseToken});
      if (!grant.alreadyProcessed) coinsAwarded += grant.coinsAwarded;
      newCoins = grant.newCoins;
      if (!grant.consumed) await billing.consume(purchase.purchaseToken).catch(() => undefined);
    }
    return {coinsAwarded, newCoins};
  };
  /** Verifies the subscriptions the Play account owns. */
  const syncSubscriptions = async (): Promise<SyncAndroidSubscriptionsOutput> => {
    /** Owned, completed subscription purchases. */
    const owned = (await billing.getOwnedPurchases("subs")).filter((purchase) => purchase.state === "purchased");
    return backend.syncSubscriptions(owned.slice(0, MAX_SUBSCRIPTION_TOKENS).map((purchase) => purchase.purchaseToken));
  };
  return {
    async checkout(product, accountUid) {
      /** Play's checkout result. */
      const result = await billing.purchase(product, accountUid);
      if (result.status !== "purchased") return {kind: result.status};
      if (product.type === "subs") {
        /** Verified subscription state. */
        const synced = await syncSubscriptions();
        return {kind: "premium", activeSkus: synced.activeSkus, premiumCoinsAwarded: synced.premiumCoinsAwarded, newCoins: synced.newCoins};
      }
      /** Coins granted for this checkout. */
      const granted = await grantCoins(result.purchases);
      if (granted.newCoins === null) throw new Error("purchase-not-granted");
      return {kind: "coins", coinsAwarded: granted.coinsAwarded, newCoins: granted.newCoins};
    },
    async restore() {
      /** Coins for unsettled purchases. */
      const coins = await grantCoins(await billing.getOwnedPurchases("inapp"));
      /** Subscription state. */
      const synced = await syncSubscriptions();
      return {coinsAwarded: coins.coinsAwarded, activeSkus: synced.activeSkus, newCoins: synced.newCoins};
    },
    syncSubscriptions,
  };
}

import type {
  GrantAndroidPurchaseInput,
  GrantAndroidPurchaseOutput,
  SyncAndroidSubscriptionsOutput,
} from "../hosted/androidAccountFunctions";
import {ANDROID_COIN_PACKS} from "./playCatalog";
import type {PlayBillingPort, PlayProduct, PlayPurchase} from "./playBillingTypes";
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
  /** Owned coin purchases that could not be verified and remain unconsumed. */
  failedPurchases: number;
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
export function createAndroidCommerce(billing: PlayBillingPort, backend: AndroidPurchaseBackend, options: {
  /** Requires a recoverable account still owning this checkout immediately before Play opens. */
  canCheckout: (accountUid: string) => boolean;
}): AndroidCommerce {
  /** Grants every completed coin purchase in a list. */
  const grantCoins = async (purchases: readonly PlayPurchase[], continueOnFailure = false): Promise<{
  /** Stores coins awarded. */
  coinsAwarded: number;
  /** Stores new coins. */
  newCoins: number | null;
  /** Stores failed purchases. */
  failedPurchases: number}> => {
    /** Retains failed purchases for this operation. */
    let failedPurchases = 0;
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
      try {
        /** Retains grant for this operation. */
        const grant = await backend.grant({productId, purchaseToken: purchase.purchaseToken});
        if (!grant.alreadyProcessed) coinsAwarded += grant.coinsAwarded;
        newCoins = grant.newCoins;
        if (!grant.consumed) await billing.consume(purchase.purchaseToken).catch(() => undefined);
      } catch (error) {
        if (!continueOnFailure) throw error;
        failedPurchases++;
      }
    }
    return {coinsAwarded, newCoins, failedPurchases};
  };
  /** Verifies the subscriptions the Play account owns. */
  const syncSubscriptions = async (fresh: readonly PlayPurchase[] = []): Promise<SyncAndroidSubscriptionsOutput> => {
    /** Owned, completed subscription purchases. */
    const owned = [...fresh, ...await billing.getOwnedPurchases("subs")].filter((purchase) => purchase.state === "purchased");
    /** Retains tokens for this operation. */
    const tokens = [...new Set(owned.map(purchase => purchase.purchaseToken))];
    return backend.syncSubscriptions(tokens.slice(0, MAX_SUBSCRIPTION_TOKENS));
  };
  /** Retains operations for this operation. */
  const operations: AndroidCommerce = {
    /** Retains checkout for this operation. */
    async checkout(product, accountUid) {
      if (!options.canCheckout(accountUid)) throw new Error("recoverable-account-required");
      /** Play's checkout result. */
      const result = await billing.purchase(product, accountUid);
      if (result.status !== "purchased") return {kind: result.status};
      if (product.type === "subs") {
        /** Verified subscription state. */
        const synced = await syncSubscriptions(result.purchases);
        return {kind: "premium", activeSkus: synced.activeSkus, premiumCoinsAwarded: synced.premiumCoinsAwarded, newCoins: synced.newCoins};
      }
      /** Coins granted for this checkout. */
      const granted = await grantCoins(result.purchases);
      if (granted.newCoins === null) throw new Error("purchase-not-granted");
      return {kind: "coins", coinsAwarded: granted.coinsAwarded, newCoins: granted.newCoins};
    },
    /** Retains restore for this operation. */
    async restore() {
      /** Coins for unsettled purchases. */
      const coins = await grantCoins(await billing.getOwnedPurchases("inapp"), true);
      /** Subscription state. */
      const synced = await syncSubscriptions();
      return {coinsAwarded: coins.coinsAwarded, failedPurchases: coins.failedPurchases, activeSkus: synced.activeSkus, newCoins: synced.newCoins};
    },
    syncSubscriptions,
  };
  /** Retains tail for this operation. */
  let tail: Promise<unknown> = Promise.resolve();
  /** Retains serialize for this operation. */
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    /** Retains result for this operation. */
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
  return {
    checkout: (product, accountUid) => serialize(() => operations.checkout(product, accountUid)),
    restore: () => serialize(() => operations.restore()),
    syncSubscriptions: () => serialize(() => operations.syncSubscriptions()),
  };
}

import {httpsCallable, type Functions} from "firebase/functions";

/** Response of `provisionAndroidAccount`. */
export type ProvisionAndroidAccountOutput = {
  /** Firebase uid owning the Global Game Account. */
  uid: string;
  /** Whether the call created the account. */
  created: boolean;
  /** Confirmed coin balance. */
  coins: number;
};

/** Request of `grantAndroidPurchase`. */
export type GrantAndroidPurchaseInput = {
  /** Play in-app product id. */
  productId: string;
  /** Play purchase token. */
  purchaseToken: string;
};
/** Response of `grantAndroidPurchase`. */
export type GrantAndroidPurchaseOutput = {
  /** The token is granted. */
  granted: true;
  /** An earlier call already granted this token. */
  alreadyProcessed: boolean;
  /** Product the coins were granted for. */
  productId: string;
  /** Coins the product grants. */
  coinsAwarded: number;
  /** Confirmed balance after the grant. */
  newCoins: number;
  /** Achievements this grant unlocked. */
  newlyUnlockedAchievementIds: string[];
  /** Whether Play confirmed consumption; when false the app consumes the token itself. */
  consumed: boolean;
};
/** Request of `syncAndroidSubscriptions`. */
export type SyncAndroidSubscriptionsInput = {
  /** Subscription purchase tokens the device's Play account owns. */
  purchaseTokens: string[];
};
/** Response of `syncAndroidSubscriptions`. */
export type SyncAndroidSubscriptionsOutput = {
  /** The tokens were verified with Play. */
  verified: true;
  /** Subscription products currently entitling the account. */
  activeSkus: string[];
  /** Premium coins this sync granted. */
  premiumCoinsAwarded: number;
  /** Confirmed balance after the sync. */
  newCoins: number;
};

/** Callables only the Android app binds; web targets never declare them. */
export function createAndroidAccountFunctions(gameplay: Functions) {
  /** Creates the Global Game Account for an Android Firebase identity. */
  const provisionAndroidAccount = httpsCallable<Record<string, never> | undefined, ProvisionAndroidAccountOutput>(
    gameplay,
    "provisionAndroidAccount",
  );
  /** Verifies a Google Play coin purchase and grants it exactly once. */
  const grantAndroidPurchase = httpsCallable<GrantAndroidPurchaseInput, GrantAndroidPurchaseOutput>(
    gameplay,
    "grantAndroidPurchase",
  );
  /** Mirrors the device's verified Google Play subscriptions onto the account. */
  const syncAndroidSubscriptions = httpsCallable<SyncAndroidSubscriptionsInput, SyncAndroidSubscriptionsOutput>(
    gameplay,
    "syncAndroidSubscriptions",
  );
  return {provisionAndroidAccount, grantAndroidPurchase, syncAndroidSubscriptions};
}
/** Android-only callable surface returned by {@link createAndroidAccountFunctions}. */
export type AndroidAccountFunctions = ReturnType<typeof createAndroidAccountFunctions>;

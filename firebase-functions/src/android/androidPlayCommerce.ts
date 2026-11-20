import {FieldValue, type Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../shared/constants";
import {
  ANDROID_COIN_PRODUCTS,
  androidPlayAccountId,
  androidPurchaseGrantId,
} from "./androidPlayCatalog";
import {PlayPurchaseNotFoundError, type PlayDeveloperApi} from "./playDeveloperApi";

/** Request of `grantAndroidPurchase`. */
export type GrantAndroidPurchaseInput = {
  /** Play in-app product id. */
  productId: string;
  /** Play purchase token returned by the Billing Library. */
  purchaseToken: string;
};

/** Response of `grantAndroidPurchase`. */
export type GrantAndroidPurchaseOutput = {
  /** The token is granted, now or by an earlier call. */
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
  /** Subscription purchase tokens the device's Play account currently owns. */
  purchaseTokens: string[];
};

/** Response of `syncAndroidSubscriptions`. */
export type SyncAndroidSubscriptionsOutput = {
  /** The tokens were verified with Play. */
  verified: true;
  /** Subscription products currently entitling this account. */
  activeSkus: string[];
  /** Premium coins this sync granted. */
  premiumCoinsAwarded: number;
  /** Confirmed balance after the sync. */
  newCoins: number;
};

/** Collaborators shared by the Android commerce handlers. */
export type AndroidCommerceDependencies = Readonly<{
  /** Firestore holding Global Game Accounts. */
  firestore: Firestore;
  /** Play Developer API client. */
  play: PlayDeveloperApi;
  /** Server clock. */
  now?: () => number;
}>;

/** Upper bounds that keep callable payloads small. */
export const ANDROID_COMMERCE_LIMITS = Object.freeze({productId: 128, purchaseToken: 4_096, subscriptionTokens: 8});

/** Returns whether a value is a non-empty string within a byte bound. */
const isBoundedString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= max;

/** Validates the grant request. */
export function parseGrantAndroidPurchaseInput(data: unknown): GrantAndroidPurchaseInput {
  /** Untrusted request body. */
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (!isBoundedString(body.productId, ANDROID_COMMERCE_LIMITS.productId)
    || !isBoundedString(body.purchaseToken, ANDROID_COMMERCE_LIMITS.purchaseToken)) {
    throw new HttpsError("invalid-argument", "productId and purchaseToken are required.");
  }
  if (!Object.hasOwn(ANDROID_COIN_PRODUCTS, body.productId)) throw new HttpsError("invalid-argument", "Unknown product.");
  return {productId: body.productId, purchaseToken: body.purchaseToken};
}

/** Validates the subscription sync request. */
export function parseSyncAndroidSubscriptionsInput(data: unknown): SyncAndroidSubscriptionsInput {
  /** Untrusted request body. */
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  /** Untrusted token list. */
  const tokens = body.purchaseTokens;
  if (!Array.isArray(tokens) || tokens.length > ANDROID_COMMERCE_LIMITS.subscriptionTokens
    || !tokens.every((token) => isBoundedString(token, ANDROID_COMMERCE_LIMITS.purchaseToken))) {
    throw new HttpsError("invalid-argument", "purchaseTokens must be a short list of tokens.");
  }
  return {purchaseTokens: [...new Set(tokens as string[])]};
}

/** Reads the stored coin balance. */
const coinsOf = (user: Record<string, unknown> | undefined): number =>
  typeof user?.coins === "number" && Number.isFinite(user.coins) ? user.coins : 0;

/**
 * Verifies one Play in-app purchase and grants its coins exactly once.
 *
 * @remarks
 * Play is the only source of truth for the purchase: the token must be in the
 * purchased state, bound to this account through `obfuscatedAccountId`, and
 * not already consumed outside this ledger. The grant and its replay record
 * commit in one transaction; consumption follows and is retried by later calls
 * for the same token until Play confirms it.
 */
export async function grantAndroidPlayPurchase(
  {firestore, play, now = Date.now}: AndroidCommerceDependencies,
  uid: string,
  {productId, purchaseToken}: GrantAndroidPurchaseInput,
): Promise<GrantAndroidPurchaseOutput> {
  /** Coins the product grants. */
  const coins = ANDROID_COIN_PRODUCTS[productId];
  /** Play's view of the purchase. */
  const purchase = await play.getProductPurchase(productId, purchaseToken).catch((error: unknown) => {
    if (error instanceof PlayPurchaseNotFoundError) throw new HttpsError("failed-precondition", "purchase-not-found");
    throw new HttpsError("unavailable", "play-api-unavailable");
  });
  if (purchase.productId !== undefined && purchase.productId !== productId) {
    throw new HttpsError("invalid-argument", "purchase-product-mismatch");
  }
  if (purchase.purchaseState === 2) throw new HttpsError("failed-precondition", "purchase-pending");
  if (purchase.purchaseState !== 0) throw new HttpsError("failed-precondition", "purchase-not-completed");
  if (purchase.obfuscatedExternalAccountId !== androidPlayAccountId(uid)) {
    throw new HttpsError("permission-denied", "purchase-account-mismatch");
  }
  /** Replay record for the token. */
  const grantRef = firestore.collection("androidPurchaseGrants").doc(androidPurchaseGrantId(purchaseToken));
  /** Account document. */
  const userRef = firestore.collection("users").doc(uid);
  /** Response fields decided inside the transaction. */
  const outcome = await firestore.runTransaction(async (transaction) => {
    /** Current replay record and account. */
    const [grant, userSnapshot] = await Promise.all([transaction.get(grantRef), transaction.get(userRef)]);
    if (!userSnapshot.exists) throw new HttpsError("failed-precondition", "account-missing");
    /** Account data. */
    const user = userSnapshot.data() ?? {};
    if (grant.exists) {
      if (grant.get("uid") !== uid) throw new HttpsError("permission-denied", "purchase-account-mismatch");
      return {alreadyProcessed: true, newCoins: coinsOf(user), newlyUnlockedAchievementIds: [] as string[]};
    }
    if (purchase.consumptionState === 1) throw new HttpsError("failed-precondition", "purchase-already-consumed");
    /** Achievements already unlocked. */
    const unlocked: unknown[] = Array.isArray(user.unlockedAchievements) ? user.unlockedAchievements : [];
    /** Whether this is the account's first purchase. */
    const firstPurchase = !unlocked.some(
      (achievement) => typeof achievement === "object" && achievement !== null
        && (achievement as {
        /** Stores achievement id. */
        achievementId?: unknown}).achievementId === "first_purchase",
    );
    /** Grant time. */
    const at = now();
    /** Balance after coins and any achievement bonus. */
    const newCoins = coinsOf(user) + coins + (firstPurchase ? ACHIEVEMENT_UNLOCK_COIN_REWARD : 0);
    transaction.update(userRef, {
      coins: newCoins,
      hasPurchasedApp: true,
      lastLogin: at,
      ...(firstPurchase ? {unlockedAchievements: [...unlocked, {achievementId: "first_purchase", unlockedAt: at}]} : {}),
    });
    transaction.create(grantRef, {
      uid,
      productId,
      coins,
      orderId: typeof purchase.orderId === "string" ? purchase.orderId : null,
      testPurchase: purchase.purchaseType === 0,
      grantedAt: FieldValue.serverTimestamp(),
    });
    return {alreadyProcessed: false, newCoins, newlyUnlockedAchievementIds: firstPurchase ? ["first_purchase"] : []};
  });
  /** Whether Play now records the token as consumed. */
  let consumed = purchase.consumptionState === 1;
  if (!consumed) {
    consumed = await play.consumeProductPurchase(productId, purchaseToken).then(() => true, () => false);
  }
  return {granted: true, productId, coinsAwarded: coins, consumed, ...outcome};
}

/** Public subscription API remains stable while its receipts are owned by the server registry. */
export {entitledSubscriptionSkus, syncAndroidPlaySubscriptions} from "./androidSubscriptionRegistry";

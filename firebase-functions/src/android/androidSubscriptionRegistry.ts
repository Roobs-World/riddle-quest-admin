import {FieldValue} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {resolvePremiumCoinGrant} from "../jest/jestProductCatalog";
import {ANDROID_SUBSCRIPTIONS, androidPlayAccountId} from "./androidPlayCatalog";
import {isAndroidAccountProvider} from "./androidUser";
import {PlayPurchaseNotFoundError, type PlaySubscriptionPurchase} from "./playDeveloperApi";
import type {
  AndroidCommerceDependencies,
  SyncAndroidSubscriptionsInput,
  SyncAndroidSubscriptionsOutput,
} from "./androidPlayCommerce";

/** One account can retain a bounded set of renewable or recoverable Play receipts. */
export const MAX_ANDROID_SUBSCRIPTION_TOKENS = 16;
/** Registry version changes with every authoritative observation, including token retirement. */
const Registry = z.object({
  version: z.number().int().nonnegative().safe(),
  purchaseTokens: z.array(z.string().min(1).max(4096)).max(MAX_ANDROID_SUBSCRIPTION_TOKENS),
});
/** Subscriptions that currently entitle a player until the verified item expiry. */
const ENTITLED = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);
/** Known terminal states cannot resume or renew; their raw tokens need not be retained. */
const TERMINAL = new Set(["SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"]);
/** Parses only server-owned registry fields; absence represents a pre-registry account. */
function registry(value: unknown): z.infer<typeof Registry> {
  if (value === undefined) return {version: 0, purchaseTokens: []};
  /** Validated canonical profile or registry, before any provider-specific grant. */
  const parsed = Registry.safeParse(value);
  if (!parsed.success) throw new HttpsError("data-loss", "Invalid Android subscription registry.");
  return parsed.data;
}
/** Resolves entitlement only from Play's account binding, lifecycle state and line-item expiry. */
export function entitledSubscriptionSkus(subscription: PlaySubscriptionPurchase, uid: string, nowMs: number): string[] {
  if (
    subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId !== androidPlayAccountId(uid) ||
    !ENTITLED.has(subscription.subscriptionState ?? "")
  )
    return [];
  return (subscription.lineItems ?? []).flatMap((item) =>
    typeof item.productId === "string" &&
    Object.hasOwn(ANDROID_SUBSCRIPTIONS, item.productId) &&
    Date.parse(item.expiryTime ?? "") > nowMs
      ? [item.productId]
      : [],
  );
}
/** Keeps recoverable held/paused receipts without preserving permanently expired subscriptions. */
function retainSubscription(subscription: PlaySubscriptionPurchase, uid: string, nowMs: number): boolean {
  if (
    subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId !== androidPlayAccountId(uid) ||
    TERMINAL.has(subscription.subscriptionState ?? "")
  )
    return false;
  if (
    !(subscription.lineItems ?? []).some(
      (item) => typeof item.productId === "string" && Object.hasOwn(ANDROID_SUBSCRIPTIONS, item.productId),
    )
  )
    return false;
  return (
    subscription.subscriptionState !== "SUBSCRIPTION_STATE_CANCELED" ||
    entitledSubscriptionSkus(subscription, uid, nowMs).length > 0
  );
}
/** Verifies the account's stored receipts as well as additions supplied by this device. */
export async function syncAndroidPlaySubscriptions(
  {firestore, play, now = Date.now}: AndroidCommerceDependencies,
  uid: string,
  {purchaseTokens}: SyncAndroidSubscriptionsInput,
): Promise<SyncAndroidSubscriptionsOutput> {
  /** Canonical account reference used for the balance and identity transaction. */
  const userRef = firestore.collection("users").doc(uid),
    registryRef = firestore.collection("androidCommerceAccounts").doc(uid);
  // External Play reads never run inside a Firestore transaction. A changed registry
  // restarts verification before this observation can change Premium or its coin cadence.
  for (let attempt = 0; attempt < 4; attempt++) {
    /** Frozen server registry revision whose external Play observations are being verified. */
    const original = await firestore.runTransaction(async (tx) => {
      /** Canonical account and private subscription registry read before projection. */
      const [account, subscriptions] = await Promise.all([tx.get(userRef), tx.get(registryRef)]);
      if (!account.exists) throw new HttpsError("failed-precondition", "account-missing");
      if (!isAndroidAccountProvider(account.get("androidProvider")))
        throw new HttpsError("permission-denied", "Android account required.");
      return registry(subscriptions.data());
    });
    /** Trusted server time for this Play entitlement observation. */
    const at = now(),
      active = new Set<string>(),
      retained: string[] = [];
    /** Bounded union of server-stored receipts and this device's additions. */
    const candidates = [...new Set([...original.purchaseTokens, ...purchaseTokens])];
    /** Whether Play confirmed at least one receipt belongs to this game account. */
    let verifiedBoundReceipt = false;
    for (const token of candidates) {
      /** OS lifecycle listener or current verified Play receipt. */
      const subscription = await play.getSubscriptionPurchase(token).catch((error: unknown) => {
        if (error instanceof PlayPurchaseNotFoundError) return null;
        throw new HttpsError("unavailable", "play-api-unavailable");
      });
      if (
        !subscription ||
        subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId !== androidPlayAccountId(uid)
      )
        continue;
      verifiedBoundReceipt = true;
      if (retainSubscription(subscription, uid, at)) retained.push(token);
      for (const sku of entitledSubscriptionSkus(subscription, uid, at)) {
        active.add(sku);
        if (subscription.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING")
          await play.acknowledgeSubscription(sku, token).catch(() => undefined);
      }
    }
    if (retained.length > MAX_ANDROID_SUBSCRIPTION_TOKENS)
      throw new HttpsError("resource-exhausted", "Too many active subscription receipts.");
    /** Sorted catalog products currently entitled by verified Play receipts. */
    const activeSkus = [...active].sort();
    /** Authoritative operation result retained after its transaction commits. */
    const result = await firestore.runTransaction(async (tx) => {
      /** Canonical account and private subscription registry read before projection. */
      const [account, subscriptions] = await Promise.all([tx.get(userRef), tx.get(registryRef)]);
      if (!account.exists) throw new HttpsError("failed-precondition", "account-missing");
      /** Current canonical account state used to project Premium and its coin cadence. */
      const user = account.data() ?? {},
        current = registry(subscriptions.data());
      if (!isAndroidAccountProvider(user.androidProvider))
        throw new HttpsError("permission-denied", "Android account required.");
      if (current.version !== original.version) return null;
      /** Current confirmed coin balance; local receipt lists cannot increase it. */
      const balance =
        typeof user.coins === "number" && Number.isSafeInteger(user.coins) && user.coins >= 0 ? user.coins : null;
      if (balance === null) throw new HttpsError("data-loss", "Invalid coin balance.");
      // Older releases did not keep receipt tokens. An empty second device cannot
      // revoke their confirmed flag or manufacture another Premium coin grant.
      /** Pre-registry account whose empty device snapshot cannot prove expiry. */
      const legacyUnknown = !subscriptions.exists && !verifiedBoundReceipt && !candidates.length;
      if (legacyUnknown) {
        /** Previously confirmed Android Premium projection used only for compatibility display. */
        const prior = z.looseObject({activeSkus: z.array(z.string())}).safeParse(user.androidSubscriptions);
        /** Known catalog entitlements preserved without manufacturing a fresh coin grant. */
        const legacySkus =
          user.hasActiveSubscription === true && prior.success
            ? prior.data.activeSkus.filter((sku) => Object.hasOwn(ANDROID_SUBSCRIPTIONS, sku))
            : [];
        return {verified: true as const, activeSkus: legacySkus, premiumCoinsAwarded: 0, newCoins: balance};
      }
      /** Once-per-30-day coin amount calculated from current committed account authority. */
      const premiumCoinsAwarded = resolvePremiumCoinGrant(activeSkus.length > 0, user.premiumCoinsGrantedAt, at),
        newCoins = balance + premiumCoinsAwarded;
      if (!Number.isSafeInteger(newCoins) || !Number.isSafeInteger(current.version + 1))
        throw new HttpsError("data-loss", "Invalid subscription balance or version.");
      tx.set(registryRef, {
        version: current.version + 1,
        purchaseTokens: retained,
        verifiedAt: FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        hasActiveSubscription: activeSkus.length > 0,
        androidSubscriptions: {activeSkus, verifiedAt: FieldValue.serverTimestamp()},
        lastLogin: at,
        ...(premiumCoinsAwarded > 0 ? {coins: newCoins, premiumCoinsGrantedAt: at} : {}),
      });
      return {verified: true as const, activeSkus, premiumCoinsAwarded, newCoins};
    });
    if (result) return result;
  }
  throw new HttpsError("aborted", "subscription-state-changed-retry");
}

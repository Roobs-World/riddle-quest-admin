import type {JestBackendPort} from "./backend";
import type {JestPlatformPort} from "./types";
import type {JestPurchaseCoordinator} from "./purchases";
import {captureBrowserException} from "../../../../src/web/observability/browserErrorReporter";

/** Dependencies and account scope required for a serialized subscription checkout. */
type SubscriptionCheckoutOptions = {
  /** Jest SDK adapter owning checkout and wallet reads. */
  platform: JestPlatformPort;
  /** Verifies signed provider holdings and purchase results. */
  backend: JestBackendPort;
  /** Requested subscription from the current provider catalog. */
  subscriptionSku: string;
  /** Provider identity used to scope cross-tab exclusion. */
  playerId: string;
  /** Refreshes the signed catalog and hides already-owned alternatives. */
  getSubscriptions: () => ReturnType<JestPurchaseCoordinator["getSubscriptions"]>;
};

/** Reads current holdings after acquiring the cross-tab checkout lock. */
async function subscribeWithPreflight({
  platform,
  backend,
  subscriptionSku,
  playerId,
  getSubscriptions,
}: SubscriptionCheckoutOptions): ReturnType<JestPurchaseCoordinator["subscribe"]> {
  /** Verified holdings refreshed inside the cross-tab checkout lock. */
  const catalog = await getSubscriptions();
  if (catalog.status !== "success") return catalog;
  /** Requested offer after existing equivalent holdings have been excluded. */
  const offer = catalog.value.find((subscription) => subscription.productId === subscriptionSku);
  if (!offer || offer.subscriptionStatus === "active") return {status: "cancelled"};
  /** Provider checkout outcome, including cancellation and already-subscribed recovery. */
  const started = await platform.beginSubscription(subscriptionSku);
  if (started.status !== "success") {
    if (started.status !== "unavailable" || started.message !== "already_subscribed") return started;
    /** Latest signed holdings used when checkout reports an existing subscription. */
    const refreshed = await platform.getSubscriptions();
    if (refreshed.status !== "success") return refreshed;
    try {
      /** Backend confirmation of an existing holding recovered from the provider. */
      const verified = await backend.syncSubscriptions(refreshed.value.subscriptionsSigned, playerId);
      return verified.activeSkus.includes(subscriptionSku)
        ? {
            status: "success",
            value: {
              activeSku: subscriptionSku,
              blockedSkus: verified.blockedSkus ?? [],
              premiumCoinsAwarded: verified.premiumCoinsAwarded ?? 0,
              newCoins: verified.newCoins,
              recoveredExistingSubscription: true,
              ...(refreshed.value.subscriptions.some((subscription) =>
                subscription.sku === subscriptionSku && subscription.sandbox === true) ? {sandbox: true} : {}),
            },
          }
        : started;
    } catch (error) {
      captureBrowserException(error, {component: "jest_purchases", operation: "refresh_subscription"});
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
  }
  try {
    /** Backend confirmation of the entitlement returned by successful checkout. */
    const verified = await backend.syncSubscriptions(started.value.subscriptionSigned, playerId);
    if (!verified.activeSkus.includes(subscriptionSku)) {
      return {status: "terminal-failure", message: "Subscription entitlement was not active"};
    }
    return {
      status: "success",
      value: {
        activeSku: subscriptionSku,
        blockedSkus: verified.blockedSkus ?? [],
        premiumCoinsAwarded: verified.premiumCoinsAwarded ?? 0,
        newCoins: verified.newCoins,
        ...(started.value.subscription.sandbox === true ? {sandbox: true} : {}),
      },
    };
  } catch (error) {
    captureBrowserException(error, {component: "jest_purchases", operation: "subscribe"});
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  }
}

/** Serializes subscription billing across tabs for this provider identity. */
export async function checkoutSubscription(options: SubscriptionCheckoutOptions): ReturnType<JestPurchaseCoordinator["subscribe"]> {
  /** Browser lock manager required to exclude simultaneous checkout in another tab. */
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return {status: "cancelled"};
  return locks.request(
    `riddle-quest:jest-subscription:${options.playerId}`,
    {mode: "exclusive", ifAvailable: true},
    (lock) => lock
      ? subscribeWithPreflight(options)
      : Promise.resolve({status: "cancelled"} as const),
  );
}

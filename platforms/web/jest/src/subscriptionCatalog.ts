import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import type {ProductSummary} from "../../../../src/platform/contracts/hostServices";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {priceLocale} from "./priceLocale";

const isCurrency = (value: string) => /^[A-Z]{3}$/.test(value);

/** Subscription verification and presentation are needed only for the subscription catalog. */
export async function loadSubscriptionCatalog({platform, backend, playerId, locale}: {
  platform: JestPlatformPort;
  backend: JestBackendPort;
  playerId: string;
  locale?: string;
}): Promise<PlatformResult<ProductSummary[]>> {
  /** Provides result behavior. */
  const result = await platform.getSubscriptions();
  if (result.status !== "success") return result;
  if (typeof result.value.subscriptionsSigned !== "string") {
    return {status: "retryable-failure", message: "Jest returned unsigned subscription data"};
  }
  /** Provides active skus behavior. */
  let activeSkus: Set<string>;
  /** Provides blocked skus behavior. */
  let blockedSkus: Set<string>;
  try {
    /** Provides verified behavior. */
    const verified = await backend.syncSubscriptions(result.value.subscriptionsSigned, playerId);
    activeSkus = new Set(verified.activeSkus);
    blockedSkus = new Set(verified.blockedSkus ?? []);
  } catch (error) {
    captureBrowserException(error, {component: "jest_purchases", operation: "sync_subscriptions"});
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  }
  /** Any existing holding suppresses alternative offers for the same Premium entitlement. */
  const hasActiveSubscription = activeSkus.size > 0 || result.value.subscriptions.some((entry) =>
    entry.status === "active");
  return {
    status: "success",
    value: result.value.subscriptions.flatMap((subscription) => {
      // SDK state can suppress a sale; only the backend grants paid access.
      /** Suppresses checkout when either source reports an existing holding. */
      const active = activeSkus.has(subscription.sku) || subscription.status === "active";
      if (!active && (hasActiveSubscription || blockedSkus.has(subscription.sku))) return [];
      if (
        !Number.isFinite(subscription.price) ||
        !isCurrency(subscription.currency) ||
        !["weekly", "monthly", "yearly"].includes(subscription.billingPeriod)
      ) {
        return [];
      }
      return [
        {
          productId: subscription.sku,
          productType: "subscription" as const,
          name: subscription.displayName,
          description: subscription.displayDescription ?? "",
          coins: 0,
          displayPrice: new Intl.NumberFormat(priceLocale(locale), {
            style: "currency",
            currency: subscription.currency,
          }).format(subscription.price),
          price: subscription.price,
          currency: subscription.currency,
          billingPeriod: subscription.billingPeriod,
          subscriptionStatus: active ? "active" as const : "inactive" as const,
          trialEligible: !active && subscription.trialEligible,
        },
      ];
    }),
  };
}

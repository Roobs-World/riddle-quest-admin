import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import {DEFAULT_PRODUCT_PRICING} from "@qwordly/core/pricing/catalog";
import type {ProductSummary} from "../play/types";

const isCurrency = (value: string) => /^[A-Z]{3}$/.test(value);

export class JestPurchaseCoordinator {
  private readonly platform: JestPlatformPort;
  private readonly backend: JestBackendPort;

  constructor(platform: JestPlatformPort, backend: JestBackendPort) {
    this.platform = platform;
    this.backend = backend;
  }

  async getProducts(locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    const result = await this.platform.getProducts();
    if (result.status !== "success") return result;
    const localCatalog = new Map(DEFAULT_PRODUCT_PRICING.map((product) => [product.productId, product]));
    return {
      status: "success",
      value: result.value.flatMap((product) => {
        const local = localCatalog.get(product.sku);
        if (!local || !Number.isFinite(product.price) || !isCurrency(product.currency)) return [];
        return [{
          productId: product.sku,
          name: product.name || local.name,
          description: product.description || local.description,
          coins: local.coins,
          displayPrice: new Intl.NumberFormat(locale, {
            style: "currency",
            currency: product.currency,
          }).format(product.price),
          price: product.price,
          currency: product.currency,
          featuredBadge: local.featuredBadge,
        }];
      }),
    };
  }

  async getSubscriptions(playerId: string, locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    const result = await this.platform.getSubscriptions();
    if (result.status !== "success") return result;
    if (typeof result.value.subscriptionsSigned !== "string") {
      return {status: "retryable-failure", message: "Jest returned unsigned subscription data"};
    }
    let activeSkus: Set<string>;
    let blockedSkus: Set<string>;
    try {
      const verified = await this.backend.syncSubscriptions(result.value.subscriptionsSigned, playerId);
      activeSkus = new Set(verified.activeSkus);
      blockedSkus = new Set(verified.blockedSkus ?? []);
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
    return {
      status: "success",
      value: result.value.subscriptions.flatMap((subscription) => {
        if (blockedSkus.has(subscription.sku)) return [];
        if (
          !Number.isFinite(subscription.price) ||
          !isCurrency(subscription.currency) ||
          !["weekly", "monthly", "yearly"].includes(subscription.billingPeriod)
        ) {
          return [];
        }
        return [{
          productId: subscription.sku,
          productType: "subscription" as const,
          name: subscription.displayName,
          description: subscription.displayDescription ?? "",
          coins: 0,
          displayPrice: new Intl.NumberFormat(locale, {
            style: "currency",
            currency: subscription.currency,
          }).format(subscription.price),
          price: subscription.price,
          currency: subscription.currency,
          billingPeriod: subscription.billingPeriod,
          subscriptionStatus: activeSkus.has(subscription.sku) ? "active" as const : "inactive" as const,
          trialEligible: subscription.trialEligible,
        }];
      }),
    };
  }

  async subscribe(subscriptionSku: string, playerId: string): Promise<PlatformResult<{
    activeSku: string;
    blockedSkus: string[];
  }>> {
    const started = await this.platform.beginSubscription(subscriptionSku);
    if (started.status !== "success") {
      if (started.status !== "unavailable" || started.message !== "already_subscribed") return started;
      const refreshed = await this.platform.getSubscriptions();
      if (refreshed.status !== "success") return refreshed;
      try {
        const verified = await this.backend.syncSubscriptions(refreshed.value.subscriptionsSigned, playerId);
        return verified.activeSkus.includes(subscriptionSku)
          ? {status: "success", value: {activeSku: subscriptionSku, blockedSkus: verified.blockedSkus ?? []}}
          : started;
      } catch (error) {
        return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
      }
    }
    try {
      const verified = await this.backend.syncSubscriptions(started.value.subscriptionSigned, playerId);
      if (!verified.activeSkus.includes(subscriptionSku)) {
        return {status: "terminal-failure", message: "Subscription entitlement was not active"};
      }
      return {
        status: "success",
        value: {activeSku: subscriptionSku, blockedSkus: verified.blockedSkus ?? []},
      };
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
  }

  async purchase(productSku: string, playerId: string): Promise<PlatformResult<{
    coinsAwarded: number;
    newCoins: number;
    newlyUnlockedAchievementIds?: string[];
  }>> {
    const started = await this.platform.beginPurchase(productSku);
    if (started.status !== "success") return started;
    try {
      const grant = await this.backend.grantPurchase(
        started.value.purchaseSigned,
        playerId,
        started.value.purchase.purchaseToken,
      );
      const completed = await this.platform.completePurchase(started.value.purchase.purchaseToken);
      return completed.status === "success"
        ? {
            status: "success",
            value: {
              coinsAwarded: grant.coinsAwarded,
              newCoins: grant.newCoins,
              newlyUnlockedAchievementIds: grant.newlyUnlockedAchievementIds,
            },
          }
        : completed;
    } catch (error) {
      return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
    }
  }

  async reconcile(playerId: string): Promise<PlatformResult<number>> {
    let count = 0;
    for (let page = 0; page < 100; page += 1) {
      const result = await this.platform.getIncompletePurchases();
      if (result.status !== "success") return result;
      for (const purchase of result.value.purchases) {
        await this.backend.grantPurchase(result.value.purchasesSigned, playerId, purchase.purchaseToken);
        const completed = await this.platform.completePurchase(purchase.purchaseToken);
        if (completed.status !== "success") return completed;
        count += 1;
      }
      if (!result.value.hasMore) return {status: "success", value: count};
    }
    return {status: "terminal-failure", message: "Incomplete purchase pagination exceeded safety limit"};
  }
}

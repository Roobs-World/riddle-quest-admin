import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import {DEFAULT_PRODUCT_PRICING} from "@qwordly/core/pricing/catalog";
import type {ProductSummary} from "../play/types";

export class JestPurchaseCoordinator {
  constructor(private readonly platform: JestPlatformPort, private readonly backend: JestBackendPort) {}

  async getProducts(locale?: string): Promise<PlatformResult<ProductSummary[]>> {
    const result = await this.platform.getProducts();
    if (result.status !== "success") return result;
    const localCatalog = new Map(DEFAULT_PRODUCT_PRICING.map((product) => [product.productId, product]));
    return {
      status: "success",
      value: result.value.flatMap((product) => {
        const local = localCatalog.get(product.sku);
        if (!local || !Number.isFinite(product.price) || !/^[A-Z]{3}$/.test(product.currency)) return [];
        return [{
          productId: product.sku,
          name: product.name || local.name,
          description: product.description || local.description,
          coins: local.coins,
          displayPrice: new Intl.NumberFormat(locale, {
            style: "currency",
            currency: product.currency,
          }).format(product.price),
          featuredBadge: local.featuredBadge,
        }];
      }),
    };
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

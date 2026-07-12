import type {
  ProductSummary,
  RewardedAdPlacement,
  WebPurchaseProvider,
  WebRewardedAdProvider,
} from "./types";

export class WebProviderNotConfiguredError extends Error {
  constructor(providerType: "purchase" | "rewarded-ad") {
    super(`${providerType} provider is not configured for production web.`);
    this.name = "WebProviderNotConfiguredError";
  }
}

export const createNotConfiguredPurchaseProvider = (): WebPurchaseProvider => ({
  id: "not-configured",
  async purchase() {
    throw new WebProviderNotConfiguredError("purchase");
  },
});

export const createNotConfiguredRewardedAdProvider = (): WebRewardedAdProvider => ({
  id: "not-configured",
  async requestReward() {
    throw new WebProviderNotConfiguredError("rewarded-ad");
  },
});

export const createFakePurchaseProvider = (): WebPurchaseProvider => ({
  id: "jest-fake-purchase",
  async purchase(product: ProductSummary, profile) {
    return {
      success: true,
      productId: product.productId,
      coinsAwarded: product.coins,
      newCoins: (profile?.coins ?? 0) + product.coins,
      newlyUnlockedAchievementIds: product.coins >= 900 ? ["coin_collector"] : [],
    };
  },
});

export const createFakeRewardedAdProvider = (): WebRewardedAdProvider => ({
  id: "jest-fake-rewarded-ad",
  async requestReward(placement: RewardedAdPlacement) {
    return {
      callbackId: `fake-${placement}-${Date.now()}`,
      provider: "jest-fake-rewarded-ad",
      rewardCoins: placement === "loss_continue" ? 50 : 75,
    };
  },
});

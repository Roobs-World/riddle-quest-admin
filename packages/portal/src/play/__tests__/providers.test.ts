import {describe, expect, it} from "@jest/globals";
import {
  WebProviderNotConfiguredError,
  createFakePurchaseProvider,
  createFakeRewardedAdProvider,
  createNotConfiguredPurchaseProvider,
} from "../providers";

const product = {
  productId: "coins.tiny",
  name: "Starter Pack",
  description: "A few coins.",
  coins: 250,
  displayPrice: "$0.99",
};

describe("web monetization providers", () => {
  it("awards fake purchase coins for the Jest harness", async () => {
    const provider = createFakePurchaseProvider();
    const result = await provider.purchase(product, {
      username: "Guest",
      coins: 10,
      level: 1,
      xp: 0,
      winStreak: 0,
      gamesPlayed: 0,
      wins: 0,
      achievements: [],
      classicIndex: 1,
    });

    expect(result.newCoins).toBe(260);
  });

  it("creates fake rewarded ad callbacks", async () => {
    const provider = createFakeRewardedAdProvider();
    const result = await provider.requestReward("coin_shop");

    expect(result.provider).toBe("jest-fake-rewarded-ad");
    expect(result.rewardCoins).toBe(75);
  });

  it("keeps production purchases behind a stable not-configured interface", async () => {
    const provider = createNotConfiguredPurchaseProvider();

    await expect(provider.purchase(product, null)).rejects.toBeInstanceOf(WebProviderNotConfiguredError);
  });
});

import {getCoinPackBuyingPower, getSoloWinCoins, SOLO_COIN_COSTS} from "../economy";
import {DEFAULT_PRODUCT_PRICING} from "../../pricing/catalog";
import {REDDIT_GOLD_PRODUCTS} from "../../pricing/redditCatalog";

describe("solo coin economy", () => {
  it("pays more for harder content while keeping a hint affordable after one easy win", () => {
    const classic = ["easy", "medium", "hard"].map((band) => getSoloWinCoins("classic", band));
    const daily = ["easy", "medium", "hard"].map((band) => getSoloWinCoins("challenge", band));
    expect(classic).toEqual([25, 40, 60]);
    expect(daily).toEqual([75, 100, 125]);
    expect(SOLO_COIN_COSTS.hint).toBeLessThanOrEqual(classic[0]);
    expect(SOLO_COIN_COSTS.continue).toBe(SOLO_COIN_COSTS.hint * 2);
    expect(SOLO_COIN_COSTS.skip).toBe(SOLO_COIN_COSTS.continue * 2);
  });

  it.each([undefined, null, "unknown", "toString", "__proto__", 100, {}])("uses a conservative reward for legacy or invalid difficulty %p", (difficulty) => {
    expect(getSoloWinCoins("classic", difficulty)).toBe(25);
    expect(getSoloWinCoins("challenge", difficulty)).toBe(75);
  });

  it("shows whole actions and rejects invalid pack amounts", () => {
    expect(getCoinPackBuyingPower(250)).toEqual({hints: 10, continues: 5});
    expect(getCoinPackBuyingPower(49)).toEqual({hints: 1, continues: 0});
    for (const amount of [-1, NaN, Infinity, 1.5]) {
      expect(getCoinPackBuyingPower(amount)).toEqual({hints: 0, continues: 0});
    }
  });

  it("gives progressively better value in each USD and Reddit Gold bundle tier", () => {
    const usdValues = DEFAULT_PRODUCT_PRICING.map((product) => {
      const price = product.regionalPrices.find(({currency}) => currency === "USD")!;
      return product.coins / price.amount;
    });
    const goldValues = REDDIT_GOLD_PRODUCTS.map((product) => product.coins / product.goldCost);
    for (const values of [usdValues, goldValues]) {
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]).toBeGreaterThan(values[index - 1]);
      }
    }
    expect(getCoinPackBuyingPower(DEFAULT_PRODUCT_PRICING[0].coins)).toEqual({hints: 10, continues: 5});
    expect(getCoinPackBuyingPower(DEFAULT_PRODUCT_PRICING.at(-1)!.coins)).toEqual({hints: 280, continues: 140});
  });
});

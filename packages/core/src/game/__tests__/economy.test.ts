import {
  DAILY_STREAK_BONUS,
  getCoinPackBuyingPower,
  getDailyStreakBonusCoins,
  getSoloWinCoins,
  SOLO_BONUS_COINS,
  SOLO_COIN_COSTS,
  SOLO_WIN_COINS,
} from "../economy";
import {DEFAULT_PRODUCT_PRICING} from "../../pricing/catalog";
import {REDDIT_GOLD_PRODUCTS} from "../../pricing/redditCatalog";

describe("solo coin economy", () => {
  it("pays more for harder content while keeping a hint affordable after one easy win", () => {
    /** Classic rewards in ascending authored difficulty. */
    const classic = ["easy", "medium", "hard"].map((band) => getSoloWinCoins("classic", band));
    /** Daily rewards in ascending authored difficulty. */
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
    /** Configured USD coin value at each bundle tier. */
    const usdValues = DEFAULT_PRODUCT_PRICING.map((product) => {
      /** USD price owned by the trusted default catalog. */
      const price = product.regionalPrices.find(({currency}) => currency === "USD")!;
      return product.coins / price.amount;
    });
    /** Reddit coin value at each Gold bundle tier. */
    const goldValues = REDDIT_GOLD_PRODUCTS.map((product) => product.coins / product.goldCost);
    for (const values of [usdValues, goldValues]) {
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]).toBeGreaterThan(values[index - 1]);
      }
    }
    expect(getCoinPackBuyingPower(DEFAULT_PRODUCT_PRICING[0].coins)).toEqual({hints: 10, continues: 5});
    expect(getCoinPackBuyingPower(DEFAULT_PRODUCT_PRICING.at(-1)!.coins)).toEqual({hints: 280, continues: 140});
  });

  it("keeps one-off bonuses smaller than any base win so they never dwarf a riddle reward", () => {
    expect(SOLO_BONUS_COINS).toEqual({levelUp: 10, achievement: 10});
    expect(DAILY_STREAK_BONUS).toEqual({initial: 10, weeklyStep: 10, intervalDays: 7, max: 100});
    /** Smallest base reward any solved riddle can pay. */
    const smallestWin = Math.min(...Object.values(SOLO_WIN_COINS.classic));
    expect(SOLO_BONUS_COINS.levelUp).toBeLessThan(smallestWin);
    expect(SOLO_BONUS_COINS.achievement).toBeLessThan(smallestWin);
    expect(getDailyStreakBonusCoins(1)).toBeLessThan(smallestWin);
    // Reported case: an easy first Daily win that starts a streak, levels up and
    // unlocks first_win + daily_completed used to pay 75 + 20 + 50 + 2 * 25 = 195.
    /** Bonus-heavy first Daily win under the current table. */
    const firstDailyWin = getSoloWinCoins("challenge", "easy") + getDailyStreakBonusCoins(1) +
      SOLO_BONUS_COINS.levelUp + 2 * SOLO_BONUS_COINS.achievement;
    expect(firstDailyWin).toBe(115);
    // Stacked bonuses stay below the riddle's own reward instead of exceeding it.
    expect(firstDailyWin).toBeLessThan(2 * getSoloWinCoins("challenge", "easy"));
  });

  it.each([[0, 0], [-2, 0], [1, 10], [6.9, 10], [7, 20], [14, 30], [63, 100], [500, 100]])(
    "pays the daily-streak bonus for a %s-day streak", (streak, expected) => {
      expect(getDailyStreakBonusCoins(streak)).toBe(expected);
    });
});

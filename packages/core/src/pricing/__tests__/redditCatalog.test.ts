import {REDDIT_GOLD_PRODUCTS, resolveRedditGoldProduct} from "../redditCatalog";

describe("Reddit Gold product catalog", () => {
  it("defines exactly the six approved coin-to-Gold grants", () => {
    expect(REDDIT_GOLD_PRODUCTS.map(({coins, goldCost}) => [coins, goldCost])).toEqual([
      [250, 50],
      [550, 100],
      [900, 150],
      [1600, 250],
      [3400, 500],
      [7000, 1000],
    ]);
    expect(new Set(REDDIT_GOLD_PRODUCTS.map(({productId}) => productId)).size).toBe(6);
  });

  it("contains consumables only and is immutable", () => {
    expect(REDDIT_GOLD_PRODUCTS.every(({kind}) => kind === "consumable")).toBe(true);
    expect(REDDIT_GOLD_PRODUCTS).toHaveLength(6);
    expect(Object.isFrozen(REDDIT_GOLD_PRODUCTS)).toBe(true);
    expect(REDDIT_GOLD_PRODUCTS.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(REDDIT_GOLD_PRODUCTS)).not.toMatch(/subscription|durable|ads?/iu);
  });

  it("resolves exact IDs and rejects unknown products", () => {
    expect(resolveRedditGoldProduct("riddle_quest_coins_900")).toMatchObject({coins: 900, goldCost: 150});
    expect(() => resolveRedditGoldProduct("com.attacker.unlimited_coins")).toThrow("invalid-reddit-product");
  });
});

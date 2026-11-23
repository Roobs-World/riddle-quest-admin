/** Describes reddit gold product. */
export type RedditGoldProduct = Readonly<{
  /** Stores product id. */
  productId: string;
  /** Stores kind. */
  kind: "consumable";
  /** Stores gold cost. */
  goldCost: number;
  /** Stores coins. */
  coins: number;
}>;

/** Provides products behavior. */
const products = [
  {productId: "riddle_quest_coins_250", kind: "consumable", goldCost: 50, coins: 250},
  {productId: "riddle_quest_coins_550", kind: "consumable", goldCost: 100, coins: 550},
  {productId: "riddle_quest_coins_900", kind: "consumable", goldCost: 150, coins: 900},
  {productId: "riddle_quest_coins_1600", kind: "consumable", goldCost: 250, coins: 1600},
  {productId: "riddle_quest_coins_3400", kind: "consumable", goldCost: 500, coins: 3400},
  {productId: "riddle_quest_coins_7000", kind: "consumable", goldCost: 1000, coins: 7000},
] as const satisfies readonly RedditGoldProduct[];

/* istanbul ignore next -- the in-module literal cannot vary at runtime; public tests assert its exact uniqueness. */
if (
  new Set(products.map(({productId}) => productId)).size !== products.length ||
  new Set(products.map(({goldCost}) => goldCost)).size !== products.length
) {
  throw new Error("invalid-reddit-product-catalog");
}

/** Immutable Reddit Gold product contract shared by packaging and authoritative fulfillment. */
export const REDDIT_GOLD_PRODUCTS: readonly RedditGoldProduct[] = Object.freeze(
  products.map((product) => Object.freeze({...product})),
);

/** Resolves reddit gold product. */
export function resolveRedditGoldProduct(productId: string): RedditGoldProduct {
  /** Provides product behavior. */
  const product = REDDIT_GOLD_PRODUCTS.find((candidate) => candidate.productId === productId);
  if (!product) throw new Error("invalid-reddit-product");
  return product;
}

/** Content-authored difficulty used by both server and self-contained solo games. */
export type EconomyDifficulty = "easy" | "medium" | "hard";

/** Stable action prices: harder content increases earnings without increasing help costs. */
export const SOLO_COIN_COSTS = Object.freeze({hint: 25, continue: 50, skip: 100});

/** Base rewards exclude the separately settled streak, level and achievement bonuses. */
export const SOLO_WIN_COINS = Object.freeze({
  classic: Object.freeze({easy: 25, medium: 40, hard: 60}),
  challenge: Object.freeze({easy: 75, medium: 100, hard: 125}),
});

/** Gives legacy or malformed content the conservative easy reward. */
export function normalizeEconomyDifficulty(value: unknown): EconomyDifficulty {
  return value === "medium" || value === "hard" ? value : "easy";
}

/** Calculates a base win grant from trusted content, never from player level or payment history. */
export function getSoloWinCoins(mode: "classic" | "challenge", difficulty: unknown): number {
  return SOLO_WIN_COINS[mode][normalizeEconomyDifficulty(difficulty)];
}

/** Whole gameplay actions a coin pack can fund, shown as alternatives. */
export type CoinPackBuyingPower = {
  /** Maximum number of hint purchases using the entire pack. */ hints: number;
  /** Maximum number of extra attempts using the entire pack. */ continues: number;
};

/** Compares a pack to gameplay spending using whole actions and mutually exclusive examples. */
export function getCoinPackBuyingPower(coins: number): CoinPackBuyingPower {
  /** Invalid pack grants must never produce an inflated value claim. */
  const balance = Number.isSafeInteger(coins) && coins > 0 ? coins : 0;
  return {hints: Math.floor(balance / SOLO_COIN_COSTS.hint), continues: Math.floor(balance / SOLO_COIN_COSTS.continue)};
}

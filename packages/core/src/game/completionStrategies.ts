import type {GameEngineMode} from "./GameEngine";

/** Defines the contract for local completion rewards. */
export interface LocalCompletionRewards {
  /** Stores coins. */
  coins: number;
  /** Stores score. */
  score: number;
}

/**
 * Guest/local reward calculation (mirrors client `getLocalRewards`).
 */
export function computeGuestCompletionRewards(
  gameMode: GameEngineMode,
  attempts: number,
  options: {
    challengeCoinReward: number;
    classicCoinReward: number;
    scoreMaxAttempts?: number;
    challengeBaseScore?: number;
    classicBaseScore?: number;
  },
): LocalCompletionRewards {
  const scoreMaxAttempts = options.scoreMaxAttempts ?? 5;
  const baseScore = gameMode === "challenge" ? (options.challengeBaseScore ?? 100) : (options.classicBaseScore ?? 50);
  const attemptsBonus = Math.max(0, (scoreMaxAttempts - attempts + 1) * 10);
  const coins = gameMode === "challenge" ? options.challengeCoinReward : options.classicCoinReward;
  return {coins, score: baseScore + attemptsBonus};
}

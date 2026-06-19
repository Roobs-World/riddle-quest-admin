/**
 * Port for terminal game completion (coins, stats, achievements).
 * Implemented by Firebase callable adapters in later refactor PRs.
 */
export interface GameCompletionInput {
  riddleId: string;
  gameMode: "challenge" | "classic";
  attempts: number;
  isCorrect: boolean;
}

export interface GameCompletionResult {
  coinsEarned?: number;
  scoreEarned?: number;
  xpEarned?: number;
  newlyUnlockedAchievementIds?: string[];
  newWinStreak?: number;
}

export interface IGameCompletionPort {
  completeGame(input: GameCompletionInput): Promise<GameCompletionResult>;
}

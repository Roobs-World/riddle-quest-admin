import type {BridgeProfile, BridgeUser} from "../../platform/bridge/messages";

/** Provides to number behavior. */
const toNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Provides to achievement ids behavior. */
const toAchievementIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).achievementId === "string"
    ) {
      return [
        (
          entry as {
            /** Stores achievement id. */
            achievementId: string;
          }
        ).achievementId,
      ];
    }
    return [];
  });
};

/** Provides to bridge profile behavior. */
export const toBridgeProfile = (user: BridgeUser, data: Record<string, unknown> | null): BridgeProfile => {
  /** Provides stats behavior. */
  const stats = typeof data?.stats === "object" && data.stats ? (data.stats as Record<string, unknown>) : {};
  /** Provides progress behavior. */
  const progress =
    typeof data?.progress === "object" && data.progress ? (data.progress as Record<string, unknown>) : {};

  return {
    username:
      (typeof data?.username === "string" && data.username) ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Player",
    coins: Math.max(0, Math.floor(toNumber(data?.coins, 0))),
    level: Math.max(1, Math.floor(toNumber(stats.level, 1))),
    xp: Math.max(0, Math.floor(toNumber(stats.xp, 0))),
    winStreak: Math.max(0, Math.floor(toNumber(stats.winStreak, 0))),
    gamesPlayed: Math.max(0, Math.floor(toNumber(stats.gamesPlayed, 0))),
    wins: Math.max(0, Math.floor(toNumber(stats.wins ?? stats.totalWins, 0))),
    achievements: toAchievementIds(data?.unlockedAchievements),
    classicIndex: Math.max(1, Math.floor(toNumber(progress.classicIndex, 1))),
    avatarUrl: typeof data?.avatarUrl === "string" ? data.avatarUrl : user.photoURL,
    dailyChallengeIndex: Math.max(0, Math.floor(toNumber(progress.dailyChallengeIndex, 0))),
    dailyChallengeCurrentQuestion: Math.max(0, Math.floor(toNumber(progress.dailyChallengeCurrentQuestion, 0))),
    dailyPuzzlesCompleted: Math.max(0, Math.floor(toNumber(stats.dailyPuzzlesCompleted, 0))),
    bestStreak: Math.max(0, Math.floor(toNumber(stats.bestStreak, 0))),
    totalWordsGuessed: Math.max(0, Math.floor(toNumber(stats.totalWordsGuessed, 0))),
    winRate: Math.max(0, toNumber(stats.winRate, 0)),
    averageGuesses: Math.max(0, toNumber(stats.averageGuesses, 0)),
    totalScore: Math.max(0, Math.floor(toNumber(stats.totalScore, 0))),
    highestLevelClassic: Math.max(0, Math.floor(toNumber(stats.highestLevelClassic, 0))),
    challengeWins: Math.max(0, Math.floor(toNumber(stats.challengeWins, 0))),
    totalWins: Math.max(0, Math.floor(toNumber(stats.totalWins ?? stats.wins, 0))),
    totalGuessesInWins: Math.max(0, Math.floor(toNumber(stats.totalGuessesInWins, 0))),
    totalHintsUsed: Math.max(0, Math.floor(toNumber(stats.totalHintsUsed, 0))),
    multiplayerGamesPlayed: Math.max(0, Math.floor(toNumber(stats.multiplayerGamesPlayed, 0))),
    multiplayerWins: Math.max(0, Math.floor(toNumber(stats.multiplayerWins, 0))),
    multiplayerChallengesCreated: Math.max(0, Math.floor(toNumber(stats.multiplayerChallengesCreated, 0))),
    hasPurchasedApp: data?.hasPurchasedApp === true,
  };
};

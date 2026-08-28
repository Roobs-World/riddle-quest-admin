import type {YouTubeGameMode, YouTubeProgress} from "./types";

/** Describes achievement context. */
type AchievementContext = Readonly<{
  /** Stores mode. */
  mode: YouTubeGameMode;
  /** Stores is correct. */
  isCorrect: boolean;
  /** Stores attempts. */
  attempts: number;
  /** Stores game over. */
  gameOver: boolean;
}>;

/** Describes achievement definition. */
type AchievementDefinition = Readonly<{
  /** Stores id. */
  id: string;
  /** Stores icon. */
  icon: string;
  /** Stores unlocked. */
  unlocked: (progress: YouTubeProgress, context: AchievementContext) => boolean;
}>;

/** Provides wins behavior. */
const wins =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.totalWins >= threshold;
/** Provides games behavior. */
const games =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.gamesPlayed >= threshold;
/** Provides streak behavior. */
const streak =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.bestDailyStreak >= threshold;
/** Provides classic behavior. */
const classic =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.highestClassicLevel >= threshold;
/** Provides daily behavior. */
const daily =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.dailyPuzzlesCompleted >= threshold;
/** Provides challenge wins behavior. */
const challengeWins =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.challengeWins >= threshold;
/** Provides hints behavior. */
const hints =
  (threshold: number) =>
  (progress: YouTubeProgress): boolean =>
    progress.totalHintsUsed >= threshold;

/** Solo-only subset of the existing achievement catalog. */
const YOUTUBE_ACHIEVEMENT_LIST: AchievementDefinition[] = [
  {id: "first_win", icon: "🏆", unlocked: wins(1)},
  {id: "wins_5", icon: "⭐", unlocked: wins(5)},
  {id: "wins_25", icon: "🌟", unlocked: wins(25)},
  {id: "wins_50", icon: "👑", unlocked: wins(50)},
  {id: "wins_100", icon: "🏛️", unlocked: wins(100)},
  {id: "win_rate_80", icon: "🎯", unlocked: (p) => p.gamesPlayed >= 10 && p.totalWins / p.gamesPlayed >= 0.8},
  {id: "efficient_10", icon: "🧠", unlocked: (p) => p.totalWins >= 10 && p.totalGuessesInWins / p.totalWins <= 3},
  {id: "games_25", icon: "🎲", unlocked: games(25)},
  {id: "games_100", icon: "🎟️", unlocked: games(100)},
  {id: "streak_3", icon: "🔥", unlocked: streak(3)},
  {id: "streak_7", icon: "⚡", unlocked: streak(7)},
  {id: "streak_14", icon: "🌋", unlocked: streak(14)},
  {id: "streak_30", icon: "🌠", unlocked: streak(30)},
  {id: "classic_10", icon: "🎮", unlocked: classic(10)},
  {id: "classic_25", icon: "🧭", unlocked: classic(25)},
  {id: "classic_50", icon: "🗺️", unlocked: classic(50)},
  {id: "classic_100", icon: "🏰", unlocked: classic(100)},
  {id: "daily_completed", icon: "📅", unlocked: daily(1)},
  {id: "daily_7", icon: "🗓️", unlocked: daily(7)},
  {id: "daily_30", icon: "🏅", unlocked: daily(30)},
  {id: "daily_100", icon: "📆", unlocked: daily(100)},
  {id: "challenge_5", icon: "⛰️", unlocked: challengeWins(5)},
  {id: "challenge_25", icon: "🏔️", unlocked: challengeWins(25)},
  {id: "challenge_50", icon: "🛡️", unlocked: challengeWins(50)},
  {id: "perfect_guess", icon: "💎", unlocked: (_p, c) => c.isCorrect && c.attempts === 1},
  {id: "classic_perfect", icon: "🏹", unlocked: (_p, c) => c.mode === "classic" && c.isCorrect && c.attempts === 1},
  {id: "challenge_perfect", icon: "🌞", unlocked: (_p, c) => c.mode === "daily" && c.isCorrect && c.attempts === 1},
  {id: "last_chance", icon: "⏳", unlocked: (_p, c) => c.isCorrect && c.attempts === 5},
  {id: "classic_last_chance", icon: "🎬", unlocked: (_p, c) => c.mode === "classic" && c.isCorrect && c.attempts === 5},
  {id: "challenge_last_chance", icon: "🌅", unlocked: (_p, c) => c.mode === "daily" && c.isCorrect && c.attempts === 5},
  {id: "lesson_learned", icon: "📘", unlocked: (_p, c) => c.gameOver && !c.isCorrect},
  {id: "hint_user", icon: "💡", unlocked: hints(1)},
  {id: "hints_10", icon: "🔦", unlocked: hints(10)},
  {id: "hints_25", icon: "🕯️", unlocked: hints(25)},
  {id: "level_5", icon: "🌙", unlocked: (p) => p.level >= 5},
  {id: "level_10", icon: "🪐", unlocked: (p) => p.level >= 10},
  {id: "level_20", icon: "🌌", unlocked: (p) => p.level >= 20},
  {id: "xp_1000", icon: "✨", unlocked: (p) => p.xp >= 1_000},
  {id: "xp_5000", icon: "☄️", unlocked: (p) => p.xp >= 5_000},
  {id: "coin_hoarder", icon: "🪙", unlocked: (p) => p.coins >= 1_000},
  {id: "treasure_vault", icon: "🏦", unlocked: (p) => p.coins >= 2_500},
];

/** Defines the youtube achievements value. */
export const YOUTUBE_ACHIEVEMENTS: readonly AchievementDefinition[] = Object.freeze(YOUTUBE_ACHIEVEMENT_LIST);

/** Finds new you tube achievements. */
export function findNewYouTubeAchievements(progress: YouTubeProgress, context: AchievementContext): string[] {
  /** Provides existing behavior. */
  const existing = new Set(progress.unlockedAchievementIds);
  return YOUTUBE_ACHIEVEMENTS.filter(({id, unlocked}) => !existing.has(id) && unlocked(progress, context)).map(
    ({id}) => id,
  );
}

/** Gets you tube achievement icon. */
export function getYouTubeAchievementIcon(id: string): string {
  return YOUTUBE_ACHIEVEMENTS.find((achievement) => achievement.id === id)?.icon ?? "🏅";
}

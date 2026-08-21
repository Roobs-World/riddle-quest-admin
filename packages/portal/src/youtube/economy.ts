import type {YouTubeGameMode} from "./types";

/** Defines the youtube starting coins value. */
export const YOUTUBE_STARTING_COINS = 300;
/** Defines the youtube hint cost value. */
export const YOUTUBE_HINT_COST = 50;
/** Defines the youtube continue cost value. */
export const YOUTUBE_CONTINUE_COST = 100;
/** Defines the youtube classic skip cost value. */
export const YOUTUBE_CLASSIC_SKIP_COST = 100;
/** Defines the youtube classic win coins value. */
export const YOUTUBE_CLASSIC_WIN_COINS = 25;
/** Defines the youtube daily win coins value. */
export const YOUTUBE_DAILY_WIN_COINS = 75;
/** Defines the youtube level up coins value. */
export const YOUTUBE_LEVEL_UP_COINS = 50;
/** Defines the youtube achievement coins value. */
export const YOUTUBE_ACHIEVEMENT_COINS = 25;
/** Defines the youtube base attempts value. */
export const YOUTUBE_BASE_ATTEMPTS = 5;
/** Defines the youtube continue attempts value. */
export const YOUTUBE_CONTINUE_ATTEMPTS = 1;

/** Mirrors the established cumulative XP curve without importing backend code. */
export function getYouTubeLevelFromXp(totalXp: number): number {
  const xp = Math.max(totalXp, 0);
  const a = 5;
  const b = 95;
  const completedLevelUps = Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a));
  return completedLevelUps + 1;
}

/** Gets you tube win xp. */
export function getYouTubeWinXp(mode: YouTubeGameMode, attempts: number): number {
  const base = mode === "daily" ? 100 : 50;
  return base + Math.max(0, (YOUTUBE_BASE_ATTEMPTS - attempts + 1) * 10);
}

/** Gets you tube daily streak bonus. */
export function getYouTubeDailyStreakBonus(streak: number): number {
  const normalized = Math.max(0, Math.floor(streak));
  if (normalized === 0) return 0;
  return Math.min(20 + Math.floor(normalized / 7) * 20, 300);
}

/** Provides utc day behavior. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Provides previous utc day behavior. */
export function previousUtcDay(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return utcDay(date);
}

/** Provides next you tube daily streak behavior. */
export function nextYouTubeDailyStreak(current: number, previousCompletion: string | undefined, today: string): number {
  return previousCompletion === previousUtcDay(today) ? current + 1 : 1;
}

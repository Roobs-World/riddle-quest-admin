import {SOLO_BONUS_COINS, SOLO_COIN_COSTS, SOLO_WIN_COINS, getDailyStreakBonusCoins} from "@riddle-quest/core/game";
import type {YouTubeGameMode} from "./types";
/** Defines the youtube starting coins value. */
export const YOUTUBE_STARTING_COINS = 300;
/** Defines the youtube hint cost value. */
export const YOUTUBE_HINT_COST = SOLO_COIN_COSTS.hint;
/** Defines the youtube continue cost value. */
export const YOUTUBE_CONTINUE_COST = SOLO_COIN_COSTS.continue;
/** Defines the youtube classic skip cost value. */
export const YOUTUBE_CLASSIC_SKIP_COST = SOLO_COIN_COSTS.skip;
/** Defines the youtube classic win coins value. */
export const YOUTUBE_CLASSIC_WIN_COINS = SOLO_WIN_COINS.classic.easy;
/** Defines the youtube daily win coins value. */
export const YOUTUBE_DAILY_WIN_COINS = SOLO_WIN_COINS.challenge.easy;
/** Defines the youtube level up coins value. */
export const YOUTUBE_LEVEL_UP_COINS = SOLO_BONUS_COINS.levelUp;
/** Defines the youtube achievement coins value. */
export const YOUTUBE_ACHIEVEMENT_COINS = SOLO_BONUS_COINS.achievement;
/** Defines the youtube base attempts value. */
export const YOUTUBE_BASE_ATTEMPTS = 5;
/** Defines the youtube continue attempts value. */
export const YOUTUBE_CONTINUE_ATTEMPTS = 1;
/** Mirrors the established cumulative XP curve without importing backend code. */
export function getYouTubeLevelFromXp(totalXp: number): number {
  /** Provides xp behavior. */
  const xp = Math.max(totalXp, 0);
  /** Provides a behavior. */
  const a = 5;
  /** Provides b behavior. */
  const b = 95;
  /** Completes d level ups. */
  const completedLevelUps = Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a));
  return completedLevelUps + 1;
}
/** Gets you tube win xp. */
export function getYouTubeWinXp(mode: YouTubeGameMode, attempts: number): number {
  /** Provides base behavior. */
  const base = mode === "daily" ? 100 : 50;
  return base + Math.max(0, (YOUTUBE_BASE_ATTEMPTS - attempts + 1) * 10);
}
/** Gets you tube daily streak bonus. */
export function getYouTubeDailyStreakBonus(streak: number): number {
  return getDailyStreakBonusCoins(streak);
}
/** Provides utc day behavior. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
/** Provides previous utc day behavior. */
export function previousUtcDay(day: string): string {
  /** Provides date behavior. */
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return utcDay(date);
}
/** Provides next you tube daily streak behavior. */
export function nextYouTubeDailyStreak(current: number, previousCompletion: string | undefined, today: string): number {
  return previousCompletion === previousUtcDay(today) ? current + 1 : 1;
}

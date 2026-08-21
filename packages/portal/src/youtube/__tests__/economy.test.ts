import {
  YOUTUBE_ACHIEVEMENT_COINS,
  YOUTUBE_BASE_ATTEMPTS,
  YOUTUBE_CLASSIC_SKIP_COST,
  YOUTUBE_CLASSIC_WIN_COINS,
  YOUTUBE_CONTINUE_ATTEMPTS,
  YOUTUBE_CONTINUE_COST,
  YOUTUBE_DAILY_WIN_COINS,
  YOUTUBE_HINT_COST,
  YOUTUBE_LEVEL_UP_COINS,
  YOUTUBE_STARTING_COINS,
  getYouTubeDailyStreakBonus,
  getYouTubeLevelFromXp,
  getYouTubeWinXp,
  nextYouTubeDailyStreak,
} from "../economy";
import {createEmptyYouTubeSave} from "../save";

describe("YouTube local economy parity", () => {
  it("locks the established solo coin and attempt contract", () => {
    expect({
      startingCoins: YOUTUBE_STARTING_COINS,
      baseAttempts: YOUTUBE_BASE_ATTEMPTS,
      continueAttempts: YOUTUBE_CONTINUE_ATTEMPTS,
      hintCost: YOUTUBE_HINT_COST,
      continueCost: YOUTUBE_CONTINUE_COST,
      classicSkipCost: YOUTUBE_CLASSIC_SKIP_COST,
      classicWinCoins: YOUTUBE_CLASSIC_WIN_COINS,
      dailyWinCoins: YOUTUBE_DAILY_WIN_COINS,
      levelUpCoins: YOUTUBE_LEVEL_UP_COINS,
      achievementCoins: YOUTUBE_ACHIEVEMENT_COINS,
    }).toEqual({
      startingCoins: 300,
      baseAttempts: 5,
      continueAttempts: 1,
      hintCost: 50,
      continueCost: 100,
      classicSkipCost: 100,
      classicWinCoins: 25,
      dailyWinCoins: 75,
      levelUpCoins: 50,
      achievementCoins: 25,
    });
    expect(createEmptyYouTubeSave("content-v1").progression.coins).toBe(YOUTUBE_STARTING_COINS);
  });

  it("matches the established XP, level, and daily-streak formulas", () => {
    expect(getYouTubeWinXp("classic", 1)).toBe(100);
    expect(getYouTubeWinXp("classic", 5)).toBe(60);
    expect(getYouTubeWinXp("classic", 6)).toBe(50);
    expect(getYouTubeWinXp("daily", 1)).toBe(150);
    expect(getYouTubeWinXp("daily", 6)).toBe(100);

    expect(getYouTubeLevelFromXp(0)).toBe(1);
    expect(getYouTubeLevelFromXp(99)).toBe(1);
    expect(getYouTubeLevelFromXp(100)).toBe(2);
    expect(getYouTubeLevelFromXp(209)).toBe(2);
    expect(getYouTubeLevelFromXp(210)).toBe(3);

    expect(getYouTubeDailyStreakBonus(0)).toBe(0);
    expect(getYouTubeDailyStreakBonus(1)).toBe(20);
    expect(getYouTubeDailyStreakBonus(7)).toBe(40);
    expect(getYouTubeDailyStreakBonus(98)).toBe(300);
    expect(nextYouTubeDailyStreak(6, "2026-08-19", "2026-08-20")).toBe(7);
    expect(nextYouTubeDailyStreak(6, "2026-08-18", "2026-08-20")).toBe(1);
  });
});

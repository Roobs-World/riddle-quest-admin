/**
 * @fileoverview Unit tests for achievement definitions and progress calculation.
 *
 * Tests that all achievements are properly defined and that progress
 * calculations work correctly for various player data scenarios.
 */

import {
  ACHIEVEMENT_DEFINITIONS,
  AchievementCriteriaType,
  AchievementPlayerData,
  getAchievementProgress,
} from "../achievements";

describe("achievements", () => {
  describe("ACHIEVEMENT_DEFINITIONS", () => {
    it("should be a non-empty array", () => {
      expect(Array.isArray(ACHIEVEMENT_DEFINITIONS)).toBe(true);
      expect(ACHIEVEMENT_DEFINITIONS.length).toBeGreaterThan(0);
    });

    it("should have unique IDs for each achievement", () => {
      const ids = ACHIEVEMENT_DEFINITIONS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have unique criteria types for each achievement", () => {
      const types = ACHIEVEMENT_DEFINITIONS.map((a) => a.criteriaType);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it("should have required properties for each achievement", () => {
      ACHIEVEMENT_DEFINITIONS.forEach((achievement) => {
        expect(typeof achievement.id).toBe("string");
        expect(achievement.id.length).toBeGreaterThan(0);
        expect(typeof achievement.name).toBe("string");
        expect(achievement.name.length).toBeGreaterThan(0);
        expect(typeof achievement.description).toBe("string");
        expect(achievement.description.length).toBeGreaterThan(0);
        expect(typeof achievement.criteriaType).toBe("string");
        expect(typeof achievement.threshold).toBe("number");
        expect(achievement.threshold).toBeGreaterThan(0);
        expect(typeof achievement.icon).toBe("string");
        expect(achievement.icon.length).toBeGreaterThan(0);
        expect(typeof achievement.getProgress).toBe("function");
      });
    });

    it("should have positive thresholds", () => {
      ACHIEVEMENT_DEFINITIONS.forEach((achievement) => {
        expect(achievement.threshold).toBeGreaterThan(0);
      });
    });
  });

  describe("getProgress for wins-based achievements", () => {
    const emptyPlayer: AchievementPlayerData = {};

    it("should return 0 for null/undefined stats", () => {
      const firstWin = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_win");
      expect(firstWin?.getProgress(emptyPlayer)).toBe(0);
      expect(firstWin?.getProgress({ stats: null })).toBe(0);
      expect(firstWin?.getProgress({ stats: undefined })).toBe(0);
    });

    it("should return totalWins for first_win achievement", () => {
      const firstWin = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_win");
      expect(firstWin?.getProgress({ stats: { totalWins: 5 } as any })).toBe(5);
      expect(firstWin?.getProgress({ stats: { totalWins: 0 } as any })).toBe(0);
    });

    it("should return totalWins for wins_5 achievement", () => {
      const wins5 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_5");
      expect(wins5?.getProgress({ stats: { totalWins: 3 } as any })).toBe(3);
      expect(wins5?.getProgress({ stats: { totalWins: 10 } as any })).toBe(10);
    });

    it("should return totalWins for wins_25 achievement", () => {
      const wins25 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_25");
      expect(wins25?.getProgress({ stats: { totalWins: 20 } as any })).toBe(20);
      expect(wins25?.getProgress({ stats: { totalWins: 30 } as any })).toBe(30);
    });

    it("should return totalWins for wins_50 achievement", () => {
      const wins50 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_50");
      expect(wins50?.getProgress({ stats: { totalWins: 40 } as any })).toBe(40);
      expect(wins50?.getProgress({ stats: { totalWins: 55 } as any })).toBe(55);
    });

    it("should return totalWins for wins_100 achievement", () => {
      const wins100 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_100");
      expect(wins100?.getProgress({ stats: { totalWins: 75 } as any })).toBe(75);
      expect(wins100?.getProgress({ stats: { totalWins: 125 } as any })).toBe(125);
    });

    it("should return gamesPlayed for games_25 achievement", () => {
      const games25 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "games_25");
      expect(games25?.getProgress({ stats: { gamesPlayed: 10 } as any })).toBe(10);
      expect(games25?.getProgress({ stats: { gamesPlayed: 25 } as any })).toBe(25);
    });

    it("should return gamesPlayed for games_100 achievement", () => {
      const games100 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "games_100");
      expect(games100?.getProgress({ stats: { gamesPlayed: 50 } as any })).toBe(50);
      expect(games100?.getProgress({ stats: { gamesPlayed: 110 } as any })).toBe(110);
    });

    it("should return winRate for win_rate_80 achievement", () => {
      const winRate80 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "win_rate_80");
      expect(winRate80?.getProgress({ stats: { winRate: 72 } as any })).toBe(72);
      expect(winRate80?.getProgress({ stats: { winRate: 85 } as any })).toBe(85);
    });

    it("should track wins for efficient_10 and complete only when average guesses qualifies", () => {
      const efficient10 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "efficient_10");
      expect(efficient10?.getProgress({ stats: { totalWins: 6, averageGuesses: 2.5 } as any })).toBe(6);
      expect(efficient10?.getProgress({ stats: { totalWins: 10, averageGuesses: 3.1 } as any })).toBe(10);
      expect(efficient10?.getProgress({ stats: { totalWins: 10, averageGuesses: 3 } as any })).toBe(10);
    });
  });

  describe("getProgress for streak-based achievements", () => {
    it("should return bestStreak for streak_3 achievement", () => {
      const streak3 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_3");
      expect(streak3?.getProgress({ stats: { bestStreak: 2 } as any })).toBe(2);
      expect(streak3?.getProgress({ stats: { bestStreak: 5 } as any })).toBe(5);
    });

    it("should return bestStreak for streak_7 achievement", () => {
      const streak7 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_7");
      expect(streak7?.getProgress({ stats: { bestStreak: 4 } as any })).toBe(4);
      expect(streak7?.getProgress({ stats: { bestStreak: 10 } as any })).toBe(10);
    });

    it("should return bestStreak for streak_14 achievement", () => {
      const streak14 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_14");
      expect(streak14?.getProgress({ stats: { bestStreak: 9 } as any })).toBe(9);
      expect(streak14?.getProgress({ stats: { bestStreak: 16 } as any })).toBe(16);
    });

    it("should return bestStreak for streak_30 achievement", () => {
      const streak30 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_30");
      expect(streak30?.getProgress({ stats: { bestStreak: 18 } as any })).toBe(18);
      expect(streak30?.getProgress({ stats: { bestStreak: 31 } as any })).toBe(31);
    });

    it("should return 0 for missing bestStreak", () => {
      const streak3 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_3");
      expect(streak3?.getProgress({})).toBe(0);
      expect(streak3?.getProgress({ stats: {} as any })).toBe(0);
    });
  });

  describe("getProgress for level-based achievements", () => {
    it("should return highestLevelClassic for classic_10 achievement", () => {
      const classic10 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_10");
      expect(classic10?.getProgress({ stats: { highestLevelClassic: 5 } as any })).toBe(5);
      expect(classic10?.getProgress({ stats: { highestLevelClassic: 15 } as any })).toBe(15);
    });

    it("should return highestLevelClassic for classic_25 achievement", () => {
      const classic25 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_25");
      expect(classic25?.getProgress({ stats: { highestLevelClassic: 20 } as any })).toBe(20);
      expect(classic25?.getProgress({ stats: { highestLevelClassic: 30 } as any })).toBe(30);
    });

    it("should return highestLevelClassic for classic_50 achievement", () => {
      const classic50 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_50");
      expect(classic50?.getProgress({ stats: { highestLevelClassic: 40 } as any })).toBe(40);
      expect(classic50?.getProgress({ stats: { highestLevelClassic: 55 } as any })).toBe(55);
    });

    it("should return highestLevelClassic for classic_100 achievement", () => {
      const classic100 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_100");
      expect(classic100?.getProgress({ stats: { highestLevelClassic: 80 } as any })).toBe(80);
      expect(classic100?.getProgress({ stats: { highestLevelClassic: 120 } as any })).toBe(120);
    });

    it("should return dailyPuzzlesCompleted for daily_completed achievement", () => {
      const daily = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "daily_completed");
      expect(daily?.getProgress({ stats: { dailyPuzzlesCompleted: 1 } as any })).toBe(1);
      expect(daily?.getProgress({ stats: { dailyPuzzlesCompleted: 0 } as any })).toBe(0);
    });

    it("should return dailyPuzzlesCompleted for daily_7 achievement", () => {
      const daily7 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "daily_7");
      expect(daily7?.getProgress({ stats: { dailyPuzzlesCompleted: 3 } as any })).toBe(3);
      expect(daily7?.getProgress({ stats: { dailyPuzzlesCompleted: 7 } as any })).toBe(7);
    });

    it("should return dailyPuzzlesCompleted for daily_30 achievement", () => {
      const daily30 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "daily_30");
      expect(daily30?.getProgress({ stats: { dailyPuzzlesCompleted: 20 } as any })).toBe(20);
      expect(daily30?.getProgress({ stats: { dailyPuzzlesCompleted: 35 } as any })).toBe(35);
    });

    it("should return dailyPuzzlesCompleted for daily_100 achievement", () => {
      const daily100 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "daily_100");
      expect(daily100?.getProgress({ stats: { dailyPuzzlesCompleted: 75 } as any })).toBe(75);
      expect(daily100?.getProgress({ stats: { dailyPuzzlesCompleted: 105 } as any })).toBe(105);
    });

    it("should return challengeWins for challenge_5 achievement", () => {
      const challenge5 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "challenge_5");
      expect(challenge5?.getProgress({ stats: { challengeWins: 4 } as any })).toBe(4);
      expect(challenge5?.getProgress({ stats: { challengeWins: 8 } as any })).toBe(8);
    });

    it("should return challengeWins for challenge_25 achievement", () => {
      const challenge25 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "challenge_25");
      expect(challenge25?.getProgress({ stats: { challengeWins: 12 } as any })).toBe(12);
      expect(challenge25?.getProgress({ stats: { challengeWins: 30 } as any })).toBe(30);
    });

    it("should return challengeWins for challenge_50 achievement", () => {
      const challenge50 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "challenge_50");
      expect(challenge50?.getProgress({ stats: { challengeWins: 33 } as any })).toBe(33);
      expect(challenge50?.getProgress({ stats: { challengeWins: 60 } as any })).toBe(60);
    });
  });

  describe("getProgress for perfect_guess achievement", () => {
    it("should always return 0 (server-evaluated)", () => {
      const perfect = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "perfect_guess");
      expect(perfect?.getProgress({})).toBe(0);
      expect(perfect?.getProgress({ stats: { totalWins: 100 } as any })).toBe(0);
    });

    it.each([
      "classic_perfect",
      "challenge_perfect",
      "last_chance",
      "classic_last_chance",
      "challenge_last_chance",
      "lesson_learned",
    ])(
      "should return 0 for server-evaluated %s achievement",
      (id) => {
        const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
        expect(achievement?.getProgress({})).toBe(0);
      }
    );
  });

  describe("getProgress for hint_user achievement", () => {
    it("should return totalHintsUsed from stats", () => {
      const hint = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "hint_user");
      expect(hint?.getProgress({ stats: { totalHintsUsed: 1 } as any })).toBe(1);
      expect(hint?.getProgress({ stats: { totalHintsUsed: 10 } as any })).toBe(10);
    });

    it("should return 0 for no hints used", () => {
      const hint = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "hint_user");
      expect(hint?.getProgress({})).toBe(0);
      expect(hint?.getProgress({ stats: { totalHintsUsed: 0 } as any })).toBe(0);
    });

    it("should return totalHintsUsed for hints_10 achievement", () => {
      const hints10 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "hints_10");
      expect(hints10?.getProgress({ stats: { totalHintsUsed: 6 } as any })).toBe(6);
      expect(hints10?.getProgress({ stats: { totalHintsUsed: 12 } as any })).toBe(12);
    });

    it("should return totalHintsUsed for hints_25 achievement", () => {
      const hints25 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "hints_25");
      expect(hints25?.getProgress({ stats: { totalHintsUsed: 18 } as any })).toBe(18);
      expect(hints25?.getProgress({ stats: { totalHintsUsed: 30 } as any })).toBe(30);
    });
  });

  describe("getProgress for level-based player achievements", () => {
    it("should return level for level_5 achievement", () => {
      const level5 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "level_5");
      expect(level5?.getProgress({ stats: { level: 3 } as any })).toBe(3);
      expect(level5?.getProgress({ stats: { level: 5 } as any })).toBe(5);
    });

    it("should return level for level_10 achievement", () => {
      const level10 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "level_10");
      expect(level10?.getProgress({ stats: { level: 7 } as any })).toBe(7);
      expect(level10?.getProgress({ stats: { level: 10 } as any })).toBe(10);
    });

    it("should return level for level_20 achievement", () => {
      const level20 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "level_20");
      expect(level20?.getProgress({ stats: { level: 14 } as any })).toBe(14);
      expect(level20?.getProgress({ stats: { level: 20 } as any })).toBe(20);
    });

    it("should return the starting level when level is missing", () => {
      const level5 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "level_5");
      expect(level5?.getProgress({})).toBe(1);
      expect(level5?.getProgress({ stats: {} as any })).toBe(1);
    });
  });

  describe("getProgress for resource achievements", () => {
    it("should return xp for xp_1000 achievement", () => {
      const xp1000 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "xp_1000");
      expect(xp1000?.getProgress({ stats: { xp: 600 } as any })).toBe(600);
      expect(xp1000?.getProgress({ stats: { xp: 1200 } as any })).toBe(1200);
    });

    it("should return xp for xp_5000 achievement", () => {
      const xp5000 = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "xp_5000");
      expect(xp5000?.getProgress({ stats: { xp: 3500 } as any })).toBe(3500);
      expect(xp5000?.getProgress({ stats: { xp: 6000 } as any })).toBe(6000);
    });

    it("should return coins for coin_hoarder achievement", () => {
      const coinHoarder = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "coin_hoarder");
      expect(coinHoarder?.getProgress({ coins: 750 })).toBe(750);
      expect(coinHoarder?.getProgress({ coins: 1000 })).toBe(1000);
    });

    it("should return coins for treasure_vault achievement", () => {
      const treasureVault = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "treasure_vault");
      expect(treasureVault?.getProgress({ coins: 1500 })).toBe(1500);
      expect(treasureVault?.getProgress({ coins: 2500 })).toBe(2500);
    });
  });

  describe("getProgress for first_purchase achievement", () => {
    it("should return 1 when hasPurchasedApp is true", () => {
      const purchase = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_purchase");
      expect(purchase?.getProgress({ hasPurchasedApp: true })).toBe(1);
    });

    it("should return 0 when hasPurchasedApp is false", () => {
      const purchase = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_purchase");
      expect(purchase?.getProgress({ hasPurchasedApp: false })).toBe(0);
    });

    it("should return 0 when hasPurchasedApp is null or undefined", () => {
      const purchase = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_purchase");
      expect(purchase?.getProgress({})).toBe(0);
      expect(purchase?.getProgress({ hasPurchasedApp: null })).toBe(0);
    });
  });

  describe("getAchievementProgress (deprecated function)", () => {
    it("should return progress for valid criteria type", () => {
      const stats = { totalWins: 7 } as any;
      const result = getAchievementProgress("first_win", stats, null);
      expect(result).toBe(7);
    });

    it("should return 0 for unknown criteria type", () => {
      const result = getAchievementProgress("unknown_type" as AchievementCriteriaType, null, null);
      expect(result).toBe(0);
    });

    it("should pass hasPurchasedApp to the definition", () => {
      const result = getAchievementProgress("first_purchase", null, null, true);
      expect(result).toBe(1);
    });

    it("should handle all valid criteria types", () => {
      const validTypes: AchievementCriteriaType[] = [
        "first_win",
        "wins_5",
        "wins_25",
        "wins_50",
        "wins_100",
        "win_rate_80",
        "efficient_10",
        "games_25",
        "games_100",
        "streak_3",
        "streak_7",
        "streak_14",
        "streak_30",
        "classic_10",
        "classic_25",
        "classic_50",
        "classic_100",
        "daily_completed",
        "daily_7",
        "daily_30",
        "daily_100",
        "challenge_5",
        "challenge_25",
        "challenge_50",
        "perfect_guess",
        "classic_perfect",
        "challenge_perfect",
        "last_chance",
        "classic_last_chance",
        "challenge_last_chance",
        "lesson_learned",
        "hint_user",
        "hints_10",
        "hints_25",
        "level_5",
        "level_10",
        "level_20",
        "xp_1000",
        "xp_5000",
        "coin_hoarder",
        "treasure_vault",
        "first_purchase",
      ];

      validTypes.forEach((type) => {
        // Should not throw
        const result = getAchievementProgress(type, null, null);
        expect(typeof result).toBe("number");
      });
    });
  });

  describe("achievement thresholds", () => {
    it("should have threshold of 1 for first_win", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "first_win");
      expect(achievement?.threshold).toBe(1);
    });

    it("should have threshold of 5 for wins_5", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_5");
      expect(achievement?.threshold).toBe(5);
    });

    it("should have threshold of 25 for wins_25", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_25");
      expect(achievement?.threshold).toBe(25);
    });

    it("should have threshold of 50 for wins_50", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "wins_50");
      expect(achievement?.threshold).toBe(50);
    });

    it("should have threshold of 25 for games_25", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "games_25");
      expect(achievement?.threshold).toBe(25);
    });

    it("should have threshold of 3 for streak_3", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_3");
      expect(achievement?.threshold).toBe(3);
    });

    it("should have threshold of 7 for streak_7", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_7");
      expect(achievement?.threshold).toBe(7);
    });

    it("should have threshold of 14 for streak_14", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_14");
      expect(achievement?.threshold).toBe(14);
    });

    it("should have threshold of 10 for classic_10", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_10");
      expect(achievement?.threshold).toBe(10);
    });

    it.each([
      ["classic_25", 25],
      ["classic_50", 50],
      ["classic_100", 100],
      ["daily_7", 7],
      ["daily_30", 30],
      ["daily_100", 100],
      ["challenge_5", 5],
      ["challenge_25", 25],
      ["challenge_50", 50],
      ["hints_10", 10],
      ["hints_25", 25],
      ["level_5", 5],
      ["level_10", 10],
      ["level_20", 20],
      ["xp_1000", 1000],
      ["xp_5000", 5000],
      ["coin_hoarder", 1000],
      ["treasure_vault", 2500],
      ["win_rate_80", 80],
      ["efficient_10", 10],
      ["wins_100", 100],
      ["games_100", 100],
      ["streak_30", 30],
    ])("%s should have threshold of %i", (id, threshold) => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
      expect(achievement?.threshold).toBe(threshold);
    });
  });

  describe("achievement icons", () => {
    it("should have emoji icons for all achievements", () => {
      ACHIEVEMENT_DEFINITIONS.forEach((achievement) => {
        // Emojis are typically 2+ characters due to unicode
        expect(achievement.icon.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should have a unique icon for every achievement", () => {
      const icons = ACHIEVEMENT_DEFINITIONS.map((achievement) => achievement.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });

    it("should have expected icons for specific achievements", () => {
      const iconMap: Record<string, string> = {
        first_win: "🏆",
        wins_5: "⭐",
        wins_25: "🌟",
        wins_50: "👑",
        wins_100: "🏛️",
        win_rate_80: "🎯",
        efficient_10: "🧠",
        games_25: "🎲",
        games_100: "🎟️",
        streak_3: "🔥",
        streak_7: "⚡",
        streak_14: "🌋",
        streak_30: "🌠",
        classic_10: "🎮",
        classic_25: "🧭",
        classic_50: "🗺️",
        classic_100: "🏰",
        daily_completed: "📅",
        daily_7: "🗓️",
        daily_30: "🏅",
        daily_100: "📆",
        challenge_5: "⛰️",
        challenge_25: "🏔️",
        challenge_50: "🛡️",
        perfect_guess: "💎",
        classic_perfect: "🏹",
        challenge_perfect: "🌞",
        last_chance: "⏳",
        classic_last_chance: "🎬",
        challenge_last_chance: "🌅",
        lesson_learned: "📘",
        hint_user: "💡",
        hints_10: "🔎",
        hints_25: "🕯️",
        level_5: "🚀",
        level_10: "🛰️",
        level_20: "🪐",
        xp_1000: "✨",
        xp_5000: "⚙️",
        coin_hoarder: "🪙",
        treasure_vault: "💰",
        first_purchase: "❤️",
      };

      Object.entries(iconMap).forEach(([id, expectedIcon]) => {
        const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
        expect(achievement?.icon).toBe(expectedIcon);
      });
    });
  });
});

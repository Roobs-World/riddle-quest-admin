/**
 * @fileoverview Unit tests for achievement definitions and progress calculation.
 *
 * Tests that all achievements are properly defined and that progress
 * calculations work correctly for various player data scenarios.
 */

import {
  ACHIEVEMENT_DEFINITIONS,
  getAchievementProgress,
  AchievementDefinition,
  AchievementPlayerData,
  AchievementCriteriaType,
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

    it("should return dailyPuzzlesCompleted for daily_completed achievement", () => {
      const daily = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "daily_completed");
      expect(daily?.getProgress({ stats: { dailyPuzzlesCompleted: 1 } as any })).toBe(1);
      expect(daily?.getProgress({ stats: { dailyPuzzlesCompleted: 0 } as any })).toBe(0);
    });
  });

  describe("getProgress for perfect_guess achievement", () => {
    it("should always return 0 (server-evaluated)", () => {
      const perfect = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "perfect_guess");
      expect(perfect?.getProgress({})).toBe(0);
      expect(perfect?.getProgress({ stats: { totalWins: 100 } as any })).toBe(0);
    });
  });

  describe("getProgress for tutorial_started achievement", () => {
    it("should return tutorialIndex from progress", () => {
      const tutorial = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "tutorial_started");
      expect(tutorial?.getProgress({ progress: { tutorialIndex: 1 } as any })).toBe(1);
      expect(tutorial?.getProgress({ progress: { tutorialIndex: 5 } as any })).toBe(5);
    });

    it("should return 0 for missing progress", () => {
      const tutorial = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "tutorial_started");
      expect(tutorial?.getProgress({})).toBe(0);
      expect(tutorial?.getProgress({ progress: null })).toBe(0);
    });
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
        "streak_3",
        "streak_7",
        "classic_10",
        "daily_completed",
        "perfect_guess",
        "tutorial_started",
        "hint_user",
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

    it("should have threshold of 3 for streak_3", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_3");
      expect(achievement?.threshold).toBe(3);
    });

    it("should have threshold of 7 for streak_7", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "streak_7");
      expect(achievement?.threshold).toBe(7);
    });

    it("should have threshold of 10 for classic_10", () => {
      const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === "classic_10");
      expect(achievement?.threshold).toBe(10);
    });
  });

  describe("achievement icons", () => {
    it("should have emoji icons for all achievements", () => {
      ACHIEVEMENT_DEFINITIONS.forEach((achievement) => {
        // Emojis are typically 2+ characters due to unicode
        expect(achievement.icon.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should have expected icons for specific achievements", () => {
      const iconMap: Record<string, string> = {
        first_win: "🏆",
        wins_5: "⭐",
        wins_25: "🌟",
        streak_3: "🔥",
        streak_7: "⚡",
        classic_10: "🎮",
        daily_completed: "📅",
        perfect_guess: "💎",
        tutorial_started: "📚",
        hint_user: "💡",
        first_purchase: "❤️",
      };

      Object.entries(iconMap).forEach(([id, expectedIcon]) => {
        const achievement = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
        expect(achievement?.icon).toBe(expectedIcon);
      });
    });
  });
});

import {describe, expect, it} from "@jest/globals";
import {RACE_ACHIEVEMENT_IDS} from "@riddle-quest/core/race";
import {PlayerProgressSchema, PlayerStatsSchema} from "@riddle-quest/core/validation";
import {ACHIEVEMENT_DEFINITIONS, getAchievementProgress} from "../achievements";
import {predictCompletionAchievementIds} from "@riddle-quest/hosted/play/predictCompletionAchievements";

describe("multiplayer achievement presentation", () => {
  it("defines every authoritative multiplayer achievement with localized copy", () => {
    /** Provides definitions behavior. */
    const definitions = new Map(ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.id, achievement]));

    for (const achievementId of RACE_ACHIEVEMENT_IDS) {
      /** Provides achievement behavior. */
      const achievement = definitions.get(achievementId);
      expect(achievement).toBeDefined();
      expect(achievement?.nameKey).toMatch(/^RaceTo10\.ACHIEVEMENT_/);
      expect(achievement?.descriptionKey).toMatch(/^RaceTo10\.ACHIEVEMENT_/);
    }
  });

  it("calculates multiplayer progress from authoritative profile statistics", () => {
    /** Provides wins behavior. */
    const wins = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "race_wins_25");
    /** Provides hosts behavior. */
    const hosts = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "race_hosts_5");

    expect(wins?.getProgress({stats: {multiplayerWins: 12} as never})).toBe(12);
    expect(hosts?.getProgress({stats: {multiplayerChallengesCreated: 3} as never})).toBe(3);
  });
});

describe("achievement progress", () => {
  /** Provides stats behavior. */
  const stats = PlayerStatsSchema.parse({
    totalWins: 100,
    averageGuesses: 2.5,
    gamesPlayed: 100,
    winRate: 85,
    bestStreak: 30,
    highestLevelClassic: 100,
    dailyPuzzlesCompleted: 100,
    challengeWins: 50,
    totalHintsUsed: 25,
    level: 20,
    xp: 5_000,
    multiplayerGamesPlayed: 10,
    multiplayerWins: 25,
    multiplayerChallengesCreated: 5,
  });
  /** Provides progress behavior. */
  const progress = PlayerProgressSchema.parse({classicIndex: 100});

  it("has unique, complete definitions whose progress functions handle a full profile", () => {
    expect(new Set(ACHIEVEMENT_DEFINITIONS.map(({id}) => id)).size).toBe(ACHIEVEMENT_DEFINITIONS.length);
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      expect(definition.threshold).toBeGreaterThan(0);
      expect(definition.icon).not.toBe("");
      expect(definition.getProgress({stats, progress, coins: 2_500, hasPurchasedApp: true})).toEqual(
        expect.any(Number),
      );
    }
  });

  it("returns safe defaults for incomplete player profiles", () => {
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      expect(definition.getProgress({})).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers every efficient-solver outcome", () => {
    /** Provides efficient behavior. */
    const efficient = ACHIEVEMENT_DEFINITIONS.find(({id}) => id === "efficient_10")!;
    expect(efficient.getProgress({stats: PlayerStatsSchema.parse({totalWins: 4})})).toBe(4);
    expect(efficient.getProgress({stats: PlayerStatsSchema.parse({totalWins: 10, averageGuesses: 4})})).toBe(10);
    expect(efficient.getProgress({stats: PlayerStatsSchema.parse({totalWins: 10, averageGuesses: 3})})).toBe(10);
    expect(efficient.getProgress({stats: {totalWins: 10} as never})).toBe(10);
  });

  it("supports the deprecated criteria lookup and unknown runtime values", () => {
    expect(getAchievementProgress("wins_5", stats, progress)).toBe(100);
    expect(getAchievementProgress("missing" as never, stats, progress)).toBe(0);
    expect(getAchievementProgress("first_purchase", stats, progress, true)).toBe(1);
  });
});

describe("optimistic completion achievements", () => {
  it("predicts only new deterministic unlocks from the local completion projection", () => {
    expect(predictCompletionAchievementIds({
      username: "Solver", coins: 10, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 4, wins: 4, totalWins: 4, totalGuessesInWins: 8,
      achievements: ["first_win", "perfect_guess"], classicIndex: 9,
    }, {gameMode: "classic", isCorrect: true, attempts: 1, gameOver: true})).toEqual([
      "wins_5", "classic_10", "classic_perfect", "classic_5",
    ]);
  });

  it("does not project unlocks for a nonterminal guess or missing profile", () => {
    /** Provides completion behavior. */
    const completion = {gameMode: "classic" as const, isCorrect: false, attempts: 2, gameOver: false};
    expect(predictCompletionAchievementIds(null, completion)).toEqual([]);
  });

  it("projects losses from legacy profiles without optional aggregate fields", () => {
    expect(predictCompletionAchievementIds({
      username: "Learner", coins: 0, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 0,
    }, {gameMode: "classic", isCorrect: false, attempts: 5, gameOver: true})).toEqual([
      "lesson_learned",
    ]);
  });

  it("projects challenge first-try achievements and preserves existing classic progress", () => {
    expect(predictCompletionAchievementIds({
      username: "Challenger", coins: 0, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 9, wins: 0, achievements: [], classicIndex: 2, highestLevelClassic: 2,
    }, {gameMode: "challenge", isCorrect: true, attempts: 1, gameOver: true})).toEqual([
      "first_win", "daily_completed", "perfect_guess", "challenge_perfect", "games_10",
    ]);
  });

  it("projects challenge last-chance achievements while evaluating efficiency thresholds", () => {
    expect(predictCompletionAchievementIds({
      username: "Closer", coins: 0, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 9, wins: 9, totalWins: 9, totalGuessesInWins: 45,
      dailyPuzzlesCompleted: 6, challengeWins: 4,
      achievements: ["first_win", "wins_5"], classicIndex: 0,
    }, {gameMode: "challenge", isCorrect: true, attempts: 5, gameOver: true})).toEqual([
      "win_rate_80", "daily_completed", "daily_7", "challenge_5", "last_chance", "challenge_last_chance", "wins_10", "games_10", "daily_3",
    ]);
  });
});

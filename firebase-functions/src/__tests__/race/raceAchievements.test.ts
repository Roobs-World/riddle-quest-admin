import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../../shared/constants";
import {evaluateRaceAchievementEvent} from "../../race/raceAchievements";

describe("multiplayer achievements", () => {
  it("unlocks the debut and clean-run achievements on a first clean completion", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {coins: 100, stats: {}, unlockedAchievements: []},
      {kind: "completed", won: false, cleanRun: true},
      1_000,
    );

    expect(update.stats).toEqual({
      multiplayerGamesPlayed: 1,
      multiplayerWins: 0,
      multiplayerChallengesCreated: 0,
    });
    expect(update.newlyUnlockedAchievementIds).toEqual(["race_debut", "race_clean_run"]);
    expect(update.achievementCoinsAwarded).toBe(2 * ACHIEVEMENT_UNLOCK_COIN_REWARD);
    expect(update.newCoins).toBe(100 + 2 * ACHIEVEMENT_UNLOCK_COIN_REWARD);
  });

  it("unlocks cumulative win milestones without duplicating existing achievements", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {
        coins: 250,
        stats: {multiplayerGamesPlayed: 8, multiplayerWins: 4},
        unlockedAchievements: [
          {achievementId: "race_debut", unlockedAt: 1},
          {achievementId: "race_first_win", unlockedAt: 2},
        ],
      },
      {kind: "completed", won: true, cleanRun: false},
      2_000,
    );

    expect(update.stats.multiplayerGamesPlayed).toBe(9);
    expect(update.stats.multiplayerWins).toBe(5);
    expect(update.newlyUnlockedAchievementIds).toEqual(["race_wins_5"]);
  });

  it("tracks hosted challenges and grants the fifth-host milestone", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {
        stats: {multiplayerChallengesCreated: 4},
        unlockedAchievements: [{achievementId: "race_host", unlockedAt: 1}],
      },
      {kind: "challenge_published"},
      3_000,
    );

    expect(update.stats.multiplayerChallengesCreated).toBe(5);
    expect(update.newlyUnlockedAchievementIds).toEqual(["race_hosts_5"]);
  });

  it("credits a creator win when an opponent resolves a challenge", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {stats: {multiplayerWins: 0}, unlockedAchievements: []},
      {kind: "opponent_resolved", won: true},
      4_000,
    );

    expect(update.stats.multiplayerGamesPlayed).toBe(1);
    expect(update.stats.multiplayerWins).toBe(1);
    expect(update.newlyUnlockedAchievementIds).toEqual(["race_debut", "race_first_win"]);
  });

  it("does not credit a creator win after an opponent loss", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {stats: {multiplayerGamesPlayed: 2, multiplayerWins: 0}},
      {kind: "opponent_resolved", won: false},
      5_000,
    );
    expect(update.stats).toMatchObject({multiplayerGamesPlayed: 3, multiplayerWins: 0});
  });

  it("unlocks the twenty-five-win and first-host milestones", () => {
    /** Provides win behavior. */
    const win = evaluateRaceAchievementEvent(
      {stats: {multiplayerGamesPlayed: 30, multiplayerWins: 24}, unlockedAchievements: ["race_debut"]},
      {kind: "completed", won: true, cleanRun: false},
      6_000,
    );
    expect(win.newlyUnlockedAchievementIds).toEqual(
      expect.arrayContaining(["race_first_win", "race_wins_5", "race_wins_25"]),
    );

    /** Provides host behavior. */
    const host = evaluateRaceAchievementEvent({}, {kind: "challenge_published"}, 6_001);
    expect(host.newlyUnlockedAchievementIds).toEqual(["race_host"]);
  });

  it("normalizes malformed stored counters, coins and achievement entries", () => {
    /** Provides update behavior. */
    const update = evaluateRaceAchievementEvent(
      {
        coins: -1,
        stats: {multiplayerGamesPlayed: 1.5, multiplayerWins: "4", multiplayerChallengesCreated: -2},
        unlockedAchievements: [null, [], {achievementId: 4}, "race_debut"],
      },
      {kind: "completed", won: false, cleanRun: false},
      7_000,
    );
    expect(update.stats).toEqual({multiplayerGamesPlayed: 1, multiplayerWins: 0, multiplayerChallengesCreated: 0});
    expect(update.newCoins).toBeGreaterThanOrEqual(0);

    /** Provides no list behavior. */
    const noList = evaluateRaceAchievementEvent(
      {stats: null, unlockedAchievements: "race_debut", coins: "100"},
      {kind: "challenge_published"},
      7_001,
    );
    expect(noList.stats.multiplayerChallengesCreated).toBe(1);
  });
});

import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../shared/constants";
import {evaluateRaceAchievementEvent} from "../race/raceAchievements";

describe("multiplayer achievements", () => {
  it("unlocks the debut and clean-run achievements on a first clean completion", () => {
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
    expect(update.newCoins).toBe(100 + (2 * ACHIEVEMENT_UNLOCK_COIN_REWARD));
  });

  it("unlocks cumulative win milestones without duplicating existing achievements", () => {
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
    const update = evaluateRaceAchievementEvent(
      {stats: {multiplayerWins: 0}, unlockedAchievements: []},
      {kind: "opponent_resolved", won: true},
      4_000,
    );

    expect(update.stats.multiplayerGamesPlayed).toBe(1);
    expect(update.stats.multiplayerWins).toBe(1);
    expect(update.newlyUnlockedAchievementIds).toEqual(["race_debut", "race_first_win"]);
  });
});

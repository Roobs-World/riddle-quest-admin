import {describe, expect, it} from "@jest/globals";
import type {BridgeProfile} from "../../../platform/bridge/messages";
import {createAchievementPlayer} from "../profileStats";

/** Profile fixture containing representative single-player and multiplayer statistics. */
const profile: BridgeProfile = {
  userId: "profile-stats",
  username: "Nova",
  coins: 75,
  xp: 420,
  level: 3,
  achievements: [],
  stats: {},
  hasPurchasedApp: true,
  classicIndex: 8,
  dailyChallengeIndex: 2,
  dailyChallengeCurrentQuestion: 3,
  wins: 4,
  totalWins: 6,
  bestStreak: 5,
  multiplayerGamesPlayed: 7,
  multiplayerWins: 2,
  multiplayerChallengesCreated: 1,
};

describe("profile achievement projection", () => {
  it("provides complete guest-safe defaults", () => {
    expect(createAchievementPlayer(null)).toMatchObject({
      coins: 0,
      hasPurchasedApp: false,
      progress: {classicIndex: 1, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
      stats: {xp: 0, level: 1, totalWins: 0, multiplayerGamesPlayed: 0},
    });
  });

  it("projects trusted profile progression and statistics", () => {
    expect(createAchievementPlayer(profile)).toMatchObject({
      coins: 75,
      hasPurchasedApp: true,
      progress: {classicIndex: 8, dailyChallengeIndex: 2, dailyChallengeCurrentQuestion: 3},
      stats: {
        xp: 420,
        level: 3,
        wins: 4,
        totalWins: 6,
        bestStreak: 5,
        multiplayerGamesPlayed: 7,
        multiplayerWins: 2,
        multiplayerChallengesCreated: 1,
      },
    });
  });

  it("falls back to wins when a legacy profile has no total-wins field", () => {
    expect(createAchievementPlayer({...profile, totalWins: undefined}).stats.totalWins).toBe(4);
  });
});

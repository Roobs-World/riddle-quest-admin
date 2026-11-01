import {describe, expect, it} from "@jest/globals";
import {toBridgeProfile} from "@qwordly/hosted/profileMapper";

describe("Firebase profile mapping", () => {
  it("maps authoritative achievement objects and all gameplay statistics", () => {
    /** Provides profile behavior. */
    const profile = toBridgeProfile(
      {uid: "player-1", displayName: "Nova", isAnonymous: false},
      {
        username: "AuthoritativeNova",
        avatarUrl: "avatar.png",
        coins: 425,
        unlockedAchievements: [
          {achievementId: "first_win", unlockedAt: 100},
          {achievementId: "wins_5", unlockedAt: 200},
        ],
        progress: {classicIndex: 9, dailyChallengeIndex: 3, dailyChallengeCurrentQuestion: 2},
        stats: {
          xp: 740,
          level: 6,
          gamesPlayed: 12,
          wins: 8,
          totalWins: 8,
          challengeWins: 3,
          winStreak: 4,
          bestStreak: 7,
          dailyPuzzlesCompleted: 5,
          totalWordsGuessed: 51,
          winRate: 66.7,
          averageGuesses: 3.2,
          totalScore: 1400,
          highestLevelClassic: 9,
          totalGuessesInWins: 26,
          totalHintsUsed: 2,
          multiplayerGamesPlayed: 4,
          multiplayerWins: 2,
          multiplayerChallengesCreated: 3,
        },
      },
    );

    expect(profile.achievements).toEqual(["first_win", "wins_5"]);
    expect(profile).toEqual(
      expect.objectContaining({
        username: "AuthoritativeNova",
        avatarUrl: "avatar.png",
        dailyChallengeIndex: 3,
        dailyChallengeCurrentQuestion: 2,
        dailyPuzzlesCompleted: 5,
        bestStreak: 7,
        totalWordsGuessed: 51,
        challengeWins: 3,
        totalHintsUsed: 2,
        multiplayerGamesPlayed: 4,
        multiplayerWins: 2,
        multiplayerChallengesCreated: 3,
      }),
    );
  });

  it("normalizes malformed, fractional, and negative profile values", () => {
    /** Provides profile behavior. */
    const profile = toBridgeProfile(
      {uid: "player-2", email: "ada@example.test", photoURL: "fallback.png", isAnonymous: false},
      {
        coins: -4,
        avatarUrl: 10,
        unlockedAchievements: ["first_win", null, {achievementId: "wins_5"}, {achievementId: 2}],
        progress: {classicIndex: 2.9, dailyChallengeIndex: -1, dailyChallengeCurrentQuestion: Number.NaN},
        stats: {
          level: 0,
          xp: "invalid",
          wins: 3.8,
          totalWins: undefined,
          gamesPlayed: -2,
          winStreak: -1,
        },
        hasPurchasedApp: true,
      },
    );

    expect(profile).toEqual(
      expect.objectContaining({
        username: "ada",
        avatarUrl: "fallback.png",
        achievements: ["first_win", "wins_5"],
        coins: 0,
        level: 1,
        xp: 0,
        wins: 3,
        totalWins: 3,
        gamesPlayed: 0,
        winStreak: 0,
        classicIndex: 2,
        dailyChallengeIndex: 0,
        dailyChallengeCurrentQuestion: 0,
        hasPurchasedApp: true,
      }),
    );
  });

  it("uses safe defaults when profile data is absent", () => {
    /** Provides profile behavior. */
    const profile = toBridgeProfile({uid: "guest", displayName: "", email: null, isAnonymous: true}, null);

    expect(profile).toEqual(
      expect.objectContaining({
        username: "Player",
        achievements: [],
        avatarUrl: undefined,
        coins: 0,
        level: 1,
        classicIndex: 1,
        hasPurchasedApp: false,
      }),
    );
  });
});

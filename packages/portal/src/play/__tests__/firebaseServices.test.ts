import {describe, expect, it} from "@jest/globals";
import {toBridgeProfile} from "../profileMapper";

describe("Firebase profile mapping", () => {
  it("maps authoritative achievement objects and all gameplay statistics", () => {
    const profile = toBridgeProfile(
      {uid: "player-1", displayName: "Nova", isAnonymous: false},
      {
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
});

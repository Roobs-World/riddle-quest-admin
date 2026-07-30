import type {BridgeProfile, BridgeUser} from "@qwordly/core/bridge";
import {restoreJestProfileWhileServerLoads} from "../playerData";

const user: BridgeUser = {uid: "player-1", isAnonymous: false};
const savedProfile: BridgeProfile = {
  username: "Nova",
  coins: 425,
  level: 6,
  xp: 740,
  winStreak: 4,
  gamesPlayed: 12,
  wins: 8,
  achievements: ["first_win"],
  classicIndex: 9,
  dailyChallengeIndex: 3,
  dailyChallengeCurrentQuestion: 2,
  dailyPuzzlesCompleted: 5,
  bestStreak: 7,
  totalWordsGuessed: 51,
  winRate: 66.7,
  averageGuesses: 3.2,
  totalScore: 1400,
  highestLevelClassic: 9,
  challengeWins: 3,
  totalWins: 8,
  totalGuessesInWins: 26,
  totalHintsUsed: 2,
};

it("restores every saved statistic from Jest while the authoritative profile loads", () => {
  expect(restoreJestProfileWhileServerLoads({user, profile: null}, savedProfile)).toEqual({
    user,
    profile: savedProfile,
  });
});

it("replaces the Jest cache with an available authoritative profile", () => {
  const authoritativeProfile = {...savedProfile, xp: 900, totalScore: 1600};
  expect(restoreJestProfileWhileServerLoads({user, profile: authoritativeProfile}, savedProfile)).toEqual({
    user,
    profile: authoritativeProfile,
  });
});

it("does not expose registered-player data without an authenticated user", () => {
  expect(restoreJestProfileWhileServerLoads({user: null, profile: null}, savedProfile)).toEqual({
    user: null,
    profile: null,
  });
});

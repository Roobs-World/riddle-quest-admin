import type {BridgeProfile, BridgeUser} from "@riddle-quest/core/bridge";
import {restoreProfileWhileServerLoads} from "../playerData";

/** Provides r. */
const user: BridgeUser = {uid: "player-1", isAnonymous: false};
/** Saves d profile. */
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

it("restores every saved statistic while the authoritative profile loads", () => {
  expect(restoreProfileWhileServerLoads({user, profile: null}, savedProfile)).toEqual({
    user,
    profile: savedProfile,
  });
});

it("replaces the display cache with an available authoritative profile", () => {
  /** Provides authoritative profile behavior. */
  const authoritativeProfile = {...savedProfile, xp: 900, totalScore: 1600};
  expect(restoreProfileWhileServerLoads({user, profile: authoritativeProfile}, savedProfile)).toEqual({
    user,
    profile: authoritativeProfile,
  });
});

it("does not expose registered-player data without an authenticated user", () => {
  expect(restoreProfileWhileServerLoads({user: null, profile: null}, savedProfile)).toEqual({
    user: null,
    profile: null,
  });
});

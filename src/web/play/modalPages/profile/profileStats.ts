import type {BridgeProfile} from "../../../../core/bridge";
import type {AchievementPlayerData} from "../../achievements";

/** Projects an optional bridge profile into the achievement evaluation contract. */
export const createAchievementPlayer = (profile: BridgeProfile | null): AchievementPlayerData => ({
  coins: profile?.coins ?? 0,
  hasPurchasedApp: profile?.hasPurchasedApp ?? false,
  progress: {
    classicIndex: profile?.classicIndex ?? 1,
    dailyChallengeIndex: profile?.dailyChallengeIndex ?? 0,
    dailyChallengeCurrentQuestion: profile?.dailyChallengeCurrentQuestion ?? 0,
  },
  stats: {
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
    dailyPuzzlesCompleted: profile?.dailyPuzzlesCompleted ?? 0,
    bestStreak: profile?.bestStreak ?? 0,
    totalWordsGuessed: profile?.totalWordsGuessed ?? 0,
    winRate: profile?.winRate ?? 0,
    averageGuesses: profile?.averageGuesses ?? 0,
    totalScore: profile?.totalScore ?? 0,
    highestLevelClassic: profile?.highestLevelClassic ?? 0,
    gamesPlayed: profile?.gamesPlayed ?? 0,
    wins: profile?.wins ?? 0,
    challengeWins: profile?.challengeWins ?? 0,
    winStreak: profile?.winStreak ?? 0,
    totalWins: profile?.totalWins ?? profile?.wins ?? 0,
    totalGuessesInWins: profile?.totalGuessesInWins ?? 0,
    totalHintsUsed: profile?.totalHintsUsed ?? 0,
    multiplayerGamesPlayed: profile?.multiplayerGamesPlayed ?? 0,
    multiplayerWins: profile?.multiplayerWins ?? 0,
    multiplayerChallengesCreated: profile?.multiplayerChallengesCreated ?? 0,
  },
});

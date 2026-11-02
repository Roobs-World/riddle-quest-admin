import {findNewMilestoneAchievementIds} from "@qwordly/core/game";
import type {BridgeProfile} from "@qwordly/core/bridge";

/** Terminal result fields that can be evaluated without trusting client rewards. */
export type AchievementCompletionPreview = {
  /** Single-player mode being completed. */ gameMode: "classic" | "challenge";
  /** Whether the locally scored terminal answer is correct. */ isCorrect: boolean;
  /** Number of guesses used. */ attempts: number;
  /** Whether the riddle has ended. */ gameOver: boolean;
};

/**
 * Predicts unlocks whose inputs are already present in the server-issued riddle
 * and profile projection. The backend remains authoritative and may add further
 * unlocks when its completion transaction reconciles XP, coins, and daily dates.
 */
export function predictCompletionAchievementIds(
  profile: BridgeProfile | null,
  completion: AchievementCompletionPreview,
): string[] {
  if (!profile || !completion.gameOver) return [];
  /** IDs already visible in the last authoritative/local profile projection. */
  const existing = new Set(profile.achievements);
  /** Projected aggregate values produced by a successful completion. */
  const gamesPlayed = profile.gamesPlayed + 1;
  /** Provides total wins behavior. */
  const totalWins = (profile.totalWins ?? profile.wins) + (completion.isCorrect ? 1 : 0);
  /** Provides total guesses in wins behavior. */
  const totalGuessesInWins = (profile.totalGuessesInWins ?? 0) +
    (completion.isCorrect ? completion.attempts : 0);
  /** Provides average guesses behavior. */
  const averageGuesses = totalWins > 0 ? Number((totalGuessesInWins / totalWins).toFixed(2)) : 0;
  /** Provides win rate behavior. */
  const winRate = Number(((totalWins / gamesPlayed) * 100).toFixed(2));
  /** Provides highest level classic behavior. */
  const highestLevelClassic = completion.gameMode === "classic" && completion.isCorrect
    ? Math.max(profile.highestLevelClassic ?? 0, profile.classicIndex + 1)
    : (profile.highestLevelClassic ?? 0);
  /** Provides daily puzzles completed behavior. */
  const dailyPuzzlesCompleted = (profile.dailyPuzzlesCompleted ?? 0) +
    (completion.gameMode === "challenge" && completion.isCorrect ? 1 : 0);
  /** Provides challenge wins behavior. */
  const challengeWins = (profile.challengeWins ?? 0) +
    (completion.gameMode === "challenge" && completion.isCorrect ? 1 : 0);
  /** Rules whose result does not depend on unprojected server-only state. */
  const rules: Array<readonly [string, boolean]> = [
    ["first_win", totalWins >= 1], ["wins_5", totalWins >= 5], ["wins_25", totalWins >= 25],
    ["wins_50", totalWins >= 50], ["wins_100", totalWins >= 100],
    ["win_rate_80", gamesPlayed >= 10 && winRate >= 80],
    ["efficient_10", totalWins >= 10 && averageGuesses <= 3],
    ["games_25", gamesPlayed >= 25], ["games_100", gamesPlayed >= 100],
    ["classic_10", highestLevelClassic >= 10], ["classic_25", highestLevelClassic >= 25],
    ["classic_50", highestLevelClassic >= 50], ["classic_100", highestLevelClassic >= 100],
    ["daily_completed", dailyPuzzlesCompleted >= 1], ["daily_7", dailyPuzzlesCompleted >= 7],
    ["daily_30", dailyPuzzlesCompleted >= 30], ["daily_100", dailyPuzzlesCompleted >= 100],
    ["challenge_5", challengeWins >= 5], ["challenge_25", challengeWins >= 25],
    ["challenge_50", challengeWins >= 50],
    ["perfect_guess", completion.isCorrect && completion.attempts === 1],
    ["classic_perfect", completion.gameMode === "classic" && completion.isCorrect && completion.attempts === 1],
    ["challenge_perfect", completion.gameMode === "challenge" && completion.isCorrect && completion.attempts === 1],
    ["last_chance", completion.isCorrect && completion.attempts === 5],
    ["classic_last_chance", completion.gameMode === "classic" && completion.isCorrect && completion.attempts === 5],
    ["challenge_last_chance", completion.gameMode === "challenge" && completion.isCorrect && completion.attempts === 5],
    ["lesson_learned", !completion.isCorrect],
  ];
  rules.push(...findNewMilestoneAchievementIds({
    totalWins, gamesPlayed, highestLevelClassic, dailyPuzzlesCompleted, challengeWins,
  }, profile.achievements).map((id): readonly [string, boolean] => [id, true]));
  return rules.filter(([id, unlocked]) => unlocked && !existing.has(id)).map(([id]) => id);
}


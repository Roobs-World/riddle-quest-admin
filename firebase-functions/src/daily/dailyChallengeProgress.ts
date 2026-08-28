import type {Player} from "../validation/firestoreSchemas";
import {getUtcDayString} from "./dailyStreak";

/** Defines the contract for daily challenge progress. */
export interface DailyChallengeProgress {
  /** Stores current question. */
  currentQuestion: number;
  /** Stores has completed today. */
  hasCompletedToday: boolean;
  /** Stores questions completed. */
  questionsCompleted: number;
}

/** Indicates whether is completed today. */
function isCompletedToday(lastCompletedAt: unknown): boolean {
  /** Provides last completed day behavior. */
  const lastCompletedDay = getUtcDayString(lastCompletedAt);
  if (!lastCompletedDay) return false;
  return lastCompletedDay === new Date().toISOString().split("T")[0];
}

/** Resolves daily progress without a database-wide reset at UTC midnight. */
export function resolveDailyChallengeProgress(user: Player | undefined, questionCount: number): DailyChallengeProgress {
  if (!user) {
    return {currentQuestion: 0, hasCompletedToday: false, questionsCompleted: 0};
  }

  /** Indicates whether has completed today. */
  const hasCompletedToday = isCompletedToday(user.lastDailyChallengeCompletedAt);
  /** Stores d question. */
  const storedQuestion = user.progress?.dailyChallengeCurrentQuestion ?? 0;
  return {
    hasCompletedToday,
    currentQuestion: hasCompletedToday ? Math.min(storedQuestion, questionCount) : 0,
    questionsCompleted: hasCompletedToday ? questionCount : 0,
  };
}

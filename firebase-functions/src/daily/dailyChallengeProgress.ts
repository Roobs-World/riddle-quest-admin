import type {Player} from "../validation/firestoreSchemas";
import {coerceToDate} from "./dailyStreak";
import {getDailyDate} from "../../../src/gameplay/daily/dailyCalendar.js";

/** Defines the contract for daily challenge progress. */
export interface DailyChallengeProgress {
  /** Stores current question. */
  currentQuestion: number;
  /** Stores has completed today. */
  hasCompletedToday: boolean;
  /** Stores questions completed. */
  questionsCompleted: number;
}

/** Resolves daily progress without a database-wide reset at regional midnight. */
export function resolveDailyChallengeProgress(user: Player | undefined, questionCount: number, locale = "en"): DailyChallengeProgress {
  if (!user) {
    return {currentQuestion: 0, hasCompletedToday: false, questionsCompleted: 0};
  }

  /** Indicates whether has completed today. */
  const completedAt = coerceToDate(user.lastDailyChallengeCompletedAt);
  /** Stored completion date or legacy timestamp interpreted in the requested locale. */
  const completedDay = user.lastCompletedDailyChallengeKey ?? (completedAt ? getDailyDate(locale, completedAt) : undefined);
  /** Whether stored completion already covers the current regional Daily date. */
  const hasCompletedToday = !!completedDay && completedDay >= getDailyDate(locale);
  /** Stores d question. */
  const storedQuestion = user.progress?.dailyChallengeCurrentQuestion ?? 0;
  return {
    hasCompletedToday,
    currentQuestion: hasCompletedToday ? Math.min(storedQuestion, questionCount) : 0,
    questionsCompleted: hasCompletedToday ? questionCount : 0,
  };
}

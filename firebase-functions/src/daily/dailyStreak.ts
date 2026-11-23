import {getDailyDate, shiftDailyDate} from "../../../src/gameplay/daily/dailyCalendar.js";
/** Describes timestamp like. */
type TimestampLike = {
  /** Stores to date. */
  toDate?: () => Date;
  /** Stores to millis. */
  toMillis?: () => number;
  /** Stores seconds. */
  seconds?: number;
  /** Stores nanoseconds. */
  nanoseconds?: number;
  /** Stores seconds. */
  _seconds?: number;
  /** Stores nanoseconds. */
  _nanoseconds?: number;
};

/** Converts Firestore timestamp variants and common date inputs to a Date. */
export function coerceToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;

  if (typeof value === "number" || typeof value === "string") {
    /** Parses d. */
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value !== "object") return null;
  /** Provides timestamp behavior. */
  const timestamp = value as TimestampLike;

  if (typeof timestamp.toDate === "function") {
    /** Parses d. */
    const parsed = timestamp.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.toMillis === "function") {
    /** Parses d. */
    const parsed = new Date(timestamp.toMillis());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Provides seconds behavior. */
  const seconds =
    typeof timestamp.seconds === "number"
      ? timestamp.seconds
      : typeof timestamp._seconds === "number"
        ? timestamp._seconds
        : null;
  if (seconds === null) return null;

  /** Provides nanos behavior. */
  const nanos =
    typeof timestamp.nanoseconds === "number"
      ? timestamp.nanoseconds
      : typeof timestamp._nanoseconds === "number"
        ? timestamp._nanoseconds
        : 0;
  /** Parses d. */
  const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Gets utc day string. */
export function getUtcDayString(value: unknown): string | null {
  /** Provides date behavior. */
  const date = coerceToDate(value);
  return date ? date.toISOString().split("T")[0] : null;
}

/** Gets yesterday utc day string. */
export function getYesterdayUtcDayString(now: Date = new Date()): string {
  /** Provides yesterday behavior. */
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

/** Reads a legacy completion timestamp in the authoritative session’s regional clock. */
export function getCompletionDay(value: unknown, locale: string): string | null {
  /** Legacy completion timestamp parsed before regional calendar conversion. */
  const date = coerceToDate(value);
  return date ? getDailyDate(locale, date) : null;
}

/** Computes next daily win streak. */
export function computeNextDailyWinStreak(
  currentWinStreak: number,
  lastDailyChallengeCompletedAt: unknown,
  now: Date = new Date(),
  locale = "UTC",
  lastCompletedKey?: string,
): number {
  return (lastCompletedKey ?? getCompletionDay(lastDailyChallengeCompletedAt, locale)) === shiftDailyDate(getDailyDate(locale, now), -1) ? currentWinStreak + 1 : 1;
}

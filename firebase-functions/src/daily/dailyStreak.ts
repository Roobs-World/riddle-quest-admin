type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

/** Converts Firestore timestamp variants and common date inputs to a Date. */
export function coerceToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value !== "object") return null;
  const timestamp = value as TimestampLike;

  if (typeof timestamp.toDate === "function") {
    const parsed = timestamp.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.toMillis === "function") {
    const parsed = new Date(timestamp.toMillis());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const seconds = typeof timestamp.seconds === "number"
    ? timestamp.seconds
    : typeof timestamp._seconds === "number"
      ? timestamp._seconds
      : null;
  if (seconds === null) return null;

  const nanos = typeof timestamp.nanoseconds === "number"
    ? timestamp.nanoseconds
    : typeof timestamp._nanoseconds === "number"
      ? timestamp._nanoseconds
      : 0;
  const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getUtcDayString(value: unknown): string | null {
  const date = coerceToDate(value);
  return date ? date.toISOString().split("T")[0] : null;
}

export function getYesterdayUtcDayString(now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function computeNextDailyWinStreak(
  currentWinStreak: number,
  lastDailyChallengeCompletedAt: unknown,
  now: Date = new Date(),
): number {
  return getUtcDayString(lastDailyChallengeCompletedAt) === getYesterdayUtcDayString(now)
    ? currentWinStreak + 1
    : 1;
}

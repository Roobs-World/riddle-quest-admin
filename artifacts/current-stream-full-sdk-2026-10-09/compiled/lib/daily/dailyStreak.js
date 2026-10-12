"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceToDate = coerceToDate;
exports.getUtcDayString = getUtcDayString;
exports.getYesterdayUtcDayString = getYesterdayUtcDayString;
exports.getCompletionDay = getCompletionDay;
exports.computeNextDailyWinStreak = computeNextDailyWinStreak;
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
/** Converts Firestore timestamp variants and common date inputs to a Date. */
function coerceToDate(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value;
    if (typeof value === "number" || typeof value === "string") {
        /** Parses d. */
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value !== "object")
        return null;
    /** Provides timestamp behavior. */
    const timestamp = value;
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
    const seconds = typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
            ? timestamp._seconds
            : null;
    if (seconds === null)
        return null;
    /** Provides nanos behavior. */
    const nanos = typeof timestamp.nanoseconds === "number"
        ? timestamp.nanoseconds
        : typeof timestamp._nanoseconds === "number"
            ? timestamp._nanoseconds
            : 0;
    /** Parses d. */
    const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
/** Gets utc day string. */
function getUtcDayString(value) {
    /** Provides date behavior. */
    const date = coerceToDate(value);
    return date ? date.toISOString().split("T")[0] : null;
}
/** Gets yesterday utc day string. */
function getYesterdayUtcDayString(now = new Date()) {
    /** Provides yesterday behavior. */
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().split("T")[0];
}
/** Reads a legacy completion timestamp in the authoritative session’s regional clock. */
function getCompletionDay(value, locale) {
    /** Legacy completion timestamp parsed before regional calendar conversion. */
    const date = coerceToDate(value);
    return date ? (0, dailyCalendar_1.getDailyDate)(locale, date) : null;
}
/** Computes next daily win streak. */
function computeNextDailyWinStreak(currentWinStreak, lastDailyChallengeCompletedAt, now = new Date(), locale = "UTC", lastCompletedKey) {
    return (lastCompletedKey ?? getCompletionDay(lastDailyChallengeCompletedAt, locale)) === (0, dailyCalendar_1.shiftDailyDate)((0, dailyCalendar_1.getDailyDate)(locale, now), -1) ? currentWinStreak + 1 : 1;
}
//# sourceMappingURL=dailyStreak.js.map
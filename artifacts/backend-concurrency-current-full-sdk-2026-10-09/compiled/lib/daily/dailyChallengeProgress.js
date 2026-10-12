"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDailyChallengeProgress = resolveDailyChallengeProgress;
const dailyStreak_1 = require("./dailyStreak");
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
/** Resolves daily progress without a database-wide reset at regional midnight. */
function resolveDailyChallengeProgress(user, questionCount, locale = "en") {
    if (!user) {
        return { currentQuestion: 0, hasCompletedToday: false, questionsCompleted: 0 };
    }
    /** Indicates whether has completed today. */
    const completedAt = (0, dailyStreak_1.coerceToDate)(user.lastDailyChallengeCompletedAt);
    /** Stored completion date or legacy timestamp interpreted in the requested locale. */
    const completedDay = user.lastCompletedDailyChallengeKey ?? (completedAt ? (0, dailyCalendar_1.getDailyDate)(locale, completedAt) : undefined);
    /** Whether stored completion already covers the current regional Daily date. */
    const hasCompletedToday = !!completedDay && completedDay >= (0, dailyCalendar_1.getDailyDate)(locale);
    /** Stores d question. */
    const storedQuestion = user.progress?.dailyChallengeCurrentQuestion ?? 0;
    return {
        hasCompletedToday,
        currentQuestion: hasCompletedToday ? Math.min(storedQuestion, questionCount) : 0,
        questionsCompleted: hasCompletedToday ? questionCount : 0,
    };
}
//# sourceMappingURL=dailyChallengeProgress.js.map
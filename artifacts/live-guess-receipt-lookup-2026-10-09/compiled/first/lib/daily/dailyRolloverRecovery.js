"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcilePreviousDailyBinding = reconcilePreviousDailyBinding;
const dailyCalendar_1 = require("@qwordly/core/validation/dailyCalendar");
const firestoreService_1 = require("../gameplay/firestoreService");
const singlePlayerAnswerPolicy_1 = require("../gameplay/singlePlayerAnswerPolicy");
const singlePlayerTerminalRecovery_1 = require("../gameplay/singlePlayerTerminalRecovery");
/** Recovers a just-finished previous-day win when local resume data was lost. */
async function reconcilePreviousDailyBinding(userId, user, isAnonymous, locale = "UTC") {
    /** Provides now behavior. */
    const now = new Date();
    /** Provides today behavior. */
    const today = (0, dailyCalendar_1.getDailyDate)(locale, now);
    // The authority checks the saved session's locale and grace window. A newly
    // selected locale must not discard a valid terminal from another clock.
    if (user.lastDailyChallengeAttemptedKey === today)
        return user;
    /** Previous calendar day rather than a fixed 24-hour subtraction across DST. */
    const challengeDate = (0, dailyCalendar_1.shiftDailyDate)(today, -1);
    /** Provides recovered behavior. */
    const recovered = await (0, singlePlayerTerminalRecovery_1.recoverPendingAuthoritativeCompletion)(userId, "challenge", (0, singlePlayerAnswerPolicy_1.getSinglePlayerCompletionKey)("challenge", challengeDate), isAnonymous, now);
    if (!recovered)
        return user;
    return (await (0, firestoreService_1.getUser)(userId)) ?? user;
}
//# sourceMappingURL=dailyRolloverRecovery.js.map
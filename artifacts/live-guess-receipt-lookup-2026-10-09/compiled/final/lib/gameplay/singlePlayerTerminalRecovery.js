"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverPendingAuthoritativeCompletion = recoverPendingAuthoritativeCompletion;
const completeGameLogic_1 = require("./completeGameLogic");
const singlePlayerCompletionBinding_1 = require("./singlePlayerCompletionBinding");
/** Parses a trusted Firestore terminal timestamp. */
const trustedTerminalDate = (value) => {
    if (typeof value !== "object" || value === null || !("toDate" in value) || typeof value.toDate !== "function") {
        return undefined;
    }
    /** Parses d. */
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
};
/** Replays one server-proven pending terminal completion without a client resume token. */
async function recoverPendingAuthoritativeCompletion(userId, gameMode, completionKey, isAnonymous, now = new Date()) {
    /** Provides bound behavior. */
    const bound = await (0, singlePlayerCompletionBinding_1.getCompletionBoundAuthoritativeSession)(userId, gameMode, completionKey);
    if (!bound || !bound.state.terminal || bound.state.isSkipped)
        return false;
    if (gameMode === "challenge" &&
        !(0, completeGameLogic_1.isDailyCompletionDateEligible)(bound.state.challengeDate, bound.state.isCorrect, trustedTerminalDate(bound.state.terminalAt), now, bound.state.locale))
        return false;
    await (0, completeGameLogic_1.completeAuthoritativeGame)({ riddleId: bound.state.riddleId, gameMode, sessionToken: bound.sessionToken }, { uid: userId, isAnonymous });
    return true;
}
//# sourceMappingURL=singlePlayerTerminalRecovery.js.map
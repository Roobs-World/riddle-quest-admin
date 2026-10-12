"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceTimelineAgrees = raceTimelineAgrees;
const race_1 = require("@qwordly/core/race");
/** Checks known contiguous event facts and aggregate bounds, including historical non-clearing skips. */
function raceTimelineAgrees(events, authority) {
    if (events.length > race_1.RACE_RULES.deckSize * (race_1.RACE_RULES.maxHintsPerRiddle + 1))
        return false;
    if (authority.totalPenaltyMs !== undefined && !Number.isSafeInteger(authority.totalPenaltyMs) ||
        authority.acceptedWallMs !== undefined && authority.acceptedWallMs < 0)
        return false;
    /** Charged actions in retained history are a lower bound, never a reconstructed legacy total. */
    let hints = 0, skips = 0;
    /** Retained hints are counted independently for each owned prompt. */
    const questionHints = new Map();
    for (const [index, event] of events.entries()) {
        if (![event.wallElapsedMs, event.totalPenaltyMs, event.adjustedElapsedMs].every(Number.isSafeInteger) ||
            event.sequence !== index || event.riddlePosition >= authority.deckSize ||
            event.correctCount > authority.correctCount || event.correctCount > event.riddlePosition + (event.type === "hint" ? 0 : 1) ||
            event.type === "correct" && event.correctCount === 0 || event.totalPenaltyMs < event.penaltyAddedMs ||
            authority.totalPenaltyMs !== undefined && event.totalPenaltyMs > authority.totalPenaltyMs ||
            authority.currentPosition !== undefined && event.riddlePosition > authority.currentPosition ||
            authority.acceptedWallMs !== undefined && event.wallElapsedMs > authority.acceptedWallMs ||
            authority.adjustedFinishMs !== undefined && event.adjustedElapsedMs > authority.adjustedFinishMs)
            return false;
        /** Previous retained action fixes the next question, minimum cumulative charge and score delta. */
        const previous = events[index - 1];
        if (previous) {
            /** Older skipped questions did not count toward ten; both historical and current scoring remain supported. */
            const delta = event.correctCount - previous.correctCount;
            if (event.wallElapsedMs < previous.wallElapsedMs || event.totalPenaltyMs < previous.totalPenaltyMs + event.penaltyAddedMs ||
                event.riddlePosition !== previous.riddlePosition + (previous.type === "hint" ? 0 : 1) ||
                (event.type === "correct" ? delta !== 1 : event.type === "hint" ? delta !== 0 : delta !== 0 && delta !== 1))
                return false;
        }
        if (event.type === "hint") {
            hints += event.penaltyAddedMs;
            /** A missing historical prefix cannot make the retained suffix exceed the actual hint limit. */
            const count = (questionHints.get(event.riddlePosition) ?? 0) + 1;
            questionHints.set(event.riddlePosition, count);
            if (count > authority.hintLimits[event.riddlePosition])
                return false;
        }
        if (event.type === "skip")
            skips += event.penaltyAddedMs;
    }
    /** The current prompt follows clearing events except when the final clearing event ended the run. */
    const last = events.at(-1);
    return !(authority.hintPenaltyMs !== undefined && hints > authority.hintPenaltyMs ||
        authority.skipPenaltyMs !== undefined && skips > authority.skipPenaltyMs ||
        authority.live && last && last.type !== "hint" && authority.currentPosition === last.riddlePosition);
}
//# sourceMappingURL=raceStoredTimeline.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveRun = liveRun;
exports.liveOperationAtMs = liveOperationAtMs;
exports.advanceLiveBot = advanceLiveBot;
exports.liveView = liveView;
const race_1 = require("@qwordly/core/race");
const raceEngine_1 = require("./raceEngine");
const raceLiveScoring_1 = require("./raceLiveScoring");
/** Creates an unscored server run using existing riddle and hint rules. */
function liveRun(base, userId, runId, startsAtMs = 0) {
    return { ...base, runId, userId, deckId: runId, role: "creator", status: startsAtMs ? "scheduled" : "prepared",
        rulesVersion: race_1.RACE_RULES.version, rulesSnapshot: race_1.RACE_RULES, evaluationPolicy: "server-only",
        currentPosition: 0, correctCount: 0, guessesUsed: 0, guessHistory: [], hintUsed: false,
        revealedLetters: [], readinessAcceptedAtMs: Math.max(0, startsAtMs - race_1.LIVE_RACE_COUNTDOWN_MS), startedAtMs: startsAtMs, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [] };
}
/** Fixed server-owned interval between fallback bot solves. */
const LIVE_BOT_SOLVE_MS = 12_000;
/** Reads and commands share a persisted clock floor, including pre-marker accepted events and bot progress. */
function liveOperationAtMs(ticket, match, sampledAtMs) {
    return Math.max(sampledAtMs, ticket.createdAtMs, ticket.seenAtMs, match?.observedAtMs ?? 0, ...(match?.runs.map(run => (0, raceEngine_1.raceOperationAtMs)({ ...run,
        readinessAcceptedAtMs: run.readinessAcceptedAtMs ?? Math.max(0, match.startsAtMs - race_1.LIVE_RACE_COUNTDOWN_MS) }, sampledAtMs)) ?? []), match?.tickets[1] === null && match.runs[1].correctCount > 0
        ? match.startsAtMs + match.runs[1].correctCount * LIVE_BOT_SOLVE_MS : 0);
}
/** Bot progress is computed live by the authority, never replayed from a recording. */
function advanceLiveBot(match, nowMs) {
    if (match.tickets[1] !== null || match.winner !== undefined || nowMs < match.startsAtMs)
        return false;
    /** Provides count behavior. */
    const count = Math.max(match.runs[1].correctCount, Math.min(race_1.RACE_RULES.targetCorrect, Math.floor((nowMs - match.startsAtMs) / LIVE_BOT_SOLVE_MS)));
    if (count <= match.runs[1].correctCount)
        return false;
    match.runs[1] = { ...match.runs[1], status: count === race_1.RACE_RULES.targetCorrect ? "completed" : "active", correctCount: count,
        lastActionAtMs: Math.max(nowMs, match.runs[1].lastActionAtMs ?? 0),
        ...(count === race_1.RACE_RULES.targetCorrect ? { wallFinishMs: count * LIVE_BOT_SOLVE_MS,
            finishedAtMs: match.startsAtMs + count * LIVE_BOT_SOLVE_MS } : {}) };
    return true;
}
/** Projects only the viewer's prompt and confirmed rival progress, without either answer. */
function liveView(ticketId, ticket, match, nowMs) {
    /** Viewer projection never predates accepted progress from either seat. */
    const observedAtMs = liveOperationAtMs(ticket, match, nowMs);
    /** Provides seat behavior. */
    const seat = match?.tickets[0] === ticketId ? 0 : 1;
    /** Provides own behavior. */
    const own = match?.runs[seat];
    /** Provides rival behavior. */
    const rival = match?.runs[1 - seat];
    /** Provides terminal behavior. */
    const terminal = match?.winner !== undefined;
    /** Provides run behavior. */
    const run = own ? (0, raceEngine_1.toRaceRunView)(own, observedAtMs, false, true) : null;
    if (run && match) {
        run.opponent = { displayName: match.players[1 - seat].displayName,
            avatarUrl: match.players[1 - seat].avatarUrl, adjustedFinishMs: (0, raceLiveScoring_1.liveFinishMs)(rival) ?? race_1.RACE_RULES.maxAdjustedTimeMs,
            events: [] };
        if (terminal) {
            run.status = "completed";
            run.currentRiddle = null;
        }
        // Neither seat can inspect a question before the same authoritative start boundary.
        else if (observedAtMs < match.startsAtMs)
            run.currentRiddle = null;
    }
    return race_1.LiveRaceViewSchema.parse({ ticketId, phase: ticket.cancelled ? "cancelled" : !match ? "searching" :
            terminal ? "result" : observedAtMs < match.startsAtMs ? "countdown" : "racing",
        serverNowMs: observedAtMs, searchEndsAtMs: ticket.createdAtMs + (ticket.privateChallenge ? race_1.LIVE_RACE_INVITE_MS : 60_000), startsAtMs: match?.startsAtMs ?? null,
        player: { ...ticket.player, correctCount: own?.correctCount ?? 0 },
        opponent: match ? { ...match.players[1 - seat], correctCount: rival?.correctCount ?? 0 } : null,
        ...(own ? { actionAvailableAtMs: own.startedAtMs } : {}),
        ...(ticket.privateChallenge ? { challengeId: `live_${ticketId}` } : {}),
        run, result: terminal ? match.winner === null ? "tie" : match.winner === seat ? "win" : "loss" : null,
        rewardCoins: terminal && match.winner === seat ? match.rewardCoins ?? 0 : 0,
        ...(terminal && own?.settlementCoins != null ? { newCoins: own.settlementCoins } :
            terminal && match.winner === seat && match.rewardCoins === race_1.LIVE_RACE_WIN_COINS ? { newCoins: match.newCoins } : {}) });
}

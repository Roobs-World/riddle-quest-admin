"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProviderLiveTournamentRun = readProviderLiveTournamentRun;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const raceSetupService_1 = require("./raceSetupService");
const redditSecurity_1 = require("../reddit/redditSecurity");
const raceLivePrivacy_1 = require("./raceLivePrivacy");
/** Resolves a completed human victory from the private live transaction records. */
async function readProviderLiveTournamentRun(transaction, db, userId, ticketId, provider) {
    /** Provider scope is fixed by the server recorder, never a client field. */
    const validOwner = provider === "facebook" ? facebookSecurity_1.isFacebookFirebaseUid : redditSecurity_1.isRedditFirebaseUid;
    if (!/^[a-f0-9]{64}$/.test(ticketId))
        throw new https_1.HttpsError("not-found", "Tournament race run was not found.");
    /** Private source ticket must belong to the authenticated tournament entrant. */
    const ticket = (await transaction.get(db.doc(`liveRaceTickets/${ticketId}`))).data();
    if (!ticket)
        throw new https_1.HttpsError("not-found", "Tournament live ticket was not found.");
    if (!validOwner(userId) || ticket.userId !== userId) {
        throw new https_1.HttpsError("permission-denied", "Tournament live ticket ownership is invalid.");
    }
    if (ticket.cancelled || typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId)) {
        throw new https_1.HttpsError("failed-precondition", "Only settled live solve victories qualify.");
    }
    /** Settled private match binds the winner seat to the creator deck. */
    const match = (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data();
    if (!match || !Array.isArray(match.tickets) || match.tickets.length !== 2 ||
        !Array.isArray(match.runs) || match.runs.length !== 2 ||
        typeof match.tickets[0] !== "string" || !/^[a-f0-9]{64}$/.test(match.tickets[0]) ||
        match.tickets[0] !== ticket.matchId || match.tickets[0] === match.tickets[1]) {
        throw new https_1.HttpsError("data-loss", "Tournament live match binding is invalid.");
    }
    /** Source ticket position must equal the authoritative winner seat. */
    const seat = match.tickets.indexOf(ticketId);
    if (seat < 0 || match.winner !== seat) {
        throw new https_1.HttpsError("failed-precondition", "Only the human solve winner qualifies.");
    }
    // Public result projections mark both players completed, including forfeits.
    // Only the private run retains genuine ten-riddle completion and its clocks.
    /** Private winner run distinguishes ten-riddle completion from public terminal projections. */
    const stored = match.runs[seat];
    if (!stored || stored.status !== "completed" || stored.correctCount !== race_1.RACE_TARGET_CORRECT) {
        throw new https_1.HttpsError("failed-precondition", "Only completed authoritative live solve runs qualify.");
    }
    // Live matches have a five-second shared countdown; recorded races use three.
    // Validate that binding here before applying the common scoring/deck validator.
    /** Live countdown metadata is separated before applying the shared run validator. */
    const { readinessAcceptedAtMs, ...record } = stored;
    if (!Number.isSafeInteger(match.startsAtMs) || match.startsAtMs <= 0 ||
        readinessAcceptedAtMs !== match.startsAtMs - race_1.LIVE_RACE_COUNTDOWN_MS) {
        throw new https_1.HttpsError("data-loss", "Tournament live countdown binding is invalid.");
    }
    /** Validated winner run supplies authoritative completion and scoring facts. */
    const run = (0, raceSetupService_1.parseRunRecord)(record, ticketId);
    if (run.userId !== userId || run.deckId !== ticketId || run.evaluationPolicy !== "server-only" ||
        run.status !== "completed" || run.correctCount !== race_1.RACE_TARGET_CORRECT ||
        run.events.filter(event => event.type === "correct" || event.type === "skip").length !== race_1.RACE_TARGET_CORRECT ||
        run.startedAtMs !== match.startsAtMs) {
        throw new https_1.HttpsError("failed-precondition", "Only completed authoritative live solve runs qualify.");
    }
    // Both seats play the creator's frozen deck. The joiner's earlier search deck
    // is unrelated and must never be used to validate its winning match run.
    /** Both seats must be scored against the creator ticket frozen at match creation. */
    const creator = seat === 0 ? ticket : (await transaction.get(db.doc(`liveRaceTickets/${match.tickets[0]}`))).data();
    /** Creator run supplies immutable source riddles and rule versions. */
    const source = creator?.run;
    /** An anonymous retained creator deck may still validate a surviving winner. */
    const deletedCreator = creator?.deleted === true && creator.cancelled === true && match.deletedSeats?.[0] === true &&
        creator.userId === raceLivePrivacy_1.DELETED_LIVE_RACE_USER_ID;
    if (!creator || creator.matchId !== ticket.matchId || !(validOwner(creator.userId) || deletedCreator) ||
        source?.userId !== creator.userId || source?.runId !== match.tickets[0] || source?.deckId !== match.tickets[0] ||
        match.runs[0]?.userId !== creator.userId || creator.pool !== ticket.pool ||
        source.locale !== run.locale || source.categoryId !== run.categoryId || source.rulesVersion !== run.rulesVersion ||
        source.contentVersion !== run.contentVersion || !Array.isArray(source.riddles) ||
        source.riddles.length !== run.riddles.length || source.riddles.some((riddle, position) => {
        if (!riddle || typeof riddle !== "object")
            return true;
        /** Source and winner riddles must agree on canonical identity and content. */
        const original = riddle, actual = run.riddles[position];
        return original.riddleId !== actual.riddleId || original.canonicalRiddleId !== actual.canonicalRiddleId ||
            original.position !== actual.position || original.text !== actual.text || original.answer !== actual.answer;
    })) {
        throw new https_1.HttpsError("data-loss", "Tournament live deck binding is invalid.");
    }
    return { run, deck: { deckId: run.deckId, locale: run.locale, categoryId: run.categoryId,
            rulesVersion: run.rulesVersion, canonicalRiddleIds: source.riddles.map((riddle) => riddle.canonicalRiddleId) } };
}
//# sourceMappingURL=raceLiveTournament.js.map
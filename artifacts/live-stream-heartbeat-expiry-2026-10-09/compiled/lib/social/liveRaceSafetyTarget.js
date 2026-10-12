"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLiveRaceSafetyTarget = resolveLiveRaceSafetyTarget;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("../race/raceEligibility");
/** Resolves only the human opponent of an authenticated, retained live seat in the mutation transaction. */
async function resolveLiveRaceSafetyTarget(transaction, db, userId, liveTicketId, nowMs) {
    if (!(0, raceEligibility_1.raceProviderScope)(userId) || !/^[a-f0-9]{64}$/.test(liveTicketId))
        throw new https_1.HttpsError("invalid-argument", "Invalid live safety seat.");
    /** Ownership is checked before following any private match binding. */
    const ticket = (await transaction.get(db.doc(`liveRaceTickets/${liveTicketId}`))).data();
    if (!ticket || ticket.userId !== userId)
        throw new https_1.HttpsError("permission-denied", "Live safety seat ownership is required.");
    if (ticket.deleted || ticket.cancelled || ticket.run?.userId !== userId || ticket.run?.runId !== liveTicketId ||
        typeof ticket.pool !== "string" || !/^[a-f0-9]{64}$/.test(ticket.pool) ||
        ticket.pool !== (0, node_crypto_1.createHash)("sha256").update(`${(0, raceEligibility_1.raceProviderScope)(userId)}:${ticket.run?.locale}:${ticket.run?.categoryId}`).digest("hex") ||
        typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId) ||
        !ticket.expiresAt || typeof ticket.expiresAt.toMillis !== "function" || nowMs >= ticket.expiresAt.toMillis())
        throw new https_1.HttpsError("failed-precondition", "Live safety seat is unavailable.");
    /** The private pair identifies the opponent; no target identity is accepted from the caller. */
    const match = (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data();
    if (!match || !Array.isArray(match.tickets) || match.tickets.length !== 2 || match.tickets[0] !== ticket.matchId ||
        !Array.isArray(match.runs) || match.runs.length !== 2 || !Array.isArray(match.players) || match.players.length !== 2)
        throw new https_1.HttpsError("data-loss", "Invalid live safety match binding.");
    /** The viewer must occupy exactly one independently identified seat. */
    const seat = match.tickets.indexOf(liveTicketId), rivalSeat = 1 - seat;
    if (seat < 0 || match.tickets[0] === match.tickets[1] || match.runs[seat]?.userId !== userId || match.runs[seat]?.runId !== liveTicketId)
        throw new https_1.HttpsError("data-loss", "Invalid live safety seat binding.");
    /** Bots and anonymized deleted seats never become moderation targets. */
    const rivalTicketId = match.tickets[rivalSeat];
    if (typeof rivalTicketId !== "string" || !/^[a-f0-9]{64}$/.test(rivalTicketId) || match.deletedSeats?.[seat] ||
        match.deletedSeats?.[rivalSeat] || match.players[rivalSeat]?.bot !== false)
        throw new https_1.HttpsError("failed-precondition", "No retained human live opponent.");
    /** Independent opponent ticket must agree with the same provider and match. */
    const rival = (await transaction.get(db.doc(`liveRaceTickets/${rivalTicketId}`))).data();
    if (!rival || rival.deleted || rival.cancelled || rival.userId === userId || !(0, raceEligibility_1.raceProviderScope)(rival.userId) ||
        (0, raceEligibility_1.raceProviderScope)(rival.userId) !== (0, raceEligibility_1.raceProviderScope)(userId) || rival.pool !== ticket.pool ||
        rival.matchId !== ticket.matchId || rival.run?.userId !== rival.userId || rival.run?.runId !== rivalTicketId ||
        rival.run?.locale !== ticket.run?.locale || rival.run?.categoryId !== ticket.run?.categoryId ||
        match.runs[rivalSeat]?.userId !== rival.userId || match.runs[rivalSeat]?.runId !== rivalTicketId ||
        !rival.expiresAt || typeof rival.expiresAt.toMillis !== "function" || nowMs >= rival.expiresAt.toMillis())
        throw new https_1.HttpsError("failed-precondition", "Live opponent binding is unavailable.");
    /** Canonical existence and deletion guards are read under the same transaction lock. */
    const [owner, opponent, ownerDeletion, opponentDeletion] = await Promise.all([
        transaction.get(db.doc(`users/${userId}`)), transaction.get(db.doc(`users/${rival.userId}`)),
        transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, rival.userId)),
    ]);
    if (!owner.exists || !opponent.exists || ownerDeletion.exists || opponentDeletion.exists)
        throw new https_1.HttpsError("failed-precondition", "Live safety account is unavailable.");
    return rival.userId;
}
//# sourceMappingURL=liveRaceSafetyTarget.js.map
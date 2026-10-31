"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmLiveGuessReceiptForUser = confirmLiveGuessReceiptForUser;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("./raceEligibility");
const raceRollout_1 = require("./raceRollout");
const raceSetupService_1 = require("./raceSetupService");
/** Rejects missing, malformed or logically expired private records before exposing proof. */
function retained(record, nowMs) {
    /** Only a real Firestore timestamp supplies the private retention deadline. */
    const expiry = record?.expiresAt;
    return expiry instanceof firebaseAdmin_1.admin.firestore.Timestamp && Number.isFinite(expiry.toMillis()) && expiry.toMillis() > nowMs;
}
/** Reads immutable command evidence without renewing, scoring, settling or writing any state. */
async function confirmLiveGuessReceiptForUser(userId, request, options = {}) {
    /** Strict parsing also protects direct gateway/service callers. */
    const input = race_1.LiveGuessReceiptQuerySchema.parse(request), provider = (0, raceEligibility_1.raceProviderScope)(userId);
    /** The authenticated namespace and server clock must be valid before private reads. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore(), nowMs = options.nowMs ?? Date.now();
    if (!provider || !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8_640_000_000_000_000)
        throw new https_1.HttpsError("permission-denied", "Live receipt unavailable.");
    return db.runTransaction(async (tx) => {
        /** Access and deletion share the proof snapshot; no operation lease or canonical write is needed. */
        const [owner, deletion, rollout, snapshot] = await tx.getAll(db.doc(`users/${userId}`), (0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId), db.doc("raceConfig/rollout"), db.doc(`liveRaceTickets/${input.ticketId}`));
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!owner.exists)
            throw new https_1.HttpsError("not-found", "Player profile unavailable.");
        /** A foreign or malformed locator reveals no proof or opponent identity. */
        const ticket = snapshot.data();
        if (!ticket || ticket.userId !== userId || ticket.deleted || ticket.cancelled || !retained(ticket, nowMs) ||
            ticket.run?.userId !== userId || ticket.run?.runId !== input.ticketId ||
            typeof ticket.matchId !== "string" || !/^[a-f0-9]{64}$/.test(ticket.matchId))
            return { status: "unconfirmed" };
        if ((provider === "jest" && ticket.run.locale !== "en") || !(0, raceRollout_1.evaluateRaceRollout)(rollout.data(), userId, ticket.run.locale).enabled)
            throw new https_1.HttpsError("permission-denied", "Live receipt unavailable.");
        if (ticket.pool !== (0, node_crypto_1.createHash)("sha256").update(`${provider}:${ticket.run.locale}:${ticket.run.categoryId}`).digest("hex"))
            return { status: "unconfirmed" };
        /** Actual ticket authority selects the match and user-scoped request document. */
        const [matchSnapshot, receiptSnapshot] = await tx.getAll(db.doc(`liveRaceMatches/${ticket.matchId}`), db.doc(`liveRaceMatches/${ticket.matchId}/requests/${(0, raceSetupService_1.requestDocumentId)(userId, input.requestId)}`));
        /** Private records are never projected into the response. */
        const match = matchSnapshot.data(), receipt = receiptSnapshot.data();
        if (!match || !retained(match, nowMs) || !Array.isArray(match.tickets) || match.tickets.length !== 2 ||
            match.tickets[0] !== ticket.matchId || match.tickets[0] === match.tickets[1])
            return { status: "unconfirmed" };
        /** Exactly one undeleted seat must still belong to the authenticated account and original run. */
        const seat = match.tickets.indexOf(input.ticketId), run = match.runs?.[seat];
        if (seat < 0 || match.deletedSeats?.[seat] || run?.userId !== userId || run?.runId !== input.ticketId ||
            run?.locale !== ticket.run.locale || run?.categoryId !== ticket.run.categoryId || !receipt || !retained(receipt, nowMs) ||
            receipt.userId !== userId || typeof receipt.binding !== "string" || !/^[a-f0-9]{64}$/.test(receipt.binding))
            return { status: "unconfirmed" };
        /** Immutable historical acceptance cannot authorize recovery after the owned question advances again. */
        if (match.winner !== undefined || run.status !== "active" || run.currentPosition !== input.position ||
            run.riddles?.[run.currentPosition]?.riddleId !== input.riddleId || run.guessesUsed !== input.guessesUsedBefore + 1)
            return { status: "unconfirmed" };
        /** Only the exact original accepted wrong attempt can bridge a single count advance. */
        const proof = receipt.guessProof;
        return { status: proof && Object.keys(proof).sort().join(",") === "guessesUsedAfter,guessesUsedBefore,position,riddleId,ticketId" &&
                proof.ticketId === input.ticketId && proof.riddleId === input.riddleId && proof.position === input.position &&
                proof.guessesUsedBefore === input.guessesUsedBefore && proof.guessesUsedAfter === input.guessesUsedBefore + 1
                ? "accepted" : "unconfirmed" };
    }, { readOnly: true });
}
//# sourceMappingURL=raceLiveGuessReceipt.js.map
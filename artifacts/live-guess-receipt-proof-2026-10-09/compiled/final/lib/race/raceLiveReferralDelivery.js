"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveRaceReferralEventId = void 0;
exports.validateLiveRaceReferralSource = validateLiveRaceReferralSource;
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const facebookSecurity_1 = require("../facebook/facebookSecurity");
const redditSecurity_1 = require("../reddit/redditSecurity");
const facebookLiveContextBinding_1 = require("./facebookLiveContextBinding");
/** Separate hash domain prevents a chosen legacy request ID from occupying the live receipt. */
const liveRaceReferralEventId = (provider, userId, ticketId) => (0, node_crypto_1.createHash)("sha256").update(`riddle-quest\0${provider}-live-referral\0${userId}\0${ticketId}`).digest("hex");
exports.liveRaceReferralEventId = liveRaceReferralEventId;
/** A public terminal projection never establishes identity, victory, or referral authority. */
async function validateLiveRaceReferralSource(transaction, db, receipt, nowMs, provider) {
    /** Provider-specific UID validation prevents cross-target referral attribution. */
    const validOwner = provider === "facebook" ? (0, facebookSecurity_1.isFacebookFirebaseUid)(receipt.userId) : (0, redditSecurity_1.isRedditFirebaseUid)(receipt.userId);
    if (receipt.source !== `${provider}_live` || !validOwner || !receipt.liveTicketId || !receipt.liveMatchId ||
        receipt.runId !== (0, exports.liveRaceReferralEventId)(provider, receipt.userId, receipt.liveTicketId))
        throw new https_1.HttpsError("data-loss", "Stored live referral receipt is invalid.");
    /** Private source records and account-deletion state are read in the same transaction. */
    const [ticketSnapshot, matchSnapshot, owner, deletion] = await Promise.all([
        transaction.get(db.doc(`liveRaceTickets/${receipt.liveTicketId}`)),
        transaction.get(db.doc(`liveRaceMatches/${receipt.liveMatchId}`)),
        transaction.get(db.doc(`users/${receipt.userId}`)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, receipt.userId)),
    ]);
    if (!ticketSnapshot.exists || !matchSnapshot.exists || !owner.exists || deletion.exists)
        return false;
    /** Both source records must retain an unexpired server timestamp. */
    const ticketExpiry = ticketSnapshot.data().expiresAt, matchExpiry = matchSnapshot.data().expiresAt;
    if (!(ticketExpiry instanceof firebaseAdmin_1.admin.firestore.Timestamp) || !(matchExpiry instanceof firebaseAdmin_1.admin.firestore.Timestamp))
        throw new https_1.HttpsError("data-loss", "Stored live referral retention is invalid.");
    if (ticketExpiry.toMillis() <= nowMs || matchExpiry.toMillis() <= nowMs)
        return false;
    /** Private ticket and match records establish the receipt source. */
    const ticket = ticketSnapshot.data(), match = matchSnapshot.data();
    if (provider === "facebook") {
        /** A copied outbox binding must agree exactly with the immutable winner's private seat. */
        const context = ticket.facebookContext === undefined ? undefined : facebookLiveContextBinding_1.FacebookLiveContextBindingSchema.safeParse(ticket.facebookContext);
        if (context && !context.success || (context && context.success ? context.data.contextKey : undefined) !== receipt.facebookContext?.contextKey ||
            (context && context.success ? context.data.createdAtMs : undefined) !== receipt.facebookContext?.createdAtMs ||
            (context && context.success ? context.data.joinedAtMs : undefined) !== receipt.facebookContext?.joinedAtMs)
            throw new https_1.HttpsError("data-loss", "Stored Facebook context receipt does not match its source.");
    }
    /** Settled winner seat identifies the only qualifying run. */
    const seat = match.winner;
    /** Provider-specific immutable receipt binding committed with the reward. */
    const binding = provider === "facebook" ? match.facebookReferral : match.redditReferral;
    /** Server-recorded multiplayer wins corroborate the qualifying settlement. */
    const wins = owner.data()?.stats?.multiplayerWins;
    if (seat !== 0 && seat !== 1 || !Array.isArray(match.tickets) || !Array.isArray(match.runs) || !Array.isArray(match.players) ||
        ticket.userId !== receipt.userId || ticket.matchId !== receipt.liveMatchId || match.tickets[seat] !== receipt.liveTicketId ||
        match.runs[seat]?.userId !== receipt.userId || match.runs[seat]?.runId !== receipt.liveTicketId ||
        match.players[seat]?.bot !== false || !Number.isSafeInteger(wins) || wins < 1 ||
        match.rewardCoins !== race_1.LIVE_RACE_WIN_COINS || binding?.eventId !== receipt.runId || binding.ticketId !== receipt.liveTicketId ||
        binding.userId !== receipt.userId || binding.createdAtMs !== receipt.createdAtMs)
        throw new https_1.HttpsError("data-loss", "Stored live referral source does not match its receipt.");
    return true;
}
//# sourceMappingURL=raceLiveReferralDelivery.js.map
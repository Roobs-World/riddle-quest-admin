"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveRaceChallengeForUser = getLiveRaceChallengeForUser;
exports.acceptLiveRaceChallengeForUser = acceptLiveRaceChallengeForUser;
const raceLiveSignals_1 = require("./raceLiveSignals");
const https_1 = require("firebase-functions/v2/https");
const facebookLiveContextBinding_1 = require("./facebookLiveContextBinding");
const race_1 = require("@qwordly/core/race");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("./raceEligibility");
const raceSetupService_1 = require("./raceSetupService");
const raceLiveState_1 = require("./raceLiveState");
const raceDeckCompatibility_1 = require("./raceDeckCompatibility");
const raceLiveJoinIntent_1 = require("./raceLiveJoinIntent");
/** Resolves an opaque platform entry handle without accepting paths or arbitrary ticket ids. */
function invitationTicketId(challengeId) {
    if (!/^live_[a-f0-9]{64}$/.test(challengeId))
        throw new https_1.HttpsError("invalid-argument", "Invalid invitation.");
    return challengeId.slice(5);
}
/** Validates both authenticated providers and reciprocal safety boundaries before exposing identity. */
async function readInvitation(db, transaction, userId, ticketId) {
    /** Server-only lobby receipt, never supplied as authority by the platform entry payload. */
    const snapshot = await transaction.get(db.doc(`liveRaceTickets/${ticketId}`));
    /** Authoritative invitation creator and immutable content selection. */
    const ticket = snapshot.data();
    if (!ticket?.privateChallenge || (0, raceEligibility_1.raceProviderScope)(userId) !== (0, raceEligibility_1.raceProviderScope)(ticket.userId) ||
        ticket.inviteRecipientId && ![ticket.userId, ticket.inviteRecipientId].includes(userId) ||
        !(["jest", "facebook"].includes((0, raceEligibility_1.raceProviderScope)(userId) ?? "") ||
            (0, raceEligibility_1.raceProviderScope)(userId) === "reddit" && ticket.rematchOfTicketId && ticket.inviteRecipientId))
        throw new https_1.HttpsError("not-found", "Invitation unavailable.");
    /** Account deletion and blocks are checked in the same transaction as acceptance. */
    const [viewerDeleted, creatorDeleted, blocked, reverseBlocked, [creator, viewer]] = await Promise.all([
        transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)), transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, ticket.userId)),
        transaction.get(db.doc(`users/${userId}/blockedRivals/${ticket.userId}`)),
        transaction.get(db.doc(`users/${ticket.userId}/blockedRivals/${userId}`)),
        transaction.getAll(db.doc(`users/${ticket.userId}`), db.doc(`users/${userId}`), { fieldMask: ["username", "level", "avatarUrl"] }),
    ]);
    (0, jestAccountDeletion_1.assertJestAccountActive)(viewerDeleted);
    if (creatorDeleted.exists || blocked.exists || reverseBlocked.exists || !creator.exists || ticket.rematchOfTicketId && !viewer.exists)
        throw new https_1.HttpsError("not-found", "Invitation unavailable.");
    /** Rematch notices use current game-owned identity, while legacy invitations retain their established projection. */
    const data = creator.data();
    /** No copied historical profile may outlive a current rematch account projection. */
    const player = ticket.rematchOfTicketId ? { displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
        level: Number.isInteger(data.level) && data.level > 0 ? data.level : 1,
        avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0 } : ticket.player;
    return { snapshot, ticket, player, viewer };
}
/** Reads a challenge notice without joining; the recipient chooses whether to accept. */
async function getLiveRaceChallengeForUser(userId, challengeId, options = {}) {
    /** Approved server database. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    return db.runTransaction(async (transaction) => {
        /** Private invitation and creator are validated before returning any display identity. */
        const { ticket, player } = await readInvitation(db, transaction, userId, invitationTicketId(challengeId));
        /** The same persisted clock floor governs preview and acceptance. */
        const nowMs = (0, raceLiveState_1.liveOperationAtMs)(ticket, undefined, options.nowMs ?? Date.now());
        /** Match determines whether this authenticated recipient already owns the second seat. */
        const match = ticket.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${ticket.matchId}`))).data() : undefined;
        /** Only new entry availability depends on the original deck; owned and accepted journeys remain recoverable. */
        let status = ticket.userId === userId ? "own" : match?.runs[1].userId === userId && match.winner === undefined ? "accepted" :
            ticket.cancelled || ticket.matchId || nowMs >= ticket.createdAtMs + race_1.LIVE_RACE_INVITE_MS ? "unavailable" : "available";
        if (status === "available" && !(0, raceDeckCompatibility_1.isLiveRaceDeckCompatible)(ticket.run))
            status = "unavailable";
        return race_1.LiveRaceChallengeSchema.parse({ challengeId, creator: player, locale: ticket.run.locale,
            categoryId: ticket.run.categoryId, expiresAtMs: ticket.createdAtMs + race_1.LIVE_RACE_INVITE_MS,
            status });
    });
}
/** Reserves the second seat atomically; concurrent recipients cannot replace an accepted rival. */
async function acceptLiveRaceChallengeForUser(userId, input, options = {}) {
    if (input.expectedOwnerId && input.expectedOwnerId !== userId)
        throw new https_1.HttpsError("permission-denied", "Live race account changed.");
    /** Invitation recipients keep their own synchronized Facebook score destination. */
    const contextKey = (0, facebookLiveContextBinding_1.facebookLiveContextSelection)(userId, input.facebookContextId);
    /** Approved database and authenticated invitation identity. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore();
    /** Existing creator ticket remains the canonical shared lobby and match id. */
    const creatorId = invitationTicketId(input.challengeId);
    return db.runTransaction(async (transaction) => {
        /** Creator seat is locked together with the recipient's active-seat pointer. */
        const [intent, { snapshot, ticket: creator, player: creatorPlayer, viewer: owner }] = await Promise.all([
            (0, raceLiveJoinIntent_1.readLiveJoinIntent)(db, transaction, userId, input), readInvitation(db, transaction, userId, creatorId)
        ]);
        if (creator.userId === userId)
            throw new https_1.HttpsError("failed-precondition", "Cannot accept your own challenge.");
        if (input.locale !== creator.run.locale || input.categoryId !== creator.run.categoryId)
            throw new https_1.HttpsError("failed-precondition", "Use the invitation's content selection.");
        /** Clock cannot move backwards across creator heartbeats. */
        const nowMs = (0, raceLiveState_1.liveOperationAtMs)(creator, undefined, options.nowMs ?? Date.now());
        /** Existing accepted match is recovered before checking invitation expiry. */
        const existing = creator.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${creator.matchId}`))).data() : undefined;
        if (existing) {
            if (existing.runs[1].userId !== userId)
                throw new https_1.HttpsError("failed-precondition", "Challenge already accepted.");
            /** Recovery returns the original recipient seat without restarting the countdown. */
            const ownId = existing.tickets[1];
            /** Server ticket supplies ownership, never the untrusted caller request id. */
            const own = (await transaction.get(db.doc(`liveRaceTickets/${ownId}`))).data();
            (0, facebookLiveContextBinding_1.assertFacebookLiveContextSelection)(own.facebookContext, contextKey);
            if (intent?.record?.ticketId && intent.record.ticketId !== ownId)
                throw new https_1.HttpsError("failed-precondition", "Request belongs to another live seat.");
            (0, raceLiveJoinIntent_1.claimLiveJoinIntent)(transaction, intent, db.doc(`liveRaceTickets/${ownId}`), nowMs);
            return (0, raceLiveState_1.liveView)(ownId, own, existing, nowMs);
        }
        if (creator.cancelled || nowMs >= creator.createdAtMs + race_1.LIVE_RACE_INVITE_MS)
            throw new https_1.HttpsError("failed-precondition", "Challenge expired or cancelled.");
        if (nowMs > creator.seenAtMs + 30_000)
            throw new https_1.HttpsError("unavailable", "Challenge creator is reconnecting.");
        /** New acceptances must not replace another active PvP journey. */
        const pointer = db.doc(`liveRacePlayers/${(0, raceSetupService_1.requestDocumentId)(userId, "active-live-race")}`);
        /** Receipt remains tied to one authenticated recipient and invitation. */
        const ownId = (0, raceSetupService_1.requestDocumentId)(userId, input.requestId);
        /** The same transaction already read and locked viewer identity; only pointer and receipt remain. */
        const [current, receipt] = await Promise.all([transaction.get(pointer), transaction.get(db.doc(`liveRaceTickets/${ownId}`))]);
        if (!owner.exists)
            throw new https_1.HttpsError("not-found", "Player profile unavailable.");
        if (receipt.exists)
            throw new https_1.HttpsError("failed-precondition", "Request belongs to another live seat.");
        if (current.data()?.ticketId) {
            /** Active journey cannot be orphaned by an invitation acceptance. */
            const old = (await transaction.get(db.doc(`liveRaceTickets/${current.data().ticketId}`))).data();
            /** Completed or retired seats may be replaced. */
            const match = old?.matchId ? (await transaction.get(db.doc(`liveRaceMatches/${old.matchId}`))).data() : undefined;
            if (old && !old.cancelled && !(old.privateChallenge && !match && nowMs >= old.createdAtMs + race_1.LIVE_RACE_INVITE_MS) &&
                (!match || match.winner === undefined))
                throw new https_1.HttpsError("failed-precondition", "Finish the current live race first.");
        }
        (0, raceDeckCompatibility_1.assertLiveRaceDeckCompatible)(creator.run);
        /** Recipient membership is captured before any acceptance writes. */
        const facebookContext = await (0, facebookLiveContextBinding_1.prepareFacebookLiveContext)(transaction, db, userId, input.locale, contextKey, nowMs);
        /** Identity comes from the authenticated server account. */
        const data = owner.data();
        /** Safe identity snapshot for the creator's lobby. */
        const player = { displayName: typeof data.username === "string" && data.username.trim() ? data.username.trim().slice(0, 80) : "Riddle Quest player",
            level: typeof data.level === "number" && Number.isInteger(data.level) && data.level > 0 ? data.level : 1,
            avatarUrl: typeof data.avatarUrl === "string" && /^https:\/\//.test(data.avatarUrl) ? data.avatarUrl : null, bot: false, correctCount: 0 };
        /** Both seats receive the creator's immutable deck and the same five-second countdown. */
        const startsAtMs = nowMs + race_1.LIVE_RACE_COUNTDOWN_MS;
        /** Private match uses the existing authoritative scoring and settlement lifecycle. */
        const match = { tickets: [creatorId, ownId], participantIds: [creator.userId, userId], startsAtMs, observedAtMs: nowMs, players: [creatorPlayer, player],
            runs: [(0, raceLiveState_1.liveRun)(creator.run, creator.userId, creatorId, startsAtMs), (0, raceLiveState_1.liveRun)(creator.run, userId, ownId, startsAtMs)] };
        /** Recipient seat does not expose the creator's share handle as its own invitation. */
        const own = { userId, pool: creator.pool, player, ...(facebookContext ? { facebookContext } : {}),
            createdAtMs: nowMs, seenAtMs: nowMs, matchId: creatorId, run: match.runs[1] };
        /** Reuse the creator's retention policy for both seats. */
        const expiresAt = snapshot.data().expiresAt;
        transaction.update(snapshot.ref, { matchId: creatorId });
        transaction.create(db.doc(`liveRaceMatches/${creatorId}`), { ...(0, raceSetupService_1.stripUndefined)(match), expiresAt });
        transaction.create(db.doc(`liveRaceTickets/${ownId}`), { ...(0, raceSetupService_1.stripUndefined)(own), expiresAt });
        (0, raceLiveJoinIntent_1.claimLiveJoinIntent)(transaction, intent, db.doc(`liveRaceTickets/${ownId}`), nowMs);
        transaction.set(pointer, { ticketId: ownId, expiresAt });
        (0, raceLiveSignals_1.publishLiveRaceSignals)(db, transaction, match.tickets, expiresAt);
        return (0, raceLiveState_1.liveView)(ownId, own, match, nowMs);
    });
}
//# sourceMappingURL=raceLiveInvitation.js.map
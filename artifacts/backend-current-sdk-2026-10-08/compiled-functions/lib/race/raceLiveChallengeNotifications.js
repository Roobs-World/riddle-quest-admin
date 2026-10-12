"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLiveRaceChallengeForUser = sendLiveRaceChallengeForUser;
exports.listLiveRaceChallengesForUser = listLiveRaceChallengesForUser;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const race_1 = require("@qwordly/core/race");
const usernameReservations_1 = require("../profile/usernameReservations");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("./raceEligibility");
const raceLiveInvitation_1 = require("./raceLiveInvitation");
/** Atomically reserves the recipient, inbox entry and one notification event for an owned private lobby. */
async function sendLiveRaceChallengeForUser(db, userId, input, nowMs = Date.now()) {
    if (!/^live_[a-f0-9]{64}$/.test(input.challengeId))
        throw new https_1.HttpsError("invalid-argument", "Invalid invitation.");
    /** Stable lookup uses the same canonical normalization as username ownership. */
    const reservationId = (0, usernameReservations_1.createUsernameReservationId)(input.recipientUsername);
    return db.runTransaction(async (tx) => {
        /** Invitation authority and username reservation are read before any writes. */
        const [seat, reservation] = await Promise.all([tx.get(db.doc(`liveRaceTickets/${input.challengeId.slice(5)}`)),
            tx.get(db.doc(`usernameReservations/${reservationId}`))]);
        /** Raw provider IDs and Firebase UIDs are never accepted from the browser. */
        const ticket = seat.data(), recipientId = reservation.data()?.userId;
        if (!ticket?.privateChallenge || ticket.userId !== userId || typeof recipientId !== "string" || recipientId === userId ||
            !["jest", "facebook"].includes((0, raceEligibility_1.raceProviderScope)(userId) ?? "") || (0, raceEligibility_1.raceProviderScope)(recipientId) !== (0, raceEligibility_1.raceProviderScope)(userId))
            throw new https_1.HttpsError("not-found", "Invitation recipient unavailable.");
        /** Accounts, blocks and rate receipts share the recipient binding transaction. */
        const rateRef = db.doc(`users/${userId}/liveChallengeRate/current`);
        /** Exactly one outbox event belongs to this lobby. */
        const eventRef = db.doc(`liveRacePushOutbox/${seat.id}`);
        /** Independent recipient throttling bounds notifications from multiple inviters. */
        const recipientRateRef = db.doc(`users/${recipientId}/liveChallengeInboxRate/current`);
        /** Account, safety and receipt snapshots read before transaction writes. */
        const [creator, recipient, deleted, recipientDeleted, blocked, reverse, rate, existing, recipientRate] = await Promise.all([
            tx.get(db.doc(`users/${userId}`)), tx.get(db.doc(`users/${recipientId}`)), tx.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)),
            tx.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, recipientId)), tx.get(db.doc(`users/${userId}/blockedRivals/${recipientId}`)),
            tx.get(db.doc(`users/${recipientId}/blockedRivals/${userId}`)), tx.get(rateRef), tx.get(eventRef), tx.get(recipientRateRef),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deleted);
        if (!creator.exists || !recipient.exists || recipientDeleted.exists || blocked.exists || reverse.exists ||
            recipient.data()?.usernameReservationId !== reservationId || typeof recipient.data()?.username !== "string" ||
            (0, usernameReservations_1.normalizeUsernameForReservation)(recipient.data().username) !== (0, usernameReservations_1.normalizeUsernameForReservation)(input.recipientUsername))
            throw new https_1.HttpsError("not-found", "Invitation recipient unavailable.");
        if (ticket.inviteRecipientId && ticket.inviteRecipientId !== recipientId)
            throw new https_1.HttpsError("failed-precondition", "Invitation already addressed.");
        /** A lost callable reply recovers the exact original work without sending again or charging quota. */
        if (existing.exists) {
            if (existing.data()?.recipientId !== recipientId || existing.data()?.creatorId !== userId)
                throw new https_1.HttpsError("failed-precondition", "Invitation receipt conflict.");
            return { status: "queued" };
        }
        /** Completed, cancelled, unattended or expired lobbies cannot enqueue an actionable push. */
        const expiresAtMs = ticket.createdAtMs + race_1.LIVE_RACE_INVITE_MS;
        if (ticket.cancelled || ticket.matchId || nowMs >= expiresAtMs || nowMs > ticket.seenAtMs + 30_000)
            throw new https_1.HttpsError("failed-precondition", "Invitation unavailable.");
        /** Five new direct invitations per creator per hour bounds unsolicited delivery. */
        const freshWindow = typeof rate.data()?.resetAtMs === "number" && rate.data().resetAtMs > nowMs;
        /** New invitation count for the current rate window. */
        const count = freshWindow ? Number(rate.data()?.count ?? 0) : 0;
        if (!Number.isSafeInteger(count) || count < 0 || count >= 5)
            throw new https_1.HttpsError("resource-exhausted", "Try again later.");
        if (typeof recipientRate.data()?.lastAtMs === "number" && recipientRate.data().lastAtMs > nowMs - 60_000)
            throw new https_1.HttpsError("resource-exhausted", "Try again later.");
        tx.set(rateRef, { count: count + 1, resetAtMs: freshWindow ? rate.data().resetAtMs : nowMs + 3_600_000 });
        tx.set(recipientRateRef, { lastAtMs: nowMs });
        tx.update(seat.ref, { inviteRecipientId: recipientId });
        tx.set(db.doc(`users/${recipientId}/liveRaceInvitations/${seat.id}`), { challengeId: input.challengeId,
            createdAtMs: nowMs, expiresAt: firestore_1.Timestamp.fromMillis(expiresAtMs) });
        tx.create(eventRef, { challengeId: input.challengeId, creatorId: userId, recipientId, expiresAtMs,
            status: "queued", createdAtMs: nowMs, expiresAt: firestore_1.Timestamp.fromMillis(expiresAtMs + 86_400_000) });
        return { status: "queued" };
    });
}
/** Reads bounded invitations through the same safety checks as SDK deep links; reading never accepts. */
async function listLiveRaceChallengesForUser(db, userId, nowMs = Date.now()) {
    /** Query is confined to the authenticated account and uses one single-field index. */
    const rows = await db.collection(`users/${userId}/liveRaceInvitations`).orderBy("createdAtMs", "desc").limit(10).get();
    /** Expired, blocked, deleted and consumed entries are omitted without exposing the failed authority. */
    const results = await Promise.allSettled(rows.docs.map(row => (0, raceLiveInvitation_1.getLiveRaceChallengeForUser)(userId, row.data().challengeId, { db, nowMs })));
    return results.flatMap(result => result.status === "fulfilled" && ["available", "accepted"].includes(result.value.status) ? [result.value] : []);
}
//# sourceMappingURL=raceLiveChallengeNotifications.js.map
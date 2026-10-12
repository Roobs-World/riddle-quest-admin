"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveJoinIntentRef = liveJoinIntentRef;
exports.readLiveJoinIntent = readLiveJoinIntent;
exports.claimLiveJoinIntent = claimLiveJoinIntent;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceSetupService_1 = require("./raceSetupService");
/** Private account subcollection stores no answers, profiles or rival identities. */
function liveJoinIntentRef(db, userId, requestId) {
    return db.doc(`users/${userId}/liveRaceJoinIntents/${(0, raceSetupService_1.requestDocumentId)(userId, requestId)}`);
}
/** Reads current intent facts on every transaction attempt; legacy joins add no reads. */
async function readLiveJoinIntent(db, transaction, userId, input) {
    if (!input.retirementAware)
        return undefined;
    /** Stable account-owned reference also serializes retirement arriving before join publication. */
    const ref = liveJoinIntentRef(db, userId, input.requestId);
    /** A first accepted command binds all selectors, including the target-owned context. */
    const binding = (0, node_crypto_1.createHash)("sha256").update(JSON.stringify([input.locale, input.categoryId, Boolean(input.createChallenge),
        input.challengeId ?? null, input.rematchOfTicketId ?? null, input.facebookContextId ?? null])).digest("hex");
    /** Fresh SDK snapshot is never cached across Firestore retries. */
    const record = (await transaction.get(ref)).data();
    if (record?.retired)
        throw new https_1.HttpsError("failed-precondition", "This live join was retired.");
    if (record?.binding && record.binding !== binding)
        throw new https_1.HttpsError("invalid-argument", "Live join id reused.");
    return { ref, binding, record, id: (0, raceSetupService_1.requestDocumentId)(userId, input.requestId) };
}
/** Publishes the first accepted join and seat claim in the same transaction; repeated joins are observations. */
function claimLiveJoinIntent(transaction, intent, ticket, nowMs) {
    if (!intent || intent.record?.ticketId)
        return;
    transaction.set(intent.ref, { binding: intent.binding, ticketId: ticket.id, retired: false,
        expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + 7 * 86_400_000) });
    transaction.update(ticket, { activeJoinId: intent.id });
}
//# sourceMappingURL=raceLiveJoinIntent.js.map
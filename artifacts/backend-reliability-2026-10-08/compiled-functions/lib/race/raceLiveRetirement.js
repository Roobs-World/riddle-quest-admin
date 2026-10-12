"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retireLiveRaceJoinForUser = retireLiveRaceJoinForUser;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
const raceEligibility_1 = require("./raceEligibility");
const raceSetupService_1 = require("./raceSetupService");
const raceLiveJoinIntent_1 = require("./raceLiveJoinIntent");
const raceLiveService_1 = require("./raceLiveService");
/** Durably retires one account-owned intent before conditionally leaving its original ticket. */
async function retireLiveRaceJoinForUser(userId, input, options = {}) {
    if (input.expectedOwnerId && input.expectedOwnerId !== userId)
        throw new https_1.HttpsError("permission-denied", "Live race account changed.");
    if (!(0, raceEligibility_1.raceProviderScope)(userId))
        throw new https_1.HttpsError("permission-denied", "Live races require a provider identity.");
    /** All facts remain in the caller's recursively deleted account subtree. */
    const db = options.db ?? firebaseAdmin_1.admin.firestore(), ref = (0, raceLiveJoinIntent_1.liveJoinIntentRef)(db, userId, input.requestId);
    /** The durable marker prevents late or retried original joins from creating another seat. */
    const ticketId = await db.runTransaction(async (transaction) => {
        /** Authenticated account and current intent are read together before any write. */
        const [snapshot, owner, deletion] = await Promise.all([transaction.get(ref), transaction.getAll(db.doc(`users/${userId}`), { fieldMask: ["username"] }).then(([profile]) => profile),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, userId)), options.authorize?.()]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!owner.exists)
            throw new https_1.HttpsError("not-found", "Player profile unavailable.");
        /** Only a server-published receipt may select a ticket for background retirement. */
        const intent = snapshot.data();
        if (!intent?.retired)
            transaction.set(ref, { ...intent, retired: true,
                expiresAt: snapshot.data()?.expiresAt ?? firebaseAdmin_1.admin.firestore.Timestamp.fromMillis((options.nowMs ?? Date.now()) + 7 * 86_400_000) });
        return intent?.ticketId;
    });
    if (!ticketId)
        return { status: "retired" };
    try {
        // The existing leave transaction rechecks both owner and claim after any concurrent newer join.
        await (0, raceLiveService_1.updateLiveRaceForUser)(userId, { ticketId, action: "leave", requestId: `retire-${(0, raceSetupService_1.requestDocumentId)(userId, input.requestId)}` }, { ...options, expectedJoinId: (0, raceSetupService_1.requestDocumentId)(userId, input.requestId) });
        return { status: "retired" };
    }
    catch (failure) {
        if (failure instanceof https_1.HttpsError && failure.code === "permission-denied" &&
            failure.details && typeof failure.details === "object" && "reason" in failure.details &&
            failure.details.reason === "live-join-superseded")
            return { status: "superseded" };
        throw failure;
    }
}
//# sourceMappingURL=raceLiveRetirement.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRaceInteractionAllowed = assertRaceInteractionAllowed;
exports.mutateRaceRun = mutateRaceRun;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const raceSettlement_1 = require("./raceSettlement");
const raceTransactionReads_1 = require("./raceTransactionReads");
const raceEngine_1 = require("./raceEngine");
const raceOpponentPrivacy_1 = require("./raceOpponentPrivacy");
const raceReceiptPrivacy_1 = require("./raceReceiptPrivacy");
const raceRollout_1 = require("./raceRollout");
const raceRequestBinding_1 = require("./raceRequestBinding");
const raceSetupService_1 = require("./raceSetupService");
/** Rejects a race when either participant has blocked the other. */
async function assertRaceInteractionAllowed(transaction, db, userId, opponentUserId) {
    if (!opponentUserId)
        return;
    /** Provides [outgoing block, incoming block] behavior. */
    const [outgoingBlock, incomingBlock] = await Promise.all([
        transaction.get(db.doc(`users/${userId}/blockedRivals/${opponentUserId}`)),
        transaction.get(db.doc(`users/${opponentUserId}/blockedRivals/${userId}`)),
    ]);
    if (outgoingBlock.exists || incomingBlock.exists) {
        throw new https_1.HttpsError("permission-denied", "This race interaction is blocked.");
    }
}
/** Applies one idempotent race mutation with rollout, privacy, and interaction enforcement. */
async function mutateRaceRun(userId, command, nowMs, db, mutate, options = {}) {
    /** Command ownership and its receipt address come from one typed intent. */
    const { runId, requestId } = command.input;
    /** Persisted intent is a digest; guesses are never copied into receipt metadata. */
    const commandBinding = (0, raceRequestBinding_1.bindRaceRequest)(command);
    /** Provides run ref behavior. */
    const runRef = db.collection("raceRuns").doc(runId);
    /** Requests ref. */
    const requestRef = runRef.collection("requests").doc((0, raceSetupService_1.requestDocumentId)(userId, requestId));
    return db.runTransaction(async (attempt) => {
        /** Repeated privacy and settlement reads share only this attempt's locked snapshots. */
        const transaction = (0, raceTransactionReads_1.withRaceTransactionReads)(attempt);
        /** Provides [request snapshot, run snapshot, rollout snapshot] behavior. */
        const [requestSnapshot, runSnapshot, rolloutSnapshot] = await Promise.all([
            transaction.get(requestRef),
            transaction.get(runRef),
            options.enforceRaceAccess ? transaction.get(db.doc("raceConfig/rollout")) : Promise.resolve(null),
        ]);
        if (!runSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Race to 10 run not found.");
        /** Stores d run. */
        const storedRun = (0, raceSetupService_1.parseRunRecord)(runSnapshot.data(), runSnapshot.id);
        if (storedRun.userId !== userId)
            throw new https_1.HttpsError("permission-denied", "This race run belongs to another player.");
        /** Provides privacy behavior. */
        const privacy = await (0, raceOpponentPrivacy_1.resolveRaceOpponentPrivacy)(transaction, db, storedRun);
        /** Provides run behavior. */
        const run = privacy.run;
        await assertRaceInteractionAllowed(transaction, db, userId, run.opponent?.subjectUserId);
        if (requestSnapshot.exists) {
            /** Legacy receipts prove only their recoverable original operation/input. */
            const bound = (0, raceRequestBinding_1.assertRaceRequestReplay)(requestSnapshot.data(), userId, commandBinding);
            (0, raceRequestBinding_1.assertRaceMutationReceipt)(requestSnapshot.data()?.response, command, run, bound);
            /** Provides response behavior. */
            const response = (0, raceReceiptPrivacy_1.hydrateRaceReceiptResponse)(requestSnapshot.data()?.response, run);
            // Current privacy-safe identity must also yield a deliverable public response.
            (0, raceRequestBinding_1.assertRaceMutationReceipt)(response, command, run, bound);
            if (privacy.scrubbed) {
                transaction.set(runRef, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)(run, true), { merge: true });
                transaction.update(requestRef, { response: (0, raceSetupService_1.stripUndefined)((0, raceReceiptPrivacy_1.minimizeRaceReceiptResponse)(response)) });
            }
            return response;
        }
        if (options.enforceRaceAccess &&
            !(0, raceRollout_1.evaluateRaceRollout)(rolloutSnapshot?.exists ? rolloutSnapshot.data() : undefined, userId).enabled) {
            throw new https_1.HttpsError("permission-denied", "Race to 10 is not enabled for this player.");
        }
        /** A transaction retry may observe a command committed after this request sampled its clock. */
        const acceptedAtMs = (0, raceEngine_1.raceOperationAtMs)(run, nowMs);
        /** Wrong guesses also retain the clock floor; scoring events alone cannot represent every accepted action. */
        const mutation = mutate({ ...(0, raceSetupService_1.applyActionRateLimit)(run, userId, acceptedAtMs), lastActionAtMs: acceptedAtMs }, acceptedAtMs);
        /** Provides settled behavior. */
        const settled = await (0, raceSettlement_1.settleRaceRun)(transaction, db, mutation.run, acceptedAtMs);
        /** Provides response behavior. */
        const response = (0, raceReceiptPrivacy_1.hydrateRaceReceiptResponse)(mutation.response, settled);
        // An undeliverable response must abort the whole transaction, including staged rewards and penalties.
        (0, raceRequestBinding_1.assertRaceMutationReceipt)(response, command, settled, true);
        transaction.set(runRef, (0, raceOpponentPrivacy_1.raceRunPrivacyWrite)({ ...settled, deadlineAtMs: (0, raceEngine_1.raceDeadlineAtMs)(settled) }, privacy.scrubbed), { merge: true });
        transaction.create(requestRef, {
            userId,
            commandBinding,
            createdAtMs: acceptedAtMs,
            response: (0, raceSetupService_1.stripUndefined)((0, raceReceiptPrivacy_1.minimizeRaceReceiptResponse)(response)),
            expiresAt: (0, raceReceiptPrivacy_1.raceReceiptExpiresAt)(runSnapshot.data()?.expiresAt, acceptedAtMs + race_1.RACE_CHALLENGE_TTL_MS),
        });
        return response;
    });
}
//# sourceMappingURL=raceRunMutation.js.map
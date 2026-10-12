"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pendingRaceDelivery = void 0;
exports.raceDeliveryRetryAt = raceDeliveryRetryAt;
exports.withRaceDeliveryReceipt = withRaceDeliveryReceipt;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const node_crypto_1 = require("node:crypto");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** New receipts expose processing state without overloading the legacy delivered flag. */
const pendingRaceDelivery = (nowMs) => ({ delivered: false, deliveryState: "pending", deliveryAttempts: 0, nextAttemptAtMs: nowMs });
exports.pendingRaceDelivery = pendingRaceDelivery;
/** Bounded exponential retry with deterministic jitter prevents synchronized storage retry waves. */
function raceDeliveryRetryAt(eventId, attempts, nowMs) {
    /** Per-event jitter remains stable when a failed invocation is retried. */
    const fraction = (0, node_crypto_1.createHash)("sha256").update(`${eventId}:${attempts}`).digest().readUInt32BE(0) / 0xffffffff;
    return nowMs + Math.min(900000, Math.round(30000 * 2 ** Math.min(5, Math.max(0, attempts - 1)) * (0.8 + fraction * 0.4)));
}
/** Permanent canonical corruption is quarantined; infrastructure failures remain pending for retry. */
async function withRaceDeliveryReceipt(db, eventRef, nowMs, operation) {
    /** Failure ownership follows the last transactional receipt read, including transaction retries. */
    let observed = false;
    /** Legacy receipts retain their replay clock while new replays also carry an opaque identity. */
    let replayedAt, replayId;
    try {
        return await operation(receipt => { observed = true; replayedAt = receipt?.replayedAtMs; replayId = receipt?.replayId; });
    }
    catch (error) {
        /** Provides permanent behavior. */
        const permanent = (error instanceof https_1.HttpsError && (error.code === "data-loss" ||
            error.code === "internal" && error.message === "Stored Race to 10 state is invalid.")) ||
            (error instanceof Error && (error.name === "ZodError" || ["invalid-race-settlement-event", "race-settlement-source-mismatch"].includes(error.message)));
        /** Concurrent successful/suppressed delivery always wins over failure bookkeeping. */
        const recorded = await db.runTransaction(async (transaction) => {
            /** Provides current behavior. */
            const current = await transaction.get(eventRef);
            if (!current.exists || current.data()?.delivered === true)
                return false;
            /** An operator replay supersedes failures from an older invocation, including permanent corruption. */
            const replayedAtMs = current.data()?.replayedAtMs;
            if (observed ? current.data()?.replayId !== replayId || !Object.is(replayedAtMs, replayedAt) :
                Number.isSafeInteger(replayedAtMs) && replayedAtMs > nowMs)
                return false;
            if (!permanent) {
                if (current.data().nextAttemptAtMs > nowMs)
                    return false;
                /** Invalid historical counters cannot produce unbounded exponentiation. */
                const attempts = Math.min(20, Math.max(0, Math.trunc(Number(current.data()?.deliveryAttempts) || 0)) + 1);
                transaction.update(eventRef, { deliveryState: "pending", deliveryAttempts: attempts, lastFailureAtMs: nowMs,
                    lastFailureCode: error instanceof https_1.HttpsError ? error.code : "unavailable",
                    nextAttemptAtMs: raceDeliveryRetryAt(eventRef.id, attempts, nowMs) });
                return true;
            }
            // delivered is a processing receipt, also used for suppressed events.
            // quarantined distinguishes failure from actual inbox/profile delivery.
            transaction.update(eventRef, { delivered: true, deliveryState: "quarantined", quarantined: true, quarantinedAtMs: nowMs,
                failureCode: "data-loss", nextAttemptAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete() });
            return true;
        });
        if (!permanent)
            throw error;
        if (recorded)
            firebase_functions_1.logger.write({ severity: "ERROR", message: "Race delivery requires repair and replay", collection: eventRef.parent.id, eventId: eventRef.id, failureCode: "data-loss" });
        return false;
    }
}
//# sourceMappingURL=raceDeliveryFailures.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverRacePerformanceEvent = exports.deliverRaceSettlementEvent = exports.RACE_SETTLEMENT_JOB_LIMIT = void 0;
exports.processRaceSettlementJobs = processRaceSettlementJobs;
exports.requireCompletedRaceDelivery = requireCompletedRaceDelivery;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceDeadlineRecovery_1 = require("./raceDeadlineRecovery");
const raceSettlementDelivery_1 = require("./raceSettlementDelivery");
const racePerformanceDelivery_1 = require("./racePerformanceDelivery");
const raceDeliveryQueue_1 = require("./raceDeliveryQueue");
/** Isolates a transient failure to its own record while preserving retry eligibility for the next invocation. */
async function settleBatch(operations, kind) {
    /** Provides results behavior. */
    const results = await Promise.allSettled(operations);
    /** Provides failed behavior. */
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed)
        firebase_functions_1.logger.error("Race background batch has retryable failures", { kind, failed, examined: results.length });
}
/** Bounded page size for unattended race settlement and missed event delivery. */
exports.RACE_SETTLEMENT_JOB_LIMIT = 100;
/** Settles due runs and retries pending outbox events without scanning all players. */
async function processRaceSettlementJobs(db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    /** Provides due behavior. */
    const due = await db.collection("raceRuns").where("status", "in", ["prepared", "scheduled", "active"])
        .where("deadlineAtMs", "<=", nowMs).orderBy("deadlineAtMs").limit(exports.RACE_SETTLEMENT_JOB_LIMIT).get();
    // Bounded concurrency prevents one popular creator or retry wave overwhelming storage.
    for (let offset = 0; offset < due.docs.length; offset += 10) {
        await settleBatch(due.docs.slice(offset, offset + 10).map((document) => (0, raceDeadlineRecovery_1.processRaceDeadline)(db, document.ref, nowMs)), "deadlines");
    }
    await settleBatch([
        (0, raceDeliveryQueue_1.processRaceDeliveryQueue)(db, "raceSettlementOutbox", id => (0, raceSettlementDelivery_1.deliverRaceSettlement)(id, db, nowMs), nowMs),
        (0, raceDeliveryQueue_1.processRaceDeliveryQueue)(db, "racePerformanceOutbox", id => (0, racePerformanceDelivery_1.deliverRacePerformance)(id, db, nowMs), nowMs),
    ], "delivery-queues");
}
/** Retry-enabled delivery of a committed creator settlement event. */
exports.deliverRaceSettlementEvent = (0, firestore_1.onDocumentCreated)({
    document: "raceSettlementOutbox/{runId}", region: "us-central1", retry: true,
}, async (event) => {
    await (0, raceSettlementDelivery_1.deliverRaceSettlement)(event.params.runId);
    await requireCompletedRaceDelivery("raceSettlementOutbox", event.params.runId);
});
/** Retry-enabled owner-only performance projection; recording popularity never updates the creator repeatedly. */
exports.deliverRacePerformanceEvent = (0, firestore_1.onDocumentCreated)({ document: "racePerformanceOutbox/{runId}", region: "us-central1", retry: true }, async (event) => {
    await (0, racePerformanceDelivery_1.deliverRacePerformance)(event.params.runId);
    await requireCompletedRaceDelivery("racePerformanceOutbox", event.params.runId);
});
/** An early Eventarc retry must not acknowledge an outbox receipt still in backoff. */
async function requireCompletedRaceDelivery(collection, runId) {
    /** Canonical receipt whose pending state must keep Eventarc retries alive. */
    const receipt = await firebaseAdmin_1.admin.firestore().collection(collection).doc(runId).get();
    if (receipt.exists && receipt.data()?.delivered !== true)
        throw new Error("Race delivery remains pending.");
}
//# sourceMappingURL=raceSettlementJobs.js.map
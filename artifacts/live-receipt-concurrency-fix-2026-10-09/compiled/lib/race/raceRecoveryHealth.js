"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorRaceRecoveryHealth = exports.RACE_PROJECTION_CYCLE_WARNING_MS = exports.RACE_RECOVERY_STALE_MS = exports.RACE_OUTBOX_DELAY_WARNING_MS = exports.RACE_DEADLINE_DELAY_WARNING_MS = exports.RACE_RECOVERY_HEALTH_SAMPLE = void 0;
exports.readRaceRecoveryHealth = readRaceRecoveryHealth;
const firebase_functions_1 = require("firebase-functions");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const raceDeliveryQueue_1 = require("./raceDeliveryQueue");
/** Operational sampling stays bounded independently of traffic or an outage backlog. */
exports.RACE_RECOVERY_HEALTH_SAMPLE = 20;
/** Deadlines should normally settle within two one-minute worker invocations. */
exports.RACE_DEADLINE_DELAY_WARNING_MS = 120000;
/** Outbox delivery older than five minutes requires investigation. */
exports.RACE_OUTBOX_DELAY_WARNING_MS = 300000;
/** Recovery checkpoints with pending work should advance at least every ten minutes. */
exports.RACE_RECOVERY_STALE_MS = 600000;
/** Full reconciliation cycles have a separate diagnostic threshold from page progress. */
exports.RACE_PROJECTION_CYCLE_WARNING_MS = 3600000;
/** Converts bounded query size into a count without claiming a full backlog scan. */
const sampleCount = (page) => ({ lowerBound: Math.min(page.size, exports.RACE_RECOVERY_HEALTH_SAMPLE),
    capped: page.size > exports.RACE_RECOVERY_HEALTH_SAMPLE });
/** Invalid clocks cannot produce misleading negative, NaN or infinite operational ages. */
const age = (nowMs, timestamp) => typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0 ? Math.max(0, nowMs - timestamp) : 0;
/** Reads bounded queue health without delivering, settling, repairing or extending retained data. */
async function readRaceRecoveryHealth(db = firebaseAdmin_1.admin.firestore(), nowMs = Date.now()) {
    /** Active status filtering excludes historical completed runs that retain retry diagnostics. */
    const active = db.collection("raceRuns").where("status", "in", ["prepared", "scheduled", "active"]);
    /** Independent bounded queries retain visibility when the delivery worker cannot run. */
    const [due, retried, quarantined, outboxes, projectionConfig, projectionState] = await Promise.all([
        active.where("deadlineAtMs", "<=", nowMs).orderBy("deadlineAtMs").limit(exports.RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
        active.where("deadlineRecovery.originalDeadlineAtMs", "<=", nowMs).orderBy("deadlineRecovery.originalDeadlineAtMs").limit(exports.RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
        db.collection("raceDeadlineFailures").where("state", "==", "quarantined").limit(exports.RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
        Promise.all(raceDeliveryQueue_1.RACE_DELIVERY_QUEUES.map(async (collection) => {
            /** The unordered sample includes corrupt/missing enqueue clocks omitted by an ordered query. */
            const pendingQuery = db.collection(collection).where("delivered", "==", false);
            /** Globally oldest age and checkpoint state are measured separately from the bounded count. */
            const [pending, head, corrupt, checkpoint] = await Promise.all([
                pendingQuery.limit(exports.RACE_RECOVERY_HEALTH_SAMPLE + 1).get(), pendingQuery.orderBy("createdAtMs").limit(1).get(),
                db.collection(collection).where("quarantined", "==", true).limit(exports.RACE_RECOVERY_HEALTH_SAMPLE + 1).get(),
                db.doc(`raceMaintenance/${collection}Recovery`).get(),
            ]);
            /** Missing checkpoint is stale only when pending age exceeds the recovery allowance. */
            const oldestPendingAgeMs = age(nowMs, head.docs[0]?.data().createdAtMs);
            /** A corrupt checkpoint clock never suppresses a stale-work alert. */
            const lastCompletedAtMs = checkpoint.data()?.lastCompletedAtMs;
            /** Counts malformed records without copying their identities into operational output. */
            const invalidEnqueueTimesInSample = pending.docs.filter(document => !Number.isSafeInteger(document.data().createdAtMs) || document.data().createdAtMs < 0).length;
            /** Original age prevents a future retry time from concealing stalled processing. */
            const recoveryStale = pending.size > 0 && oldestPendingAgeMs >= exports.RACE_RECOVERY_STALE_MS &&
                (!Number.isFinite(lastCompletedAtMs) || lastCompletedAtMs > nowMs || nowMs - lastCompletedAtMs >= exports.RACE_RECOVERY_STALE_MS);
            return [collection, { pending: sampleCount(pending), quarantined: sampleCount(corrupt), oldestPendingAgeMs,
                    invalidEnqueueTimesInSample, recoveryStale }];
        })),
        db.doc("raceConfig/maintenance").get(),
        db.doc("raceMaintenance/projectionReconciliation").get(),
    ]);
    /** Invalid/future clocks stay unknown rather than looking like fresh successful work. */
    const observedAge = (timestamp) => Number.isSafeInteger(timestamp) && timestamp >= 0 && timestamp <= nowMs
        ? nowMs - timestamp : null;
    /** Reported counts describe observations only, without copying cursor or document identities. */
    const observedCount = (count) => Number.isSafeInteger(count) && count >= 0 ? count : null;
    /** Only allowlisted operational facts leave the private checkpoint. */
    const checkpoint = projectionState.data();
    /** Explicitly disabled reconciliation may legitimately have no checkpoint. */
    const enabled = projectionConfig.data()?.projectionReconciliationEnabled === true;
    /** Original page completion clock is independent of lease renewals and failed retries. */
    const lastPageAgeMs = observedAge(checkpoint?.lastCompletedAtMs);
    /** A recent page does not establish that both complete passes are keeping up. */
    const lastCycleAgeMs = observedAge(checkpoint?.lastCycleCompletedAtMs);
    /** Previous complete-cycle corruption survives later successful individual pages. */
    const projections = { enabled, lastPageAgeMs, lastCycleAgeMs,
        unavailableInCurrentCycle: observedCount(checkpoint?.cycleUnavailable),
        unavailableInLastCycle: observedCount(checkpoint?.lastCycleUnavailable),
        recoveryStale: enabled && (lastPageAgeMs === null || lastPageAgeMs >= exports.RACE_RECOVERY_STALE_MS),
        pageFailed: typeof checkpoint?.lastFailureCode === "string" && checkpoint.lastFailureCode.length > 0 };
    /** Due wake-up delay does not substitute for original scoring delay during retries. */
    const deadlines = { due: sampleCount(due), oldestWakeDelayMs: age(nowMs, due.docs[0]?.data().deadlineAtMs),
        retried: sampleCount(retried), oldestOriginalDeadlineAgeInSampleMs: Math.max(0, ...retried.docs.map(document => age(nowMs, document.data().deadlineRecovery?.originalDeadlineAtMs))),
        deferredInSample: retried.docs.filter(document => document.data().deadlineAtMs > nowMs).length, quarantined: sampleCount(quarantined) };
    /** Structured codes make alert filters stable while retaining bounded metric cardinality. */
    const warnings = [];
    if (projections.recoveryStale)
        warnings.push("projections-recovery-stale");
    if (enabled && lastCycleAgeMs === null)
        warnings.push("projections-cycle-unobserved");
    if (enabled && lastCycleAgeMs !== null && lastCycleAgeMs >= exports.RACE_PROJECTION_CYCLE_WARNING_MS)
        warnings.push("projections-cycle-delay");
    if (projections.pageFailed)
        warnings.push("projections-page-failed");
    if ((projections.unavailableInCurrentCycle ?? 0) > 0 || (projections.unavailableInLastCycle ?? 0) > 0)
        warnings.push("projections-unavailable-sources");
    if (deadlines.oldestWakeDelayMs >= exports.RACE_DEADLINE_DELAY_WARNING_MS)
        warnings.push("deadlines-overdue");
    if (deadlines.oldestOriginalDeadlineAgeInSampleMs >= exports.RACE_OUTBOX_DELAY_WARNING_MS)
        warnings.push("deadline-retry-delay");
    if (deadlines.quarantined.lowerBound > 0)
        warnings.push("deadlines-quarantined");
    for (const [collection, report] of outboxes) {
        if (report.oldestPendingAgeMs >= exports.RACE_OUTBOX_DELAY_WARNING_MS)
            warnings.push(`${collection}-delivery-delay`);
        if (report.quarantined.lowerBound > 0)
            warnings.push(`${collection}-quarantined`);
        if (report.invalidEnqueueTimesInSample > 0)
            warnings.push(`${collection}-invalid-enqueue-time`);
        if (report.recoveryStale)
            warnings.push(`${collection}-recovery-stale`);
    }
    return { observedAtMs: nowMs, deadlines, outboxes: Object.fromEntries(outboxes), projections, warnings };
}
/** Independent read-only monitoring survives missed worker invocations and retained quarantine. */
exports.monitorRaceRecoveryHealth = (0, sentryHandlers_1.onScheduleWithSentry)("monitorRaceRecoveryHealth", {
    schedule: "every 5 minutes", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
}, async () => {
    /** Failed health queries reject the scheduled run rather than report a healthy empty queue. */
    const report = await readRaceRecoveryHealth();
    firebase_functions_1.logger.write({ severity: report.warnings.length ? "WARNING" : "INFO", message: "Race recovery health", ...report });
});
//# sourceMappingURL=raceRecoveryHealth.js.map
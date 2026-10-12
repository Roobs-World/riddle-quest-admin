"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRaceDeadline = processRaceDeadline;
exports.replayRaceDeadline = replayRaceDeadline;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const raceEngine_1 = require("./raceEngine");
const raceSetupService_1 = require("./raceSetupService");
const raceSettlement_1 = require("./raceSettlement");
/** Processes a due run, removing corrupt records from the queue and deferring transient failures. */
async function processRaceDeadline(db, ref, nowMs) {
    try {
        /** Provides state behavior. */
        const state = await db.runTransaction(async (transaction) => {
            /** Re-read current authority after the indexed lookup. */
            const current = await transaction.get(ref);
            if (!current.exists || !["prepared", "scheduled", "active"].includes(current.data()?.status) || !Number.isFinite(current.data()?.deadlineAtMs) || current.data().deadlineAtMs > nowMs)
                return "skipped";
            /** Unsupported persisted records require operator repair rather than repeated automatic retries. */
            let run;
            try {
                run = (0, raceSetupService_1.parseRunRecord)(current.data(), current.id);
            }
            catch (error) {
                if (!(error instanceof https_1.HttpsError) || !["internal", "data-loss"].includes(error.code))
                    throw error;
                transaction.set(db.doc(`raceDeadlineFailures/${ref.id}`), { runId: ref.id, state: "quarantined", failureCode: "data-loss",
                    originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data().deadlineAtMs,
                    quarantinedAtMs: nowMs, expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + 90 * 86_400_000) });
                transaction.update(ref, { deadlineAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: nowMs });
                return "quarantined";
            }
            if (run.runId !== ref.id)
                throw new https_1.HttpsError("data-loss", "Race deadline identity does not match its document.");
            await (0, raceSettlement_1.settleRaceRun)(transaction, db, run, nowMs);
            return "processed";
        });
        if (state === "quarantined")
            firebase_functions_1.logger.write({ severity: "ERROR", message: "Race deadline requires repair and replay", runId: ref.id, failureCode: "data-loss" });
    }
    catch (error) {
        // Scheduling metadata is not read by raceClock/refreshRaceRun. Delaying this
        // index entry cannot grant extra playing time or change the canonical outcome.
        await db.runTransaction(async (transaction) => {
            /** A concurrent mutation/settlement takes precedence over retry bookkeeping. */
            const current = await transaction.get(ref);
            if (!current.exists || !["prepared", "scheduled", "active"].includes(current.data()?.status) || !Number.isFinite(current.data()?.deadlineAtMs) || current.data().deadlineAtMs > nowMs)
                return;
            if (error instanceof https_1.HttpsError && error.code === "data-loss") {
                transaction.set(db.doc(`raceDeadlineFailures/${ref.id}`), { runId: ref.id, state: "quarantined", failureCode: "data-loss",
                    originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data().deadlineAtMs, quarantinedAtMs: nowMs,
                    expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(nowMs + 90 * 86_400_000) });
                transaction.update(ref, { deadlineAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: nowMs });
                firebase_functions_1.logger.write({ severity: "ERROR", message: "Race deadline requires repair and replay", runId: ref.id, failureCode: "data-loss" });
                return;
            }
            /** Bounded exponential storage backoff prevents one failed account monopolizing every page. */
            const attempts = Math.min(20, Math.max(0, Number(current.data()?.deadlineRecovery?.attempts) || 0) + 1);
            /** Provides next attempt at ms behavior. */
            const nextAttemptAtMs = nowMs + Math.min(900_000, 30_000 * 2 ** Math.min(5, attempts - 1));
            /** Provides recovery behavior. */
            const recovery = { originalDeadlineAtMs: current.data()?.deadlineRecovery?.originalDeadlineAtMs ?? current.data().deadlineAtMs, attempts, nextAttemptAtMs };
            transaction.update(ref, { deadlineAtMs: nextAttemptAtMs, deadlineRecovery: recovery });
        });
        throw error;
    }
}
/** Admin-only repair seam: validates repaired source before restoring its derived scheduling index. */
async function replayRaceDeadline(db, runId, nowMs) {
    await db.runTransaction(async (transaction) => {
        /** Canonical repaired source and its diagnostic receipt are read together. */
        const ref = db.doc(`raceRuns/${runId}`);
        /** Provides [source, failure] behavior. */
        const [source, failure] = await Promise.all([transaction.get(ref), transaction.get(db.doc(`raceDeadlineFailures/${runId}`))]);
        if (!source.exists || !failure.exists || failure.data()?.state !== "quarantined")
            throw new https_1.HttpsError("failed-precondition", "No quarantined deadline is available to replay.");
        /** Provides run behavior. */
        const run = (0, raceSetupService_1.parseRunRecord)(source.data(), source.id);
        /** Provides deadline at ms behavior. */
        const deadlineAtMs = (0, raceEngine_1.raceDeadlineAtMs)(run);
        if (run.runId !== runId || !["prepared", "scheduled", "active"].includes(run.status) || !Number.isFinite(deadlineAtMs))
            throw new https_1.HttpsError("failed-precondition", "Repaired run has no valid unattended deadline.");
        transaction.update(ref, { deadlineAtMs, deadlineRecovery: firebaseAdmin_1.admin.firestore.FieldValue.delete(), deadlineQuarantinedAtMs: firebaseAdmin_1.admin.firestore.FieldValue.delete() });
        transaction.update(failure.ref, { state: "replayed", replayedAtMs: nowMs });
    });
}
//# sourceMappingURL=raceDeadlineRecovery.js.map
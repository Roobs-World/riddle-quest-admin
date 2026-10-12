"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replenishClassicSupply = void 0;
exports.processClassicSupplyJob = processClassicSupplyJob;
exports.processClassicSupplyJobs = processClassicSupplyJobs;
const node_crypto_1 = require("node:crypto");
const validation_1 = require("@qwordly/core/validation");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const sentry_1 = require("../shared/sentry");
const constants_1 = require("../shared/constants");
const riddleGeneration_1 = require("./riddleGeneration");
/** Lease outlives the worker timeout; crashed invocations become eligible again. */
const LEASE_MS = 10 * 60000;
/** An attempt may spend up to three further sixty-second model calls after this deadline. */
const GENERATION_BUDGET_MS = 3 * 60000;
/** Backoff avoids spinning on a provider outage. */
const RETRY_MS = 5 * 60000;
/** Claims a durable request transactionally so overlapping scheduled invocations cannot generate twice. */
async function processClassicSupplyJob(requestId) {
    /** Firestore owns the durable generation request and retry lease. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Stable job document survives worker retries and crashes. */
    const ref = db.collection("classicSupplyJobs").doc(requestId);
    /** Invocation identity prevents an expired worker from settling a newer lease. */
    const leaseId = (0, node_crypto_1.randomUUID)();
    /** Claim time defines lease eligibility and the generation deadline. */
    const now = Date.now();
    /** Validated locale is returned only after this invocation acquires the job lease. */
    const locale = await db.runTransaction(async (transaction) => {
        /** Each attempt locks the canonical job and loads only its eligibility and locale inputs. */
        const [snapshot] = await transaction.getAll(ref, { fieldMask: ["nextAttemptAtMs", "completed", "locale"] });
        /** Persisted completion and retry fields determine whether the job can run. */
        const data = snapshot?.data();
        if (!data || data.nextAttemptAtMs > now || data.completed === true)
            return undefined;
        if (!validation_1.SUPPORTED_LOCALES.includes(data.locale))
            throw new Error("Invalid Classic supply job locale.");
        transaction.update(ref, { leaseId, nextAttemptAtMs: now + LEASE_MS });
        return data.locale;
    });
    if (!locale)
        return "skipped";
    /** Generation outcome controls completion or delayed retry. */
    let succeeded = false;
    try {
        await (0, riddleGeneration_1.generateLocalizedClassicRiddlesForLocale)(locale, constants_1.RIDDLE_GENERATION_BATCH_SIZE, now + GENERATION_BUDGET_MS);
        succeeded = true;
    }
    catch (error) {
        (0, sentry_1.captureException)(error, { operation: "classicSupplyJob", locale });
    }
    await db.runTransaction(async (transaction) => {
        /** This attempt locks the canonical job and loads only its current lease owner before recording an outcome. */
        const [snapshot] = await transaction.getAll(ref, { fieldMask: ["leaseId"] });
        /** Missing or superseded jobs cannot be recreated or settled by this invocation. */
        const current = snapshot?.data();
        if (current?.leaseId !== leaseId)
            return;
        transaction.update(ref, succeeded
            ? { completed: true, nextAttemptAtMs: Number.MAX_SAFE_INTEGER }
            : { nextAttemptAtMs: Date.now() + RETRY_MS });
    });
    return succeeded ? "generated" : "retry";
}
/** Three bounded jobs per invocation; one indexed field covers both retry and expired-lease eligibility. */
async function processClassicSupplyJobs() {
    /** Discovery needs only due document IDs; claim transactions independently read current eligibility and locale. */
    const due = await firebaseAdmin_1.admin.firestore().collection("classicSupplyJobs")
        .where("nextAttemptAtMs", "<=", Date.now()).orderBy("nextAttemptAtMs").limit(3).select().get();
    await Promise.all(due.docs.map(document => processClassicSupplyJob(document.id)));
}
/** Scheduled retries also recover requests whose original worker died or timed out. */
exports.replenishClassicSupply = (0, sentryHandlers_1.onScheduleWithSentry)("replenishClassicSupply", {
    schedule: "every 1 minutes", timeZone: "UTC", region: "us-central1",
    timeoutSeconds: 540, secrets: ["OPENAI_API_KEY"],
}, async () => { await processClassicSupplyJobs(); });
//# sourceMappingURL=classicSupplyWorker.js.map
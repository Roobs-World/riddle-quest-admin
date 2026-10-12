"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RACE_MATCH_LOOKUP_MS = exports.RACE_MATCH_TRANSACTION_BUDGET = exports.RACE_MATCH_DOCUMENT_READ_BUDGET = void 0;
exports.assertRaceMatchReadBudget = assertRaceMatchReadBudget;
exports.withMeteredRaceTransaction = withMeteredRaceTransaction;
const https_1 = require("firebase-functions/v2/https");
/** Canonical document reads include rejected candidates and automatic transaction retries. */
exports.RACE_MATCH_DOCUMENT_READ_BUDGET = 1000;
/** Caps repeated contention independently of candidate-document retrieval. */
exports.RACE_MATCH_TRANSACTION_BUDGET = 200;
/** Stops issuing new work after this elapsed lookup time; already-issued reads may finish later. */
exports.RACE_MATCH_LOOKUP_MS = 15000;
/** Exhausted work budgets are retryable search failures, never an empty opponent pool. */
function assertRaceMatchReadBudget(meter, startingTransaction = false) {
    if (meter.documentReadAttempts >= exports.RACE_MATCH_DOCUMENT_READ_BUDGET || startingTransaction && meter.transactionAttempts >= exports.RACE_MATCH_TRANSACTION_BUDGET)
        throw new https_1.HttpsError("resource-exhausted", "Match search reached its storage work budget. Please retry.");
    if (meter.deadlineAtMs !== undefined && Date.now() >= meter.deadlineAtMs)
        throw new https_1.HttpsError("deadline-exceeded", "Match search exceeded its lookup time budget. Please retry.");
}
/** Measures canonical eligibility/offer reads through the same transaction interface used by their implementations. */
function withMeteredRaceTransaction(db, meter, operation, options) {
    return db.runTransaction(async (transaction) => {
        assertRaceMatchReadBudget(meter, true);
        meter.transactionAttempts++;
        /** Issued reads must settle before a budget failure leaves this callback. */
        const reads = [];
        /** One transaction snapshot owns this cache; automatic retries create a new one. */
        const cache = new Map();
        /** Parallel eligibility callers share one RPC when their reads become ready together. */
        let pendingBatch;
        /** Admission reserves document capacity; dispatch rechecks only the elapsed deadline. */
        const beforeDispatch = () => {
            if (meter.deadlineAtMs !== undefined && Date.now() >= meter.deadlineAtMs)
                throw new https_1.HttpsError("deadline-exceeded", "Match search exceeded its lookup time budget. Please retry.");
            if (meter.documentReadBatches !== undefined)
                meter.documentReadBatches++;
        };
        /** SDK getAll preserves reference ordering; each caller receives only its own slice. */
        const readBatch = (references) => {
            if (!pendingBatch) {
                /** This array is filled synchronously before the next microtask dispatches it. */
                const combined = [];
                pendingBatch = { references: combined, result: Promise.resolve().then(() => {
                        pendingBatch = undefined;
                        beforeDispatch();
                        return transaction.getAll(...combined);
                    }) };
            }
            /** Original caller order remains stable even when other groups complete first. */
            const batch = pendingBatch, offset = batch.references.length;
            batch.references.push(...references);
            return batch.result.then(snapshots => snapshots.slice(offset, offset + references.length));
        };
        /** Reads each unique path once and preserves input ordering across grouped RPCs. */
        const readDocuments = (references, batch) => {
            /** Pending shared reads are installed before another caller can inspect the cache. */
            const missing = references.filter((reference, index) => !cache.has(reference.path) &&
                (!reference.path || references.findIndex(item => item.path === reference.path) === index));
            /** Cache reuse reduces physical work without relaxing any transaction's read set. */
            if (meter.documentReadCacheHits !== undefined)
                meter.documentReadCacheHits += references.length - missing.length;
            if (missing.length) {
                assertRaceMatchReadBudget(meter);
                if (meter.documentReadAttempts + missing.length > exports.RACE_MATCH_DOCUMENT_READ_BUDGET)
                    return Promise.reject(new https_1.HttpsError("resource-exhausted", "Match search reached its storage work budget. Please retry."));
                meter.documentReadAttempts += missing.length;
                /** Deferral installs all promises before even a synchronously throwing adapter runs. */
                const issued = batch && typeof transaction.getAll === "function" ? readBatch(missing)
                    : Promise.resolve().then(() => {
                        beforeDispatch();
                        return Promise.all(missing.map(reference => transaction.get(reference)));
                    });
                reads.push(issued);
                for (const [index, reference] of missing.entries()) {
                    /** Firestore snapshots carry their physical path; narrow mocks may use ordered results. */
                    if (reference.path)
                        cache.set(reference.path, issued.then(snapshots => snapshots.find(snapshot => snapshot.ref?.path === reference.path) ?? snapshots[index]));
                }
                if (references.every(reference => !reference.path))
                    return issued;
            }
            return Promise.all(references.map(reference => cache.get(reference.path)));
        };
        /** Provides measured behavior. */
        const measured = new Proxy(transaction, {
            /** Intercepts transaction document reads for telemetry. */
            get(target, property) {
                if (property === "get")
                    return (reference) => Promise.resolve().then(() => readDocuments([reference], false)).then(snapshots => snapshots[0]);
                if (property === "getAll")
                    return (...references) => Promise.resolve().then(() => readDocuments(references, true));
                /** Provides member behavior. */
                const member = Reflect.get(target, property);
                return typeof member === "function" ? member.bind(target) : member;
            }
        });
        try {
            return await operation(measured);
        }
        finally {
            await Promise.allSettled(reads);
        }
    }, options);
}
//# sourceMappingURL=raceMatchReadMeter.js.map
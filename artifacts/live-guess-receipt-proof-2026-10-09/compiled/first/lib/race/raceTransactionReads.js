"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRaceTransactionReads = withRaceTransactionReads;
const firestore_1 = require("firebase-admin/firestore");
/**
 * Reuses document snapshots only within one Firestore transaction attempt.
 * Every snapshot still participates in Firestore conflict detection; retries must
 * construct a new wrapper. Queries and reads after writes retain SDK behavior.
 */
function withRaceTransactionReads(transaction) {
    /** References include their converters in isEqual, preventing incompatible snapshot reuse. */
    const reads = new Map();
    /** Reads after any write must still be rejected by the actual transaction SDK. */
    let wrote = false;
    /** All mutation methods retain their SDK receiver and chaining behavior. */
    const wrapper = new Proxy(transaction, {
        /** Intercepts reads and writes while preserving the underlying transaction receiver. */
        get(target, property) {
            if (property === "get")
                return (reference) => {
                    if (wrote || !(reference instanceof firestore_1.DocumentReference))
                        return Reflect.apply(target.get, target, [reference]);
                    for (const [existing, snapshot] of reads)
                        if (existing.isEqual(reference))
                            return snapshot;
                    /** In-flight reads are shared as well as completed snapshots. */
                    const snapshot = target.get(reference);
                    reads.set(reference, snapshot);
                    return snapshot;
                };
            /** Other SDK functions must execute against their original transaction instance. */
            const value = Reflect.get(target, property, target);
            if (typeof value !== "function")
                return value;
            return (...args) => {
                if (["create", "set", "update", "delete"].includes(String(property)))
                    wrote = true;
                /** Chained writes keep using the wrapper without losing the read-after-write guard. */
                const result = Reflect.apply(value, target, args);
                return result === target ? wrapper : result;
            };
        },
    });
    return wrapper;
}
//# sourceMappingURL=raceTransactionReads.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_NONCE_COLLECTION = exports.FACEBOOK_NONCE_TIMESTAMP_MAX_MS = exports.FACEBOOK_NONCE_TTL_MS = void 0;
exports.createFacebookIdentityNonceRecord = createFacebookIdentityNonceRecord;
exports.readFacebookIdentityNonceRecord = readFacebookIdentityNonceRecord;
exports.prepareFacebookIdentityNonceRetention = prepareFacebookIdentityNonceRetention;
const firestore_1 = require("firebase-admin/firestore");
/** One-use Meta assertion challenge lifetime; logical validation does not wait for TTL. */
exports.FACEBOOK_NONCE_TTL_MS = 5 * 60 * 1_000;
/** Firestore's timestamp ceiling also bounds all numeric authentication clocks. */
exports.FACEBOOK_NONCE_TIMESTAMP_MAX_MS = 253_402_300_799_999;
/** Server-only collection, distinct from every other provider's identity state. */
exports.FACEBOOK_NONCE_COLLECTION = "facebookIdentityNonces";
/** Issues the exact numeric and physical five-minute deadline without an identity field. */
function createFacebookIdentityNonceRecord(createdAtMs) {
    if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0 ||
        createdAtMs > exports.FACEBOOK_NONCE_TIMESTAMP_MAX_MS - exports.FACEBOOK_NONCE_TTL_MS) {
        throw new Error("invalid-facebook-nonce-clock");
    }
    return { createdAtMs, expiresAtMs: createdAtMs + exports.FACEBOOK_NONCE_TTL_MS,
        expiresAt: firestore_1.Timestamp.fromMillis(createdAtMs + exports.FACEBOOK_NONCE_TTL_MS), consumedAtMs: null };
}
/** Validates original/consumed state and rejects mismatched TTL instead of repairing its lifetime. */
function readFacebookIdentityNonceRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("invalid-facebook-nonce-record");
    /** Only the server's minimal lifetime and replay metadata is accepted. */
    const row = value;
    /** Original five-minute window must remain valid even after consumption or physical expiry. */
    const { createdAtMs, expiresAtMs, consumedAtMs, expiresAt, playerIdHash } = row;
    if (Object.keys(row).some(key => !["createdAtMs", "expiresAtMs", "consumedAtMs", "expiresAt", "playerIdHash"].includes(key)) ||
        typeof createdAtMs !== "number" || !Number.isSafeInteger(createdAtMs) || createdAtMs < 0 ||
        createdAtMs > exports.FACEBOOK_NONCE_TIMESTAMP_MAX_MS - exports.FACEBOOK_NONCE_TTL_MS ||
        typeof expiresAtMs !== "number" || expiresAtMs !== createdAtMs + exports.FACEBOOK_NONCE_TTL_MS ||
        (expiresAt !== undefined && (!(expiresAt instanceof firestore_1.Timestamp) || !expiresAt.isEqual(firestore_1.Timestamp.fromMillis(expiresAtMs)))) ||
        (consumedAtMs === null ? playerIdHash !== undefined :
            typeof consumedAtMs !== "number" || !Number.isSafeInteger(consumedAtMs) ||
                consumedAtMs < createdAtMs || consumedAtMs >= expiresAtMs ||
                typeof playerIdHash !== "string" || !/^[0-9a-f]{64}$/.test(playerIdHash))) {
        throw new Error("invalid-facebook-nonce-record");
    }
    return row;
}
/** Prepares one legacy nonce transactionally; deletion/consumption can never recreate or renew it. */
async function prepareFacebookIdentityNonceRetention(db, nonceHash, apply = false) {
    if (!/^[0-9a-f]{64}$/.test(nonceHash))
        throw new Error("invalid-facebook-nonce-hash");
    /** Opaque SHA-256 document scope contains no raw challenge or player identity. */
    const ref = db.collection(exports.FACEBOOK_NONCE_COLLECTION).doc(nonceHash);
    return db.runTransaction(async (transaction) => {
        /** Re-read inside the transaction instead of writing the stale maintenance page. */
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            return "missing";
        /** Both consumed and unused legacy rows retain their exact original acceptance deadline. */
        const record = readFacebookIdentityNonceRecord(snapshot.data());
        if (record.expiresAt !== undefined)
            return "already-ready";
        if (apply)
            transaction.update(ref, { expiresAt: firestore_1.Timestamp.fromMillis(record.expiresAtMs) });
        return "ready";
    });
}
//# sourceMappingURL=facebookIdentityNonce.js.map
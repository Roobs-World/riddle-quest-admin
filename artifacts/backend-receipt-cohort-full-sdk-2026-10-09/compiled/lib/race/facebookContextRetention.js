"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_CONTEXT_RETENTION_PAGE_LIMIT = void 0;
exports.purgeExpiredFacebookContext = purgeExpiredFacebookContext;
exports.purgeExpiredFacebookContextPage = purgeExpiredFacebookContextPage;
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const facebookContextCompetition_1 = require("./facebookContextCompetition");
const facebookContextService_1 = require("./facebookContextService");
/** Fixed per-invocation budget; subsequent invocations continue from remaining expired boards. */
exports.FACEBOOK_CONTEXT_RETENTION_PAGE_LIMIT = 20;
/** Validates the authority clock before selecting or deleting any expired context. */
function requireRetentionClock(nowMs) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > facebookContextCompetition_1.FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS) {
        throw new Error("invalid-facebook-context-retention-clock");
    }
}
/** Deletes one expired parent and every bounded score entry atomically, preserving identity-free history. */
async function purgeExpiredFacebookContext(db, contextKey, nowMs, apply = false) {
    requireRetentionClock(nowMs);
    if (!/^[0-9a-f]{64}$/.test(contextKey))
        throw new Error("invalid-facebook-context-retention-key");
    /** Only Facebook context state is eligible; user accounts and economies are untouched. */
    const ref = db.doc(`facebookContextCompetitions/${contextKey}`);
    return db.runTransaction(async (transaction) => {
        /** Re-reading within the transaction protects against rollover/join and account-deletion races. */
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            return { status: "missing", entries: 0, archive: false };
        /** Canonical server windows and provider-scoped membership must validate before any deletion. */
        const board = (0, facebookContextService_1.parseFacebookContextCompetition)(snapshot.data());
        if (board.contextKey !== contextKey)
            throw new Error("invalid-facebook-context-retention-scope");
        if (board.expiresAtMs > nowMs)
            return { status: "active", entries: 0, archive: false };
        /** Reads every score, including stale orphan membership entries, before the write phase. */
        const entries = await transaction.get(ref.collection("entries").limit(facebookContextService_1.FACEBOOK_CONTEXT_MEMBER_LIMIT + 1));
        if (entries.size > facebookContextService_1.FACEBOOK_CONTEXT_MEMBER_LIMIT)
            return { status: "too-many-entries", entries: 0, archive: false };
        /** Retention is anchored to original expiry, never extended by a late cleanup run. */
        const historyExpiresAtMs = board.expiresAtMs + facebookContextCompetition_1.FACEBOOK_CONTEXT_HISTORY_RETENTION_MS;
        /** Avoids recreating metadata whose entire permitted lifetime has already elapsed. */
        const archive = historyExpiresAtMs > nowMs;
        if (apply) {
            if (archive)
                transaction.set(db.doc(`facebookContextCompetitionHistory/${contextKey}_${board.createdAtMs}`), {
                    contextKey, contextType: board.contextType, locale: board.locale,
                    startsAtMs: board.createdAtMs, endsAtMs: board.expiresAtMs,
                    participantCount: board.members.length, archivedAtMs: nowMs, rewardsEnabled: false,
                    expiresAt: firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(historyExpiresAtMs),
                }, { merge: false });
            for (const entry of entries.docs)
                transaction.delete(entry.ref);
            transaction.delete(ref);
        }
        return { status: "ready", entries: entries.size, archive };
    });
}
/** Processes one bounded page, sanitizing per-board failures and retaining incomplete-work evidence. */
async function purgeExpiredFacebookContextPage(db, nowMs, apply = false, limit = exports.FACEBOOK_CONTEXT_RETENTION_PAGE_LIMIT) {
    requireRetentionClock(nowMs);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > exports.FACEBOOK_CONTEXT_RETENTION_PAGE_LIMIT) {
        throw new Error("invalid-facebook-context-retention-limit");
    }
    /** Numeric canonical expiry is indexed even on legacy parents without a physical TTL policy. */
    const snapshot = await db.collection("facebookContextCompetitions")
        .where("expiresAtMs", "<=", nowMs).orderBy("expiresAtMs").limit(limit + 1).get();
    /** Aggregate-only operational output; context keys, members and provider errors are excluded. */
    const totals = { scanned: 0, ready: 0, missing: 0, active: 0, invalid: 0, entries: 0 };
    for (const row of snapshot.docs.slice(0, limit)) {
        totals.scanned++;
        try {
            /** A stale outer query cannot authorize deletion of a replacement generation. */
            const result = await purgeExpiredFacebookContext(db, row.id, nowMs, apply);
            totals.entries += result.entries;
            if (result.status === "too-many-entries")
                totals.invalid++;
            else
                totals[result.status]++;
        }
        catch {
            totals.invalid++;
        }
    }
    return { ...totals, complete: snapshot.size <= limit && totals.invalid === 0 };
}
//# sourceMappingURL=facebookContextRetention.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_NOTIFICATION_REPROMPT_MS = void 0;
exports.resolveFacebookNotificationPromptClaim = resolveFacebookNotificationPromptClaim;
exports.claimFacebookNotificationPrompt = claimFacebookNotificationPrompt;
exports.acceptFacebookNotificationPrompt = acceptFacebookNotificationPrompt;
const firestore_1 = require("firebase-admin/firestore");
/** Defines the facebook notification reprompt ms value. */
exports.FACEBOOK_NOTIFICATION_REPROMPT_MS = 7 * 24 * 60 * 60 * 1_000;
/** Defines the max firestore milliseconds value. */
const MAX_FIRESTORE_MILLISECONDS = 253_402_300_799_999;
/** Provides timestamp millis behavior. */
const timestampMillis = (value) => {
    if (typeof value !== "object" ||
        value === null ||
        !("toMillis" in value) ||
        typeof value.toMillis !== "function") {
        throw new Error("invalid-facebook-notification-prompt-lease");
    }
    try {
        /** Provides milliseconds behavior. */
        const milliseconds = value.toMillis();
        if (typeof milliseconds !== "number" ||
            !Number.isSafeInteger(milliseconds) ||
            milliseconds < 0 ||
            milliseconds > MAX_FIRESTORE_MILLISECONDS)
            throw new Error();
        return milliseconds;
    }
    catch {
        throw new Error("invalid-facebook-notification-prompt-lease");
    }
};
/** Parses lease. */
const parseLease = (value, uid) => {
    if (value === undefined)
        return null;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("invalid-facebook-notification-prompt-lease");
    }
    /** Provides record behavior. */
    const record = value;
    if (record.schemaVersion !== 1 || record.uid !== uid || typeof record.accepted !== "boolean") {
        throw new Error("invalid-facebook-notification-prompt-lease");
    }
    /** Provides last prompt at ms behavior. */
    const lastPromptAtMs = timestampMillis(record.lastPromptAt);
    /** Provides accepted at ms behavior. */
    const acceptedAtMs = record.acceptedAt === undefined ? undefined : timestampMillis(record.acceptedAt);
    if ((record.accepted && acceptedAtMs === undefined) || (!record.accepted && acceptedAtMs !== undefined)) {
        throw new Error("invalid-facebook-notification-prompt-lease");
    }
    return {
        schemaVersion: 1,
        uid,
        accepted: record.accepted,
        lastPromptAtMs,
        ...(acceptedAtMs === undefined ? {} : { acceptedAtMs }),
    };
};
/** Indicates whether has authoritative win. */
const hasAuthoritativeWin = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("invalid-facebook-notification-win-state");
    }
    /** Provides stats behavior. */
    const stats = value.stats;
    if (typeof stats !== "object" || stats === null || Array.isArray(stats)) {
        throw new Error("invalid-facebook-notification-win-state");
    }
    /** Provides record behavior. */
    const record = stats;
    /** Provides counters behavior. */
    const counters = ["wins", "totalWins", "multiplayerWins"].map((field) => record[field] ?? 0);
    if (counters.some((counter) => typeof counter !== "number" || !Number.isSafeInteger(counter) || counter < 0)) {
        throw new Error("invalid-facebook-notification-win-state");
    }
    return counters.some((counter) => counter > 0);
};
/** Pure fail-closed decision used by the transactional prompt lease. */
function resolveFacebookNotificationPromptClaim({ uid, user, lease, nowMs, }) {
    if (!/^facebook_[0-9a-f]{40}$/u.test(uid) ||
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > MAX_FIRESTORE_MILLISECONDS) {
        throw new Error("invalid-facebook-notification-prompt-request");
    }
    if (!hasAuthoritativeWin(user))
        return { granted: false };
    /** Parses d lease. */
    const parsedLease = parseLease(lease, uid);
    if (parsedLease?.accepted)
        return { granted: false };
    if (parsedLease &&
        (parsedLease.lastPromptAtMs > nowMs || nowMs - parsedLease.lastPromptAtMs < exports.FACEBOOK_NOTIFICATION_REPROMPT_MS)) {
        return { granted: false };
    }
    return { granted: true, claimedAtMs: nowMs };
}
/** Atomically grants at most one prompt attempt per player per seven-day window. */
async function claimFacebookNotificationPrompt(uid, { db = (0, firestore_1.getFirestore)(), nowMs = Date.now(), } = {}) {
    /** Provides r ref. */
    const userRef = db.collection("users").doc(uid);
    /** Provides lease ref behavior. */
    const leaseRef = db.collection("facebookNotificationPromptLeases").doc(uid);
    return db.runTransaction(async (transaction) => {
        /** Provides [user snapshot, lease snapshot] behavior. */
        const [userSnapshot, leaseSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(leaseRef)]);
        if (!userSnapshot.exists)
            throw new Error("facebook-notification-user-missing");
        /** Provides decision behavior. */
        const decision = resolveFacebookNotificationPromptClaim({
            uid,
            user: userSnapshot.data(),
            lease: leaseSnapshot.exists ? leaseSnapshot.data() : undefined,
            nowMs,
        });
        if (decision.granted) {
            transaction.set(leaseRef, {
                schemaVersion: 1,
                uid,
                accepted: false,
                lastPromptAt: firestore_1.Timestamp.fromMillis(decision.claimedAtMs),
            }, { merge: false });
        }
        return decision;
    });
}
/** Permanently records successful platform permission after a granted prompt attempt. */
async function acceptFacebookNotificationPrompt(uid, { db = (0, firestore_1.getFirestore)(), nowMs = Date.now(), } = {}) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > MAX_FIRESTORE_MILLISECONDS) {
        throw new Error("invalid-facebook-notification-prompt-request");
    }
    /** Provides lease ref behavior. */
    const leaseRef = db.collection("facebookNotificationPromptLeases").doc(uid);
    await db.runTransaction(async (transaction) => {
        /** Provides snapshot behavior. */
        const snapshot = await transaction.get(leaseRef);
        if (!snapshot.exists)
            throw new Error("facebook-notification-prompt-not-claimed");
        /** Provides lease behavior. */
        const lease = parseLease(snapshot.data(), uid);
        if (!lease)
            throw new Error("facebook-notification-prompt-not-claimed");
        if (lease.accepted)
            return;
        if (lease.lastPromptAtMs > nowMs)
            throw new Error("invalid-facebook-notification-prompt-lease");
        transaction.set(leaseRef, {
            schemaVersion: 1,
            uid,
            accepted: true,
            lastPromptAt: firestore_1.Timestamp.fromMillis(lease.lastPromptAtMs),
            acceptedAt: firestore_1.Timestamp.fromMillis(nowMs),
        }, { merge: false });
    });
}
//# sourceMappingURL=facebookNotificationPrompts.js.map
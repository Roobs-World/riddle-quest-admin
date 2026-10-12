"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionExpiry = exports.SINGLE_PLAYER_SESSION_TTL_MS = void 0;
exports.isSinglePlayerSessionExpired = isSinglePlayerSessionExpired;
exports.assertSinglePlayerSessionActive = assertSinglePlayerSessionActive;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
/** Logical lifetime of private answer-bearing single-player state. */
exports.SINGLE_PLAYER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
/** Builds the fixed Firestore TTL value used when private session state is issued. */
const sessionExpiry = () => firebaseAdmin_1.admin.firestore.Timestamp.fromMillis(Date.now() + exports.SINGLE_PLAYER_SESSION_TTL_MS);
exports.sessionExpiry = sessionExpiry;
/** Returns whether a stored session is missing a trusted future expiry. */
function isSinglePlayerSessionExpired(state, now = new Date()) {
    /** Provides expires at behavior. */
    const expiresAt = state.expiresAt;
    if (!expiresAt || typeof expiresAt.toDate !== "function")
        return true;
    /** Provides expiry behavior. */
    const expiry = expiresAt.toDate();
    return !(expiry instanceof Date) || Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}
/** Fails closed before an expired private session can be read, replayed, or extended. */
function assertSinglePlayerSessionActive(state, now = new Date()) {
    if (isSinglePlayerSessionExpired(state, now)) {
        throw new https_1.HttpsError("failed-precondition", "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE");
    }
}
//# sourceMappingURL=singlePlayerSessionExpiry.js.map
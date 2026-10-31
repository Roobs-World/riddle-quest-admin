"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncJestAvatar = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const jestSecurity_1 = require("../jest/jestSecurity");
const jestAccountDeletion_1 = require("../jest/jestAccountDeletion");
/** Fills an empty game avatar from the registered player's Jest profile. */
exports.syncJestAvatar = (0, sentryHandlers_1.onCallWithSentry)("syncJestAvatar", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides uid behavior. */
    const uid = request.auth?.uid;
    /** Provides player id behavior. */
    const playerId = request.auth?.token.jestPlayerId;
    if (!uid ||
        request.auth?.token.jestRegistered !== true ||
        typeof playerId !== "string" ||
        (0, jestSecurity_1.jestFirebaseUid)(playerId) !== uid) {
        throw new https_1.HttpsError("permission-denied", "A registered Jest account is required.");
    }
    /** Provides data behavior. */
    const data = request.data;
    if (!data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.keys(data).length !== 1 ||
        typeof data.avatarUrl !== "string") {
        throw new https_1.HttpsError("invalid-argument", "A Jest avatar URL is required.");
    }
    /** Provides avatar url behavior. */
    const avatarUrl = data.avatarUrl;
    if (avatarUrl.length > 2048)
        throw new https_1.HttpsError("invalid-argument", "The Jest avatar URL is too long.");
    /** Provides url behavior. */
    let url;
    try {
        url = new URL(avatarUrl);
    }
    catch {
        throw new https_1.HttpsError("invalid-argument", "The Jest avatar URL is invalid.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.href !== avatarUrl) {
        throw new https_1.HttpsError("invalid-argument", "The Jest avatar URL must be HTTPS.");
    }
    /** Provides db behavior. */
    const db = firebaseAdmin_1.admin.firestore();
    /** Provides user ref behavior. */
    const userRef = db.collection("users").doc(uid);
    /** Provides leaderboard ref behavior. */
    const leaderboardRef = db.collection("leaderboard").doc(uid);
    return db.runTransaction(async (transaction) => {
        /** Provides [user, leaderboard, deletion] behavior. */
        const [user, leaderboard, deletion] = await Promise.all([
            transaction.get(userRef),
            transaction.get(leaderboardRef),
            transaction.get((0, jestAccountDeletion_1.getJestAccountDeletionRef)(db, uid)),
        ]);
        (0, jestAccountDeletion_1.assertJestAccountActive)(deletion);
        if (!user.exists)
            throw new https_1.HttpsError("not-found", "Player profile not found.");
        /** Provides existing behavior. */
        const existing = user.get("avatarUrl");
        if (typeof existing === "string" && existing.length > 0)
            return { avatarUrl: existing };
        transaction.update(userRef, { avatarUrl });
        if (leaderboard.exists)
            transaction.update(leaderboardRef, { avatarUrl, updatedAt: Date.now() });
        return { avatarUrl };
    });
});
//# sourceMappingURL=syncJestAvatar.js.map
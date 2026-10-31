"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAvatar = void 0;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const firestoreService_1 = require("../gameplay/firestoreService");
const callableSecurity_1 = require("../shared/callableSecurity");
const firebaseAdmin_1 = require("../shared/firebaseAdmin");
const sentry_1 = require("../shared/sentry");
const callableValidation_1 = require("../validation/callableValidation");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const avatarUpload_1 = require("./avatarUpload");
const leaderboardProfile_1 = require("./leaderboardProfile");
const sentryHandlers_1 = require("../shared/sentryHandlers");
/** Uploads an authenticated registered player's avatar and updates its public URL. */
exports.updateAvatar = (0, sentryHandlers_1.onCallWithSentry)("updateAvatar", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (request.auth.token.jestRegistered !== true) {
        throw new https_1.HttpsError("failed-precondition", "Register with Jest before uploading a profile photo.");
    }
    /** Provides {image data url} behavior. */
    const { imageDataUrl } = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.UpdateAvatarRequestSchema, request.data, "updateAvatar");
    /** Provides r id. */
    const userId = request.auth.uid;
    try {
        /** Provides {bytes, content type} behavior. */
        const { bytes, contentType } = (0, avatarUpload_1.decodeAvatarDataUrl)(imageDataUrl);
        /** Provides bucket behavior. */
        const bucket = firebaseAdmin_1.admin.storage().bucket();
        /** Provides object path behavior. */
        const objectPath = `avatars/${userId}/profile`;
        /** Provides file behavior. */
        const file = bucket.file(objectPath);
        /** Provides version behavior. */
        const version = Date.now();
        /** Provides download token behavior. */
        const downloadToken = (0, node_crypto_1.randomUUID)();
        await file.save(bytes, {
            resumable: false,
            metadata: {
                contentType,
                cacheControl: "public,max-age=86400",
                metadata: {
                    uploadedAt: String(version),
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });
        /** Provides avatar url behavior. */
        const avatarUrl = (0, avatarUpload_1.avatarDownloadUrl)(bucket.name, objectPath, downloadToken);
        await (0, firestoreService_1.updateUserProfile)(userId, { avatarUrl });
        await (0, leaderboardProfile_1.syncLeaderboardProfileFields)(userId, { avatarUrl });
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.UpdateAvatarResponseSchema, { success: true, message: "Avatar updated successfully.", avatarUrl }, "updateAvatar");
    }
    catch (error) {
        v2_1.logger.error(`Error updating avatar for user ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        if (error instanceof https_1.HttpsError)
            throw error;
        /** Provides reason behavior. */
        const reason = error instanceof Error ? error.message : "";
        if (reason.startsWith("invalid-avatar-")) {
            throw new https_1.HttpsError("invalid-argument", "The selected image is invalid.");
        }
        throw new https_1.HttpsError("internal", "An error occurred while updating the avatar.");
    }
});
//# sourceMappingURL=updateAvatar.js.map
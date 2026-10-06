"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUsername = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentry_1 = require("../shared/sentry");
const profanity_1 = require("@qwordly/core/validation/profanity");
const callableValidation_1 = require("../validation/callableValidation");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const leaderboardProfile_1 = require("./leaderboardProfile");
const sentryHandlers_1 = require("../shared/sentryHandlers");
/**
 * Updates the authenticated user's username in their profile and leaderboard.
 * Validates for profanity and uniqueness before saving both records atomically.
 */
exports.updateUsername = (0, sentryHandlers_1.onCallWithSentry)("updateUsername", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    /** Provides r id. */
    const userId = request.auth.uid;
    /** Provides {username} behavior. */
    const { username } = (0, callableValidation_1.validateCallableRequest)(requestSchemas_1.UpdateUsernameRequestSchema, request.data, "updateUsername");
    /** Provides profanity error behavior. */
    const profanityError = (0, profanity_1.validateUsernameForProfanity)(username);
    if (profanityError) {
        throw new https_1.HttpsError("invalid-argument", profanityError);
    }
    try {
        await (0, leaderboardProfile_1.updateUsernameRecords)(userId, username);
        v2_1.logger.info("Authenticated user updated their username.");
        return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.BasicSuccessMessageResponseSchema, { success: true, message: "Username updated successfully." }, "updateUsername");
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        v2_1.logger.error(`Error updating username for user ${userId}:`, error);
        (0, sentry_1.captureException)(error);
        throw new https_1.HttpsError("internal", "An error occurred while updating username.");
    }
});
//# sourceMappingURL=updateUsername.js.map
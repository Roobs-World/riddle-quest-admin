"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = void 0;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const callableSecurity_1 = require("../../shared/callableSecurity");
const sentry_1 = require("../../shared/sentry");
const errorMetadata_1 = require("../../shared/errorMetadata");
const deleteAccountData_1 = require("./deleteAccountData");
const sentryHandlers_1 = require("../../shared/sentryHandlers");
const jestAccountDeletion_1 = require("../../jest/jestAccountDeletion");
const jestSecurity_1 = require("../../jest/jestSecurity");
const facebookSecurity_1 = require("../../facebook/facebookSecurity");
const facebookAccountDeletion_1 = require("../../facebook/facebookAccountDeletion");
const params_1 = require("firebase-functions/params");
/** Provides facebook uid secret behavior. */
const facebookUidSecret = (0, params_1.defineSecret)("FACEBOOK_UID_SECRET");
/** Callable boundary for permanent Riddle Quest account deletion. */
exports.deleteAccount = (0, sentryHandlers_1.onCallWithSentry)("deleteAccount", {
    ...callableSecurity_1.browserCallableSecurityOptions,
    timeoutSeconds: 540,
    secrets: [facebookUidSecret],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    /** Provides jest player id behavior. */
    const jestPlayerId = typeof request.auth.token?.jestPlayerId === "string" && request.auth.token.jestPlayerId.length > 0
        ? request.auth.token.jestPlayerId
        : undefined;
    if ((0, jestSecurity_1.isJestFirebaseUid)(request.auth.uid) && !jestPlayerId) {
        throw new https_1.HttpsError("failed-precondition", "Refresh the Jest session before deleting this account.");
    }
    if (jestPlayerId && (0, jestSecurity_1.jestFirebaseUid)(jestPlayerId) !== request.auth.uid) {
        throw new https_1.HttpsError("failed-precondition", "The authenticated Jest identity is inconsistent.");
    }
    /** Provides facebook generation behavior. */
    const facebookGeneration = request.auth.token?.provider === "facebook" && Number.isSafeInteger(request.auth.token.accountGeneration)
        ? request.auth.token.accountGeneration
        : undefined;
    if ((0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid) && facebookGeneration === undefined) {
        throw new https_1.HttpsError("failed-precondition", "Refresh the Facebook session before deleting this account.");
    }
    if (facebookGeneration !== undefined && !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("failed-precondition", "The authenticated Facebook identity is inconsistent.");
    }
    try {
        if (facebookGeneration !== undefined) {
            await (0, facebookAccountDeletion_1.deleteFacebookAccountGeneration)({ uid: request.auth.uid, accountGeneration: facebookGeneration }, { uidSecret: facebookUidSecret.value() });
        }
        else {
            await (0, deleteAccountData_1.deleteAccountForUser)(request.auth.uid, jestPlayerId);
        }
        return { success: true };
    }
    catch (error) {
        if ((0, jestAccountDeletion_1.isJestAccountDeletionBusyError)(error)) {
            throw new https_1.HttpsError("aborted", "Account deletion is waiting for an earlier operation. Retry shortly.");
        }
        v2_1.logger.error("Account deletion failed.", (0, errorMetadata_1.getSafeErrorMetadata)(error));
        (0, sentry_1.captureException)(error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "An unexpected error occurred while deleting the account.");
    }
}, { skipJestAccountOperationLease: true });
//# sourceMappingURL=deleteAccountCallable.js.map
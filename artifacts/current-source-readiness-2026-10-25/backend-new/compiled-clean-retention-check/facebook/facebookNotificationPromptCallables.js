"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptFacebookNotificationPermissionPrompt = exports.claimFacebookNotificationPermissionPrompt = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookNotificationPrompts_1 = require("./facebookNotificationPrompts");
const facebookSecurity_1 = require("./facebookSecurity");
/** Validates the empty request data shape. */
const EmptyRequestSchema = zod_1.z.object({}).strict();
/** Validates the claim response data shape. */
const ClaimResponseSchema = zod_1.z.discriminatedUnion("granted", [
    zod_1.z.object({ granted: zod_1.z.literal(false) }).strict(),
    zod_1.z.object({ granted: zod_1.z.literal(true), claimedAtMs: zod_1.z.number().int().nonnegative().safe() }).strict(),
]);
/** Validates the accepted response data shape. */
const AcceptedResponseSchema = zod_1.z.object({ accepted: zod_1.z.literal(true) }).strict();
/** Provides require facebook notifications behavior. */
const requireFacebookNotifications = (request) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("notifications")) {
        throw new https_1.HttpsError("unavailable", "Facebook notifications are temporarily unavailable.");
    }
    return request.auth.uid;
};
/** Provides claim facebook notification permission prompt behavior. */
exports.claimFacebookNotificationPermissionPrompt = (0, sentryHandlers_1.onCallWithSentry)("claimFacebookNotificationPermissionPrompt", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides uid behavior. */
    const uid = requireFacebookNotifications(request);
    (0, callableValidation_1.validateCallableRequest)(EmptyRequestSchema, request.data, "claimFacebookNotificationPermissionPrompt");
    return (0, callableValidation_1.validateCallableResponse)(ClaimResponseSchema, await (0, facebookNotificationPrompts_1.claimFacebookNotificationPrompt)(uid), "claimFacebookNotificationPermissionPrompt");
});
/** Provides accept facebook notification permission prompt behavior. */
exports.acceptFacebookNotificationPermissionPrompt = (0, sentryHandlers_1.onCallWithSentry)("acceptFacebookNotificationPermissionPrompt", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides uid behavior. */
    const uid = requireFacebookNotifications(request);
    (0, callableValidation_1.validateCallableRequest)(EmptyRequestSchema, request.data, "acceptFacebookNotificationPermissionPrompt");
    await (0, facebookNotificationPrompts_1.acceptFacebookNotificationPrompt)(uid);
    return (0, callableValidation_1.validateCallableResponse)(AcceptedResponseSchema, { accepted: true }, "acceptFacebookNotificationPermissionPrompt");
});
//# sourceMappingURL=facebookNotificationPromptCallables.js.map
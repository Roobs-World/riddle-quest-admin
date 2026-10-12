"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindFacebookReferral = exports.createFacebookReferral = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookReferrals_1 = require("./facebookReferrals");
const facebookSecurity_1 = require("./facebookSecurity");
/** Validates the bind referral data shape. */
const BindReferralSchema = zod_1.z.object({ token: zod_1.z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
/** Provides require facebook uid behavior. */
const requireFacebookUid = (request) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("referrals")) {
        throw new https_1.HttpsError("unavailable", "Facebook referrals are temporarily unavailable.");
    }
    return request.auth.uid;
};
/** Issues an opaque, expiring Facebook referral entry token. */
exports.createFacebookReferral = (0, sentryHandlers_1.onCallWithSentry)("createFacebookReferral", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides uid behavior. */
    const uid = requireFacebookUid(request);
    (0, callableValidation_1.validateCallableRequest)(zod_1.z.object({}).strict(), request.data, "createFacebookReferral");
    return (0, facebookReferrals_1.issueFacebookReferralToken)(uid);
});
/** Binds the authenticated new player to at most one lifetime Facebook referrer. */
exports.bindFacebookReferral = (0, sentryHandlers_1.onCallWithSentry)("bindFacebookReferral", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides uid behavior. */
    const uid = requireFacebookUid(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(BindReferralSchema, request.data, "bindFacebookReferral");
    return (0, facebookReferrals_1.bindFacebookReferralToken)(uid, input.token);
});
//# sourceMappingURL=facebookReferralCallables.js.map
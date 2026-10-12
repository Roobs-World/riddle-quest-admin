"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPresenceConsent = void 0;
exports.requirePresenceConsentIdentity = requirePresenceConsentIdentity;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookFeatureFlags_1 = require("../facebook/facebookFeatureFlags");
const presenceAggregation_1 = require("./presenceAggregation");
const presenceFeatureGate_1 = require("./presenceFeatureGate");
/** Validates the presence consent request data shape. */
const PresenceConsentRequestSchema = zod_1.z.object({ enabled: zod_1.z.boolean() }).strict();
/** Validates the presence consent response data shape. */
const PresenceConsentResponseSchema = zod_1.z.object({ success: zod_1.z.literal(true), enabled: zod_1.z.boolean() }).strict();
/** Provides facebook uid behavior. */
const facebookUid = /^facebook_[0-9a-f]{40}$/;
/** Provides jest uid behavior. */
const jestUid = /^jest_[0-9a-f]{40}$/;
/** Requires provider claims to agree with the UID namespace before account-wide consent changes. */
function requirePresenceConsentIdentity(request) {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    /** Provides {uid, token} behavior. */
    const { uid, token } = request.auth;
    /** Provides facebook behavior. */
    const facebook = facebookUid.test(uid) && token.provider === "facebook";
    /** Provides jest behavior. */
    const jest = jestUid.test(uid) && typeof token.jestPlayerId === "string" && token.jestPlayerId.length > 0;
    if (!facebook && !jest)
        throw new https_1.HttpsError("permission-denied", "Platform identity is invalid.");
    return uid;
}
/** Opens presence writes only on explicit opt-in; opt-out clears all sessions atomically. */
exports.setPresenceConsent = (0, sentryHandlers_1.onCallWithSentry)("setPresenceConsent", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    /** Provides r id. */
    const userId = requirePresenceConsentIdentity(request);
    /** Provides input behavior. */
    const input = (0, callableValidation_1.validateCallableRequest)(PresenceConsentRequestSchema, request.data, "setPresenceConsent");
    if (facebookUid.test(userId)) {
        /** Provides presence enabled behavior. */
        const presenceEnabled = (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("presence");
        await (0, presenceFeatureGate_1.syncFacebookPresenceFeatureGate)(presenceEnabled);
        if (input.enabled && !presenceEnabled) {
            throw new https_1.HttpsError("unavailable", "Facebook presence is temporarily unavailable.");
        }
    }
    await (0, presenceAggregation_1.setPresenceConsentForUser)(userId, input.enabled);
    return (0, callableValidation_1.validateCallableResponse)(PresenceConsentResponseSchema, { success: true, enabled: input.enabled }, "setPresenceConsent");
});
//# sourceMappingURL=presenceConsentCallable.js.map
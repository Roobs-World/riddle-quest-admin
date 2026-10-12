"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFacebookClientConfiguration = void 0;
exports.resolveFacebookClientConfiguration = resolveFacebookClientConfiguration;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const callableValidation_1 = require("../validation/callableValidation");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookSecurity_1 = require("./facebookSecurity");
const presenceFeatureGate_1 = require("../presence/presenceFeatureGate");
/** Validates the facebook client configuration response data shape. */
const FacebookClientConfigurationResponseSchema = zod_1.z
    .object({
    interstitialsEnabled: zod_1.z.boolean(),
    notificationsEnabled: zod_1.z.boolean(),
    commerceEnabled: zod_1.z.boolean(),
    rewardedAdsEnabled: zod_1.z.boolean(),
    referralsEnabled: zod_1.z.boolean(),
    matchmakingEnabled: zod_1.z.boolean(),
    tournamentsEnabled: zod_1.z.boolean(),
    presenceEnabled: zod_1.z.boolean(),
    removeInterstitialAds: zod_1.z.boolean(),
})
    .strict();
/** Projects the server switch set and durable entitlement without exposing commerce debt or receipts. */
function resolveFacebookClientConfiguration(commerceAccount, disabledFeatures = process.env.FACEBOOK_DISABLED_FEATURES) {
    if (commerceAccount?.removeInterstitialAds !== undefined &&
        typeof commerceAccount.removeInterstitialAds !== "boolean") {
        throw new Error("invalid-facebook-commerce-entitlement");
    }
    return FacebookClientConfigurationResponseSchema.parse({
        interstitialsEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("interstitials", disabledFeatures),
        notificationsEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("notifications", disabledFeatures),
        commerceEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("commerce", disabledFeatures),
        rewardedAdsEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("rewarded_ads", disabledFeatures),
        referralsEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("referrals", disabledFeatures),
        matchmakingEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("matchmaking", disabledFeatures),
        tournamentsEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("tournaments", disabledFeatures),
        presenceEnabled: (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("presence", disabledFeatures),
        removeInterstitialAds: commerceAccount?.removeInterstitialAds ?? false,
    });
}
/** Returns only non-sensitive, fail-closed Facebook capability state for the authenticated account. */
exports.getFacebookClientConfiguration = (0, sentryHandlers_1.onCallWithSentry)("getFacebookClientConfiguration", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    (0, callableValidation_1.validateCallableRequest)(zod_1.z.object({}).strict(), request.data, "getFacebookClientConfiguration");
    /** Provides presence enabled behavior. */
    const presenceEnabled = (0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("presence");
    await (0, presenceFeatureGate_1.syncFacebookPresenceFeatureGate)(presenceEnabled);
    /** Provides commerce account behavior. */
    const commerceAccount = await (0, firestore_1.getFirestore)().collection("facebookCommerceAccounts").doc(request.auth.uid).get();
    /** Provides configuration behavior. */
    const configuration = resolveFacebookClientConfiguration(commerceAccount.data());
    if (configuration.presenceEnabled !== presenceEnabled) {
        throw new Error("facebook-presence-feature-gate-drift");
    }
    return (0, callableValidation_1.validateCallableResponse)(FacebookClientConfigurationResponseSchema, configuration, "getFacebookClientConfiguration");
});
//# sourceMappingURL=facebookClientConfigurationCallable.js.map
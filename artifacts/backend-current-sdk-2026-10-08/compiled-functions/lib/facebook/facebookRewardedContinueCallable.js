"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantFacebookRewardedContinue = void 0;
const https_1 = require("firebase-functions/v2/https");
const requestSchemas_1 = require("@qwordly/core/validation/requestSchemas");
const callableValidation_1 = require("../validation/callableValidation");
const callableSecurity_1 = require("../shared/callableSecurity");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const singlePlayerSession_1 = require("../gameplay/singlePlayerSession");
const facebookFeatureFlags_1 = require("./facebookFeatureFlags");
const facebookSecurity_1 = require("./facebookSecurity");
/** No client-supplied amount, identity, or arbitrary reward can enter this boundary. */
const RequestSchema = requestSchemas_1.SpendCoinsRequestSchema.omit({ reason: true, amount: true });
/**
 * Grants the one session-bounded extra try following the SDK-mediated opt-in flow.
 * This is NOT a server-verifiable ad impression receipt or a currency-grant endpoint.
 */
exports.grantFacebookRewardedContinue = (0, sentryHandlers_1.onCallWithSentry)("grantFacebookRewardedContinue", callableSecurity_1.browserCallableSecurityOptions, async (request) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !(0, facebookSecurity_1.isFacebookFirebaseUid)(request.auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!(0, facebookFeatureFlags_1.isFacebookFeatureEnabled)("rewarded_ads"))
        throw new https_1.HttpsError("unavailable", "Rewarded continuation is unavailable.");
    /** Validated session and mutation identity passed to the server-owned funding path. */
    const { gameMode, riddleId, requestId, sessionToken } = (0, callableValidation_1.validateCallableRequest)(RequestSchema, request.data, "grantFacebookRewardedContinue");
    /** Validated authoritative balance returned after the continuation grant. */
    const newCoins = await (0, singlePlayerSession_1.grantAuthoritativeContinue)(request.auth.uid, gameMode, riddleId, requestId, sessionToken, "facebook-rewarded");
    return (0, callableValidation_1.validateCallableResponse)(requestSchemas_1.SpendCoinsResponseSchema, { newCoins }, "grantFacebookRewardedContinue");
});
//# sourceMappingURL=facebookRewardedContinueCallable.js.map
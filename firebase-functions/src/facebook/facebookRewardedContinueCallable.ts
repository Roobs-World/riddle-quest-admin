import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {SpendCoinsRequestSchema, SpendCoinsResponseSchema} from "@qwordly/core/validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {grantAuthoritativeContinue} from "../gameplay/singlePlayerSession";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {isFacebookFirebaseUid} from "./facebookSecurity";

/** No client-supplied amount, identity, or arbitrary reward can enter this boundary. */
const RequestSchema = SpendCoinsRequestSchema.omit({reason: true, amount: true});

/**
 * Grants the one session-bounded extra try following the SDK-mediated opt-in flow.
 * This is NOT a server-verifiable ad impression receipt or a currency-grant endpoint.
 */
export const grantFacebookRewardedContinue = onCallWithSentry(
  "grantFacebookRewardedContinue", browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
      throw new HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!isFacebookFeatureEnabled("rewarded_ads")) throw new HttpsError("unavailable", "Rewarded continuation is unavailable.");
    /** Validated session and mutation identity passed to the server-owned funding path. */
    const {gameMode, riddleId, requestId, sessionToken} = validateCallableRequest(RequestSchema, request.data, "grantFacebookRewardedContinue");
    /** Validated authoritative balance returned after the continuation grant. */
    const newCoins = await grantAuthoritativeContinue(request.auth.uid, gameMode, riddleId, requestId, sessionToken, "facebook-rewarded");
    return validateCallableResponse(SpendCoinsResponseSchema, {newCoins}, "grantFacebookRewardedContinue");
  },
);

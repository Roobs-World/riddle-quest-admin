import {getFirestore} from "firebase-admin/firestore";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {isFacebookFirebaseUid} from "./facebookSecurity";
import {syncFacebookPresenceFeatureGate} from "../presence/presenceFeatureGate";

/** Validates the facebook client configuration response data shape. */
const FacebookClientConfigurationResponseSchema = z.object({
  interstitialsEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  commerceEnabled: z.boolean(),
  rewardedAdsEnabled: z.boolean(),
  referralsEnabled: z.boolean(),
  matchmakingEnabled: z.boolean(),
  tournamentsEnabled: z.boolean(),
  presenceEnabled: z.boolean(),
  removeInterstitialAds: z.boolean(),
}).strict();

/** Projects the server switch set and durable entitlement without exposing commerce debt or receipts. */
export function resolveFacebookClientConfiguration(
  commerceAccount: Record<string, unknown> | undefined,
  disabledFeatures = process.env.FACEBOOK_DISABLED_FEATURES,
): z.infer<typeof FacebookClientConfigurationResponseSchema> {
  if (
    commerceAccount?.removeInterstitialAds !== undefined &&
    typeof commerceAccount.removeInterstitialAds !== "boolean"
  ) {
    throw new Error("invalid-facebook-commerce-entitlement");
  }
  return FacebookClientConfigurationResponseSchema.parse({
    interstitialsEnabled: isFacebookFeatureEnabled("interstitials", disabledFeatures),
    notificationsEnabled: isFacebookFeatureEnabled("notifications", disabledFeatures),
    commerceEnabled: isFacebookFeatureEnabled("commerce", disabledFeatures),
    rewardedAdsEnabled: isFacebookFeatureEnabled("rewarded_ads", disabledFeatures),
    referralsEnabled: isFacebookFeatureEnabled("referrals", disabledFeatures),
    matchmakingEnabled: isFacebookFeatureEnabled("matchmaking", disabledFeatures),
    tournamentsEnabled: isFacebookFeatureEnabled("tournaments", disabledFeatures),
    presenceEnabled: isFacebookFeatureEnabled("presence", disabledFeatures),
    removeInterstitialAds: commerceAccount?.removeInterstitialAds ?? false,
  });
}

/** Returns only non-sensitive, fail-closed Facebook capability state for the authenticated account. */
export const getFacebookClientConfiguration = onCallWithSentry(
  "getFacebookClientConfiguration",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
      throw new HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    validateCallableRequest(z.object({}).strict(), request.data, "getFacebookClientConfiguration");
    const presenceEnabled = isFacebookFeatureEnabled("presence");
    await syncFacebookPresenceFeatureGate(presenceEnabled);
    const commerceAccount = await getFirestore().collection("facebookCommerceAccounts").doc(request.auth.uid).get();
    const configuration = resolveFacebookClientConfiguration(commerceAccount.data());
    if (configuration.presenceEnabled !== presenceEnabled) {
      throw new Error("facebook-presence-feature-gate-drift");
    }
    return validateCallableResponse(
      FacebookClientConfigurationResponseSchema,
      configuration,
      "getFacebookClientConfiguration",
    );
  },
);

import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../../../../firebase-functions/src/shared/callableSecurity";
import {onCallWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../../../../firebase-functions/src/validation/callableValidation";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {isFacebookFirebaseUid} from "./facebookSecurity";
import {syncFacebookPresenceFeatureGate} from "../../../../firebase-functions/src/presence/presenceFeatureGate";

/** Validates the facebook client configuration response data shape. */
const FacebookClientConfigurationResponseSchema = z
  .object({
    interstitialsEnabled: z.boolean(),
    notificationsEnabled: z.boolean(),
    commerceEnabled: z.boolean(),
    rewardedAdsEnabled: z.boolean(),
    referralsEnabled: z.boolean(),
    matchmakingEnabled: z.boolean(),
    tournamentsEnabled: z.boolean(),
    presenceEnabled: z.boolean(),
    removeInterstitialAds: z.boolean(),
  })
  .strict();

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
    commerceEnabled: isFacebookFeatureEnabled("commerce", disabledFeatures) && process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED === "1",
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
    /** Provides presence enabled behavior. */
    const presenceEnabled = isFacebookFeatureEnabled("presence");
    await syncFacebookPresenceFeatureGate(presenceEnabled);
    /** Provides commerce account behavior. */
    const commerceAccount = await getFirestore().collection("facebookCommerceAccounts").doc(request.auth.uid).get();
    /** Provides configuration behavior. */
    const configuration = resolveFacebookClientConfiguration(commerceAccount.data());
    if (configuration.commerceEnabled) {
      /** Provider identity matches for this account, capped to detect ambiguity. */
      const identities = await getFirestore().collection("providerIdentities").where("uid", "==", request.auth.uid).limit(2).get();
      /** Only provider identity eligible to establish the current payment generation. */
      const identity = identities.size === 1 ? identities.docs[0].data() : undefined;
      /** Account generation asserted by the authenticated Facebook session. */
      const generation = request.auth.token.accountGeneration;
      /** Trusted creation or deletion timestamp delimiting the current account generation. */
      const startedAt = generation === 1 ? identity?.createdAt : identity?.lastDeletedAt;
      configuration.commerceEnabled = identity?.provider === "facebook" && identity.status === "active" &&
        identity.accountGeneration === generation && typeof generation === "number" && Number.isSafeInteger(generation) &&
        generation >= 1 && startedAt instanceof Timestamp &&
        Date.now() >= (generation === 1 ? Math.floor(startedAt.toMillis() / 1_000) : Math.ceil(startedAt.toMillis() / 1_000)) * 1_000;
    }
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

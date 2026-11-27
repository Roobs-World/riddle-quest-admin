import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {isFacebookFeatureEnabled} from "../../../platforms/web/facebook/server/facebookFeatureFlags";
import {setPresenceConsentForUser} from "./presenceAggregation";
import {syncFacebookPresenceFeatureGate} from "../../../platforms/web/facebook/server/presence/facebookPresenceFeatureGate";

/** Validates the presence consent request data shape. */
const PresenceConsentRequestSchema = z.object({enabled: z.boolean()}).strict();
/** Validates the presence consent response data shape. */
const PresenceConsentResponseSchema = z.object({success: z.literal(true), enabled: z.boolean()}).strict();
/** Provides facebook uid behavior. */
const facebookUid = /^facebook_[0-9a-f]{40}$/;
/** Provides jest uid behavior. */
const jestUid = /^jest_[0-9a-f]{40}$/;

/** Requires provider claims to agree with the UID namespace before account-wide consent changes. */
export function requirePresenceConsentIdentity(request: CallableRequest<unknown>): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required.");
  /** Provides {uid, token} behavior. */
  const {uid, token} = request.auth;
  /** Provides facebook behavior. */
  const facebook = facebookUid.test(uid) && token.provider === "facebook";
  /** Provides jest behavior. */
  const jest = jestUid.test(uid) && typeof token.jestPlayerId === "string" && token.jestPlayerId.length > 0;
  if (!facebook && !jest) throw new HttpsError("permission-denied", "Platform identity is invalid.");
  return uid;
}

/** Opens presence writes only on explicit opt-in; opt-out clears all sessions atomically. */
export const setPresenceConsent = onCallWithSentry(
  "setPresenceConsent",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides r id. */
    const userId = requirePresenceConsentIdentity(request);
    /** Provides input behavior. */
    const input = validateCallableRequest(PresenceConsentRequestSchema, request.data, "setPresenceConsent");
    if (facebookUid.test(userId)) {
      /** Provides presence enabled behavior. */
      const presenceEnabled = isFacebookFeatureEnabled("presence");
      await syncFacebookPresenceFeatureGate(presenceEnabled);
      if (input.enabled && !presenceEnabled) {
        throw new HttpsError("unavailable", "Facebook presence is temporarily unavailable.");
      }
    }
    await setPresenceConsentForUser(userId, input.enabled);
    return validateCallableResponse(
      PresenceConsentResponseSchema,
      {success: true, enabled: input.enabled},
      "setPresenceConsent",
    );
  },
);

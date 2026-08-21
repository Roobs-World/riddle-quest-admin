import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {bindFacebookReferralToken, issueFacebookReferralToken} from "./facebookReferrals";
import {isFacebookFirebaseUid} from "./facebookSecurity";

/** Validates the bind referral data shape. */
const BindReferralSchema = z.object({token: z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();

/** Provides require facebook uid behavior. */
const requireFacebookUid = (request: CallableRequest<unknown>): string => {
  if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
    throw new HttpsError("unauthenticated", "Facebook authentication is required.");
  }
  if (!isFacebookFeatureEnabled("referrals")) {
    throw new HttpsError("unavailable", "Facebook referrals are temporarily unavailable.");
  }
  return request.auth.uid;
};

/** Issues an opaque, expiring Facebook referral entry token. */
export const createFacebookReferral = onCallWithSentry(
  "createFacebookReferral",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    const uid = requireFacebookUid(request);
    validateCallableRequest(z.object({}).strict(), request.data, "createFacebookReferral");
    return issueFacebookReferralToken(uid);
  },
);

/** Binds the authenticated new player to at most one lifetime Facebook referrer. */
export const bindFacebookReferral = onCallWithSentry(
  "bindFacebookReferral",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    const uid = requireFacebookUid(request);
    const input = validateCallableRequest(BindReferralSchema, request.data, "bindFacebookReferral");
    return bindFacebookReferralToken(uid, input.token);
  },
);

import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {acceptFacebookNotificationPrompt, claimFacebookNotificationPrompt} from "./facebookNotificationPrompts";
import {isFacebookFirebaseUid} from "./facebookSecurity";

/** Validates the empty request data shape. */
const EmptyRequestSchema = z.object({}).strict();
/** Validates the claim response data shape. */
const ClaimResponseSchema = z.discriminatedUnion("granted", [
  z.object({granted: z.literal(false)}).strict(),
  z.object({granted: z.literal(true), claimedAtMs: z.number().int().nonnegative().safe()}).strict(),
]);
/** Validates the accepted response data shape. */
const AcceptedResponseSchema = z.object({accepted: z.literal(true)}).strict();

/** Provides require facebook notifications behavior. */
const requireFacebookNotifications = (request: CallableRequest<unknown>): string => {
  if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
    throw new HttpsError("unauthenticated", "Facebook authentication is required.");
  }
  if (!isFacebookFeatureEnabled("notifications")) {
    throw new HttpsError("unavailable", "Facebook notifications are temporarily unavailable.");
  }
  return request.auth.uid;
};

/** Provides claim facebook notification permission prompt behavior. */
export const claimFacebookNotificationPermissionPrompt = onCallWithSentry(
  "claimFacebookNotificationPermissionPrompt",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    const uid = requireFacebookNotifications(request);
    validateCallableRequest(EmptyRequestSchema, request.data, "claimFacebookNotificationPermissionPrompt");
    return validateCallableResponse(
      ClaimResponseSchema,
      await claimFacebookNotificationPrompt(uid),
      "claimFacebookNotificationPermissionPrompt",
    );
  },
);

/** Provides accept facebook notification permission prompt behavior. */
export const acceptFacebookNotificationPermissionPrompt = onCallWithSentry(
  "acceptFacebookNotificationPermissionPrompt",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    const uid = requireFacebookNotifications(request);
    validateCallableRequest(EmptyRequestSchema, request.data, "acceptFacebookNotificationPermissionPrompt");
    await acceptFacebookNotificationPrompt(uid);
    return validateCallableResponse(
      AcceptedResponseSchema,
      {accepted: true},
      "acceptFacebookNotificationPermissionPrompt",
    );
  },
);

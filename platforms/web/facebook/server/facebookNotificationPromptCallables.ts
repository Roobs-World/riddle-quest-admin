import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {browserCallableSecurityOptions} from "../../../../firebase-functions/src/shared/callableSecurity";
import {onCallWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../../../../firebase-functions/src/validation/callableValidation";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {acceptFacebookNotificationPrompt, claimFacebookNotificationPrompt} from "./facebookNotificationPrompts";
import {isFacebookFirebaseUid} from "./facebookSecurity";

/** Validates the empty request data shape. */
const EmptyRequestSchema = z.object({}).strict();
/** Settings consent requests do not depend on a completed riddle. */
const ClaimRequestSchema = z.object({source: z.literal("settings").optional()}).strict();
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
    /** Provides uid behavior. */
    const uid = requireFacebookNotifications(request);
    const input = validateCallableRequest(ClaimRequestSchema, request.data, "claimFacebookNotificationPermissionPrompt");
    return validateCallableResponse(
      ClaimResponseSchema,
      await (input.source ? claimFacebookNotificationPrompt(uid, {source: input.source}) : claimFacebookNotificationPrompt(uid)),
      "claimFacebookNotificationPermissionPrompt",
    );
  },
);

/** Provides accept facebook notification permission prompt behavior. */
export const acceptFacebookNotificationPermissionPrompt = onCallWithSentry(
  "acceptFacebookNotificationPermissionPrompt",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    /** Provides uid behavior. */
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

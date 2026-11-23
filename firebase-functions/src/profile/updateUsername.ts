import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {captureException} from "../shared/sentry";
import {validateUsernameForProfanity} from "../../../src/accounts/validation/profanity.js";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {BasicSuccessMessageResponseSchema, UpdateUsernameRequestSchema} from "../../../src/platform/contracts/requestSchemas.js";
import {updateUsernameRecords} from "./leaderboardProfile";
import {onCallWithSentry} from "../shared/sentryHandlers";

/**
 * Updates the authenticated user's username in their profile and leaderboard.
 * Validates for profanity and uniqueness before saving both records atomically.
 */
export const updateUsername = onCallWithSentry(
  "updateUsername",
  browserCallableSecurityOptions,
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    /** Provides r id. */
    const userId = request.auth.uid;
    /** Provides {username} behavior. */
    const {username} = validateCallableRequest(UpdateUsernameRequestSchema, request.data, "updateUsername");
    /** Provides profanity error behavior. */
    const profanityError = validateUsernameForProfanity(username);

    if (profanityError) {
      throw new HttpsError("invalid-argument", profanityError);
    }

    try {
      await updateUsernameRecords(userId, username);
      logger.info("Authenticated user updated their username.");
      return validateCallableResponse(
        BasicSuccessMessageResponseSchema,
        {success: true, message: "Username updated successfully."},
        "updateUsername",
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error(`Error updating username for user ${userId}:`, error);
      captureException(error);
      throw new HttpsError("internal", "An error occurred while updating username.");
    }
  },
);

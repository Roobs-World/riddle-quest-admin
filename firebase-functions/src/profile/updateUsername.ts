import {logger} from "firebase-functions/v2";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {admin} from "../shared/firebaseAdmin";
import {captureException} from "../shared/sentry";
import {validateUsernameForProfanity} from "../utils/profanityFilter";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {BasicSuccessMessageResponseSchema, UpdateUsernameRequestSchema} from "../validation/requestSchemas";
import {updateUsernameRecords} from "./leaderboardProfile";
import {onCallWithSentry} from "../shared/sentryHandlers";

/**
 * Updates the authenticated user's username in their profile and leaderboard.
 * Validates for profanity and uniqueness before saving both records atomically.
 */
export const updateUsername = onCallWithSentry("updateUsername", browserCallableSecurityOptions, async (request: CallableRequest<unknown>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {username} = validateCallableRequest(UpdateUsernameRequestSchema, request.data, "updateUsername");
  const trimmed = username.trim();
  const profanityError = validateUsernameForProfanity(trimmed);

  if (profanityError) {
    throw new HttpsError("invalid-argument", profanityError);
  }

  const existing = await admin.firestore().collection("users").where("username", "==", trimmed).limit(1).get();

  if (!existing.empty && existing.docs[0].id !== userId) {
    throw new HttpsError("already-exists", "Username already taken.");
  }

  try {
    await updateUsernameRecords(userId, trimmed);
    logger.info("Authenticated user updated their username.");
    return validateCallableResponse(
      BasicSuccessMessageResponseSchema,
      {success: true, message: "Username updated successfully."},
      "updateUsername",
    );
  } catch (error) {
    logger.error(`Error updating username for user ${userId}:`, error);
    captureException(error);
    throw new HttpsError("internal", "An error occurred while updating username.", error);
  }
});

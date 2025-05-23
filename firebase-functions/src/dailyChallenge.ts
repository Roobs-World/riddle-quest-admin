import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {updateUserLastCompletedDailyChallengeDate, getUser} from "./firestoreService.js";

/**
 * Sets the last completed daily challenge date for the authenticated user.
 * @param request - The request object representing the request context.
 * @return A message indicating the success of the operation.
 */
export const setCompletedDailyChallenge = async (
  request: functions.https.CallableRequest,
): Promise<{message: string}> => {
  try {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to set completed daily challenge.",
      );
    }
    const currentUserId = request.auth.uid;

    const currentDate = new Date().toISOString();

    await updateUserLastCompletedDailyChallengeDate(currentUserId, currentDate);

    return {
      message: "Last completed daily challenge date set successfully.",
    };
  } catch (error) {
    functions.logger.error("Error setting completed daily challenge:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while setting completed daily challenge.",
      error,
    );
  }
};

/**
 * Checks if the user has completed the current daily challenge.
 * @param request - The request object representing the request context.
 * @param request.data - The request data object containing the user ID.
 * @param request.data.id - The user ID.
 * @return A promise that resolves to true if the user has completed the daily
 * challenge, otherwise false.
 */
export const hasCompletedDailyChallenge = onCall(
  {},
  async (request: functions.https.CallableRequest<{id: string}>): Promise<boolean> => {
    try {
      const {id: currentUserId} = request.data;

      const user = await getUser(currentUserId);

      if (user && user.lastDailyChallengeCompletedAt) {
        const lastCompletedDate = new Date(user.lastDailyChallengeCompletedAt);
        const currentDate = new Date();
        return currentDate.toDateString() === lastCompletedDate.toDateString();
      } else {
        return false;
      }
    } catch (error) {
      functions.logger.error("Error checking daily challenge status:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while checking daily challenge status.",
        error,
      );
    }
  },
);

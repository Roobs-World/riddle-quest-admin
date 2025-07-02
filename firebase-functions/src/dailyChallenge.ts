import * as functions from "firebase-functions";
import * as admin from "firebase-admin"; // Added for Firestore access
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {updateUserLastCompletedDailyChallengeDate, getUser} from "./firestoreService";

/**
 * Sets the last completed daily challenge date for the authenticated user.
 * @param request - The request object representing the request context.
 * @return A message indicating the success of the operation.
 */
export const setCompletedDailyChallenge = onCall(
  {},
  async (request: CallableRequest<unknown>): Promise<{message: string}> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The user must be authenticated to set completed daily challenge.");
      }
      const currentUserId = request.auth.uid;

      const currentDate = new Date().toISOString();

      await updateUserLastCompletedDailyChallengeDate(currentUserId, currentDate);

      return {
        message: "Last completed daily challenge date set successfully.",
      };
    } catch (error) {
      // Re-throw HttpsError instances directly
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error setting completed daily challenge:", error);
      throw new HttpsError("internal", "An error occurred while setting completed daily challenge.", error);
    }
  },
);

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
  async (request: CallableRequest<{id: string}>): Promise<boolean> => {
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
      throw new HttpsError("internal", "An error occurred while checking daily challenge status.", error);
    }
  },
);

interface DailyChallengeData {
  riddleId: string;
  text: string;
  date: string; // YYYY-MM-DD format to track which day this challenge is for
  // Add other non-sensitive fields that might be in dailyChallenge/current if needed
}

interface GetCurrentDailyChallengeResponse {
  challenge?: DailyChallengeData;
  hasCompletedToday?: boolean;
  error?: string;
}

/**
 * Gets the current daily challenge riddle data (excluding the answer).
 * Returns the single daily challenge that's available for today.
 * Optionally includes the user's completion status if authenticated.
 */
export const getCurrentDailyChallenge = onCall(
  {},
  async (request: CallableRequest<unknown>): Promise<GetCurrentDailyChallengeResponse> => {
    try {
      const currentDate = new Date();
      const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      const dailyChallengeDoc = await dailyChallengeRef.get();

      if (!dailyChallengeDoc.exists) {
        functions.logger.warn("No daily challenge document found.");
        return {error: "No daily challenge available at the moment."};
      }

      const allData = dailyChallengeDoc.data();
      if (!allData || !allData.riddleId || !allData.text) {
        functions.logger.error("Daily challenge document is missing required fields (riddleId, text).", allData);
        return {error: "Daily challenge data is incomplete."};
      }

      // Check if the challenge is for today (optional validation)
      if (allData.date && allData.date !== todayDateString) {
        functions.logger.warn(`Daily challenge date mismatch. Expected: ${todayDateString}, Found: ${allData.date}`);
        // Still return the challenge as the scheduler will update it
      }

      const challengeData: DailyChallengeData = {
        riddleId: allData.riddleId,
        text: allData.text,
        date: allData.date || todayDateString, // Use today's date as fallback
        // Map other expected non-sensitive fields here
      };

      let hasCompletedToday: boolean | undefined = undefined;
      if (request.auth) {
        const userId = request.auth.uid;
        const user = await getUser(userId);
        if (user && user.lastDailyChallengeCompletedAt) {
          const lastCompletedDate = new Date(user.lastDailyChallengeCompletedAt);
          const currentDate = new Date();
          hasCompletedToday = currentDate.toDateString() === lastCompletedDate.toDateString();
        } else {
          hasCompletedToday = false; // User exists but hasn't completed any
        }
      }

      console.log(`Returning daily challenge for ${challengeData.date}: ${challengeData.riddleId}`);
      return {
        challenge: challengeData,
        hasCompletedToday: hasCompletedToday,
      };
    } catch (error) {
      functions.logger.error("Error getting current daily challenge:", error);
      return {error: "An error occurred while fetching the daily challenge."};
    }
  },
);

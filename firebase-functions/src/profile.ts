import * as admin from "firebase-admin";
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {PlayerSchema} from "./validation/firestoreSchemas.js";

/**
 * Resets the authenticated user's game statistics in Firestore.
 * Requires authentication.
 */
export const resetStats = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  console.log(`Resetting stats for user: ${userId}`);

  const userRef = admin.firestore().collection("users").doc(userId);

  try {
    // Get the default stats from the schema to ensure all stats are reset
    const defaultStats = PlayerSchema.parse({});

    // Update the user's document with the default stats
    await userRef.update({
      stats: defaultStats,
      // Also reset progress-related fields if needed, e.g., dailyChallengeIndex, classicIndex
      // Based on the PlayerSchema, dailyChallengeIndex and classicIndex are separate from stats
      // and likely represent current progress rather than historical stats.
      // Resetting them here might not be desired depending on UX flow.
      // For now, only resetting the fields within the `stats` object.
      // If resetting overall progress is needed, add them here:
      // progress: { classicIndex: 0, dailyChallengeIndex: 0, tutorialIndex: 0 },
    });

    console.log(`User ${userId} stats reset successfully.`);

    return {success: true, message: "Stats reset successfully."};
  } catch (error) {
    console.error(`Error resetting stats for user ${userId}:`, error);
    throw new HttpsError("internal", "An error occurred while resetting stats.", error);
  }
});

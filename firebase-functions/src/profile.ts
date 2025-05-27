import * as admin from "firebase-admin";
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {PlayerStatsSchema} from "./validation/firestoreSchemas";
import {updateUserProfile} from "./firestoreService";

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
    const defaultStats = PlayerStatsSchema.parse({});

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

/**
 * Updates the authenticated user's avatar URL in Firestore.
 * Requires authentication.
 * @param data - The request data containing the new avatar URL.
 * @param data.avatarUrl - The new URL of the user's avatar in Firebase Storage.
 */
export const updateAvatar = onCall(async (request: CallableRequest<{avatarUrl: string}>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {avatarUrl} = request.data;

  if (!avatarUrl || typeof avatarUrl !== "string") {
    throw new HttpsError("invalid-argument", "Invalid or missing avatar URL.");
  }

  console.log(`Updating avatar URL for user: ${userId} with ${avatarUrl}`);

  try {
    await updateUserProfile(userId, {avatarUrl: avatarUrl});
    console.log(`User ${userId} avatar URL updated successfully.`);
    return {success: true, message: "Avatar URL updated successfully."};
  } catch (error) {
    console.error(`Error updating avatar URL for user ${userId}:`, error);
    throw new HttpsError("internal", "An error occurred while updating avatar URL.", error);
  }
});

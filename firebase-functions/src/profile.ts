import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {updateUserProfile} from "./firestoreService";

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

import * as admin from "firebase-admin";
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {updateUserProfile} from "./firestoreService";
import {validateUsernameForProfanity} from "./utils/profanityFilter";
import {captureException} from "./sentry";

async function syncLeaderboardProfileFields(
  userId: string,
  fields: {username?: string; avatarUrl?: string},
): Promise<void> {
  const updates: {username?: string; avatarUrl?: string; updatedAt: number} = {
    updatedAt: Date.now(),
  };

  if (typeof fields.username === "string") {
    updates.username = fields.username;
  }

  if (typeof fields.avatarUrl === "string") {
    updates.avatarUrl = fields.avatarUrl;
  }

  if (updates.username === undefined && updates.avatarUrl === undefined) {
    return;
  }

  try {
    await admin.firestore().collection("leaderboard").doc(userId).set(updates, {merge: true});
  } catch (error) {
    logger.warn(`Failed to sync leaderboard profile fields for user ${userId}:`, error);
    captureException(error);
  }
}

/**
 * Updates the authenticated user's avatar URL in Firestore.
 * Requires authentication.
 * @param data - The request data containing the new avatar URL.
 * @param data.avatarUrl - The new URL of the user's avatar in Firebase Storage.
 */
export const updateAvatar = onCall({enforceAppCheck: true}, async (request: CallableRequest<{avatarUrl: string}>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {avatarUrl} = request.data;

  if (!avatarUrl || typeof avatarUrl !== "string") {
    throw new HttpsError("invalid-argument", "Invalid or missing avatar URL.");
  }

  logger.info(`Updating avatar URL for user: ${userId} with ${avatarUrl}`);

  try {
    await updateUserProfile(userId, {avatarUrl: avatarUrl});
    await syncLeaderboardProfileFields(userId, {avatarUrl});
    logger.info(`User ${userId} avatar URL updated successfully.`);
    return {success: true, message: "Avatar URL updated successfully."};
  } catch (error) {
    logger.error(`Error updating avatar URL for user ${userId}:`, error);
    captureException(error);
    throw new HttpsError("internal", "An error occurred while updating avatar URL.", error);
  }
});

/**
 * Updates the authenticated user's username in Firestore.
 * Validates for profanity and uniqueness before saving.
 */
export const updateUsername = onCall({enforceAppCheck: true}, async (request: CallableRequest<{username: string}>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {username} = request.data;

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    throw new HttpsError("invalid-argument", "Username must be at least 3 characters long.");
  }

  const trimmed = username.trim();

  const profanityError = validateUsernameForProfanity(trimmed);
  if (profanityError) {
    throw new HttpsError("invalid-argument", profanityError);
  }

  // Check uniqueness (exclude the current user)
  const existing = await admin.firestore().collection("users").where("username", "==", trimmed).limit(1).get();

  if (!existing.empty && existing.docs[0].id !== userId) {
    throw new HttpsError("already-exists", "Username already taken.");
  }

  try {
    await updateUserProfile(userId, {username: trimmed});
    await syncLeaderboardProfileFields(userId, {username: trimmed});
    logger.info(`User ${userId} username updated to: ${trimmed}`);
    return {success: true, message: "Username updated successfully."};
  } catch (error) {
    logger.error(`Error updating username for user ${userId}:`, error);
    captureException(error);
    throw new HttpsError("internal", "An error occurred while updating username.", error);
  }
});

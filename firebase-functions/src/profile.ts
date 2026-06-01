import * as admin from "firebase-admin";
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {updateUserProfile} from "./firestoreService";
import {validateUsernameForProfanity} from "./utils/profanityFilter";
import {captureException} from "./sentry";
import {
  BasicSuccessMessageResponseSchema,
  UpdateAvatarRequestSchema,
  UpdateUsernameRequestSchema,
} from "./validation/requestSchemas";
import {validateCallableRequest, validateCallableResponse} from "./validation/callableValidation";

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
export const updateAvatar = onCall({enforceAppCheck: true}, async (request: CallableRequest<unknown>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;
  const {avatarUrl} = validateCallableRequest(
    UpdateAvatarRequestSchema,
    request.data,
    "updateAvatar",
    "Invalid or missing avatar URL.",
  );

  logger.info(`Updating avatar URL for user: ${userId} with ${avatarUrl}`);

  try {
    await updateUserProfile(userId, {avatarUrl: avatarUrl});
    await syncLeaderboardProfileFields(userId, {avatarUrl});
    logger.info(`User ${userId} avatar URL updated successfully.`);
    return validateCallableResponse(
      BasicSuccessMessageResponseSchema,
      {success: true, message: "Avatar URL updated successfully."},
      "updateAvatar",
    );
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
export const updateUsername = onCall(async (request: CallableRequest<unknown>) => {
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

  // Check uniqueness (exclude the current user)
  const existing = await admin.firestore().collection("users").where("username", "==", trimmed).limit(1).get();

  if (!existing.empty && existing.docs[0].id !== userId) {
    throw new HttpsError("already-exists", "Username already taken.");
  }

  try {
    await updateUserProfile(userId, {username: trimmed});
    await syncLeaderboardProfileFields(userId, {username: trimmed});
    logger.info(`User ${userId} username updated to: ${trimmed}`);
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

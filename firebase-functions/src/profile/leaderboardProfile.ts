import {logger} from "firebase-functions/v2";
import {admin} from "../shared/firebaseAdmin";
import {captureException} from "../shared/sentry";

/** Profile fields duplicated onto a leaderboard entry for display. */
export interface LeaderboardProfileFields {
  /** Public avatar URL shown alongside leaderboard scores. */
  avatarUrl?: string;
  /** Public username shown alongside leaderboard scores. */
  username?: string;
}

/**
 * Best-effort synchronizes display-only profile fields to a leaderboard entry.
 *
 * @param userId - User whose leaderboard entry should be updated.
 * @param fields - Display fields to merge into the leaderboard entry.
 */
export async function syncLeaderboardProfileFields(
  userId: string,
  fields: LeaderboardProfileFields,
): Promise<void> {
  const updates: LeaderboardProfileFields & {updatedAt: number} = {
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
 * Atomically updates a user's authoritative profile and leaderboard username.
 *
 * Keeping both writes in the same batch prevents a successful profile update
 * from leaving an old username visible in leaderboard results.
 *
 * @param userId - Authenticated user whose username is changing.
 * @param username - Validated and trimmed username to persist.
 */
export async function updateUsernameRecords(userId: string, username: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);
  const leaderboardRef = db.collection("leaderboard").doc(userId);
  const batch = db.batch();

  batch.update(userRef, {username});
  batch.set(leaderboardRef, {username, updatedAt: Date.now()}, {merge: true});
  await batch.commit();
}

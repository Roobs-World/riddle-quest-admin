import {logger} from "firebase-functions/v2";
import {HttpsError} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {captureException} from "../shared/sentry";
import {
  createUsernameReservationId,
  normalizeUsernameForReservation,
  reservationIdForUserData,
  usernameReservationMigrationRef,
  USERNAME_RESERVATIONS_COLLECTION,
} from "./usernameReservations";

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
export async function syncLeaderboardProfileFields(userId: string, fields: LeaderboardProfileFields): Promise<void> {
  /** Updates s. */
  const updates: LeaderboardProfileFields & {
    /** Stores updated at. */
    updatedAt: number;
  } = {
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
    await admin
      .firestore()
      .collection("leaderboard")
      .doc(userId)
      .set(
        {
          userId,
          subjectUserId: userId,
          ...updates,
        },
        {merge: true},
      );
  } catch (error) {
    logger.warn(`Failed to sync leaderboard profile fields for user ${userId}:`, error);
    captureException(error);
  }
}

/**
 * Atomically reserves and updates a user's profile and leaderboard username.
 *
 * Keeping ownership and both profile writes in one transaction prevents a
 * successful update from leaving stale ownership or leaderboard display data.
 *
 * @param userId - Authenticated user whose username is changing.
 * @param username - Validated and trimmed username to persist.
 */
export async function updateUsernameRecords(userId: string, username: string): Promise<void> {
  /** Provides db behavior. */
  const db = admin.firestore();
  /** Provides r ref. */
  const userRef = db.collection("users").doc(userId);
  /** Provides leaderboard ref behavior. */
  const leaderboardRef = db.collection("leaderboard").doc(userId);
  /** Normalizes d username. */
  const normalizedUsername = normalizeUsernameForReservation(username);
  /** Provides reservation id behavior. */
  const reservationId = createUsernameReservationId(username);
  /** Provides reservation ref behavior. */
  const reservationRef = db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(reservationId);
  /** Provides migration ref behavior. */
  const migrationRef = usernameReservationMigrationRef(db);
  /** Provides exact legacy query behavior. */
  const exactLegacyQuery = db.collection("users").where("username", "==", username).limit(2);
  /** Normalizes d query. */
  const normalizedQuery = db.collection("users").where("usernameNormalized", "==", normalizedUsername).limit(2);

  await db.runTransaction(async (transaction) => {
    /** Provides r snapshot. */
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new HttpsError("not-found", "Player profile not found.");
    /** Provides previous reservation id behavior. */
    const previousReservationId = reservationIdForUserData(userSnapshot.data());
    /** Provides previous reservation ref behavior. */
    const previousReservationRef =
      previousReservationId && previousReservationId !== reservationId
        ? db.collection(USERNAME_RESERVATIONS_COLLECTION).doc(previousReservationId)
        : undefined;

    // Every read precedes every write. Reading the deterministic new reservation
    // is the serialization boundary that makes concurrent equivalent claims race-safe.
    /** Provides migration snapshot behavior. */
    const migrationSnapshot = await transaction.get(migrationRef);
    /** Provides reservation snapshot behavior. */
    const reservationSnapshot = await transaction.get(reservationRef);
    /** Provides exact legacy snapshot behavior. */
    const exactLegacySnapshot = await transaction.get(exactLegacyQuery);
    /** Normalizes d snapshot. */
    const normalizedSnapshot = await transaction.get(normalizedQuery);
    /** Provides previous reservation snapshot behavior. */
    const previousReservationSnapshot = previousReservationRef
      ? await transaction.get(previousReservationRef)
      : undefined;

    if (!migrationSnapshot.exists || migrationSnapshot.data()?.complete !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Username changes are temporarily unavailable while existing profiles are migrated.",
      );
    }

    /** Provides reservation owner behavior. */
    const reservationOwner = reservationSnapshot.exists ? reservationSnapshot.data()?.userId : undefined;
    /** Provides legacy collision behavior. */
    const legacyCollision = [...exactLegacySnapshot.docs, ...normalizedSnapshot.docs].some(
      (document) => document.id !== userId,
    );
    if ((reservationSnapshot.exists && reservationOwner !== userId) || legacyCollision) {
      throw new HttpsError("already-exists", "Username already taken.");
    }

    if (
      previousReservationRef &&
      previousReservationSnapshot?.exists &&
      previousReservationSnapshot.data()?.userId === userId
    ) {
      transaction.delete(previousReservationRef);
    }
    transaction.set(reservationRef, {
      normalizedUsername,
      userId,
      username,
      updatedAt: Date.now(),
    });
    transaction.update(userRef, {
      username,
      usernameNormalized: normalizedUsername,
      usernameReservationId: reservationId,
    });
    transaction.set(
      leaderboardRef,
      {
        userId,
        subjectUserId: userId,
        username,
        updatedAt: Date.now(),
      },
      {merge: true},
    );
  });
}

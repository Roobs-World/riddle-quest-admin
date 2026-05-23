import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {initializeNewUser, ensureUserDocumentComplete} from "./firestoreService";
import {captureException} from "./sentry";
import type {Player} from "./validation/firestoreSchemas";

/**
 * Request data for initializing a new user
 */
interface InitializeUserRequestData {
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  seed?: Partial<Player>;
}

/**
 * Response data for user initialization
 */
interface InitializeUserResponseData {
  success: boolean;
  message: string;
  userId: string;
  player: Player;
}

interface DeleteAccountResponseData {
  success: boolean;
  message: string;
}

const USER_ID_FIELD_COLLECTIONS = ["purchaseAnalytics", "notificationHistory"] as const;
const USER_STORAGE_PREFIXES = ["avatars", "exports"] as const;

const isAuthUserNotFoundError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as {code?: string}).code === "auth/user-not-found"
  );
};

const deleteUserOwnedCollectionDocs = async (
  collectionName: string,
  userId: string,
): Promise<number> => {
  const db = admin.firestore();
  let deletedCount = 0;
  const pageSize = 450;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where("userId", "==", userId)
      .limit(pageSize)
      .get();

    if (snapshot.empty) {
      return deletedCount;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deletedCount += snapshot.size;
  }
};

export const deleteAccountForUser = async (userId: string): Promise<void> => {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  await db.recursiveDelete(userRef);
  await db.collection("leaderboard").doc(userId).delete();

  await Promise.all(
    USER_ID_FIELD_COLLECTIONS.map(async (collectionName) => {
      const deleted = await deleteUserOwnedCollectionDocs(collectionName, userId);
      if (deleted > 0) {
        functions.logger.info(`Deleted ${deleted} ${collectionName} docs for user ${userId}.`);
      }
    }),
  );

  await Promise.all(
    USER_STORAGE_PREFIXES.map(async (folder) => {
      const prefix = `${folder}/${userId}/`;
      await admin.storage().bucket().deleteFiles({prefix});
    }),
  );

  try {
    await admin.auth().deleteUser(userId);
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) {
      throw error;
    }
    functions.logger.info(`Auth user ${userId} was already missing during account deletion.`);
  }
};

/**
 * Callable function to initialize a new user document with default stats and progress.
 * This should be called when a new user account is created to ensure proper data structure.
 *
 * @param request - The request containing user data
 * @returns A promise resolving to initialization status
 */
export const initializeUser = onCall<InitializeUserRequestData, Promise<InitializeUserResponseData>>(
  {enforceAppCheck: true},
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      const userId = request.auth.uid;
      const {email, username, displayName, avatarUrl} = request.data;

      // Validate required fields
      if (!email || !username) {
        throw new HttpsError("invalid-argument", "Email and username are required.");
      }

      // Initialize the user document with default stats and progress
      await initializeNewUser(userId, {
        email,
        username,
        displayName,
        avatarUrl,
        seed: request.data.seed,
      });

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const player = userDoc.data() as Player | undefined;
      if (!player) {
        throw new HttpsError("internal", "User document was not available after initialization.");
      }

      functions.logger.info(`Successfully initialized user document for ${userId}`);

      return {
        success: true,
        message: "User document initialized successfully with default stats and progress.",
        userId,
        player,
      };
    } catch (error: unknown) {
      functions.logger.error("Error in initializeUser:", error);
      captureException(error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "An unexpected error occurred while initializing user.", error);
    }
  },
);

/**
 * Callable function to ensure a user document has all required fields.
 * This can be called to fix incomplete user documents from older app versions.
 *
 * @param request - The request (no data required, uses authenticated user)
 * @returns A promise resolving to completion status
 */
export const ensureUserComplete = onCall<object, Promise<{success: boolean; message: string}>>(
  {enforceAppCheck: true},
  async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const userId = request.auth.uid;

    // Ensure the user document has all required fields
    await ensureUserDocumentComplete(userId);

    functions.logger.info(`Successfully ensured user document completeness for ${userId}`);

    return {
      success: true,
      message: "User document verified/updated with all required fields.",
    };
  } catch (error: unknown) {
    functions.logger.error("Error in ensureUserComplete:", error);
    captureException(error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while ensuring user completeness.", error);
  }
  },
);

export const deleteAccount = onCall<object, Promise<DeleteAccountResponseData>>(
  {enforceAppCheck: true},
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      const userId = request.auth.uid;
      await deleteAccountForUser(userId);

      functions.logger.info(`Successfully deleted account for ${userId}.`);

      return {
        success: true,
        message: "Account deleted successfully.",
      };
    } catch (error: unknown) {
      functions.logger.error("Error in deleteAccount:", error);
      captureException(error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "An unexpected error occurred while deleting account.", error);
    }
  },
);

/**
 * Request data for updating user stats (admin function)
 */
interface UpdateUserStatsRequestData {
  targetUserId: string;
  statsUpdate: {
    dailyPuzzlesCompleted?: number;
    bestStreak?: number;
    totalWordsGuessed?: number;
    winRate?: number;
    averageGuesses?: number;
    totalScore?: number;
    highestLevelClassic?: number;
    gamesPlayed?: number;
    wins?: number;
    challengeWins?: number;
    winStreak?: number;
    totalWins?: number;
    totalGuessesInWins?: number;
  };
}

/**
 * Checks if the authenticated user has admin privileges.
 * Admin status is determined by Firebase custom claims.
 *
 * @param auth - The auth object from the request
 * @returns True if the user is an admin, false otherwise
 */
async function isUserAdmin(auth: {uid: string; token: {admin?: boolean}}): Promise<boolean> {
  // Check for admin custom claim set via Firebase Admin SDK
  // To set admin claim: admin.auth().setCustomUserClaims(uid, { admin: true })
  if (auth.token?.admin === true) {
    return true;
  }

  // Fallback: Check if user is in the admins collection in Firestore
  try {
    const adminDoc = await admin.firestore().collection("admins").doc(auth.uid).get();
    return adminDoc.exists;
  } catch (error) {
    functions.logger.error("Error checking admin status:", error);
    captureException(error);
    return false;
  }
}

/**
 * Admin function to manually update user statistics.
 * Requires admin privileges via Firebase custom claims or admins collection.
 *
 * @param request - The request containing user ID and stats to update
 * @returns A promise resolving to update status
 */
export const updateUserStats = onCall<UpdateUserStatsRequestData, Promise<{success: boolean; message: string}>>(
  {enforceAppCheck: true},
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

      // Verify admin authorization using custom claims or admins collection
      const hasAdminAccess = await isUserAdmin(request.auth as {uid: string; token: {admin?: boolean}});
      if (!hasAdminAccess) {
        functions.logger.warn(`Unauthorized admin access attempt by user ${request.auth.uid}`);
        throw new HttpsError("permission-denied", "This operation requires admin privileges.");
      }

      const {targetUserId, statsUpdate} = request.data;

      if (!targetUserId || !statsUpdate) {
        throw new HttpsError("invalid-argument", "targetUserId and statsUpdate are required.");
      }

      // Validate that the stats update contains valid fields
      const allowedStatFields = [
        "dailyPuzzlesCompleted",
        "bestStreak",
        "totalWordsGuessed",
        "winRate",
        "averageGuesses",
        "totalScore",
        "highestLevelClassic",
        "gamesPlayed",
        "wins",
        "challengeWins",
        "winStreak",
        "totalWins",
        "totalGuessesInWins",
      ];

      const invalidFields = Object.keys(statsUpdate).filter((field) => !allowedStatFields.includes(field));

      if (invalidFields.length > 0) {
        throw new HttpsError("invalid-argument", `Invalid stat fields: ${invalidFields.join(", ")}`);
      }

      // Prepare the update with proper field paths
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(statsUpdate)) {
        updateData[`stats.${key}`] = value;
      }

      // Update the user document
      await admin.firestore().collection("users").doc(targetUserId).update(updateData);

      functions.logger.info(`Successfully updated stats for user ${targetUserId}:`, statsUpdate);

      return {
        success: true,
        message: `User stats updated successfully for ${targetUserId}.`,
      };
    } catch (error: unknown) {
      functions.logger.error("Error in updateUserStats:", error);
      captureException(error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "An unexpected error occurred while updating user stats.", error);
    }
  },
);

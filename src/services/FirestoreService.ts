import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Player, PlayerSchema } from "../validation/firestoreSchemas";
import {
  FirestoreRiddle,
  FirestoreRiddleSchema,
} from "../validation/firestoreSchemas";
import { ZodError } from "zod";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/** Session cache for riddle fetches to avoid repeated Firestore reads (e.g. mode switch). */
const RIDDLE_CACHE_MAX_SIZE = 50;
const riddleCache = new Map<string, FirestoreRiddle>();

function getCachedRiddle(key: string): FirestoreRiddle | undefined {
  return riddleCache.get(key);
}

function setCachedRiddle(key: string, riddle: FirestoreRiddle): void {
  if (riddleCache.size >= RIDDLE_CACHE_MAX_SIZE) {
    const firstKey = riddleCache.keys().next().value;
    if (firstKey !== undefined) riddleCache.delete(firstKey);
  }
  riddleCache.set(key, riddle);
}

/** Clears the riddle cache (for tests or when cache must be invalidated). */
export function clearRiddleCache(): void {
  riddleCache.clear();
}

/**
 * Saves the user's progress to Firestore.
 *
 * @param userId The user's unique identifier.
 * @param progress The progress data to save.
 */
export const saveUserProgressToFirestore = async (
  userId: string,
  progress: Player["progress"]
): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to save progress to Firestore without a userId.");
    return;
  }
  try {
    await setDoc(
      doc(getFirestore(), "users", userId),
      { progress: progress },
      { merge: true }
    );
    logger.info(
      "Player progress saved to Firestore successfully for user:",
      userId
    );
  } catch (error) {
    logger.error("Error saving player progress to Firestore:", error);
    captureException(error);
    throw error;
  }
};

export const loadUserProgressFromFirestore = async (
  userId: string
): Promise<Player | null> => {
  if (!userId) {
    logger.warn("Attempted to load progress from Firestore without a userId.");
    return null;
  }
  try {
    const userDoc = await getDoc(doc(getFirestore(), "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData) {
        try {
          const validatedPlayer = PlayerSchema.parse(userData);
          logger.info("Player data validated successfully.");

          return validatedPlayer;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error(
              "Zod validation error for player data:",
              zodError.issues
            );
          } else {
            logger.error(
              "Unexpected error during player data validation:",
              zodError
            );
          }
          captureException(zodError);
          return null;
        }
      }
    }
    logger.info("No player progress found in Firestore for user:", userId);
    return null;
  } catch (error) {
    logger.error("Error loading player progress from Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Fetches a daily riddle from Firestore based on the daily index.
 * This function only fetches riddles and does not trigger generation.
 *
 * @param dailyIndex The daily challenge index from the player's progress.
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchDailyRiddleFromFirestore = async (
  dailyIndex: number
): Promise<FirestoreRiddle | null> => {
  const cacheKey = `daily:${dailyIndex}`;
  const cached = getCachedRiddle(cacheKey);
  if (cached) {
    logger.debug(`Daily riddle for index ${dailyIndex} served from cache`);
    return cached;
  }

  logger.debug(`Fetching daily riddle for index ${dailyIndex} from Firestore`);

  try {
    const riddleQuerySnapshot = await getDocs(
      query(
        collection(getFirestore(), "dailyRiddles"),
        where("dailyIndex", "==", dailyIndex),
        limit(1)
      )
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          setCachedRiddle(cacheKey, validatedRiddle);
          logger.debug(
            "Daily riddle fetched and validated successfully:",
            validatedRiddle
          );
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error(
              "Zod validation error for daily riddle data:",
              zodError.issues
            );
          } else {
            logger.error(
              "Unexpected error during daily riddle data validation:",
              zodError
            );
          }
          captureException(zodError);
          return null;
        }
      }
    } else {
      logger.debug(`No daily riddle found for index: ${dailyIndex}`);
      return null;
    }
  } catch (error) {
    logger.error("Error fetching daily riddle from Firestore:", error);
    captureException(error);
    throw error;
  }
  return null;
};

/**
 * Fetches a classic mode riddle from Firestore based on the user's classic index.
 * This function only fetches riddles and does not trigger generation.
 *
 * @param classicIndex The classic challenge index from the player's progress.
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchClassicRiddleFromFirestore = async (
  classicIndex: number
): Promise<FirestoreRiddle | null> => {
  const cacheKey = `classic:${classicIndex}`;
  const cached = getCachedRiddle(cacheKey);
  if (cached) {
    logger.debug(`Classic riddle for index ${classicIndex} served from cache`);
    return cached;
  }

  logger.debug(
    `Fetching classic riddle for index ${classicIndex} from Firestore`
  );

  try {
    const riddleQuerySnapshot = await getDocs(
      query(collection(getFirestore(), "riddles"), where("classicIndex", "==", classicIndex), limit(1))
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          setCachedRiddle(cacheKey, validatedRiddle);
          logger.debug(
            "Classic riddle fetched and validated successfully:",
            validatedRiddle
          );
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error(
              "Zod validation error for classic riddle data:",
              zodError.issues
            );
          } else {
            logger.error(
              "Unexpected error during classic riddle data validation:",
              zodError
            );
          }
          captureException(zodError);
          return null;
        }
      }
    } else {
      logger.debug(`No classic riddle found for index: ${classicIndex}`);
    }
    return null;
  } catch (error) {
    logger.error("Error fetching classic riddle from Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Fetches the daily riddle from Firestore for a given date.
 *
 * @param dateString The date string for which to fetch the daily riddle (e.g., YYYY-MM-DD).
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchDailyRiddleForDate = async (
  dateString: string
): Promise<FirestoreRiddle | null> => {
  try {
    // Assuming daily riddles are stored in a subcollection or have a field referencing the date
    // For now, let's assume they are in the 'riddles' collection with a 'date' field.
    const riddleQuerySnapshot = await getDocs(
      query(collection(getFirestore(), "riddles"), where("date", "==", dateString), limit(1))
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          logger.debug(
            "Daily riddle fetched and validated successfully for date:",
            dateString
          );
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error(
              "Zod validation error for daily riddle data for date:",
              dateString,
              zodError.issues
            );
          } else {
            logger.error(
              "Unexpected error during daily riddle data validation for date:",
              dateString,
              zodError
            );
          }
          captureException(zodError);
          return null;
        }
      }
    } else {
      logger.debug("No daily riddle found for date:", dateString);
    }
    return null;
  } catch (error) {
    logger.error(
      "Error fetching daily riddle for date from Firestore:",
      error
    );
    captureException(error);
    throw error;
  }
};

/**
 * Updates the last daily challenge completed timestamp for the user in Firestore.
 *
 * @param userId The ID of the user.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateLastDailyChallengeCompletedAt = async (
  userId: string
): Promise<void> => {
  if (!userId) {
    logger.warn(
      "Attempted to update daily challenge completion timestamp without a userId."
    );
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      lastDailyChallengeCompletedAt: serverTimestamp(),
    });
    logger.info(
      "Last daily challenge completed timestamp updated successfully for user:",
      userId
    );
  } catch (error) {
    logger.error(
      "Error updating last daily challenge completed timestamp in Firestore:",
      error
    );
    captureException(error);
    throw error;
  }
};

/**
 * Fetches a tutorial mode riddle from Firestore based on the user's tutorial index.
 *
 * @param tutorialIndex The tutorial index from the player's progress.
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchTutorialRiddleFromFirestore = async (
  tutorialIndex: number
): Promise<FirestoreRiddle | null> => {
  const cacheKey = `tutorial:${tutorialIndex}`;
  const cached = getCachedRiddle(cacheKey);
  if (cached) {
    logger.debug(`Tutorial riddle for index ${tutorialIndex} served from cache`);
    return cached;
  }

  try {
    const riddleQuerySnapshot = await getDocs(
      query(collection(getFirestore(), "riddles"), where("tutorialIndex", "==", tutorialIndex), limit(1))
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          setCachedRiddle(cacheKey, validatedRiddle);
          logger.debug(
            "Tutorial riddle fetched and validated successfully:",
            validatedRiddle
          );
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error(
              "Zod validation error for tutorial riddle data:",
              zodError.issues
            );
          } else {
            logger.error(
              "Unexpected error during tutorial riddle data validation:",
              zodError
            );
          }
          captureException(zodError);
          return null;
        }
      }
    } else {
      logger.debug("No tutorial riddle found for index:", tutorialIndex);
    }
    return null;
  } catch (error) {
    logger.error("Error fetching tutorial riddle from Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Returns the number of tutorial riddles in Firestore (for gating "Start Tutorial" etc.).
 * Queries riddles collection where category === "tutorial".
 */
export const getTutorialRiddleCount = async (): Promise<number> => {
  try {
    const snapshot = await getDocs(
      query(collection(getFirestore(), "riddles"), where("category", "==", "tutorial"))
    );
    return snapshot.size;
  } catch (error) {
    logger.error("Error getting tutorial riddle count from Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Updates the user's classic progress index in Firestore.
 *
 * @param userId The ID of the user.
 * @param classicIndex The new classic index.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateClassicIndexInFirestore = async (
  userId: string,
  classicIndex: number
): Promise<void> => {
  if (!userId) {
    logger.warn(
      "Attempted to update classic index in Firestore without a userId."
    );
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      "progress.classicIndex": classicIndex,
    });
    logger.info(
      "Classic index updated successfully for user:",
      userId,
      "to",
      classicIndex
    );
  } catch (error) {
    logger.error("Error updating classic index in Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Updates the user's daily challenge progress index in Firestore.
 *
 * @param userId The ID of the user.
 * @param dailyChallengeIndex The new daily challenge index.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateDailyChallengeIndexInFirestore = async (
  userId: string,
  dailyChallengeIndex: number
): Promise<void> => {
  if (!userId) {
    logger.warn(
      "Attempted to update daily challenge index in Firestore without a userId."
    );
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      "progress.dailyChallengeIndex": dailyChallengeIndex,
    });
    logger.info(
      "Daily challenge index updated successfully for user:",
      userId,
      "to",
      dailyChallengeIndex
    );
  } catch (error) {
    logger.error("Error updating daily challenge index in Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Updates the user's tutorial progress index in Firestore.
 *
 * @param userId The ID of the user.
 * @param tutorialIndex The new tutorial index.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateTutorialIndexInFirestore = async (
  userId: string,
  tutorialIndex: number
): Promise<void> => {
  if (!userId) {
    logger.warn(
      "Attempted to update tutorial index in Firestore without a userId."
    );
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      "progress.tutorialIndex": tutorialIndex,
    });
    logger.info(
      "Tutorial index updated successfully for user:",
      userId,
      "to",
      tutorialIndex
    );
  } catch (error) {
    logger.error("Error updating tutorial index in Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Updates fields in the user document in Firestore, allowing for FieldValue in stats.
 *
 * @param userId The ID of the user.
 * @param updates An object containing the fields to update, potentially with FieldValue.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateUserDocumentInFirestore = async (
  userId: string,
  updates: Partial<Player>
): Promise<void> => {
  if (!userId) {
    logger.warn(
      "Attempted to update user document in Firestore without a userId."
    );
    return;
  }
  try {
    // No Zod validation here as FieldValue is not directly parsable by Zod
    // PlayerSchema.partial().parse(updates); // Remove Zod parse

    await updateDoc(doc(getFirestore(), "users", userId), updates);
    logger.info("User document updated successfully for user:", userId);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error(
        "Zod validation error for user document updates:",
        error.issues
      );
      captureException(error);
      throw new Error("Invalid user document update data provided.");
    } else {
      logger.error("Error updating user document in Firestore:", error);
      captureException(error);
      throw error;
    }
  }
};

/**
 * Updates user stats in Firestore.
 *
 * @param userId The ID of the user.
 * @param stats The player stats to update.
 * @param transaction Optional: The Firestore transaction to use.
 * @returns A Promise that resolves when the update is complete.
 */
export const updateUserStats = async (
  userId: string,
  stats: Partial<Player["stats"]>,
  transaction?: FirebaseFirestoreTypes.Transaction
): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update user stats without a userId.");
    return;
  }
  const userRef = doc(getFirestore(), "users", userId);

  try {
    await (transaction
      ? transaction.update(userRef, { stats })
      : updateDoc(userRef, { stats }));
  } catch (error) {
    logger.error("Error updating user stats in Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Creates a new user document in Firestore with default values.
 * This is used when a new user signs in with Google or other OAuth providers.
 *
 * @param userId The user's Firebase Auth UID.
 * @param email The user's email address.
 * @param displayName The user's display name (optional).
 * @returns A Promise resolving to the created Player object.
 */
export const createUserDocumentInFirestore = async (
  userId: string,
  email: string,
  displayName?: string
): Promise<Player> => {
  if (!userId) {
    throw new Error("Cannot create user document without a userId.");
  }

  logger.debug("Creating user document with params:", {
    userId,
    email,
    displayName,
  });

  try {
    // Create default user data - only include defined values, omit undefined fields
    const baseUserData = {
      userId,
      email,
      username: displayName || email.split("@")[0], // Use display name or email prefix as username
      coins: 100, // Starting coins
      progress: {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        dailyChallengeCurrentQuestion: 0,
        tutorialIndex: 0,
      },
      stats: {
        dailyPuzzlesCompleted: 0,
        bestStreak: 0,
        totalWordsGuessed: 0,
        winRate: 0,
        averageGuesses: 0,
        totalScore: 0,
        highestLevelClassic: 0,
        gamesPlayed: 0,
        wins: 0,
        challengeWins: 0,
        winStreak: 0,
        totalWins: 0,
        totalGuessesInWins: 0,
        totalHintsUsed: 0,
      },
      unlockedAchievements: [],
      createdAt: Date.now(),
      hasPurchasedApp: false, // Default to false for new users
      // Omit lastDailyChallengeCompletedAt since it's undefined - Firestore doesn't support undefined values
    };

    // Add displayName only if it's defined
    const defaultUserData: Player = displayName
      ? { ...baseUserData, displayName }
      : baseUserData;

    logger.debug(
      "Default user data prepared:",
      JSON.stringify(defaultUserData, null, 2)
    );

    // Validate the data before saving
    const validatedUserData = PlayerSchema.parse(defaultUserData);

    // Save to Firestore
    await setDoc(doc(getFirestore(), "users", userId), validatedUserData);
    logger.info("New user document created successfully for user:", userId);
    return validatedUserData;
  } catch (error) {
    logger.error("Error creating user document in Firestore:", error);
    logger.error(
      "Error details:",
      error instanceof Error ? error.message : "Unknown error",
      error instanceof Error ? error.stack : "No stack trace"
    );
    captureException(error);
    throw error;
  }
};

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
import {Player, PlayerSchema} from "../validation/firestoreSchemas";
import {FirestoreRiddle, FirestoreRiddleSchema} from "../validation/firestoreSchemas";
import {ZodError} from "zod";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";

/** Session cache for riddle fetches to avoid repeated Firestore reads (e.g. mode switch). */
const RIDDLE_CACHE_MAX_SIZE = 50;
const riddleCache = new Map<string, FirestoreRiddle>();
const DAILY_RIDDLE_DOC_ID = "current";
const FIRESTORE_RETRYABLE_CODES = new Set<string>([
  "firestore/unavailable",
  "unavailable",
  "firestore/deadline-exceeded",
  "deadline-exceeded",
  "firestore/internal",
  "internal",
]);
const MAX_READ_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 300;

const ALLOWED_USER_UPDATE_FIELDS = new Set<string>([
  "userId",
  "username",
  "email",
  "coins",
  "displayName",
  "avatarUrl",
  "hasPurchasedApp",
  "createdAt",
  "registeredAt",
  "lastLogin",
  "lastDailyChallengeCompletedAt",
  "stats",
  "progress",
  "unlockedAchievements",
  "fcmToken",
  "fcmTokenUpdatedAt",
  "lastStreakReminderSentAt",
] as const);

const ALLOWED_STATS_UPDATE_FIELDS = new Set<string>([
  "xp",
  "level",
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
  "totalHintsUsed",
] as const);

const ALLOWED_PROGRESS_UPDATE_FIELDS = new Set<string>([
  "classicIndex",
  "dailyChallengeIndex",
  "dailyChallengeCurrentQuestion",
  "tutorialIndex",
] as const);

const stripUndefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined && nestedValue !== null),
  ) as Partial<T>;

const sanitizeUserDocumentUpdates = (updates: Partial<Player>): Partial<Player> => {
  const topLevel = stripUndefined(updates as Record<string, unknown>);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(topLevel)) {
    if (!ALLOWED_USER_UPDATE_FIELDS.has(key)) {
      continue;
    }

    if (key === "stats" && value && typeof value === "object" && !Array.isArray(value)) {
      const stats = stripUndefined(value as Record<string, unknown>);
      sanitized.stats = Object.fromEntries(
        Object.entries(stats).filter(([statsKey]) => ALLOWED_STATS_UPDATE_FIELDS.has(statsKey)),
      );
      continue;
    }

    if (key === "progress" && value && typeof value === "object" && !Array.isArray(value)) {
      const progress = stripUndefined(value as Record<string, unknown>);
      sanitized.progress = Object.fromEntries(
        Object.entries(progress).filter(([progressKey]) => ALLOWED_PROGRESS_UPDATE_FIELDS.has(progressKey)),
      );
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized as Partial<Player>;
};

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

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeFirestoreErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code =
    "code" in error && typeof (error as {code?: unknown}).code === "string" ? (error as {code: string}).code : null;
  if (code) {
    return code;
  }

  const message =
    "message" in error && typeof (error as {message?: unknown}).message === "string"
      ? (error as {message: string}).message
      : "";
  const match = message.match(/\[(firestore\/[^\]]+)\]/i);
  return match?.[1]?.toLowerCase() ?? null;
};

const isRetryableFirestoreReadError = (error: unknown): boolean => {
  const code = normalizeFirestoreErrorCode(error)?.toLowerCase();
  if (code && FIRESTORE_RETRYABLE_CODES.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("service is currently unavailable") ||
    message.includes("transient condition") ||
    message.includes("network request failed")
  );
};

async function withFirestoreReadRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_READ_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < MAX_READ_RETRY_ATTEMPTS && isRetryableFirestoreReadError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 120);
      logger.warn(`${operationName} transient Firestore error. Retrying...`, {
        attempt,
        nextDelayMs: delay,
        errorCode: normalizeFirestoreErrorCode(error),
      });
      await wait(delay);
    }
  }

  throw lastError;
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
export const saveUserProgressToFirestore = async (userId: string, progress: Player["progress"]): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to save progress to Firestore without a userId.");
    return;
  }
  try {
    await setDoc(doc(getFirestore(), "users", userId), {progress: progress}, {merge: true});
    logger.info("Player progress saved to Firestore successfully for user:", userId);
  } catch (error) {
    logger.error("Error saving player progress to Firestore:", error);
    captureException(error);
    throw error;
  }
};

export const loadUserProgressFromFirestore = async (userId: string): Promise<Player | null> => {
  if (!userId) {
    logger.warn("Attempted to load progress from Firestore without a userId.");
    return null;
  }
  try {
    const userDoc = await withFirestoreReadRetry("loadUserProgressFromFirestore", () =>
      getDoc(doc(getFirestore(), "users", userId)),
    );
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData) {
        try {
          const validatedPlayer = PlayerSchema.parse(userData);
          logger.info("Player data validated successfully.");

          return validatedPlayer;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error("Zod validation error for player data:", zodError.issues);
          } else {
            logger.error("Unexpected error during player data validation:", zodError);
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
 * Fetches today's single daily riddle from Firestore.
 * This function only fetches riddles and does not trigger generation.
 *
 * @param dailyIndex Legacy client progress value retained for API compatibility.
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchDailyRiddleFromFirestore = async (dailyIndex: number): Promise<FirestoreRiddle | null> => {
  logger.debug(
    `Fetching current daily riddle from Firestore dailyRiddles/${DAILY_RIDDLE_DOC_ID} (client index hint: ${dailyIndex})`,
  );

  try {
    const currentDailyDoc = await withFirestoreReadRetry("fetchDailyRiddleFromFirestore.current", () =>
      getDoc(doc(getFirestore(), "dailyRiddles", DAILY_RIDDLE_DOC_ID)),
    );

    if (currentDailyDoc.exists()) {
      const riddleData = currentDailyDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: riddleData.riddleId ?? currentDailyDoc.id ?? DAILY_RIDDLE_DOC_ID,
          });
          logger.debug("Current daily riddle fetched and validated successfully:", validatedRiddle);
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error("Zod validation error for daily riddle data:", zodError.issues);
          } else {
            logger.error("Unexpected error during daily riddle data validation:", zodError);
          }
          captureException(zodError);
          return null;
        }
      }
    }

    logger.debug(`No current daily riddle found at dailyRiddles/${DAILY_RIDDLE_DOC_ID}`);
    return null;
  } catch (error) {
    logger.error("Error fetching daily riddle from Firestore:", error);
    captureException(error);
    throw error;
  }
};

/**
 * Fetches a classic mode riddle from Firestore based on the user's classic index.
 * This function only fetches riddles and does not trigger generation.
 *
 * @param classicIndex The classic challenge index from the player's progress.
 * @returns A Promise resolving to the FirestoreRiddle data or null if not found.
 */
export const fetchClassicRiddleFromFirestore = async (classicIndex: number): Promise<FirestoreRiddle | null> => {
  const cacheKey = `classic:${classicIndex}`;
  const cached = getCachedRiddle(cacheKey);
  if (cached) {
    logger.debug(`Classic riddle for index ${classicIndex} served from cache`);
    return cached;
  }

  logger.debug(`Fetching classic riddle for index ${classicIndex} from Firestore`);

  try {
    const riddleQuerySnapshot = await withFirestoreReadRetry("fetchClassicRiddleFromFirestore", () =>
      getDocs(query(collection(getFirestore(), "riddles"), where("classicIndex", "==", classicIndex), limit(1))),
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          setCachedRiddle(cacheKey, validatedRiddle);
          logger.debug("Classic riddle fetched and validated successfully:", validatedRiddle);
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error("Zod validation error for classic riddle data:", zodError.issues);
          } else {
            logger.error("Unexpected error during classic riddle data validation:", zodError);
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
export const fetchDailyRiddleForDate = async (dateString: string): Promise<FirestoreRiddle | null> => {
  try {
    // Assuming daily riddles are stored in a subcollection or have a field referencing the date
    // For now, let's assume they are in the 'riddles' collection with a 'date' field.
    const riddleQuerySnapshot = await withFirestoreReadRetry("fetchDailyRiddleForDate", () =>
      getDocs(query(collection(getFirestore(), "riddles"), where("date", "==", dateString), limit(1))),
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          logger.debug("Daily riddle fetched and validated successfully for date:", dateString);
          return validatedRiddle;
        } catch (zodError) {
          if (zodError instanceof ZodError) {
            logger.error("Zod validation error for daily riddle data for date:", dateString, zodError.issues);
          } else {
            logger.error("Unexpected error during daily riddle data validation for date:", dateString, zodError);
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
    logger.error("Error fetching daily riddle for date from Firestore:", error);
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
export const updateLastDailyChallengeCompletedAt = async (userId: string): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update daily challenge completion timestamp without a userId.");
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      lastDailyChallengeCompletedAt: serverTimestamp(),
    });
    logger.info("Last daily challenge completed timestamp updated successfully for user:", userId);
  } catch (error) {
    logger.error("Error updating last daily challenge completed timestamp in Firestore:", error);
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
export const updateClassicIndexInFirestore = async (userId: string, classicIndex: number): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update classic index in Firestore without a userId.");
    return;
  }
  try {
    const normalizedClassicIndex =
      typeof classicIndex === "number" && Number.isFinite(classicIndex) ? Math.max(0, Math.floor(classicIndex)) : 0;
    await updateDoc(doc(getFirestore(), "users", userId), {
      "progress.classicIndex": normalizedClassicIndex,
    });
    logger.info("Classic index updated successfully for user:", userId, "to", normalizedClassicIndex);
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
  dailyChallengeIndex: number,
): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update daily challenge index in Firestore without a userId.");
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), {
      "progress.dailyChallengeIndex": dailyChallengeIndex,
    });
    logger.info("Daily challenge index updated successfully for user:", userId, "to", dailyChallengeIndex);
  } catch (error) {
    logger.error("Error updating daily challenge index in Firestore:", error);
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
export const updateUserDocumentInFirestore = async (userId: string, updates: Partial<Player>): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update user document in Firestore without a userId.");
    return;
  }
  const sanitizedUpdates = sanitizeUserDocumentUpdates({
    ...updates,
    userId,
  });
  if (Object.keys(sanitizedUpdates).length === 0) {
    logger.warn("Skipping Firestore user update because payload had no allowed fields.");
    return;
  }
  try {
    await updateDoc(doc(getFirestore(), "users", userId), sanitizedUpdates);
    logger.info("User document updated successfully for user:", userId);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error("Zod validation error for user document updates:", error.issues);
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
  transaction?: FirebaseFirestoreTypes.Transaction,
): Promise<void> => {
  if (!userId) {
    logger.warn("Attempted to update user stats without a userId.");
    return;
  }
  const userRef = doc(getFirestore(), "users", userId);
  const statsFieldUpdates = Object.fromEntries(
    Object.entries(stats).flatMap(([key, value]) => (value === undefined ? [] : [[`stats.${key}`, value]])),
  );
  if (Object.keys(statsFieldUpdates).length === 0) {
    return;
  }

  try {
    await (transaction ? transaction.update(userRef, statsFieldUpdates) : updateDoc(userRef, statsFieldUpdates));
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
 * @param avatarUrl The user's provider avatar URL (optional).
 * @returns A Promise resolving to the created Player object.
 */
export const createUserDocumentInFirestore = async (
  userId: string,
  email: string,
  displayName?: string,
  avatarUrl?: string,
  seed?: Partial<Player>,
): Promise<Player> => {
  if (!userId) {
    throw new Error("Cannot create user document without a userId.");
  }

  logger.debug("Creating user document with params:", {
    userId,
    email,
    displayName,
    avatarUrl,
  });

  try {
    // Create default user data - only include defined values, omit undefined fields
    const baseUserData = {
      userId,
      email,
      username:
        (typeof seed?.username === "string" && seed.username.trim() !== "" ? seed.username.trim() : undefined) ||
        displayName ||
        email.split("@")[0], // Prefer guest-chosen username, then provider, then email prefix
      coins: typeof seed?.coins === "number" ? seed.coins : 100, // Starting coins
      progress: {
        classicIndex: 1,
        dailyChallengeIndex: 0,
        dailyChallengeCurrentQuestion: 0,
        ...(seed?.progress ?? {}),
      },
      stats: {
        xp: 0,
        level: 1,
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
        ...(seed?.stats ?? {}),
      },
      unlockedAchievements: Array.isArray(seed?.unlockedAchievements) ? seed.unlockedAchievements : [],
      createdAt: Date.now(),
      hasPurchasedApp: typeof seed?.hasPurchasedApp === "boolean" ? seed.hasPurchasedApp : false, // Default to false for new users
      // Omit lastDailyChallengeCompletedAt since it's undefined - Firestore doesn't support undefined values
    };

    // Add displayName only if it's defined
    const defaultUserData: Player = displayName ? {...baseUserData, displayName} : baseUserData;

    if (avatarUrl) {
      defaultUserData.avatarUrl = avatarUrl;
    }

    if (typeof seed?.lastDailyChallengeCompletedAt === "number") {
      defaultUserData.lastDailyChallengeCompletedAt = seed.lastDailyChallengeCompletedAt;
    }

    logger.debug("Default user data prepared:", JSON.stringify(defaultUserData, null, 2));

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
      error instanceof Error ? error.stack : "No stack trace",
    );
    captureException(error);
    throw error;
  }
};

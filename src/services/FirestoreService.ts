import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {Player, PlayerSchema} from "../validation/firestoreSchemas";
import {FirestoreRiddle, FirestoreRiddleSchema} from "../validation/firestoreSchemas";
import {getLocale, type SupportedLanguage} from "../i18n";
import {ZodError, z} from "zod";
import {logger} from "../utils/logger";
import {captureException, withSentrySpan} from "../utils/sentry";
import {callValidatedFunction, getCallableFunction} from "../utils/firebaseFunctions";
import {CurrentDailyChallengeOutputSchema, EmptyInputSchema} from "../validation/cloudFunctionsSchemas";
import {
  playerFirestoreConverter,
  riddleFirestoreConverter,
  withConverterIfAvailable,
} from "./firestoreConverters";

/** Session cache for riddle fetches to avoid repeated Firestore reads (e.g. mode switch). */
const RIDDLE_CACHE_MAX_SIZE = 50;
const riddleCache = new Map<string, FirestoreRiddle>();
const LOCALIZED_RIDDLES_COLLECTION = "localizedRiddles";
const DAILY_RIDDLE_DOC_ID = "current";
const CurrentClassicRiddleInputSchema = z.object({
  classicIndex: z.number().int().nonnegative(),
  locale: z.string().optional(),
});
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
  "displayName",
  "avatarUrl",
  "preferredLanguage",
  "createdAt",
  "registeredAt",
  "lastLogin",
  "fcmToken",
  "fcmTokenUpdatedAt",
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

const resolveLocale = (locale?: SupportedLanguage): SupportedLanguage => locale ?? getLocale();

const getLocalizedRiddleCollection = (locale: SupportedLanguage): string =>
  `${LOCALIZED_RIDDLES_COLLECTION}/${locale}/riddles`;

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

const isExpectedFirestoreAccessError = (error: unknown): boolean => {
  const code = normalizeFirestoreErrorCode(error)?.toLowerCase() ?? "";
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error && typeof (error as {message?: unknown}).message === "string"
          ? (error as {message: string}).message
          : String(error);
  const normalized = `${code} ${text}`.toLowerCase();

  return (
    normalized.includes("permission-denied") ||
    normalized.includes("unauthenticated") ||
    normalized.includes("firestore/permission-denied") ||
    normalized.includes("firestore/unauthenticated") ||
    normalized.includes("permission denied") ||
    normalized.includes("not authorized")
  );
};

const logExpectedFirestoreAccessWarning = (scope: string, error: unknown): void => {
  logger.warn(`${scope} denied during startup; falling back to local state.`, error);
};

const buildDailyRiddleFromChallenge = (
  challengeResponse: Awaited<ReturnType<typeof callValidatedFunction<typeof EmptyInputSchema, typeof CurrentDailyChallengeOutputSchema>>>,
  resolvedLocale: SupportedLanguage,
  dailyIndex: number,
): FirestoreRiddle | null => {
  const challenge = challengeResponse.challenge;
  const question = challenge?.questions?.[0];

  if (
    !challenge ||
    !question ||
    typeof question.text !== "string" ||
    question.text.length === 0 ||
    typeof question.answer !== "string" ||
    question.answer.length === 0
  ) {
    return null;
  }

  return {
    riddleId: question.riddleId,
    canonicalKey: challenge.date ? `daily:${challenge.date}` : `daily:${question.riddleId}`,
    challengeKey: challenge.date,
    locale: resolvedLocale,
    dailyIndex,
    text: question.text,
    answer: question.answer,
    category: "daily",
  };
};

const buildClassicRiddleFromChallenge = (
  challengeResponse: Awaited<ReturnType<typeof callValidatedFunction<typeof CurrentClassicRiddleInputSchema, typeof CurrentDailyChallengeOutputSchema>>>,
  resolvedLocale: SupportedLanguage,
  classicIndex: number,
): FirestoreRiddle | null => {
  const challenge = challengeResponse.challenge;
  const question = challenge?.questions?.[0];

  if (
    !challenge ||
    !question ||
    typeof question.text !== "string" ||
    question.text.length === 0 ||
    typeof question.answer !== "string" ||
    question.answer.length === 0
  ) {
    return null;
  }

  return {
    riddleId: question.riddleId,
    canonicalKey: `classic:${classicIndex}`,
    locale: resolvedLocale,
    dailyIndex: classicIndex,
    text: question.text,
    answer: question.answer,
    category: "classic",
  };
};

async function withFirestoreReadRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
  return withSentrySpan(
    `firestore.read.${operationName}`,
    "db.firestore",
    async () => {
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
    },
    {operationName},
  );
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
  logger.warn("Skipping direct client progress write; player progress is persisted by Cloud Functions.", {
    userId,
    progress,
  });
};

export const loadUserProgressFromFirestore = async (userId: string): Promise<Player | null> => {
  if (!userId) {
    logger.warn("Attempted to load progress from Firestore without a userId.");
    return null;
  }
  try {
    const userDoc = await withFirestoreReadRetry("loadUserProgressFromFirestore", () =>
      getDoc(withConverterIfAvailable(doc(getFirestore(), "users", userId), playerFirestoreConverter)),
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
export const fetchDailyRiddleFromFirestore = async (
  dailyIndex: number,
  locale?: SupportedLanguage,
): Promise<FirestoreRiddle | null> => {
  const resolvedLocale = resolveLocale(locale);

  try {
    logger.debug("Fetching current daily riddle from the daily challenge callable");
    const challengeResponse = await callValidatedFunction(
      "getCurrentDailyChallenge",
      {},
      EmptyInputSchema,
      CurrentDailyChallengeOutputSchema,
    );
    const riddle = buildDailyRiddleFromChallenge(challengeResponse, resolvedLocale, dailyIndex);
    if (riddle) {
      logger.debug("Current daily riddle fetched and validated successfully:", riddle);
      return riddle;
    }
    logger.debug(`No current daily riddle available for locale ${resolvedLocale}`);
    return null;
  } catch (error) {
    if (isExpectedFirestoreAccessError(error)) {
      logExpectedFirestoreAccessWarning("Daily riddle Firestore read", error);
      return null;
    }
    logger.error("Error fetching daily riddle from callable:", error);
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
export const fetchClassicRiddleFromFirestore = async (
  classicIndex: number,
  locale?: SupportedLanguage,
): Promise<FirestoreRiddle | null> => {
  const resolvedLocale = resolveLocale(locale);
  const cacheKey = `classic:${resolvedLocale}:${classicIndex}`;
  const cached = getCachedRiddle(cacheKey);
  if (cached) {
    logger.debug(`Classic riddle for index ${classicIndex} served from cache for locale ${resolvedLocale}`);
    return cached;
  }

  logger.debug(`Fetching classic riddle for index ${classicIndex} from Firestore locale ${resolvedLocale}`);

  try {
    const challengeResponse = await callValidatedFunction(
      "getCurrentClassicRiddle",
      {classicIndex, locale: resolvedLocale},
      CurrentClassicRiddleInputSchema,
      CurrentDailyChallengeOutputSchema,
    );
    const riddle = buildClassicRiddleFromChallenge(challengeResponse, resolvedLocale, classicIndex);
    if (riddle) {
      setCachedRiddle(cacheKey, riddle);
      logger.debug("Classic riddle fetched and validated successfully:", riddle);
      return riddle;
    }
    logger.debug(`No classic riddle found for index: ${classicIndex} in locale ${resolvedLocale}`);
    return null;
  } catch (error) {
    if (isExpectedFirestoreAccessError(error)) {
      logExpectedFirestoreAccessWarning("Classic riddle Firestore read", error);
      return null;
    }
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
    const resolvedLocale = getLocale();
    const riddleQuerySnapshot = await withFirestoreReadRetry("fetchDailyRiddleForDate", () =>
      getDocs(
        query(
          withConverterIfAvailable(collection(getFirestore(), getLocalizedRiddleCollection(resolvedLocale)), riddleFirestoreConverter),
          where("challengeKey", "==", dateString),
          limit(1),
        ),
      ),
    );

    if (!riddleQuerySnapshot.empty) {
      const riddleDoc = riddleQuerySnapshot.docs[0];
      const riddleData = riddleDoc.data();
      if (riddleData) {
        try {
          const validatedRiddle = FirestoreRiddleSchema.parse(riddleData);
          logger.debug("Daily riddle fetched and validated successfully for date and locale:", dateString, resolvedLocale);
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
    if (isExpectedFirestoreAccessError(error)) {
      logExpectedFirestoreAccessWarning("Daily riddle lookup for date", error);
      return null;
    }
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
  logger.warn("Skipping direct client daily completion timestamp write; completion is persisted by Cloud Functions.", {
    userId,
  });
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
  const normalizedClassicIndex =
    typeof classicIndex === "number" && Number.isFinite(classicIndex) ? Math.max(0, Math.floor(classicIndex)) : 0;
  logger.warn("Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.", {
    userId,
    classicIndex: normalizedClassicIndex,
  });
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
  logger.warn("Skipping direct client daily progress write; daily progress is persisted by Cloud Functions.", {
    userId,
    dailyChallengeIndex,
  });
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
  const statsFieldUpdates = Object.fromEntries(
    Object.entries(stats).flatMap(([key, value]) => (value === undefined ? [] : [[`stats.${key}`, value]])),
  );
  if (Object.keys(statsFieldUpdates).length === 0) {
    return;
  }

  if (transaction) {
    throw new Error("Client-side Firestore transactions cannot update server-managed user stats.");
  }
  logger.warn("Skipping direct client stats write; player stats are persisted by Cloud Functions.", {
    userId,
    stats: statsFieldUpdates,
  });
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
      preferredLanguage: seed?.preferredLanguage,
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
      preferredLanguage:
        typeof seed?.preferredLanguage === "string" ? seed.preferredLanguage : getLocale(),
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

    const initializeUserCallable = getCallableFunction("initializeUser");
    const result = await initializeUserCallable({
      email: validatedUserData.email,
      username: validatedUserData.username,
      displayName: validatedUserData.displayName,
      avatarUrl: validatedUserData.avatarUrl,
      seed: validatedUserData,
    });
    const initialized = result.data as {player?: Player};
    if (!initialized.player) {
      throw new Error("initializeUser did not return initialized player data.");
    }
    logger.info("New user document created successfully via Cloud Function for user:", userId);
    return PlayerSchema.parse(initialized.player);
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

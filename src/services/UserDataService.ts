import {getFirestore, doc, getDoc, updateDoc} from "@react-native-firebase/firestore";
import {Player, PlayerSchema} from "../validation/firestoreSchemas";
import {ZodError} from "zod";
import {IUserDataService} from "./interfaces/IUserDataService";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {getCallableFunction} from "../utils/firebaseFunctions";

const stripServerManagedUserFields = (updates: Partial<Player>): Partial<Player> => {
  const clientEditableUpdates = {...updates};
  delete clientEditableUpdates.coins;
  delete clientEditableUpdates.progress;
  delete clientEditableUpdates.stats;
  delete clientEditableUpdates.hasPurchasedApp;
  delete clientEditableUpdates.unlockedAchievements;
  delete clientEditableUpdates.lastDailyChallengeCompletedAt;

  return clientEditableUpdates;
};

/**
 * Service for managing user data in Firestore
 */
export class UserDataService implements IUserDataService {
  private static readonly USERS_COLLECTION = "users";

  /**
   * Saves the user's progress to Firestore.
   */
  async saveUserProgress(userId: string, progress: Player["progress"]): Promise<void> {
    if (!userId || !userId.trim()) {
      logger.warn("Attempted to save progress to Firestore without a userId.");
      return;
    }

    try {
      logger.warn("Skipping direct client progress write; player progress is persisted by Cloud Functions.", {
        userId,
        progress,
      });
    } catch (error) {
      logger.error("Error saving player progress to Firestore:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Loads user progress from Firestore.
   */
  async loadUserProgress(userId: string): Promise<Player | null> {
    if (!userId || !userId.trim()) {
      logger.warn("Attempted to load progress from Firestore without a userId.");
      return null;
    }

    try {
      const userDoc = await getDoc(doc(getFirestore(), UserDataService.USERS_COLLECTION, userId));

      if (!userDoc.exists()) {
        logger.info("No user document found for userId:", userId);
        return null;
      }

      const userData = userDoc.data();
      if (!userData) {
        logger.warn("User document exists but has no data for userId:", userId);
        return null;
      }

      // Validate the data structure
      const validatedData = PlayerSchema.parse(userData);
      logger.info("User progress loaded successfully for user:", userId);
      return validatedData;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("User data validation failed:", error.issues);
        captureException(error);
        throw new Error("Invalid user data structure in Firestore");
      }
      logger.error("Error loading user progress from Firestore:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Creates a new user document in Firestore.
   */
  async createUserDocument(userId: string, userData: Player): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to create user document");
    }

    try {
      // Validate the user data before saving
      const validatedData = PlayerSchema.parse(userData);

      const initializeUserCallable = getCallableFunction("initializeUser");
      await initializeUserCallable({
        email: validatedData.email,
        username: validatedData.username,
        displayName: validatedData.displayName,
        avatarUrl: validatedData.avatarUrl,
        seed: validatedData,
      });

      logger.info("User document created successfully via Cloud Function for user:", userId);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("User data validation failed during creation:", error.issues);
        captureException(error);
        throw new Error("Invalid user data provided for creation");
      }
      logger.error("Error creating user document:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Updates user document in Firestore.
   */
  async updateUserDocument(userId: string, updates: Partial<Player>): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to update user document");
    }

    try {
      const clientEditableUpdates = stripServerManagedUserFields(updates);
      if (Object.keys(clientEditableUpdates).length === 0) {
        logger.warn("Skipping user document update because it only contained server-managed fields.", {userId});
        return;
      }
      await updateDoc(doc(getFirestore(), UserDataService.USERS_COLLECTION, userId), clientEditableUpdates);

      logger.info("User document updated successfully for user:", userId);
    } catch (error) {
      logger.error("Error updating user document:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Updates the classic index for a user.
   */
  async updateClassicIndex(userId: string, newIndex: number): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to update classic index");
    }

    try {
      logger.warn("Skipping direct client classic progress write; classic progress is persisted by Cloud Functions.", {
        userId,
        newIndex,
      });
    } catch (error) {
      logger.error("Error updating classic index:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Updates user coins.
   */
  async updateUserCoins(userId: string, newCoinAmount: number): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to update coins");
    }

    if (newCoinAmount < 0) {
      throw new Error("Coin amount cannot be negative");
    }

    try {
      logger.warn("Skipping direct client coin write; economy changes are persisted by Cloud Functions.", {
        userId,
        newCoinAmount,
      });
    } catch (error) {
      logger.error("Error updating user coins:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Checks if a user document exists.
   */
  async userExists(userId: string): Promise<boolean> {
    if (!userId || !userId.trim()) {
      return false;
    }

    try {
      const userDoc = await getDoc(doc(getFirestore(), UserDataService.USERS_COLLECTION, userId));

      return userDoc.exists();
    } catch (error) {
      logger.error("Error checking if user exists:", error);
      captureException(error);
      return false;
    }
  }

  /**
   * Initializes a new user document with complete default stats and progress.
   * Calls the Firebase function to ensure proper server-side initialization.
   */
  async initializeNewUser(userData: {
    email: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<{success: boolean; message: string; userId: string}> {
    try {
      const initializeUserCallable = getCallableFunction("initializeUser");
      const result = await initializeUserCallable(userData);

      logger.info("User initialized successfully:", result.data);
      return result.data as {
        success: boolean;
        message: string;
        userId: string;
      };
    } catch (error) {
      logger.error("Error initializing new user:", error);
      captureException(error);
      throw new Error("Failed to initialize new user account");
    }
  }

  /**
   * Ensures user document has all required stats and progress fields.
   * Calls the Firebase function to fix any missing fields.
   */
  async ensureUserDocumentComplete(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const ensureUserCompleteCallable = getCallableFunction("ensureUserComplete");
      const result = await ensureUserCompleteCallable({});

      logger.info("User document completeness ensured:", result.data);
      return result.data as {success: boolean; message: string};
    } catch (error) {
      logger.error("Error ensuring user document completeness:", error);
      captureException(error);
      throw new Error("Failed to ensure user document completeness");
    }
  }

  /**
   * Updates user statistics manually (admin function).
   * Useful for data fixes or admin operations.
   */
  async updateUserStats(
    targetUserId: string,
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
    },
  ): Promise<{success: boolean; message: string}> {
    try {
      const updateUserStatsCallable = getCallableFunction("updateUserStats");
      const result = await updateUserStatsCallable({
        targetUserId,
        statsUpdate,
      });

      logger.info("User stats updated successfully:", result.data);
      return result.data as {success: boolean; message: string};
    } catch (error) {
      logger.error("Error updating user stats:", error);
      captureException(error);
      throw new Error("Failed to update user stats");
    }
  }
}

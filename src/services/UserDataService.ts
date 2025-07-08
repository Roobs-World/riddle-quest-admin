import { getFirestore } from "@react-native-firebase/firestore";
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { Player, PlayerSchema } from "../validation/firestoreSchemas";
import { ZodError } from "zod";
import { IUserDataService } from "./interfaces/IUserDataService";

/**
 * Service for managing user data in Firestore
 */
export class UserDataService implements IUserDataService {
  private static readonly USERS_COLLECTION = "users";

  /**
   * Saves the user's progress to Firestore.
   */
  async saveUserProgress(
    userId: string,
    progress: Player["progress"]
  ): Promise<void> {
    if (!userId || !userId.trim()) {
      console.warn("Attempted to save progress to Firestore without a userId.");
      return;
    }

    try {
      await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .set({ progress }, { merge: true });

      console.log(
        "Player progress saved to Firestore successfully for user:",
        userId
      );
    } catch (error) {
      console.error("Error saving player progress to Firestore:", error);
      throw error;
    }
  }

  /**
   * Loads user progress from Firestore.
   */
  async loadUserProgress(userId: string): Promise<Player | null> {
    if (!userId || !userId.trim()) {
      console.warn(
        "Attempted to load progress from Firestore without a userId."
      );
      return null;
    }

    try {
      const userDoc = await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .get();

      if (!userDoc.exists()) {
        console.log("No user document found for userId:", userId);
        return null;
      }

      const userData = userDoc.data();
      if (!userData) {
        console.warn(
          "User document exists but has no data for userId:",
          userId
        );
        return null;
      }

      // Validate the data structure
      const validatedData = PlayerSchema.parse(userData);
      console.log("User progress loaded successfully for user:", userId);
      return validatedData;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("User data validation failed:", error.issues);
        throw new Error("Invalid user data structure in Firestore");
      }
      console.error("Error loading user progress from Firestore:", error);
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

      await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .set(validatedData);

      console.log("User document created successfully for user:", userId);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(
          "User data validation failed during creation:",
          error.issues
        );
        throw new Error("Invalid user data provided for creation");
      }
      console.error("Error creating user document:", error);
      throw error;
    }
  }

  /**
   * Updates user document in Firestore.
   */
  async updateUserDocument(
    userId: string,
    updates: Partial<Player>
  ): Promise<void> {
    if (!userId || !userId.trim()) {
      throw new Error("User ID is required to update user document");
    }

    try {
      await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .update(updates);

      console.log("User document updated successfully for user:", userId);
    } catch (error) {
      console.error("Error updating user document:", error);
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
      await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .update({
          "progress.classicIndex": newIndex,
        });

      console.log(`Classic index updated to ${newIndex} for user:`, userId);
    } catch (error) {
      console.error("Error updating classic index:", error);
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
      await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .update({
          coins: newCoinAmount,
        });

      console.log(`Coins updated to ${newCoinAmount} for user:`, userId);
    } catch (error) {
      console.error("Error updating user coins:", error);
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
      const userDoc = await getFirestore(getApp())
        .collection(UserDataService.USERS_COLLECTION)
        .doc(userId)
        .get();

      return userDoc.exists();
    } catch (error) {
      console.error("Error checking if user exists:", error);
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
  }): Promise<{ success: boolean; message: string; userId: string }> {
    try {
      const initializeUserCallable = getFunctions(getApp()).httpsCallable(
        "initializeUser"
      );
      const result = await initializeUserCallable(userData);

      console.log("User initialized successfully:", result.data);
      return result.data as {
        success: boolean;
        message: string;
        userId: string;
      };
    } catch (error) {
      console.error("Error initializing new user:", error);
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
      const ensureUserCompleteCallable = getFunctions(getApp()).httpsCallable(
        "ensureUserComplete"
      );
      const result = await ensureUserCompleteCallable({});

      console.log("User document completeness ensured:", result.data);
      return result.data as { success: boolean; message: string };
    } catch (error) {
      console.error("Error ensuring user document completeness:", error);
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
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updateUserStatsCallable = getFunctions(getApp()).httpsCallable(
        "updateUserStats"
      );
      const result = await updateUserStatsCallable({
        targetUserId,
        statsUpdate,
      });

      console.log("User stats updated successfully:", result.data);
      return result.data as { success: boolean; message: string };
    } catch (error) {
      console.error("Error updating user stats:", error);
      throw new Error("Failed to update user stats");
    }
  }
}

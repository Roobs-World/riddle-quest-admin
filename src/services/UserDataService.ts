import { getFirestore } from "@react-native-firebase/firestore";
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
}

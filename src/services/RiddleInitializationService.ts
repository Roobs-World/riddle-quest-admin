import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { getCallableFunction } from "../utils/firebaseFunctions";

/**
 * Service responsible for checking and initializing the riddle database
 * during app startup if it's empty.
 */
export class RiddleInitializationService {
  /**
   * Static flag to track if initialization has been attempted
   * to prevent duplicate Firebase function calls
   */
  private static isInitializing: boolean = false;
  private static hasInitialized: boolean = false;
  private static initializationFailed: boolean = false;

  /**
   * Gets the current initialization status
   */
  static getInitializationStatus(): {
    isInitializing: boolean;
    hasInitialized: boolean;
    initializationFailed: boolean;
  } {
    return {
      isInitializing: this.isInitializing,
      hasInitialized: this.hasInitialized,
      initializationFailed: this.initializationFailed,
    };
  }

  /**
   * Checks if the riddle database has any riddles and initializes it if empty.
   * This should be called during app startup to ensure riddles are available.
   */
  static async checkAndInitializeRiddles(): Promise<void> {
    // Prevent duplicate initialization calls
    if (this.isInitializing || this.hasInitialized) {
      console.log(
        "🔒 Riddle initialization already in progress or completed, skipping..."
      );
      return;
    }

    this.isInitializing = true;
    console.log("🔍 Checking if riddle database needs initialization...");

    try {
      // Check if any classic riddles exist
      const riddlesSnapshot = await firestore(getApp())
        .collection("riddles")
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();

      if (!riddlesSnapshot.empty) {
        console.log(
          "✅ Riddle database already has riddles - no initialization needed"
        );
        this.hasInitialized = true;
        this.initializationFailed = false;
        return;
      }

      console.log("⚠️ No riddles found in database - initializing...");

      // Call the Firebase function to initialize riddles
      const initializeRiddleDatabase = getCallableFunction(
        "initializeRiddleDatabase"
      );

      try {
        console.log("📡 Calling initializeRiddleDatabase Firebase function...");
        const result = await initializeRiddleDatabase({});
        console.log("✅ Riddle initialization result:", result.data);
      } catch (error) {
        console.error("❌ Error calling initializeRiddleDatabase:", error);

        // Try the alternative function
        console.log("🔄 Trying alternative: generateClassicRiddles...");
        const generateClassicRiddles = getCallableFunction(
          "generateClassicRiddles"
        );

        try {
          const result = await generateClassicRiddles({});
          console.log("✅ Classic riddles generation result:", result.data);
        } catch (fallbackError) {
          console.error(
            "❌ Error calling generateClassicRiddles:",
            fallbackError
          );
          throw new Error(
            "Failed to initialize riddle database with both methods"
          );
        }
      }

      // Verify riddles were created
      const verifySnapshot = await firestore(getApp())
        .collection("riddles")
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();

      if (verifySnapshot.empty) {
        throw new Error(
          "Riddle initialization completed but no riddles found in database"
        );
      }

      console.log("✅ Riddle database successfully initialized!");
      this.hasInitialized = true;
      this.initializationFailed = false;
    } catch (error) {
      console.error("❌ Error during riddle initialization check:", error);
      this.initializationFailed = true;
      // Don't throw here - allow the app to continue even if initialization fails
      // The user will see appropriate error messages when trying to play
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Resets the initialization flags (useful for testing or forcing re-initialization)
   */
  static resetInitializationFlags(): void {
    this.isInitializing = false;
    this.hasInitialized = false;
    this.initializationFailed = false;
  }

  /**
   * Checks if there are sufficient riddles for gameplay.
   * @returns true if there are enough riddles, false otherwise
   */
  static async hasEnoughRiddles(minimumCount: number = 10): Promise<boolean> {
    try {
      const riddlesSnapshot = await firestore(getApp())
        .collection("riddles")
        .where("classicIndex", ">=", 0)
        .limit(minimumCount)
        .get();

      return riddlesSnapshot.size >= minimumCount;
    } catch (error) {
      console.error("Error checking riddle count:", error);
      return false;
    }
  }
}

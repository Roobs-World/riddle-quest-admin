import {getFirestore, collection, getDocs, query, where, limit} from "@react-native-firebase/firestore";
import {getCallableFunction} from "../utils/firebaseFunctions";
import {logger} from "../utils/logger";
import {captureException, startTransaction} from "../utils/sentry";

/**
 * Service responsible for checking and initializing the riddle database
 * during app startup if it's empty.
 */
export class RiddleInitializationService {
  /** True while initialization flow is currently running. */
  private static isInitializing: boolean = false;
  /** True once initialization has completed successfully at least once. */
  private static hasInitialized: boolean = false;
  /** True when the latest initialization attempt failed. */
  private static initializationFailed: boolean = false;

  /**
   * Gets the current initialization status
   *
   * @returns Snapshot of initialization lifecycle flags.
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
   *
   * @returns Promise resolved after initialization check/attempt is complete.
   */
  static async checkAndInitializeRiddles(): Promise<void> {
    // Prevent duplicate initialization calls
    if (this.isInitializing || this.hasInitialized) {
      logger.debug("Riddle initialization already in progress or completed, skipping...");
      return;
    }

    this.isInitializing = true;
    logger.debug("Checking if riddle database needs initialization...");

    const txn = startTransaction("checkAndInitializeRiddles", "db");
    try {
      // Check if any classic riddles exist in the riddles collection
      const riddlesSnapshot = await getDocs(
        query(collection(getFirestore(), "riddles"), where("classicIndex", ">=", 0), limit(1)),
      );

      if (!riddlesSnapshot.empty) {
        logger.debug("Classic riddles database already has riddles - no initialization needed");
        this.hasInitialized = true;
        this.initializationFailed = false;
        return;
      }

      logger.warn("No classic riddles found in database - initializing...");

      // Call the Firebase function to initialize riddles with timeout
      const initializeRiddleDatabase = getCallableFunction("initializeRiddleDatabase");

      try {
        logger.info("Calling initializeRiddleDatabase Firebase function...");

        // Add timeout handling for Firebase Function calls
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Firebase function timeout after 60 seconds")), 60000);
        });

        let result: unknown;
        try {
          result = await Promise.race([initializeRiddleDatabase({}), timeoutPromise]);
        } finally {
          clearTimeout(timeoutId!);
        }

        logger.info("Riddle initialization result:", (result as {data: unknown})?.data);
      } catch (error) {
        logger.error("❌ Error calling initializeRiddleDatabase:", error);
        captureException(error);

        // Try the alternative function
        logger.info("Trying alternative: generateClassicRiddles...");
        const generateClassicRiddles = getCallableFunction("generateClassicRiddles");

        try {
          logger.info("Calling generateClassicRiddles Firebase function...");

          // Add timeout for fallback function too
          let fallbackTimeoutId: ReturnType<typeof setTimeout>;
          const fallbackTimeoutPromise = new Promise((_, reject) => {
            fallbackTimeoutId = setTimeout(
              () => reject(new Error("Firebase function timeout after 60 seconds")),
              60000,
            );
          });

          let result: unknown;
          try {
            result = await Promise.race([generateClassicRiddles({}), fallbackTimeoutPromise]);
          } finally {
            clearTimeout(fallbackTimeoutId!);
          }

          logger.info("Classic riddles generation result:", (result as {data: unknown})?.data);
        } catch (fallbackError) {
          logger.error("❌ Error calling generateClassicRiddles:", fallbackError);
          captureException(fallbackError);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(
            `Failed to initialize riddle database with both methods. Primary error: ${errorMessage}. Fallback error: ${fallbackErrorMessage}`,
          );
        }
      }

      // Verify classic riddles were created in the riddles collection
      const verifySnapshot = await getDocs(
        query(collection(getFirestore(), "riddles"), where("classicIndex", ">=", 0), limit(1)),
      );

      if (verifySnapshot.empty) {
        throw new Error("Riddle initialization completed but no classic riddles found in database");
      }

      logger.info("Classic riddles database successfully initialized!");
      this.hasInitialized = true;
      this.initializationFailed = false;
    } catch (error) {
      logger.error("❌ Error during riddle initialization check:", error);
      captureException(error);
      this.initializationFailed = true;
      // Don't throw here - allow the app to continue even if initialization fails
      // The user will see appropriate error messages when trying to play
    } finally {
      txn.finish();
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
   * Checks if there are sufficient classic riddles for gameplay.
   *
   * @param minimumCount Minimum required riddle count.
   * @returns true if there are enough riddles, false otherwise
   */
  static async hasEnoughRiddles(minimumCount: number = 10): Promise<boolean> {
    try {
      const riddlesSnapshot = await getDocs(
        query(collection(getFirestore(), "riddles"), where("classicIndex", ">=", 0), limit(minimumCount)),
      );

      return riddlesSnapshot.size >= minimumCount;
    } catch (error) {
      logger.error("Error checking riddle count:", error);
      captureException(error);
      return false;
    }
  }
}

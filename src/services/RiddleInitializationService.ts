import {collection, getDocs, getFirestore, limit, query, where} from "@react-native-firebase/firestore";
import {getCallableFunction} from "../utils/firebaseFunctions";
import {logger} from "../utils/logger";
import {captureException, startTransaction} from "../utils/sentry";
import {getLocale} from "../i18n";
import {getLocalizedRiddleCollection} from "./riddleCollections";

const isExpectedStartupAccessError = (error: unknown): boolean => {
  const code =
    error && typeof error === "object" && "code" in error && typeof (error as {code?: unknown}).code === "string"
      ? ((error as {code: string}).code ?? "").toLowerCase()
      : "";
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : typeof error === "string" ? error : "";
  const text = `${code} ${message}`.toLowerCase();

  return (
    text.includes("unauthenticated") ||
    text.includes("permission-denied") ||
    text.includes("firestore/permission-denied") ||
    text.includes("functions/permission-denied") ||
    text.includes("functions/unauthenticated") ||
    text.includes("appcheck") ||
    text.includes("app-check") ||
    text.includes("app check")
  );
};

const describeStartupAccessError = (error: unknown): Record<string, unknown> => {
  if (error && typeof error === "object") {
    return {
      code: "code" in error ? (error as {code?: unknown}).code : undefined,
      message: error instanceof Error ? error.message : undefined,
    };
  }

  return {
    message: String(error),
  };
};

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
    const locale = getLocale();

    const txn = startTransaction("checkAndInitializeRiddles", "db");
    try {
      // Check if any classic riddles exist in the localized collection for the active locale.
      const riddlesSnapshot = await getDocs(
        query(
          collection(getFirestore(), getLocalizedRiddleCollection(locale)),
          where("classicIndex", ">=", 0),
          limit(1),
        ),
      );

      if (!riddlesSnapshot.empty) {
        logger.debug(`Classic riddles database already has riddles for locale ${locale} - no initialization needed`);
        this.hasInitialized = true;
        this.initializationFailed = false;
        return;
      }

      logger.warn(`No classic riddles found in localized database for locale ${locale} - initializing...`);

      // Call the Firebase function to initialize riddles with timeout
      const initializeRiddleDatabase = getCallableFunction("initializeRiddleDatabase");

      logger.info("Calling initializeRiddleDatabase Firebase function...");

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

      // Verify classic riddles were created in the riddles collection
      const verifySnapshot = await getDocs(
        query(
          collection(getFirestore(), getLocalizedRiddleCollection(locale)),
          where("classicIndex", ">=", 0),
          limit(1),
        ),
      );

      if (verifySnapshot.empty) {
        throw new Error(
          `Riddle initialization completed but no classic riddles found in localized database for locale ${locale}`,
        );
      }

      logger.info(`Classic riddles database successfully initialized for locale ${locale}!`);
      this.hasInitialized = true;
      this.initializationFailed = false;
    } catch (error) {
      if (isExpectedStartupAccessError(error)) {
        logger.warn("Riddle initialization skipped because the backend denied access during startup.", {
          ...describeStartupAccessError(error),
        });
      } else {
        logger.error("❌ Error during riddle initialization check:", error);
        captureException(error);
      }
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
        query(
          collection(getFirestore(), getLocalizedRiddleCollection(getLocale())),
          where("classicIndex", ">=", 0),
          limit(minimumCount),
        ),
      );
      return riddlesSnapshot.size >= minimumCount;
    } catch (error) {
      logger.error("Error checking riddle count:", error);
      captureException(error);
      return false;
    }
  }
}

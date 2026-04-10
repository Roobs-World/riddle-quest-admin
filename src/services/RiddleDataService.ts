import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "@react-native-firebase/firestore";
import {
  FirestoreRiddle,
  FirestoreRiddleSchema,
} from "../validation/firestoreSchemas";
import { ZodError } from "zod";
import { IRiddleDataService } from "./interfaces/IRiddleDataService";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Service for managing riddle data in Firestore
 */
export class RiddleDataService implements IRiddleDataService {
  private static readonly RIDDLES_COLLECTION = "riddles";

  /**
   * Fetches the current daily riddle.
   */
  async fetchDailyRiddle(): Promise<FirestoreRiddle | null> {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      const snapshot = await getDocs(
        query(
          collection(getFirestore(), RiddleDataService.RIDDLES_COLLECTION),
          where("category", "==", "daily"),
          where("date", "==", today),
          limit(1)
        )
      );

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();
        const validatedRiddle = FirestoreRiddleSchema.parse({
          ...riddleData,
          riddleId: snapshot.docs[0].id,
        });

        logger.debug("Daily riddle found for date:", today);
        return validatedRiddle;
      } else {
        logger.debug("No daily riddle found for date:", today);
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Daily riddle validation failed:", error.issues);
        captureException(error);
        throw new Error("Invalid daily riddle data structure");
      }
      logger.error("Error fetching daily riddle:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Fetches a specific classic mode riddle by its level.
   */
  async fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null> {
    logger.debug(`Fetching classic riddle for level ${level} from Firestore`);

    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), RiddleDataService.RIDDLES_COLLECTION), where("classicIndex", "==", level), limit(1))
      );

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();

        if (riddleData && riddleData.answer !== undefined) {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          });

          logger.debug(`Classic riddle found for level: ${level}`);
          return validatedRiddle;
        } else {
          logger.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        logger.debug(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`
        );
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Classic riddle validation failed:", error.issues);
        captureException(error);
        throw new Error("Invalid classic riddle data structure");
      }
      logger.error(`Error fetching classic riddle for level ${level}:`, error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Fetches a specific tutorial mode riddle by its level.
   */
  async fetchTutorialRiddle(level: number): Promise<FirestoreRiddle | null> {
    logger.debug(`Fetching tutorial riddle for level ${level} from Firestore`);

    try {
      const snapshot = await getDocs(
        query(
          collection(getFirestore(), RiddleDataService.RIDDLES_COLLECTION),
          where("category", "==", "tutorial"),
          where("tutorialIndex", "==", level),
          limit(1)
        )
      );

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();

        if (riddleData && riddleData.answer !== undefined) {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          });

          logger.debug(`Tutorial riddle found for level: ${level}`);
          return validatedRiddle;
        } else {
          logger.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        logger.debug(`No tutorial riddle found for level: ${level}`);
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Tutorial riddle validation failed:", error.issues);
        captureException(error);
        throw new Error("Invalid tutorial riddle data structure");
      }
      logger.error("Error fetching tutorial riddle:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Fetches a riddle by its ID.
   */
  async fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null> {
    if (!riddleId || !riddleId.trim()) {
      throw new Error("Riddle ID is required");
    }

    try {
      const riddleDoc = await getDoc(doc(getFirestore(), RiddleDataService.RIDDLES_COLLECTION, riddleId));

      if (!riddleDoc.exists()) {
        logger.debug("No riddle found with ID:", riddleId);
        return null;
      }

      const riddleData = riddleDoc.data();
      if (!riddleData) {
        logger.warn(
          "Riddle document exists but has no data for ID:",
          riddleId
        );
        return null;
      }

      const validatedRiddle = FirestoreRiddleSchema.parse({
        ...riddleData,
        riddleId: riddleDoc.id,
      });

      logger.debug("Riddle loaded successfully for ID:", riddleId);
      return validatedRiddle;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Riddle validation failed:", error.issues);
        captureException(error);
        throw new Error("Invalid riddle data structure");
      }
      logger.error("Error fetching riddle by ID:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Gets the count of available classic riddles.
   */
  async getClassicRiddleCount(): Promise<number> {
    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), RiddleDataService.RIDDLES_COLLECTION), where("category", "==", "classic"))
      );

      return snapshot.size;
    } catch (error) {
      logger.error("Error getting classic riddle count:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Gets the count of available tutorial riddles.
   */
  async getTutorialRiddleCount(): Promise<number> {
    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), RiddleDataService.RIDDLES_COLLECTION), where("category", "==", "tutorial"))
      );

      return snapshot.size;
    } catch (error) {
      logger.error("Error getting tutorial riddle count:", error);
      captureException(error);
      throw error;
    }
  }
}


import {getFirestore, collection, doc, getDoc, getDocs, query, where, limit} from "@react-native-firebase/firestore";
import {FirestoreRiddle, FirestoreRiddleSchema} from "../validation/firestoreSchemas";
import {ZodError} from "zod";
import {getLocale, t} from "../i18n";
import {IRiddleDataService} from "./interfaces/IRiddleDataService";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {graphemeLength} from "@qwordly/core/game";
import {CURRENT_DAILY_RIDDLE_DOC_ID, getLocalizedRiddleCollection} from "./riddleCollections";

const snapshotExists = (snapshot: unknown): boolean => {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const typedSnapshot = snapshot as {exists?: boolean | (() => boolean)};
  if (typeof typedSnapshot.exists === "function") {
    return typedSnapshot.exists();
  }

  return Boolean(typedSnapshot.exists);
};

/**
 * Service for managing riddle data in Firestore
 */
export class RiddleDataService implements IRiddleDataService {
  /**
   * Fetches the current daily riddle.
   *
   * @returns Today's daily riddle, or `null` when unavailable.
   */
  async fetchDailyRiddle(): Promise<FirestoreRiddle | null> {
    const locale = getLocale();
    try {
      const localizedSnapshot = await getDocs(
        query(
          collection(getFirestore(), getLocalizedRiddleCollection(locale)),
          where("riddleId", "==", CURRENT_DAILY_RIDDLE_DOC_ID),
          limit(1),
        ),
      );
      const currentSnapshot = localizedSnapshot;

      if (!currentSnapshot.empty) {
        const riddleData = currentSnapshot.docs[0].data();
        const validatedRiddle = FirestoreRiddleSchema.parse({
          ...riddleData,
          riddleId: riddleData?.riddleId ?? currentSnapshot.docs[0].id,
          locale: riddleData?.locale ?? locale,
          canonicalKey: riddleData?.canonicalKey ?? `daily:${riddleData?.challengeKey ?? currentSnapshot.docs[0].id}`,
          challengeKey: riddleData?.challengeKey ?? currentSnapshot.docs[0].id,
          answerLength: graphemeLength(riddleData?.answer ?? "", riddleData?.locale ?? locale),
        });

        logger.debug("Daily riddle found");
        return validatedRiddle;
      } else {
        logger.debug("No daily riddle found");
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Daily riddle validation failed:", error.issues);
        captureException(error);
        throw new Error(t("ErrorMessages.INVALID_DATA_FORMAT"));
      }
      logger.error("Error fetching daily riddle:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Fetches a specific classic mode riddle by its level.
   *
   * @param level One-based classic level index.
   * @returns Matching classic riddle, or `null` when missing.
   */
  async fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null> {
    const locale = getLocale();
    logger.debug(`Fetching classic riddle for level ${level} from Firestore`);

    try {
      const localizedSnapshot = await getDocs(
        query(
          collection(getFirestore(), getLocalizedRiddleCollection(locale)),
          where("classicIndex", "==", level),
          limit(1),
        ),
      );
      const snapshot = localizedSnapshot;

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();

        if (riddleData && riddleData.answer !== undefined) {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            locale: riddleData.locale ?? locale,
            canonicalKey: riddleData.canonicalKey ?? `classic:${level}`,
            answerLength: graphemeLength(riddleData.answer, riddleData.locale ?? locale),
          });

          logger.debug(`Classic riddle found for level: ${level}`);
          return validatedRiddle;
        } else {
          logger.error(`Riddle data or answer missing for level: ${level}. Data:`, riddleData);
          return null;
        }
      } else {
        logger.debug(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`,
        );
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Classic riddle validation failed:", error.issues);
        captureException(error);
        throw new Error(t("ErrorMessages.INVALID_DATA_FORMAT"));
      }
      logger.error(`Error fetching classic riddle for level ${level}:`, error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Fetches a riddle by its ID.
   *
   * @param riddleId Firestore document id for the riddle.
   * @returns Matching riddle, or `null` if not found.
   */
  async fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null> {
    if (!riddleId || !riddleId.trim()) {
      throw new Error(t("ErrorMessages.RIDDLE_ID_REQUIRED"));
    }

    try {
      const locale = getLocale();
      const riddleDoc = await getDoc(doc(getFirestore(), getLocalizedRiddleCollection(locale), riddleId));

      if (!snapshotExists(riddleDoc)) {
        logger.debug("No riddle found with ID:", riddleId);
        return null;
      }

      const riddleData = riddleDoc.data();
      if (!riddleData) {
        logger.warn("Riddle document exists but has no data for ID:", riddleId);
        return null;
      }

      const validatedRiddle = FirestoreRiddleSchema.parse({
        ...riddleData,
        riddleId: riddleDoc.id,
        locale: riddleData.locale ?? locale,
      });

      logger.debug("Riddle loaded successfully for ID:", riddleId);
      return validatedRiddle;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error("Riddle validation failed:", error.issues);
        captureException(error);
        throw new Error(t("ErrorMessages.INVALID_DATA_FORMAT"));
      }
      logger.error("Error fetching riddle by ID:", error);
      captureException(error);
      throw error;
    }
  }

  /**
   * Gets the count of available classic riddles.
   *
   * @returns Number of classic riddles currently available.
   */
  async getClassicRiddleCount(): Promise<number> {
    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), getLocalizedRiddleCollection(getLocale())), where("classicIndex", ">=", 0)),
      );
      return snapshot.size;
    } catch (error) {
      logger.error("Error getting classic riddle count:", error);
      captureException(error);
      throw error;
    }
  }
}

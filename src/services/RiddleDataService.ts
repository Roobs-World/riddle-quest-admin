import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import {
  FirestoreRiddle,
  FirestoreRiddleSchema,
} from "../validation/firestoreSchemas";
import { ZodError } from "zod";
import { IRiddleDataService } from "./interfaces/IRiddleDataService";

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

      const snapshot = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .where("category", "==", "daily")
        .where("date", "==", today)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();
        const validatedRiddle = FirestoreRiddleSchema.parse({
          ...riddleData,
          riddleId: snapshot.docs[0].id,
        });

        console.log("Daily riddle found for date:", today);
        return validatedRiddle;
      } else {
        console.log("No daily riddle found for date:", today);
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Daily riddle validation failed:", error.issues);
        throw new Error("Invalid daily riddle data structure");
      }
      console.error("Error fetching daily riddle:", error);
      throw error;
    }
  }

  /**
   * Fetches a specific classic mode riddle by its level.
   */
  async fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null> {
    console.log(`Fetching classic riddle for level ${level} from Firestore`);

    try {
      const snapshot = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .where("classicIndex", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();

        if (riddleData && riddleData.answer !== undefined) {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          });

          console.log(`Classic riddle found for level: ${level}`);
          return validatedRiddle;
        } else {
          console.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        console.log(
          `No classic riddle found for level: ${level}. Riddles will be generated automatically on the server when needed.`
        );
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Classic riddle validation failed:", error.issues);
        throw new Error("Invalid classic riddle data structure");
      }
      console.error(`Error fetching classic riddle for level ${level}:`, error);
      throw error;
    }
  }

  /**
   * Fetches a specific tutorial mode riddle by its level.
   */
  async fetchTutorialRiddle(level: number): Promise<FirestoreRiddle | null> {
    console.log(`Fetching tutorial riddle for level ${level} from Firestore`);

    try {
      const snapshot = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .where("category", "==", "tutorial")
        .where("tutorialIndex", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const riddleData = snapshot.docs[0].data();

        if (riddleData && riddleData.answer !== undefined) {
          const validatedRiddle = FirestoreRiddleSchema.parse({
            ...riddleData,
            riddleId: snapshot.docs[0].id,
            answerLength: riddleData.answer.length,
          });

          console.log(`Tutorial riddle found for level: ${level}`);
          return validatedRiddle;
        } else {
          console.error(
            `Riddle data or answer missing for level: ${level}. Data:`,
            riddleData
          );
          return null;
        }
      } else {
        console.log(`No tutorial riddle found for level: ${level}`);
        return null;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Tutorial riddle validation failed:", error.issues);
        throw new Error("Invalid tutorial riddle data structure");
      }
      console.error("Error fetching tutorial riddle:", error);
      throw error;
    }
  }

  /**
   * Fetches a riddle by its ID.
   */
  async fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null> {
    if (!riddleId) {
      throw new Error("Riddle ID is required");
    }

    try {
      const riddleDoc = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .doc(riddleId)
        .get();

      if (!riddleDoc.exists()) {
        console.log("No riddle found with ID:", riddleId);
        return null;
      }

      const riddleData = riddleDoc.data();
      if (!riddleData) {
        console.warn(
          "Riddle document exists but has no data for ID:",
          riddleId
        );
        return null;
      }

      const validatedRiddle = FirestoreRiddleSchema.parse({
        ...riddleData,
        riddleId: riddleDoc.id,
      });

      console.log("Riddle loaded successfully for ID:", riddleId);
      return validatedRiddle;
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Riddle validation failed:", error.issues);
        throw new Error("Invalid riddle data structure");
      }
      console.error("Error fetching riddle by ID:", error);
      throw error;
    }
  }

  /**
   * Gets the count of available classic riddles.
   */
  async getClassicRiddleCount(): Promise<number> {
    try {
      const snapshot = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .where("category", "==", "classic")
        .get();

      return snapshot.size;
    } catch (error) {
      console.error("Error getting classic riddle count:", error);
      throw error;
    }
  }

  /**
   * Gets the count of available tutorial riddles.
   */
  async getTutorialRiddleCount(): Promise<number> {
    try {
      const snapshot = await firestore(getApp())
        .collection(RiddleDataService.RIDDLES_COLLECTION)
        .where("category", "==", "tutorial")
        .get();

      return snapshot.size;
    } catch (error) {
      console.error("Error getting tutorial riddle count:", error);
      throw error;
    }
  }
}

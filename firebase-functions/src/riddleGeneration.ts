import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {generateAndAppendRiddles} from "./generateRiddles";
import * as admin from "firebase-admin";

/**
 * Callable function to trigger the generation and appending of new Classic Mode riddles.
 * Can be called by the client when the next classic riddle is not found.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateClassicRiddles = onCall(
  {enforceAppCheck: false},
  async (): Promise<{success: boolean; message: string}> => {
    console.log("Client requested Classic Mode riddle generation.");

    try {
      // Set the environment variable from functions config as fallback
      if (!process.env.OPEN_AI_KEY) {
        const config = functions.config();
        if (config.openai && config.openai.api_key) {
          process.env.OPEN_AI_KEY = config.openai.api_key;
          console.log("Set OPEN_AI_KEY from functions config");
        }
      }

      await generateAndAppendRiddles(5);
      console.log("Classic Mode riddles generated and stored in Firestore.");
      return {
        success: true,
        message: "New Classic Mode riddles generated and added to Firestore.",
      };
    } catch (error) {
      console.error("Error generating Classic Mode riddles:", error);
      throw new functions.https.HttpsError("internal", "Failed to generate new classic riddles.", error);
    }
  },
);

/**
 * Callable function to initialize the riddle database with a larger batch of riddles.
 * This is intended for initial setup when no riddles exist in the database.
 * @return A promise resolving to an object indicating success or failure.
 */
export const initializeRiddleDatabase = onCall(
  {enforceAppCheck: false},
  async (): Promise<{success: boolean; message: string; riddlesGenerated: number}> => {
    console.log("Client requested riddle database initialization.");

    try {
      // Set the environment variable from functions config as fallback
      if (!process.env.OPEN_AI_KEY) {
        const config = functions.config();
        if (config.openai && config.openai.api_key) {
          process.env.OPEN_AI_KEY = config.openai.api_key;
          console.log("Set OPEN_AI_KEY from functions config");
        }
      }

      // Check if any classic riddles already exist
      const existingRiddlesSnapshot = await admin
        .firestore()
        .collection("riddles")
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();

      if (!existingRiddlesSnapshot.empty) {
        console.log("Riddle database already initialized - classic riddles exist.");
        return {
          success: true,
          message: "Riddle database already initialized.",
          riddlesGenerated: 0,
        };
      }

      // Generate initial batch of riddles for new database
      const initialRiddleCount = 20;
      await generateAndAppendRiddles(initialRiddleCount);
      console.log(`Riddle database initialized with ${initialRiddleCount} classic riddles.`);

      return {
        success: true,
        message: `Riddle database initialized with ${initialRiddleCount} classic riddles.`,
        riddlesGenerated: initialRiddleCount,
      };
    } catch (error) {
      console.error("Error initializing riddle database:", error);
      throw new functions.https.HttpsError("internal", "Failed to initialize riddle database.", error);
    }
  },
);

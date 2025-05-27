import * as functions from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {generateAndAppendRiddles} from "./generateRiddles";

/**
 * Callable function to trigger the generation and appending of new Classic Mode riddles.
 * Can be called by the client when the next classic riddle is not found.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateClassicRiddles = onCall(async (): Promise<{success: boolean; message: string}> => {
  console.log("Client requested Classic Mode riddle generation.");

  try {
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
});

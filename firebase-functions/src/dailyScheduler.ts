import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateUniqueRiddle} from "./openaiService";
import * as functions from "firebase-functions";

// Export the handler function for testing first
export const scheduledTaskHandler = async (_context: ScheduledEvent) => {
  console.log("Daily challenge scheduler started.");

  try {
    const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
    console.log("dailyChallengeRef created.");
    const dailyChallengeDoc = await dailyChallengeRef.get();
    console.log("dailyChallengeDoc fetched.", dailyChallengeDoc.exists);

    const currentDate = new Date();
    const todayDateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

    const existingChallengeData = dailyChallengeDoc.data();
    const existingChallengeDate = existingChallengeData?.date;

    let isNewRiddleNeeded = false;

    if (!dailyChallengeDoc.exists) {
      functions.logger.warn("No daily challenge document found. Proceeding to generate a new one.");
      console.log("No daily challenge document found, proceeding to generate.");
      isNewRiddleNeeded = true;
    } else if (existingChallengeDate !== todayDateString) {
      functions.logger.warn(
        `Daily challenge date mismatch. Expected: ${todayDateString}, Found: ${existingChallengeDate}. Proceeding to generate a new one.`,
      );
      console.log("Existing challenge is not for today, proceeding to generate a new one.");
      isNewRiddleNeeded = true;
    } else {
      functions.logger.info(`Daily challenge already exists for ${todayDateString}. Skipping generation.`);
      console.log("Existing challenge is for today, skipping generation.");
    }

    if (isNewRiddleNeeded) {
      // Generate a new unique riddle using OpenAI
      let riddleText, answerText;
      try {
        console.log(`Generating fresh riddle using OpenAI for ${todayDateString}...`);
        const generatedRiddle = await generateUniqueRiddle();
        if (generatedRiddle === null) {
          functions.logger.error("generateUniqueRiddle returned null.");
          return; // Exit if riddle generation failed
        }
        [riddleText, answerText] = generatedRiddle;
        console.log(`Successfully generated daily riddle: "${riddleText}" → "${answerText}"`);
      } catch (openaiError) {
        functions.logger.error("Failed to generate riddle from OpenAI:", openaiError);
        // Optionally handle error - perhaps retry or use a fallback riddle
        return;
      }

      // Prepare the data to be stored
      const newDailyChallengeData = {
        riddleId: `daily_${todayDateString}`,
        text: riddleText,
        answer: answerText,
        date: todayDateString,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: "openai",
        // Add other fields as needed
      };

      // Set the new daily challenge document
      try {
        console.log("Attempting to set daily challenge document.");
        await dailyChallengeRef.set(newDailyChallengeData);
        console.log(`Daily challenge set for ${todayDateString}: "${riddleText}"`);
      } catch (setError) {
        functions.logger.error("Failed to set daily challenge document:", setError);
        // Optionally handle error
        return;
      }
    }

    console.log("Daily challenge scheduler finished.");
  } catch (error) {
    functions.logger.error("Daily challenge scheduler failed:", error);
  }
};

/**
 * Scheduled function to set the daily challenge.
 * Runs once every day at 00:00 UTC.
 * Creates exactly ONE daily challenge per day based on the current date.
 * Uses OpenAI to generate a fresh riddle for each day.
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs daily at 00:00 UTC
    timeZone: "UTC",
    secrets: ["OPENAI_API_KEY"],
  },
  scheduledTaskHandler, // Use the exported handler here
);

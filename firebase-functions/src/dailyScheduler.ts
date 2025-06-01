import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {ScheduledEvent} from "firebase-functions/v2/scheduler";
import {generateUniqueRiddle} from "./openaiService";

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
  async (_context: ScheduledEvent) => {
    console.log("Daily challenge scheduler started.");

    try {
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      console.log(`Generating daily challenge for date: ${dateString}`);

      // 1. Check if a daily challenge already exists for today
      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      const existingChallenge = await dailyChallengeRef.get();

      if (existingChallenge.exists) {
        const existingData = existingChallenge.data();
        if (existingData && existingData.date === dateString) {
          console.log(`Daily challenge already exists for ${dateString}. Skipping generation.`);
          return;
        }
      }

      // 2. Check for required environment variables
      const openAIKey = process.env.OPENAI_API_KEY;
      if (!openAIKey) {
        console.error("OPENAI_API_KEY environment variable is required for daily challenge generation");
        return;
      }

      // 3. Generate a fresh riddle using OpenAI specifically for today's challenge
      console.log(`Generating fresh riddle using OpenAI for ${dateString}...`);
      const generatedRiddle = await generateUniqueRiddle();

      if (!generatedRiddle) {
        console.error("Failed to generate riddle using OpenAI for daily challenge");
        return;
      }

      const [riddleText, riddleAnswer] = generatedRiddle;
      console.log(`Successfully generated daily riddle: "${riddleText}" → "${riddleAnswer}"`);

      // 4. Create the single daily challenge for today with the fresh riddle
      const dailyChallenge = {
        riddleId: `daily_${dateString}`, // Unique ID for this daily challenge
        text: riddleText,
        answer: riddleAnswer,
        date: dateString, // Track which date this challenge is for
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: "openai", // Track that this was freshly generated
      };

      // 5. Store the daily challenge (replaces any existing challenge)
      await dailyChallengeRef.set(dailyChallenge);

      console.log(`Daily challenge set for ${dateString}: "${riddleText}"`);
      console.log("Daily challenge scheduler finished successfully.");
    } catch (error) {
      console.error("Error running daily challenge scheduler:", error);
    }
  },
);

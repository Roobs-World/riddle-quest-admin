import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";

/**
 * Scheduled function to set the daily challenge.
 * Runs once every day at a specific time (e.g., midnight UTC).
 */
export const dailyChallengeScheduler = onSchedule(
  {
    schedule: "0 0 * * *", // Runs daily at 00:00 UTC
    timeZone: "UTC", // Users can choose any timeZone - typically choose ones that makes sense for your user
  },
  async (_context: any) => {
    console.log("Daily challenge scheduler started.");

    try {
      // 1. Select or generate the daily riddle.
      // For simplicity, let's fetch a random riddle from the 'riddles' collection.
      // In a real application, you'd have more sophisticated logic here.
      const riddlesRef = admin.firestore().collection("riddles");
      const snapshot = await riddlesRef.get();

      if (snapshot.empty) {
        console.warn("No riddles found to set as daily challenge.");
        return;
      }

      // Select a random riddle from the snapshot
      const randomIndex = Math.floor(Math.random() * snapshot.size);
      const dailyRiddleDoc = snapshot.docs[randomIndex];
      const dailyRiddleData = dailyRiddleDoc.data();

      if (!dailyRiddleData || !dailyRiddleData.answer || !dailyRiddleData.text) {
        console.error("Selected daily riddle is missing data:", dailyRiddleDoc.id);
        return;
      }

      const dailyRiddleId = dailyRiddleDoc.id;
      const dailyRiddle = {
        riddleId: dailyRiddleId,
        text: dailyRiddleData.text,
        answer: dailyRiddleData.answer,
        // Include other relevant fields if needed by the client
      };

      // 2. Store the daily riddle information in Firestore for clients to access.
      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      await dailyChallengeRef.set(dailyRiddle);

      console.log(`Daily challenge set to riddle: ${dailyRiddleId}`);

      console.log("Daily challenge scheduler finished.");
    } catch (error) {
      console.error("Error running daily challenge scheduler:", error);
      // Depending on your error handling strategy, you might want to log to a dedicated error collection
    }
  },
);

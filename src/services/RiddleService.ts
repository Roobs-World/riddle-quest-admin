import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export const RiddleService = {
  /**
   * Fetches the current daily riddle for the authenticated user.
   * It checks the user's progress for the day and returns the next uncompleted riddle.
   * @returns A Promise resolving to the daily riddle data, or null if no riddle is available or all daily riddles are completed.
   */
  async fetchDailyRiddle() {
    // Implement logic to fetch the next daily riddle from Firestore based on user's progress
    console.log("Fetching daily riddle from Firestore");
    const userId = auth().currentUser?.uid;
    if (!userId) {
      console.error("No authenticated user found.");
      return null; // Or throw an error, depending on desired behavior
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      // Fetch the daily challenge document for today
      const dailyChallengeDoc = await firestore()
        .collection("dailyChallenge")
        .doc(today)
        .get();

      if (!dailyChallengeDoc.exists()) {
        console.log(`No daily challenge found for date: ${today}`);
        return null;
      }

      const dailyChallengeData = dailyChallengeDoc.data();
      const riddleIds = dailyChallengeData?.riddleIds as string[] | undefined;

      if (!riddleIds || riddleIds.length === 0) {
        console.log(
          `Daily challenge found for ${today}, but no riddleIds array.`
        );
        return null;
      }

      // Fetch user's progress for today's daily challenge
      const userAttemptsDoc = await firestore()
        .collection("userDailyChallengeAttempts")
        .doc(`${userId}_${today}`)
        .get();

      const userAttemptsData = userAttemptsDoc.data();
      const completedIndex = (userAttemptsData?.completedIndex as number) || 0;

      // Check if there is a next riddle to fetch
      if (completedIndex < riddleIds.length) {
        const nextRiddleId = riddleIds[completedIndex];

        // Fetch the actual riddle document
        const riddleDoc = await firestore()
          .collection("riddles")
          .doc(nextRiddleId)
          .get();

        if (riddleDoc.exists()) {
          console.log(
            `Fetched daily riddle ID: ${nextRiddleId} at index ${completedIndex}`
          );
          return { ...riddleDoc.data(), riddleId: riddleDoc.id };
        } else {
          console.log(`Riddle document not found for ID: ${nextRiddleId}`);
          return null;
        }
      } else {
        console.log(`User has completed all daily riddles for date: ${today}`);
        return null; // All riddles for today are completed
      }
    } catch (error) {
      console.error("Error fetching daily riddle:", error);
      throw error;
    }
  },

  /**
   * Fetches a specific classic mode riddle by its level.
   * @param {number} level - The level of the classic riddle to fetch.
   * @returns A Promise resolving to the classic riddle data, or null if not found.
   */
  async fetchClassicRiddle(level: number) {
    // Implement logic to fetch a specific classic riddle by level from Firestore
    console.log(`Fetching classic riddle for level ${level} from Firestore`);
    try {
      const snapshot = await firestore()
        .collection("riddles")
        .where("mode", "==", "classic")
        .where("level", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      } else {
        console.log(`No classic riddle found for level: ${level}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching classic riddle:", error);
      throw error;
    }
  },

  /**
   * Fetches a specific tutorial mode riddle by its level.
   * @param {number} level - The level of the tutorial riddle to fetch.
   * @returns A Promise resolving to the tutorial riddle data, or null if not found.
   */
  async fetchTutorialRiddle(level: number) {
    // Implement logic to fetch a specific tutorial riddle by level from Firestore
    console.log(`Fetching tutorial riddle for level ${level} from Firestore`);
    try {
      const snapshot = await firestore()
        .collection("riddles")
        .where("mode", "==", "tutorial")
        .where("level", "==", level)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      } else {
        console.log(`No tutorial riddle found for level: ${level}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching tutorial riddle:", error);
      throw error;
    }
  },
};

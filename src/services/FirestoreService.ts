import firestore from "@react-native-firebase/firestore";
import { Player } from "../types/Player";

const usersCollection = firestore().collection("users");

export const saveUserProgressToFirestore = async (
  userId: string,
  progress: Pick<
    Player,
    "dailyChallengeIndex" | "tutorialIndex" | "classicIndex"
  >
): Promise<void> => {
  if (!userId) {
    console.warn("Attempted to save progress to Firestore without a userId.");
    return;
  }
  try {
    await usersCollection.doc(userId).set(
      {
        progress: {
          dailyChallengeIndex: progress.dailyChallengeIndex,
          tutorialIndex: progress.tutorialIndex,
          classicIndex: progress.classicIndex,
          // Include other progress fields as added to Player
        },
      },
      { merge: true }
    ); // Use merge: true to avoid overwriting other user data
    console.log(
      "Player progress saved to Firestore successfully for user:",
      userId
    );
  } catch (error) {
    console.error("Error saving player progress to Firestore:", error);
    throw error; // Rethrow the error for calling code to handle
  }
};

export const loadUserProgressFromFirestore = async (
  userId: string
): Promise<Player | null> => {
  if (!userId) {
    console.warn("Attempted to load progress from Firestore without a userId.");
    return null;
  }
  try {
    const userDoc = await usersCollection.doc(userId).get();
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData) {
        // Map Firestore data back to the desired structure (full Player type)
        return {
          userId: userId,
          dailyChallengeIndex: userData.progress?.dailyChallengeIndex || 0,
          tutorialIndex: userData.progress?.tutorialIndex || 0,
          classicIndex: userData.progress?.classicIndex || 0,
          coins: userData.coins || 0,
          username: userData.username || "",
          email: userData.email || "",
          registeredAt: userData.registeredAt
            ? new Date(userData.registeredAt.toDate())
            : null,
          lastLogin: userData.lastLogin
            ? new Date(userData.lastLogin.toDate())
            : null,
        } as Player;
      }
    }
    console.log("No player progress found in Firestore for user:", userId);
    return null; // Return null if user doc or progress data doesn't exist
  } catch (error) {
    console.error("Error loading player progress from Firestore:", error);
    throw error; // Rethrow the error
  }
};

import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";

interface RiddleData {
  text: string;
  answer: string;
  classicIndex: number;
  difficulty: string;
  category?: string;
}

/**
 * Creates missing riddles that were deleted by tests.
 * This function adds essential riddles with classicIndex 0, 1, 2 that new users need.
 */
export async function createMissingRiddles(): Promise<void> {
  try {
    console.log("🔄 Creating missing riddles...");

    const riddlesToCreate: RiddleData[] = [
      {
        text: "I flow but never move, I have banks but no money. What am I?",
        answer: "river",
        classicIndex: 0,
        difficulty: "easy",
      },
      {
        text: "I have keys but no locks, space but no room. You can enter but can't go outside. What am I?",
        answer: "keyboard",
        classicIndex: 1,
        difficulty: "easy",
      },
      {
        text: "I get smaller the more I am used. What am I?",
        answer: "candle",
        classicIndex: 2,
        difficulty: "easy",
      },
    ];

    const db = firestore(getApp());
    const riddlesCollection = db.collection("riddles");

    for (const riddleData of riddlesToCreate) {
      // Check if a riddle with this classicIndex already exists
      const existingQuery = await riddlesCollection
        .where("classicIndex", "==", riddleData.classicIndex)
        .get();

      if (existingQuery.empty) {
        // Create new riddle document
        const docRef = await riddlesCollection.add({
          text: riddleData.text,
          answer: riddleData.answer,
          classicIndex: riddleData.classicIndex,
          difficulty: riddleData.difficulty,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `✅ Created riddle with classicIndex ${riddleData.classicIndex}, document ID: ${docRef.id}`
        );
      } else {
        console.log(
          `⚠️ Riddle with classicIndex ${riddleData.classicIndex} already exists`
        );
      }
    }

    console.log("✅ Missing riddles creation completed!");
  } catch (error) {
    console.error("❌ Error creating missing riddles:", error);
    throw error;
  }
}

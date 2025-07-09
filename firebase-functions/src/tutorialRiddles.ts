import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import {getUser} from "./firestoreService";
import {RiddleCollections, TutorialRiddle} from "./validation/firestoreSchemas";

/**
 * Gets a tutorial riddle by its index.
 * @param tutorialIndex - The index of the tutorial riddle to retrieve.
 * @returns The tutorial riddle or undefined if not found.
 */
export async function getTutorialRiddle(tutorialIndex: number): Promise<TutorialRiddle | undefined> {
  try {
    const riddleSnapshot = await admin
      .firestore()
      .collection(RiddleCollections.TUTORIAL_RIDDLES)
      .where("tutorialIndex", "==", tutorialIndex)
      .limit(1)
      .get();

    if (riddleSnapshot.empty) {
      functions.logger.warn(`Tutorial riddle not found for index ${tutorialIndex}`);
      return undefined;
    }

    const riddleDoc = riddleSnapshot.docs[0];
    return riddleDoc.data() as TutorialRiddle;
  } catch (error) {
    functions.logger.error(`Error getting tutorial riddle at index ${tutorialIndex}:`, error);
    throw new Error(`Failed to get tutorial riddle at index ${tutorialIndex}`);
  }
}

/**
 * Gets the current tutorial riddle for the authenticated user.
 * Returns the riddle text without the answer for security.
 */
export const getCurrentTutorialRiddle = onCall(
  {},
  async (
    request: CallableRequest<unknown>,
  ): Promise<{
    riddle?: {
      riddleId: string;
      text: string;
      tutorialIndex: number;
      difficulty?: string;
    };
    currentIndex?: number;
    totalTutorialRiddles?: number;
    isCompleted?: boolean;
    error?: string;
  }> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to get tutorial riddle.");
      }

      const userId = request.auth.uid;
      const user = await getUser(userId);

      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      const currentTutorialIndex = user.progress?.tutorialIndex || 0;

      // Get the tutorial riddle at the current index
      const tutorialRiddle = await getTutorialRiddle(currentTutorialIndex);

      if (!tutorialRiddle) {
        // Check if tutorial is completed by counting total tutorial riddles
        const totalRiddlesSnapshot = await admin
          .firestore()
          .collection(RiddleCollections.TUTORIAL_RIDDLES)
          .count()
          .get();

        const totalTutorialRiddles = totalRiddlesSnapshot.data().count;

        if (currentTutorialIndex >= totalTutorialRiddles) {
          return {
            currentIndex: currentTutorialIndex,
            totalTutorialRiddles,
            isCompleted: true,
          };
        }

        return {
          error: `Tutorial riddle not found for index ${currentTutorialIndex}`,
        };
      }

      // Get total count of tutorial riddles
      const totalRiddlesSnapshot = await admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).count().get();

      const totalTutorialRiddles = totalRiddlesSnapshot.data().count;

      return {
        riddle: {
          riddleId: tutorialRiddle.riddleId,
          text: tutorialRiddle.text,
          tutorialIndex: tutorialRiddle.tutorialIndex,
          difficulty: tutorialRiddle.difficulty,
        },
        currentIndex: currentTutorialIndex,
        totalTutorialRiddles,
        isCompleted: false,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error getting current tutorial riddle:", error);
      throw new HttpsError("internal", "An error occurred while fetching the tutorial riddle.");
    }
  },
);

/**
 * Advances the user to the next tutorial riddle.
 * Called when a user completes a tutorial riddle or skips it.
 */
export const advanceTutorialProgress = onCall(
  {},
  async (
    request: CallableRequest<unknown>,
  ): Promise<{
    newTutorialIndex: number;
    isCompleted: boolean;
    message: string;
  }> => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to advance tutorial progress.");
      }

      const userId = request.auth.uid;
      const user = await getUser(userId);

      if (!user) {
        throw new HttpsError("not-found", "User data not found.");
      }

      const currentTutorialIndex = user.progress?.tutorialIndex || 0;
      const newTutorialIndex = currentTutorialIndex + 1;

      // Check if tutorial is completed
      const totalRiddlesSnapshot = await admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).count().get();

      const totalTutorialRiddles = totalRiddlesSnapshot.data().count;
      const isCompleted = newTutorialIndex >= totalTutorialRiddles;

      // Update user progress
      const userRef = admin.firestore().collection("users").doc(userId);
      await userRef.update({
        "progress.tutorialIndex": newTutorialIndex,
      });

      functions.logger.info(`User ${userId} advanced to tutorial riddle ${newTutorialIndex}`);

      return {
        newTutorialIndex,
        isCompleted,
        message: isCompleted
          ? "Tutorial completed! All tutorial riddles finished."
          : `Advanced to tutorial riddle ${newTutorialIndex + 1}.`,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      functions.logger.error("Error advancing tutorial progress:", error);
      throw new HttpsError("internal", "An error occurred while advancing tutorial progress.");
    }
  },
);

/**
 * Gets the tutorial riddle answer for validation.
 * This function is used by the game logic to validate user guesses.
 * @param riddleId - The ID of the tutorial riddle.
 * @returns The tutorial riddle with the answer.
 */
export async function getTutorialRiddleWithAnswer(riddleId: string): Promise<TutorialRiddle | undefined> {
  try {
    const riddleDoc = await admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).doc(riddleId).get();

    if (!riddleDoc.exists) {
      functions.logger.warn(`Tutorial riddle not found for ID ${riddleId}`);
      return undefined;
    }

    return riddleDoc.data() as TutorialRiddle;
  } catch (error) {
    functions.logger.error(`Error getting tutorial riddle with answer for ID ${riddleId}:`, error);
    throw new Error(`Failed to get tutorial riddle with answer for ID ${riddleId}`);
  }
}

/**
 * Initializes tutorial riddles if the collection is empty.
 * This function creates a basic set of tutorial riddles for new users.
 */
export async function initializeTutorialRiddlesIfEmpty(): Promise<void> {
  try {
    const existingRiddlesSnapshot = await admin
      .firestore()
      .collection(RiddleCollections.TUTORIAL_RIDDLES)
      .limit(1)
      .get();

    if (!existingRiddlesSnapshot.empty) {
      console.log("Tutorial riddles already exist, skipping initialization.");
      return;
    }

    // Create some basic tutorial riddles
    const basicTutorialRiddles = [
      {
        text: "I am a word that starts with 'H' and rhymes with 'mouse'. What am I?",
        answer: "house",
        difficulty: "easy",
      },
      {
        text: "I am a color that is also a fruit. What am I?",
        answer: "orange",
        difficulty: "easy",
      },
      {
        text: "I have four legs and bark. What am I?",
        answer: "dog",
        difficulty: "easy",
      },
      {
        text: "I am round and bounce. Children play with me. What am I?",
        answer: "ball",
        difficulty: "easy",
      },
      {
        text: "I have wings and can fly. I build nests in trees. What am I?",
        answer: "bird",
        difficulty: "easy",
      },
    ];

    const batch = admin.firestore().batch();

    basicTutorialRiddles.forEach((riddle, index) => {
      const riddleRef = admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).doc();
      const riddleData: TutorialRiddle = {
        riddleId: riddleRef.id,
        text: riddle.text,
        answer: riddle.answer,
        tutorialIndex: index,
        difficulty: riddle.difficulty,
        category: "tutorial",
      };

      batch.set(riddleRef, riddleData);
    });

    await batch.commit();
    console.log(`Successfully created ${basicTutorialRiddles.length} basic tutorial riddles.`);
  } catch (error) {
    console.error("Error initializing tutorial riddles:", error);
    throw new Error("Failed to initialize tutorial riddles.");
  }
}

/**
 * Callable function to initialize tutorial riddles.
 * Can be called manually if needed.
 */
export const initializeTutorialRiddlesFunction = onCall({}, async (): Promise<{success: boolean; message: string}> => {
  try {
    await initializeTutorialRiddlesIfEmpty();
    return {
      success: true,
      message: "Tutorial riddles initialized successfully.",
    };
  } catch (error) {
    functions.logger.error("Error initializing tutorial riddles:", error);
    throw new HttpsError("internal", "Failed to initialize tutorial riddles.");
  }
});

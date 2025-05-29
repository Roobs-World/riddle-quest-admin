import * as admin from "firebase-admin";
import {generateUniqueRiddle} from "./openaiService";
import type {FirestoreRiddle} from "./validation/firestoreSchemas";

/**
 * Checks if a riddle already exists in the provided lists of questions and
 * answers.
 *
 * @param riddle - The riddle object to check.
 * @param existingQuestions - An array of existing questions.
 * @param existingAnswers - An array of existing answers.
 * @return True if the riddle exists, false otherwise.
 */
function riddleExists(
  riddle: {question: string; answer: string},
  existingQuestions: string[],
  existingAnswers: string[],
): boolean {
  const normalizedQuestion = riddle.question.toLowerCase();
  const normalizedAnswer = riddle.answer.toLowerCase();

  return existingQuestions.includes(normalizedQuestion) || existingAnswers.includes(normalizedAnswer);
}

/**
 * Fetches existing riddles from Firestore for duplicate checking.
 * @returns A promise that resolves with an object containing arrays of questions and answers.
 */
async function getExistingRiddlesFromFirestore(): Promise<{questions: string[]; answers: string[]}> {
  try {
    const riddlesSnapshot = await admin.firestore().collection("riddles").get();

    const questions: string[] = [];
    const answers: string[] = [];

    riddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    return {questions, answers};
  } catch (error) {
    console.error("Error fetching existing riddles from Firestore:", error);
    throw new Error("Failed to fetch existing riddles from Firestore.");
  }
}

/**
 * Gets the next available classic index for new riddles.
 * @returns The next available classic index.
 */
async function getNextClassicIndex(): Promise<number> {
  try {
    const riddlesSnapshot = await admin
      .firestore()
      .collection("riddles")
      .where("classicIndex", ">=", 0)
      .orderBy("classicIndex", "desc")
      .limit(1)
      .get();

    if (riddlesSnapshot.empty) {
      return 0; // Start from 0 if no classic riddles exist
    }

    const highestIndexDoc = riddlesSnapshot.docs[0];
    const highestIndex = highestIndexDoc.data().classicIndex || 0;
    return highestIndex + 1;
  } catch (error) {
    console.error("Error getting next classic index:", error);
    throw new Error("Failed to get next classic index.");
  }
}

/**
 * Stores generated riddles directly in Firestore.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting classic index for the riddles.
 */
async function storeRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const riddleRef = admin.firestore().collection("riddles").doc();
    const riddleData: FirestoreRiddle = {
      riddleId: riddleRef.id,
      text: riddle.question,
      answer: riddle.answer,
      classicIndex: startingIndex + index,
      category: "classic",
    };

    batch.set(riddleRef, riddleData);
  });

  try {
    await batch.commit();
    console.log(`Successfully stored ${riddles.length} new riddles in Firestore.`);
  } catch (error) {
    console.error("Error storing riddles in Firestore:", error);
    throw new Error("Failed to store riddles in Firestore.");
  }
}

/**
 * Generates a specified number of unique riddles and stores them directly in Firestore.
 *
 * @param numberOfRiddles - The number of new riddles to generate.
 */
export async function generateAndAppendRiddles(numberOfRiddles: number): Promise<void> {
  console.log(`Generating ${numberOfRiddles} new riddles...`);

  // Check for required environment variables
  const openAIKey = process.env.OPEN_AI_KEY;
  if (!openAIKey) {
    throw new Error("OPEN_AI_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available classic index
  const startingIndex = await getNextClassicIndex();

  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];

  while (newRiddles.length < numberOfRiddles) {
    // Generate a riddle using the OpenAI service
    const riddle = await generateUniqueRiddle();

    if (riddle) {
      const newRiddle = {
        question: riddle[0],
        answer: riddle[1],
      };

      // Check for duplicates against existing and newly generated riddles
      if (
        !riddleExists(newRiddle, existing.questions, existing.answers) &&
        !riddleExists(
          newRiddle,
          generatedAttempts.map((r) => r.question),
          generatedAttempts.map((r) => r.answer),
        )
      ) {
        newRiddles.push(newRiddle);
        // Add to existing for subsequent duplicate checks within this run
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());
        console.log(`Generated riddle ${newRiddles.length}/${numberOfRiddles}`);
      } else {
        console.warn("Generated riddle is a duplicate, trying again...");
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn("Failed to generate unique riddle, retrying...");
    }
  }

  if (newRiddles.length > 0) {
    // Store riddles directly in Firestore
    await storeRiddlesInFirestore(newRiddles, startingIndex);
    console.log(`Successfully generated and stored ${newRiddles.length} new riddles in Firestore.`);
  } else {
    console.warn("No new unique riddles were generated.");
  }
}

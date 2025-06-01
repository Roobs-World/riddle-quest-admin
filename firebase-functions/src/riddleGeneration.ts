import * as functions from "firebase-functions";
import {onCall, CallableOptions} from "firebase-functions/v2/https";
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
 * Checks both classic riddles and daily challenge riddles.
 * @returns A promise that resolves with an object containing arrays of questions and answers.
 */
async function getExistingRiddlesFromFirestore(): Promise<{questions: string[]; answers: string[]}> {
  try {
    const questions: string[] = [];
    const answers: string[] = [];

    // Get classic riddles from 'riddles' collection
    const riddlesSnapshot = await admin.firestore().collection("riddles").get();
    riddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    // Get daily challenge riddles from 'dailyChallenge' collection
    const dailyChallengeSnapshot = await admin.firestore().collection("dailyChallenge").get();
    dailyChallengeSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    console.log(
      `Loaded ${questions.length} existing questions and ${answers.length} existing answers for duplicate checking`,
    );
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
 * Gets the next available daily index for new daily riddles.
 * @returns The next available daily index.
 */
async function getNextDailyIndex(): Promise<number> {
  try {
    const riddlesSnapshot = await admin
      .firestore()
      .collection("riddles")
      .where("dailyIndex", ">=", 0)
      .orderBy("dailyIndex", "desc")
      .limit(1)
      .get();

    if (riddlesSnapshot.empty) {
      return 0; // Start from 0 if no daily riddles exist
    }

    const highestIndexDoc = riddlesSnapshot.docs[0];
    const highestIndex = highestIndexDoc.data().dailyIndex || 0;
    return highestIndex + 1;
  } catch (error) {
    console.error("Error getting next daily index:", error);
    throw new Error("Failed to get next daily index.");
  }
}

/**
 * Stores generated daily riddles directly in Firestore.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting daily index for the riddles.
 */
async function storeDailyRiddlesInFirestore(
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
      dailyIndex: startingIndex + index,
      category: "daily",
    };

    batch.set(riddleRef, riddleData);
  });

  try {
    await batch.commit();
    console.log(`Successfully stored ${riddles.length} new daily riddles in Firestore.`);
  } catch (error) {
    console.error("Error storing daily riddles in Firestore:", error);
    throw new Error("Failed to store daily riddles in Firestore.");
  }
}

/**
 * Generates a specified number of unique riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new riddles to generate.
 */
export async function generateAndAppendRiddles(numberOfRiddles: number): Promise<void> {
  console.log(`Generating ${numberOfRiddles} new riddles...`);

  // Check for required environment variables
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
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

/**
 * Generates a specified number of unique daily riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new daily riddles to generate.
 */
export async function generateAndAppendDailyRiddles(numberOfRiddles: number): Promise<void> {
  console.log(`Generating ${numberOfRiddles} new daily riddles...`);

  // Check for required environment variables
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking (includes both classic and daily)
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available daily index
  const startingIndex = await getNextDailyIndex();

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
        console.log(`Generated daily riddle ${newRiddles.length}/${numberOfRiddles}`);
      } else {
        console.warn("Generated daily riddle is a duplicate, trying again...");
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn("Failed to generate unique daily riddle, retrying...");
    }
  }

  if (newRiddles.length > 0) {
    // Store daily riddles directly in Firestore
    await storeDailyRiddlesInFirestore(newRiddles, startingIndex);
    console.log(`Successfully generated and stored ${newRiddles.length} new daily riddles in Firestore.`);
  } else {
    console.warn("No new unique daily riddles were generated.");
  }
}

/**
 * Initializes the riddle database if it's empty.
 * This function is called automatically by the submit answer function if no riddles exist.
 *
 * @param initialRiddleCount - The number of initial riddles to generate.
 */
export async function initializeRiddleDatabaseIfEmpty(initialRiddleCount: number = 20): Promise<void> {
  console.log("🔍 Checking if riddle database needs initialization...");

  try {
    // Check if any classic riddles already exist
    const existingRiddlesSnapshot = await admin
      .firestore()
      .collection("riddles")
      .where("classicIndex", ">=", 0)
      .limit(1)
      .get();

    if (!existingRiddlesSnapshot.empty) {
      console.log("✅ Riddle database already initialized - classic riddles exist.");
      return;
    }

    // Generate initial batch of riddles for new database
    console.log(`📝 Generating ${initialRiddleCount} initial riddles for database initialization...`);
    await generateAndAppendRiddles(initialRiddleCount);
    console.log(`✅ Riddle database initialized with ${initialRiddleCount} classic riddles.`);
  } catch (error) {
    console.error("❌ Error initializing riddle database:", error);
    throw new Error("Failed to initialize riddle database.");
  }
}

/**
 * Callable function to trigger the generation and appending of new Classic Mode riddles.
 * This is now deprecated in favor of automatic generation in submit answer function.
 * Kept for backward compatibility.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateClassicRiddles = onCall(
  {
    enforceAppCheck: false,
    cors: true,
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 540, // 9 minutes for riddle generation
  } as CallableOptions,
  async (): Promise<{success: boolean; message: string}> => {
    console.log("🚀 generateClassicRiddles function called - entry point reached");
    console.log("🔧 Function configuration: enforceAppCheck=false, cors=true, region=us-central1");

    try {
      console.log("📝 Starting riddle generation process with 10 riddles...");
      await generateAndAppendRiddles(10);
      console.log("✅ Classic Mode riddles generated and stored in Firestore successfully.");
      return {
        success: true,
        message: "New Classic Mode riddles generated and added to Firestore.",
      };
    } catch (error) {
      console.error("❌ Error generating Classic Mode riddles:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      } else {
        console.error("❌ Error details:", String(error));
      }
      throw new functions.https.HttpsError("internal", "Failed to generate new classic riddles.", error);
    }
  },
);

/**
 * Callable function to initialize the riddle database with a larger batch of riddles.
 * This is now deprecated in favor of automatic initialization in submit answer function.
 * Kept for backward compatibility.
 * @return A promise resolving to an object indicating success or failure.
 */
export const initializeRiddleDatabase = onCall(
  {
    enforceAppCheck: false,
    cors: true,
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 300, // 5 minutes for initial database setup
  } as CallableOptions,
  async (): Promise<{success: boolean; message: string; riddlesGenerated: number}> => {
    console.log("🚀 initializeRiddleDatabase function called - entry point reached");
    console.log("🔧 Function configuration: enforceAppCheck=false, cors=true, region=us-central1");

    try {
      // Check if any classic riddles already exist
      const existingRiddlesSnapshot = await admin
        .firestore()
        .collection("riddles")
        .where("classicIndex", ">=", 0)
        .limit(1)
        .get();

      if (!existingRiddlesSnapshot.empty) {
        console.log("✅ Riddle database already initialized - classic riddles exist.");
        return {
          success: true,
          message: "Riddle database already initialized.",
          riddlesGenerated: 0,
        };
      }

      // Generate initial batch of riddles for new database
      const initialRiddleCount = 20;
      console.log(`📝 Generating ${initialRiddleCount} initial riddles for database initialization...`);
      await generateAndAppendRiddles(initialRiddleCount);
      console.log(`✅ Riddle database initialized with ${initialRiddleCount} classic riddles.`);

      return {
        success: true,
        message: `Riddle database initialized with ${initialRiddleCount} classic riddles.`,
        riddlesGenerated: initialRiddleCount,
      };
    } catch (error) {
      console.error("❌ Error initializing riddle database:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      } else {
        console.error("❌ Error details:", String(error));
      }
      throw new functions.https.HttpsError("internal", "Failed to initialize riddle database.", error);
    }
  },
);

/**
 * Callable function to trigger the generation and appending of new Daily Mode riddles.
 * Can be called by the client when more daily riddles are needed.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateDailyRiddles = onCall(
  {
    enforceAppCheck: false,
    cors: true,
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 540, // 9 minutes for riddle generation
  } as CallableOptions,
  async (): Promise<{success: boolean; message: string}> => {
    console.log("🚀 generateDailyRiddles function called - entry point reached");
    console.log("🔧 Function configuration: enforceAppCheck=false, cors=true, region=us-central1");

    try {
      console.log("📝 Starting daily riddle generation process with 10 riddles...");
      await generateAndAppendDailyRiddles(10);
      console.log("✅ Daily Mode riddles generated and stored in Firestore successfully.");
      return {
        success: true,
        message: "New Daily Mode riddles generated and added to Firestore.",
      };
    } catch (error) {
      console.error("❌ Error generating Daily Mode riddles:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      } else {
        console.error("❌ Error details:", String(error));
      }
      throw new functions.https.HttpsError("internal", "Failed to generate new daily riddles.", error);
    }
  },
);

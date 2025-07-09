import * as functions from "firebase-functions";
import {onCall, CallableOptions, CallableRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {generateUniqueRiddle} from "./openaiService";
import type {ClassicRiddle, DailyRiddle, TutorialRiddle} from "./validation/firestoreSchemas";
import {RiddleCollections} from "./validation/firestoreSchemas";

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
 * Fetches existing riddles from all riddle collections for duplicate checking.
 * Checks classic riddles, daily riddles, and tutorial riddles.
 * @returns A promise that resolves with an object containing arrays of questions and answers.
 */
async function getExistingRiddlesFromFirestore(): Promise<{questions: string[]; answers: string[]}> {
  try {
    const questions: string[] = [];
    const answers: string[] = [];

    // Get classic riddles from 'riddles' collection
    const riddlesSnapshot = await admin.firestore().collection(RiddleCollections.RIDDLES).get();
    riddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    // Get daily riddles from 'dailyRiddles' collection
    const dailyRiddlesSnapshot = await admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).get();
    dailyRiddlesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.text) {
        questions.push(data.text.toLowerCase());
      }
      if (data.answer) {
        answers.push(data.answer.toLowerCase());
      }
    });

    // Get tutorial riddles from 'tutorialRiddles' collection
    const tutorialRiddlesSnapshot = await admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).get();
    tutorialRiddlesSnapshot.forEach((doc) => {
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
      .collection(RiddleCollections.RIDDLES)
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
 * Stores generated classic riddles in the riddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting classic index for the riddles.
 */
async function storeClassicRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const riddleRef = admin.firestore().collection(RiddleCollections.RIDDLES).doc();
    const riddleData: ClassicRiddle = {
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
    console.log(`Successfully stored ${riddles.length} new classic riddles in Firestore.`);
  } catch (error) {
    console.error("Error storing classic riddles in Firestore:", error);
    throw new Error("Failed to store classic riddles in Firestore.");
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
      .collection(RiddleCollections.DAILY_RIDDLES)
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
 * Stores generated daily riddles in the dailyRiddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting daily index for the riddles.
 */
async function storeDailyRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const riddleRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc();
    const riddleData: DailyRiddle = {
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
 * Gets the next available tutorial index for new tutorial riddles.
 * @returns The next available tutorial index.
 */
async function getNextTutorialIndex(): Promise<number> {
  try {
    const riddlesSnapshot = await admin
      .firestore()
      .collection(RiddleCollections.TUTORIAL_RIDDLES)
      .where("tutorialIndex", ">=", 0)
      .orderBy("tutorialIndex", "desc")
      .limit(1)
      .get();

    if (riddlesSnapshot.empty) {
      return 0; // Start from 0 if no tutorial riddles exist
    }

    const highestIndexDoc = riddlesSnapshot.docs[0];
    const highestIndex = highestIndexDoc.data().tutorialIndex || 0;
    return highestIndex + 1;
  } catch (error) {
    console.error("Error getting next tutorial index:", error);
    throw new Error("Failed to get next tutorial index.");
  }
}

/**
 * Stores generated tutorial riddles in the tutorialRiddles collection.
 * @param riddles - An array of riddle objects to store.
 * @param startingIndex - The starting tutorial index for the riddles.
 */
async function storeTutorialRiddlesInFirestore(
  riddles: {question: string; answer: string}[],
  startingIndex: number,
): Promise<void> {
  const batch = admin.firestore().batch();

  riddles.forEach((riddle, index) => {
    const riddleRef = admin.firestore().collection(RiddleCollections.TUTORIAL_RIDDLES).doc();
    const riddleData: TutorialRiddle = {
      riddleId: riddleRef.id,
      text: riddle.question,
      answer: riddle.answer,
      tutorialIndex: startingIndex + index,
      category: "tutorial",
    };

    batch.set(riddleRef, riddleData);
  });

  try {
    await batch.commit();
    console.log(`Successfully stored ${riddles.length} new tutorial riddles in Firestore.`);
  } catch (error) {
    console.error("Error storing tutorial riddles in Firestore:", error);
    throw new Error("Failed to store tutorial riddles in Firestore.");
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

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

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
        console.log(`Generated riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
      } else {
        console.warn(`Generated riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn(`Failed to generate unique riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    console.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} riddles after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique riddles after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    // Store riddles directly in Firestore
    await storeClassicRiddlesInFirestore(newRiddles, startingIndex);
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

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

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
        console.log(`Generated daily riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
      } else {
        console.warn(`Generated daily riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn(`Failed to generate unique daily riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    console.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} daily riddles after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique daily riddles after ${maxAttempts} attempts`);
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
 * Generates a specified number of unique tutorial riddles and stores them directly in Firestore.
 * This function is called automatically by the submit answer function when needed.
 *
 * @param numberOfRiddles - The number of new tutorial riddles to generate.
 */
export async function generateAndAppendTutorialRiddles(numberOfRiddles: number): Promise<void> {
  console.log(`Generating ${numberOfRiddles} new tutorial riddles...`);

  // Check for required environment variables
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking (includes both classic and daily)
  const existing = await getExistingRiddlesFromFirestore();

  // Get the next available tutorial index
  const startingIndex = await getNextTutorialIndex();

  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = numberOfRiddles * 10; // Allow 10x attempts for retries
  let attemptCount = 0;

  while (newRiddles.length < numberOfRiddles && attemptCount < maxAttempts) {
    attemptCount++;

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
        console.log(`Generated tutorial riddle ${newRiddles.length}/${numberOfRiddles} (attempt ${attemptCount})`);
      } else {
        console.warn(
          `Generated tutorial riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`,
        );
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn(`Failed to generate unique tutorial riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (newRiddles.length < numberOfRiddles && attemptCount >= maxAttempts) {
    console.warn(
      `Circuit breaker activated: Only generated ${newRiddles.length}/${numberOfRiddles} tutorial riddles after ${maxAttempts} attempts`,
    );
    if (newRiddles.length === 0) {
      throw new Error(`Failed to generate any unique tutorial riddles after ${maxAttempts} attempts`);
    }
  }

  if (newRiddles.length > 0) {
    // Store tutorial riddles directly in Firestore
    await storeTutorialRiddlesInFirestore(newRiddles, startingIndex);
    console.log(`Successfully generated and stored ${newRiddles.length} new tutorial riddles in Firestore.`);
  } else {
    console.warn("No new unique tutorial riddles were generated.");
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
      .collection(RiddleCollections.RIDDLES)
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
        .collection(RiddleCollections.RIDDLES)
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

/**
 * Generates a specified number of unique tutorial riddles and stores them directly in Firestore.
 * This is now deprecated in favor of automatic generation in submit answer function.
 * Kept for backward compatibility.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateTutorialRiddles = onCall(
  {
    enforceAppCheck: false,
    cors: true,
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 540, // 9 minutes for riddle generation
  } as CallableOptions,
  async (): Promise<{success: boolean; message: string}> => {
    console.log("🚀 generateTutorialRiddles function called - entry point reached");
    console.log("🔧 Function configuration: enforceAppCheck=false, cors=true, region=us-central1");

    try {
      console.log("📝 Starting tutorial riddle generation process with 10 riddles...");
      await generateAndAppendTutorialRiddles(10);
      console.log("✅ Tutorial riddles generated and stored in Firestore successfully.");
      return {
        success: true,
        message: "New Tutorial riddles generated and added to Firestore.",
      };
    } catch (error) {
      console.error("❌ Error generating Tutorial riddles:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      } else {
        console.error("❌ Error details:", String(error));
      }
      throw new functions.https.HttpsError("internal", "Failed to generate new tutorial riddles.", error);
    }
  },
);

/**
 * Generates 5 riddles for today's daily challenge and stores them in the proper structure.
 * This replaces the single daily riddle with a 5-question daily challenge.
 * @param forceGenerate - If true, generates new riddles even if today's challenge already exists.
 * @return A promise that resolves when the daily challenge is created.
 */
export async function generateTodaysDailyChallenge(forceGenerate: boolean = false): Promise<void> {
  console.log("🚀 Generating today's 5-question daily challenge...");

  const today = new Date();
  const todayDateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

  // Check if today's challenge already exists
  const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
  const existingChallenge = await dailyChallengeRef.get();

  if (existingChallenge.exists && !forceGenerate) {
    const existingData = existingChallenge.data();
    if (existingData?.date === todayDateString && existingData?.questions?.length === 5) {
      console.log("✅ Today's daily challenge already exists with 5 questions.");
      return;
    }
  }

  console.log(`📝 Generating 5 new riddles for daily challenge on ${todayDateString}...`);

  // Check for required environment variables
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  // Get existing riddles for duplicate checking
  const existing = await getExistingRiddlesFromFirestore();

  const dailyChallengeQuestions: {
    riddleId: string;
    text: string;
    answer: string;
  }[] = [];

  const generatedAttempts: {question: string; answer: string}[] = [];

  // Circuit breaker: Maximum attempts to prevent infinite loops
  const maxAttempts = 50; // 10x the number of riddles we need
  let attemptCount = 0;

  while (dailyChallengeQuestions.length < 5 && attemptCount < maxAttempts) {
    attemptCount++;

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
        // Create riddle document in dailyRiddles collection
        const riddleRef = admin.firestore().collection(RiddleCollections.DAILY_RIDDLES).doc();
        const riddleData: DailyRiddle = {
          riddleId: riddleRef.id,
          text: newRiddle.question,
          answer: newRiddle.answer,
          dailyIndex: dailyChallengeQuestions.length, // Use the current count as index
          category: "daily",
          difficulty: "normal",
        };

        // Store the riddle in the dailyRiddles collection
        await riddleRef.set(riddleData);

        // Add to daily challenge questions array
        dailyChallengeQuestions.push({
          riddleId: riddleRef.id,
          text: newRiddle.question,
          answer: newRiddle.answer,
        });

        // Add to existing for subsequent duplicate checks within this run
        existing.questions.push(newRiddle.question.toLowerCase());
        existing.answers.push(newRiddle.answer.toLowerCase());

        console.log(`Generated daily challenge question ${dailyChallengeQuestions.length}/5 (attempt ${attemptCount})`);
      } else {
        console.warn(`Generated riddle is a duplicate, trying again... (attempt ${attemptCount}/${maxAttempts})`);
      }
      generatedAttempts.push(newRiddle);
    } else {
      console.warn(`Failed to generate unique riddle, retrying... (attempt ${attemptCount}/${maxAttempts})`);
    }
  }

  // Check if we hit the circuit breaker
  if (dailyChallengeQuestions.length < 5 && attemptCount >= maxAttempts) {
    console.warn(
      `Circuit breaker activated: Only generated ${dailyChallengeQuestions.length}/5 daily challenge questions after ${maxAttempts} attempts`,
    );
    if (dailyChallengeQuestions.length === 0) {
      throw new Error(`Failed to generate any unique daily challenge questions after ${maxAttempts} attempts`);
    }
  }

  if (dailyChallengeQuestions.length > 0) {
    // Create the daily challenge document structure
    const dailyChallengeData = {
      date: todayDateString,
      questions: dailyChallengeQuestions.map((q, _index) => ({
        riddleId: q.riddleId,
        text: q.text,
        // Don't include answer in the client-accessible data
      })),
      totalQuestions: dailyChallengeQuestions.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store the daily challenge in the dailyChallenge collection
    await dailyChallengeRef.set(dailyChallengeData);

    // Reset all users' daily challenge progress for the new day
    await resetAllUsersDailyChallengeProgress();

    console.log(
      `✅ Successfully generated and stored ${dailyChallengeQuestions.length} questions for today's daily challenge.`,
    );
  } else {
    throw new Error("Failed to generate any daily challenge questions.");
  }
}

/**
 * Resets all users' daily challenge progress to 0 for the new day.
 * This is called when a new daily challenge is generated.
 */
async function resetAllUsersDailyChallengeProgress(): Promise<void> {
  console.log("🔄 Resetting all users' daily challenge progress for new day...");

  try {
    // Get all user documents
    const usersSnapshot = await admin.firestore().collection("users").get();

    if (usersSnapshot.empty) {
      console.log("No users found to reset progress.");
      return;
    }

    // Create batch to update all users
    const batch = admin.firestore().batch();
    let userCount = 0;

    usersSnapshot.forEach((userDoc) => {
      const userRef = userDoc.ref;
      batch.update(userRef, {
        "progress.dailyChallengeCurrentQuestion": 0,
      });
      userCount++;
    });

    // Commit the batch update
    await batch.commit();

    console.log(`✅ Reset daily challenge progress for ${userCount} users.`);
  } catch (error) {
    console.error("❌ Error resetting users' daily challenge progress:", error);
    throw new Error("Failed to reset users' daily challenge progress.");
  }
}

/**
 * Callable function to generate today's 5-question daily challenge.
 * Can be called manually or by a scheduler.
 * @return A promise resolving to an object indicating success or failure.
 */
export const generateTodaysDailyChallengeFunction = onCall(
  {
    enforceAppCheck: false,
    cors: true,
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 540, // 9 minutes for riddle generation
  } as CallableOptions,
  async (
    request: CallableRequest<{forceGenerate?: boolean}>,
  ): Promise<{success: boolean; message: string; questionsGenerated: number}> => {
    console.log("🚀 generateTodaysDailyChallengeFunction called - entry point reached");

    try {
      const {forceGenerate = false} = request.data || {};

      const today = new Date();
      const todayDateString = today.toISOString().split("T")[0];

      console.log(`📝 Starting daily challenge generation for ${todayDateString}...`);
      await generateTodaysDailyChallenge(forceGenerate);

      // Get the generated challenge to count questions
      const dailyChallengeRef = admin.firestore().collection("dailyChallenge").doc("current");
      const challengeDoc = await dailyChallengeRef.get();
      const questionsGenerated = challengeDoc.exists ? challengeDoc.data()?.questions?.length || 0 : 0;

      console.log(`✅ Daily challenge generated successfully with ${questionsGenerated} questions.`);
      return {
        success: true,
        message: `Today's daily challenge generated successfully with ${questionsGenerated} questions.`,
        questionsGenerated,
      };
    } catch (error) {
      console.error("❌ Error generating today's daily challenge:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
      } else {
        console.error("❌ Error details:", String(error));
      }
      throw new functions.https.HttpsError("internal", "Failed to generate today's daily challenge.", error);
    }
  },
);

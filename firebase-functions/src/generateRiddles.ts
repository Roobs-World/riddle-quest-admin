// import type { FirestoreRiddle } from "../../src/validation/firestoreSchemas";
// import { google } from "googleapis";
// import { OpenAI } from "openai";
import {getExistingRiddles, appendRiddlesToSheet} from "./sheetsService.js";
import {generateUniqueRiddle} from "./openaiService.js";
import * as functions from "firebase-functions"; // Import firebase-functions

// Access Firebase function configuration
const envConfig = functions.config();

const spreadsheetId = envConfig.sheets?.spreadsheet_id;
// Assuming sheets.google_sheets_client_email
const clientEmail = envConfig.sheets?.google_sheets_client_email;
// Assuming sheets.google_sheets_private_key
const privateKey = envConfig.sheets?.google_sheets_private_key;
// Assuming openai.api_key
const openAIKey = envConfig.openai?.api_key;

// Ensure required environment variables are set
if (!spreadsheetId || !clientEmail || !privateKey || !openAIKey) {
  const missing: string[] = [];
  if (!spreadsheetId) {
    missing.push("SPREADSHEET_ID (via functions.config().sheets.spreadsheet_id)");
  }
  if (!clientEmail) {
    missing.push("GOOGLE_SHEETS_CLIENT_EMAIL (via functions.config().sheets" + ".google_sheets_client_email)");
  }
  if (!privateKey) {
    missing.push("GOOGLE_SHEETS_PRIVATE_KEY (via functions.config().sheets" + ".google_sheets_private_key)");
  }
  if (!openAIKey) {
    missing.push("OPENAI_API_KEY (via functions.config().openai.api_key)");
  }
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

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
 * Generates a specified number of unique riddles by fetching data from the
 * Sheet, and appends them.
 *
 * @param numberOfRiddles - The number of new riddles to generate.
 */
export async function generateAndAppendRiddles(numberOfRiddles: number): Promise<void> {
  console.log(`Generating ${numberOfRiddles} new riddles...`);

  const sheetRange = "classic!A:B";
  // Use the configured spreadsheetId
  const existing = await getExistingRiddles(spreadsheetId!, sheetRange);

  const newRiddles: {question: string; answer: string}[] = [];
  const generatedAttempts: {question: string; answer: string}[] = [];
  // Prevent infinite loops
  const MAX_GENERATION_ATTEMPTS = numberOfRiddles * 5;

  while (newRiddles.length < numberOfRiddles && generatedAttempts.length < MAX_GENERATION_ATTEMPTS) {
    // Generate a riddle using the OpenAI service
    const riddle = await generateUniqueRiddle(existing.questions, existing.answers);

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
        ) // Check against already attempted generations
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
    // Append riddles using the Sheets service
    await appendRiddlesToSheet(newRiddles);
    console.log(`Successfully appended ${newRiddles.length} new riddles to Google ` + "Sheet.");
  } else if (generatedAttempts.length === MAX_GENERATION_ATTEMPTS) {
    console.error("Reached maximum generation attempts without generating enough " + "unique riddles.");
    throw new Error(
      "Failed to generate enough unique riddles due to excessive " + "duplicates or generation failures.",
    );
  } else {
    console.warn("No new unique riddles were generated.");
  }
}

import {sheets_v4 as sheetsV4, google} from "googleapis";
import * as functions from "firebase-functions";

// Use Firebase function configuration for sensitive information
const sheetsConfig = functions.config().sheets;

const spreadsheetId = sheetsConfig?.spreadsheet_id;
const clientEmail = sheetsConfig?.google_sheets_client_email;
const privateKey = sheetsConfig?.google_sheets_private_key;

// Ensure required environment variables are set
if (!spreadsheetId || !clientEmail || !privateKey) {
  throw new Error("Missing required environment variables for Google Sheets.");
}

const jwtClient = new google.auth.JWT(
  clientEmail,
  undefined,
  // Replace \n with actual newline characters
  privateKey.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"],
);

const sheets: sheetsV4.Sheets = google.sheets({
  version: "v4",
  auth: jwtClient,
});

/**
 * Fetches existing riddles from the Google Sheet.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} range - The range to read data from (e.g., 'Sheet1!A:B').
 * @returns {Promise<{ questions: string[]; answers: string[] }>} A promise that resolves
 * with an object containing arrays of questions and answers.
 */
export async function getExistingRiddles(
  spreadsheetId: string,
  range: string,
): Promise<{questions: string[]; answers: string[]}> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return {questions: [], answers: []};
    }

    const existingQuestions = rows.map((row) => (row[0]?.toString() || "").toLowerCase());
    const existingAnswers = rows.map((row) => (row[1]?.toString() || "").toLowerCase());

    return {questions: existingQuestions, answers: existingAnswers};
  } catch (error) {
    console.error("Error fetching existing riddles:", error);
    throw new Error("Failed to fetch existing riddles from Google Sheet.");
  }
}

/**
 * Appends generated riddles to the Google Sheet.
 * @param {{ question: string; answer: string }[]} riddles - An array of riddle
 * objects to append.
 * @returns {Promise<void>} A promise that resolves when the riddles are appended.
 */
export async function appendRiddlesToSheet(riddles: {question: string; answer: string}[]): Promise<void> {
  const values = riddles.map((riddle) => [riddle.question, riddle.answer]);

  const resource = {
    values,
  };

  try {
    // Use non-null assertion for spreadsheetId as it's checked on
    // initialization
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId!,
      range: "classic!A:B", // TODO: Make range configurable if needed
      valueInputOption: "USER_ENTERED",
      requestBody: resource,
    });
    console.log(
      // Use optional chaining and nullish coalescing
      `${result.data.updates?.updatedCells ?? 0} cells appended.`,
    );
  } catch (error) {
    console.error("Error appending to Google Sheet:", error);
    throw new Error("Failed to append riddles to Google Sheet.");
  }
}

/**
 * Retrieves a specific riddle from the Google Sheet by game mode and index
 * using the googleapis library.
 *
 * @param {string} gameMode - The game mode (e.g., 'Classic', 'Daily').
 * @param {number} index - The 1-based index of the riddle in the sheet.
 * @return {Promise<[string, string] | null>} A promise that resolves with the
 * riddle data [question, answer] or null if not found/malformed.
 */
export async function getRiddleDataFromSheetGoogleApis(
  gameMode: string,
  index: number,
): Promise<[string, string] | null> {
  const sheetRange = `${gameMode}!A${index}:B${index}`; // e.g., 'Classic!A2:B2'

  try {
    // Use non-null assertion for spreadsheetId as it's checked on
    // initialization
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId!,
      range: sheetRange,
    });

    const rowData = response.data.values;

    // Check if data exists and has the correct structure (single row with
    // two columns)
    if (!rowData || rowData.length === 0 || !rowData[0] || rowData[0].length !== 2) {
      console.warn(`Missing or malformed data from Google Sheets for gameMode: ${gameMode}, index: ${index}`);
      return null;
    }

    // Assuming the values are strings, return them as a tuple
    return [rowData[0][0].toString(), rowData[0][1].toString()];
  } catch (error) {
    console.error(`Error fetching riddle data from Google Sheets using googleapis: ${error}`, {gameMode, index});
    throw new Error(`Failed to fetch riddle data from sheet for ${gameMode} at index ${index} using googleapis.`);
  }
}

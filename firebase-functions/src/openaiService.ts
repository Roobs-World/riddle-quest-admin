import OpenAI from "openai";
import * as functions from "firebase-functions";
import {captureException} from "./sentry";

// Lazy initialization variable
let openaiClient: OpenAI | null = null;

/**
 * Resets the OpenAI client cache. Used for testing.
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

/**
 * Initializes the OpenAI client if not already initialized.
 * @returns {OpenAI} The initialized OpenAI client.
 */
function initializeOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  // Use environment variables for sensitive information
  const openAIKey = process.env.OPENAI_API_KEY;

  // Ensure environment variables are set
  if (!openAIKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  openaiClient = new OpenAI({apiKey: openAIKey});
  return openaiClient;
}

/**
 * Generates a single unique riddle using OpenAI.
 * @return {Promise<[string, string] | null>} A promise that resolves with a
 *   riddle [question, answer] or null if generation fails or is a duplicate.
 */
export async function generateUniqueRiddle(): Promise<[string, string] | null> {
  const openai = initializeOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a creative riddle designer for a mobile word game. Generate a single original, engaging riddle that feels fresh and accessible to a broad audience. " +
            "To increase variety, internally pick one category and one clue style before writing. " +
            "Rotate across categories such as nature, everyday objects, food, jobs, places, science, technology, sports, arts, history, mythology, and emotions. " +
            "Vary clue styles: metaphor, personification, mini-scene, compare/contrast, misdirection, playful logic, or subtle wordplay. " +
            "Do not rely on the same opening pattern every time, especially not repeated 'What am I?' phrasing. " +
            "Keep clues solvable, fair, and fun for mobile players.",
        },
        {
          role: "user",
          content:
            "Generate a unique riddle in this exact format:\n\n" +
            "Question: [your riddle question here]\n" +
            "Answer: [your answer here]\n\n" +
            "Requirements:\n" +
            "- Question: 10-90 characters, use natural language with proper grammar and punctuation\n" +
            "- Answer: MAXIMUM 7 characters, use ONLY lowercase letters (a-z), absolutely NO punctuation, NO numbers, NO special characters, NO apostrophes, NO hyphens\n" +
            "- Content: Engaging and suitable for mobile game players of all ages\n" +
            "- Style diversity: Use a less common riddle angle, avoid generic textbook riddles, and avoid repeating familiar tropes\n" +
            "- Question pattern variety: Prefer alternatives to plain 'What am I?' prompts (use first-person voice, situation-based clues, or indirect questions when possible)\n" +
            "- Originality: Must be completely unique, not a common or well-known riddle\n\n" +
            "The answer length and format are critical: it must never exceed 7 characters and must contain only lowercase letters.",
        },
      ],
    });

    const output = completion.choices[0].message.content;
    if (!output) {
      functions.logger.warn("OpenAI returned empty content.");
      return null;
    }

    const cleanedOutput = output.replace(/\*\*/g, "");

    // Look for the standard format: "Question:" and "Answer:"
    const questionMatch = cleanedOutput.match(/Question:\s*(.+?)(?=\nAnswer:)/s);
    const answerMatch = cleanedOutput.match(/Answer:\s*(.+?)(?:\n|$)/s);

    if (!questionMatch || !answerMatch) {
      functions.logger.warn("Could not parse question or answer from OpenAI output using standard format.");
      return null;
    }

    const question = questionMatch[1].trim();
    const answer = answerMatch[1].trim();

    if (!question || !answer) {
      functions.logger.warn("Question or answer is empty after parsing.");
      return null;
    }

    // Validate answer length (critical requirement)
    if (answer.length > 7) {
      functions.logger.warn(`Answer too long: "${answer}" (${answer.length} characters). Must be 7 or fewer.`);
      return null;
    }

    // Validate answer format (only lowercase letters)
    if (!/^[a-z]+$/.test(answer)) {
      functions.logger.warn(`Answer contains invalid characters: "${answer}". Must be only lowercase letters.`);
      return null;
    }

    // Validate question format (allow natural language but keep it reasonable)
    if (!/^[a-zA-Z0-9\s,.'?!-]+$/.test(question)) {
      functions.logger.warn(
        `Question contains invalid characters: "${question}". Must contain only letters, numbers, spaces, and basic punctuation.`,
      );
      return null;
    }

    functions.logger.info(`Generated valid riddle: "${question}" → "${answer}" (${answer.length} chars)`);
    return [question, answer];
  } catch (error) {
    functions.logger.error(`Error generating riddle with OpenAI (model: ${model}):`, error);
    captureException(error);
    return null; // Return null on error to prevent breaking the loop
  }
}

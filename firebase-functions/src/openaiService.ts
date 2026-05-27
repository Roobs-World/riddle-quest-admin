import OpenAI from "openai";
import {zodResponseFormat} from "openai/helpers/zod";
import * as functions from "firebase-functions";
import {z} from "zod";
import {captureException, withSentrySpan} from "./sentry";
import {clueContainsLiteralAnswer} from "./riddleQuality";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "./constants";

// Lazy initialization variable
let openaiClient: OpenAI | null = null;

export const GeneratedRiddleSchema = z
  .object({
    question: z.string().min(10).max(90).regex(/^[a-zA-Z0-9\s,.'?!-]+$/),
    answer: z
      .string()
      .min(1)
      .max(MAX_RIDDLE_ANSWER_CHARACTERS)
      .regex(/^[a-z]+$/),
  })
  .strict();

type GeneratedRiddle = z.infer<typeof GeneratedRiddleSchema>;

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

function summarizeZodIssues(issues: {path: PropertyKey[]; message: string}[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function validateGeneratedRiddle(generatedRiddle: GeneratedRiddle): [string, string] | null {
  const question = generatedRiddle.question.trim();
  const answer = generatedRiddle.answer.trim();

  if (!question || !answer) {
    functions.logger.warn("Question or answer is empty after structured parsing.");
    return null;
  }

  if (clueContainsLiteralAnswer(question, answer)) {
    functions.logger.warn(`Question reveals the literal answer: "${question}" -> "${answer}".`);
    return null;
  }

  if (answer.length > MAX_RIDDLE_ANSWER_CHARACTERS) {
    functions.logger.warn(
      `Answer too long: "${answer}" (${answer.length} characters). Must be ${MAX_RIDDLE_ANSWER_CHARACTERS} or fewer.`,
    );
    return null;
  }

  if (!/^[a-z]+$/.test(answer)) {
    functions.logger.warn(`Answer contains invalid characters: "${answer}". Must be only lowercase letters.`);
    return null;
  }

  if (!/^[a-zA-Z0-9\s,.'?!-]+$/.test(question)) {
    functions.logger.warn(
      `Question contains invalid characters: "${question}". Must contain only letters, numbers, spaces, and basic punctuation.`,
    );
    return null;
  }

  const validation = GeneratedRiddleSchema.safeParse({question, answer});
  if (!validation.success) {
    functions.logger.warn(`Generated riddle failed schema validation: ${summarizeZodIssues(validation.error.issues)}`);
    return null;
  }

  return [validation.data.question, validation.data.answer];
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
    const completion = await withSentrySpan(
      "openai.generateUniqueRiddle",
      "ai.generate",
      () =>
        openai.chat.completions.parse({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a creative riddle designer for a mobile word game. Generate a single original, engaging pub-quiz style riddle question that feels fresh and accessible to a broad audience. " +
                "To increase variety, internally pick one broad pub-quiz subject and one clue style before writing. " +
                "Use subjects people normally encounter at pub quizzes, including music, history, science, film and TV, sport, geography, literature and language, food and drink, art and culture, general knowledge, nature, technology, and everyday life. " +
                "Rotate subjects over time and avoid overusing any single category. " +
                "Vary clue styles: mini-scene, indirect trivia clue, compare/contrast, personification, light misdirection, playful logic, metaphor, or subtle wordplay. " +
                "Make each clue fair, specific, and solvable with one clear answer; avoid obscure specialist trivia, vague clues, and clues that could fit many answers. " +
                "Do not rely on the same opening pattern every time, especially not repeated 'What am I?' phrasing. " +
                "Keep clues solvable, fair, and fun for mobile players.",
            },
            {
              role: "user",
              content:
                "Generate a unique riddle as a JSON object matching the provided response schema with question and answer fields.\n\n" +
                "Requirements:\n" +
                "- Question: 10-90 characters, use natural language with proper grammar and punctuation\n" +
                "- Question must be a clue, not the answer itself, and must not include the answer word anywhere\n" +
                `- Answer: MAXIMUM ${MAX_RIDDLE_ANSWER_CHARACTERS} characters, use ONLY lowercase letters (a-z), absolutely NO punctuation, NO numbers, NO special characters, NO apostrophes, NO hyphens\n` +
                "- Content: Engaging, all-ages, and suitable for a wide audience of casual mobile game players\n" +
                "- Topic scope: Root the riddle in one broad pub-quiz subject such as music, history, general knowledge, film and TV, sport, geography, science, literature and language, food and drink, art and culture, nature, technology, or everyday life\n" +
                "- Pub quiz feel: Ask as a clue-based trivia style prompt while still feeling like a riddle\n" +
                "- Clue quality: Give enough concrete detail to point to one clear answer, but do not make the solution obvious\n" +
                "- Accessibility: Prefer familiar knowledge over niche facts, obscure proper nouns, or specialist trivia\n" +
                "- Safety against spoilers: Do not include the answer, close variants, plurals, or obvious word stems in the question\n" +
                "- Style diversity: Use a less common riddle angle, avoid generic textbook riddles, vague clues, and familiar tropes\n" +
                "- Question pattern variety: Prefer alternatives to plain 'What am I?' prompts (use first-person voice, situation-based clues, or indirect questions when possible)\n" +
                "- Originality: Must be completely unique, not a common or well-known riddle\n\n" +
                `The answer length and format are critical: it must never exceed ${MAX_RIDDLE_ANSWER_CHARACTERS} characters and must contain only lowercase letters.`,
            },
          ],
          response_format: zodResponseFormat(GeneratedRiddleSchema, "generated_riddle"),
        }),
      {model},
    );

    const generatedRiddle = completion.choices[0]?.message.parsed;
    if (!generatedRiddle) {
      functions.logger.warn("OpenAI returned empty structured riddle content.");
      return null;
    }

    const validatedRiddle = validateGeneratedRiddle(generatedRiddle);
    if (!validatedRiddle) {
      return null;
    }

    const [question, answer] = validatedRiddle;

    functions.logger.info(`Generated valid riddle: "${question}" -> "${answer}" (${answer.length} chars)`);
    return validatedRiddle;
  } catch (error) {
    functions.logger.error(`Error generating riddle with OpenAI (model: ${model}):`, error);
    captureException(error);
    return null; // Return null on error to prevent breaking the loop
  }
}

import OpenAI from "openai";

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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a creative riddle master for a mobile word game. Generate unique, engaging riddles that are fun and accessible to a wide audience. " +
            "Each riddle must be completely original and not repeat any previously generated content. " +
            "Avoid overusing 'What am I?' format - be creative with question styles. " +
            "Draw inspiration from popular culture, art, history, geography, music, film, gaming, and general knowledge to create interesting riddles.",
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
            "- Style: Creative, fun, and not overly difficult\n" +
            "- Originality: Must be completely unique, not a common or well-known riddle\n\n" +
            "The answer length is critical - it must never exceed 7 characters and must contain only lowercase letters.",
        },
      ],
    });

    const output = completion.choices[0].message.content;
    if (!output) {
      console.warn("OpenAI returned empty content.");
      return null;
    }

    const cleanedOutput = output.replace(/\*\*/g, "");

    // Look for the standard format: "Question:" and "Answer:"
    const questionMatch = cleanedOutput.match(/Question:\s*(.+?)(?=\nAnswer:)/s);
    const answerMatch = cleanedOutput.match(/Answer:\s*(.+?)(?:\n|$)/s);

    if (!questionMatch || !answerMatch) {
      console.warn("Could not parse question or answer from OpenAI output using standard format.");
      return null;
    }

    const question = questionMatch[1].trim();
    const answer = answerMatch[1].trim();

    if (!question || !answer) {
      console.warn("Question or answer is empty after parsing.");
      return null;
    }

    // Validate answer length (critical requirement)
    if (answer.length > 7) {
      console.warn(`Answer too long: "${answer}" (${answer.length} characters). Must be 7 or fewer.`);
      return null;
    }

    // Validate answer format (only lowercase letters)
    if (!/^[a-z]+$/.test(answer)) {
      console.warn(`Answer contains invalid characters: "${answer}". Must be only lowercase letters.`);
      return null;
    }

    // Validate question format (allow natural language but keep it reasonable)
    if (!/^[a-zA-Z0-9\s,.'?!-]+$/.test(question)) {
      console.warn(
        `Question contains invalid characters: "${question}". Must contain only letters, numbers, spaces, and basic punctuation.`,
      );
      return null;
    }

    console.log(`Generated valid riddle: "${question}" → "${answer}" (${answer.length} chars)`);
    return [question, answer];
  } catch (error) {
    console.error("Error generating riddle with OpenAI:", error);
    return null; // Return null on error to prevent breaking the loop
  }
}

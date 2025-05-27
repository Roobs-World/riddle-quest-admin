import "openai/shims/node";
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

  // Use Firebase function configuration for sensitive information
  // const openaiConfig = functions.config().openai;
  // const openAIKey = openaiConfig?.api_key; // Accessing openai.api_key
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
            "You are a creative assistant quiz master tasked with generating " +
            "unique riddles. Each riddle must be novel, not repeating any " +
            "previously generated riddles or answers. Try avoid using What " +
            "am I? for 5% of answers. Be more inventive. Use common " +
            "culture art history gaming geography music film or anything " +
            "used in a popular culture to generate a riddle",
        },
        {
          role: "user",
          content:
            "Generate a unique riddle with a question and answer format. " +
            "Ensure the answer only includes lowercase letters (a-z) and " +
            "does not contain any punctuation, numbers, or special " +
            "characters. Ensure the question only includes lowercase " +
            "letters (a-z) a comma or a question mark. The question " +
            "should be engaging and suitable for a wide audience, with a " +
            "length of 10-90 characters, and the answer should be " +
            "concise. Aim for light-hearted content suitable for a wide " +
            "mobile game audience. The riddle must be entirely new, not " +
            "repeating or closely resembling any previously created " +
            "riddles or common riddles known widely.",
        },
      ],
    });

    const output = completion.choices[0].message.content;
    if (!output) {
      console.warn("OpenAI returned empty content.");
      return null;
    }

    const cleanedOutput = output.replace(/\*\*/g, "");

    let splitIndex = cleanedOutput.lastIndexOf("\n\n");
    if (splitIndex === -1) {
      splitIndex = cleanedOutput.indexOf("\nAnswer:");
    }

    if (splitIndex === -1) {
      console.warn("Could not find separator in OpenAI output.");
      return null;
    }

    const question = cleanedOutput.substring(0, splitIndex).trim().replace("Question: ", "");
    const answerPart = cleanedOutput.substring(splitIndex);

    if (!answerPart.includes(":")) {
      console.warn("Could not find answer separator in OpenAI output.");
      return null;
    }
    const answer = answerPart.split(":")[1]?.trim();

    if (!question || !answer) {
      console.warn("Could not parse question or answer from OpenAI output.");
      return null;
    }

    // Check for duplicates against existing riddles (This check will be moved
    // outside this service)
    // For now, just return the generated riddle
    console.log(`Generated potential riddle: ${question} (${answer.length} letters)`);
    return [question, answer];
  } catch (error) {
    console.error("Error generating riddle with OpenAI:", error);
    return null; // Return null on error to prevent breaking the loop
  }
}

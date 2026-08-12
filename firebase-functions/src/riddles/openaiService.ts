import OpenAI from "openai";
import {zodTextFormat} from "openai/helpers/zod";
import * as functions from "firebase-functions";
import {z} from "zod";
import {captureException, withSentrySpan} from "../shared/sentry";
import {clueContainsLiteralAnswer} from "./riddleQuality";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../shared/constants";
import {type SupportedLocale} from "@qwordly/core/validation";
import {getSafeErrorMetadata} from "../shared/errorMetadata";

// Lazy initialization variable
/** Provides openai client behavior. */
let openaiClient: OpenAI | null = null;

/** Validates the open ai generated riddle data shape. */
const OpenAIGeneratedRiddleSchema = z
  .object({
    question: z.string().min(10).max(120),
    answer: z.string().min(1).max(MAX_RIDDLE_ANSWER_CHARACTERS),
  })
  .strict();

/** Validates the open ai riddle review data shape. */
const OpenAIRiddleReviewSchema = z
  .object({
    clueSupportsAnswer: z.boolean(),
    singleBestAnswer: z.boolean(),
    factuallySound: z.boolean(),
    naturalLanguage: z.boolean(),
    fairForCasualPlayers: z.boolean(),
    noAnswerSpoiler: z.boolean(),
    issues: z.array(z.string().min(1).max(160)).max(5),
  })
  .strict();

/** Validates the generated riddle data shape. */
export const GeneratedRiddleSchema = z
  .object({
    question: z
      .string()
      .min(10)
      .max(120)
      .regex(/^[\p{L}\p{M}\p{N}\p{P}\s]+$/u),
    answer: z
      .string()
      .min(1)
      .max(MAX_RIDDLE_ANSWER_CHARACTERS)
      .regex(/^[a-z]+$/),
  })
  .strict();

/** Describes generated riddle. */
type GeneratedRiddle = z.infer<typeof GeneratedRiddleSchema>;
/** Describes riddle review. */
type RiddleReview = z.infer<typeof OpenAIRiddleReviewSchema>;

/** Defines the default openai model value. */
const DEFAULT_OPENAI_MODEL = "gpt-5.6-sol";
/** Defines the riddle reasoning effort value. */
const RIDDLE_REASONING_EFFORT = "medium" as const;

/**
 * Resets the OpenAI client cache. Used for testing.
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

/** Gets locale specific prompt. */
const getLocaleSpecificPrompt = (locale: SupportedLocale): string => {
  if (locale === "en") {
    return "";
  }

  return (
    `Write the question naturally in ${locale}, using that locale's native script and everyday vocabulary. ` +
    "Adapt the clue, imagery, and references so they feel native to the locale rather than translated from English. " +
    "Prefer widely understood local concepts, idioms, foods, places, customs, and everyday objects that a native speaker would recognize immediately. " +
    "Avoid culture-specific references that only make sense in English or in a different country, and avoid obscure local trivia that would be unfair to a broad audience. " +
    "Return the answer as its standard unaccented lowercase Latin transliteration, using only letters a-z, and make the expected romanized spelling unambiguous."
  );
};

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

  openaiClient = new OpenAI({apiKey: openAIKey, timeout: 15_000, maxRetries: 0});
  return openaiClient;
}

/** Provides summarize zod issues behavior. */
function summarizeZodIssues(issues: {path: PropertyKey[]; message: string}[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/** Normalizes generated text. */
function normalizeGeneratedText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u2018\u2019\u201B\u2032]/gu, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/gu, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/gu, "-")
    .replace(/\u2026/gu, "...")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Validates generated riddle. */
function validateGeneratedRiddle(generatedRiddle: GeneratedRiddle): [string, string] | null {
  const question = normalizeGeneratedText(generatedRiddle.question);
  const answer = normalizeGeneratedText(generatedRiddle.answer).toLocaleLowerCase();

  if (!question || !answer) {
    functions.logger.warn("Question or answer is empty after structured parsing.");
    return null;
  }

  if (clueContainsLiteralAnswer(question, answer)) {
    functions.logger.warn("Generated question revealed its answer and was rejected.");
    return null;
  }

  if (answer.length > MAX_RIDDLE_ANSWER_CHARACTERS) {
    functions.logger.warn("Generated answer exceeded the maximum playable length and was rejected.", {
      answerLength: answer.length,
      maximumLength: MAX_RIDDLE_ANSWER_CHARACTERS,
    });
    return null;
  }

  if (!/^[a-z]+$/.test(answer)) {
    functions.logger.warn("Generated answer was not compatible with the in-game keyboard and was rejected.");
    return null;
  }

  if (!/^[\p{L}\p{M}\p{N}\p{P}\s]+$/u.test(question)) {
    functions.logger.warn("Generated question contained invalid characters and was rejected.");
    return null;
  }

  const validation = GeneratedRiddleSchema.safeParse({question, answer});
  if (!validation.success) {
    functions.logger.warn(`Generated riddle failed schema validation: ${summarizeZodIssues(validation.error.issues)}`);
    return null;
  }

  return [validation.data.question, validation.data.answer];
}

/** Gets reasoning settings. */
function getReasoningSettings(
  model: string,
): {reasoning: {effort: typeof RIDDLE_REASONING_EFFORT}} | Record<string, never> {
  return model.startsWith("gpt-5.6") ? {reasoning: {effort: RIDDLE_REASONING_EFFORT}} : {};
}

/** Provides review passed behavior. */
function reviewPassed(review: RiddleReview): boolean {
  return (
    review.clueSupportsAnswer &&
    review.singleBestAnswer &&
    review.factuallySound &&
    review.naturalLanguage &&
    review.fairForCasualPlayers &&
    review.noAnswerSpoiler &&
    review.issues.length === 0
  );
}

/** Provides review generated riddle behavior. */
async function reviewGeneratedRiddle(
  openai: OpenAI,
  model: string,
  locale: SupportedLocale,
  question: string,
  answer: string,
): Promise<boolean> {
  const completion = await withSentrySpan(
    "openai.reviewGeneratedRiddle",
    "ai.review",
    () =>
      openai.responses.parse({
        model,
        ...getReasoningSettings(model),
        instructions:
          "You are the independent quality editor for an all-ages mobile riddle game. " +
          "Review the candidate strictly; do not repair it and do not give it the benefit of the doubt. " +
          "A passing clue must logically and factually support the supplied answer, make that answer clearly better than other plausible answers, read naturally in the target language, and be fair to casual players. " +
          "Reject vague clues, strained associations, incorrect facts, translation-like wording, obscure trivia, and clues that reveal the answer or an obvious variant. " +
          "Set every check independently. If any check fails, add a short, concrete issue. Return no issues only when every check passes.",
        input: JSON.stringify({targetLocale: locale, candidate: {question, answer}}),
        prompt_cache_key: "riddlequest-riddle-review-v1",
        store: false,
        text: {format: zodTextFormat(OpenAIRiddleReviewSchema, "riddle_review"), verbosity: "low"},
      }),
    {model, locale},
  );

  const review = completion.output_parsed;
  if (!review) {
    functions.logger.warn("OpenAI returned empty riddle review content.");
    return false;
  }

  if (!reviewPassed(review)) {
    functions.logger.warn("Generated riddle was rejected by quality review.", {
      issueCount: review.issues.length,
      failedChecks: {
        clueSupportsAnswer: !review.clueSupportsAnswer,
        singleBestAnswer: !review.singleBestAnswer,
        factuallySound: !review.factuallySound,
        naturalLanguage: !review.naturalLanguage,
        fairForCasualPlayers: !review.fairForCasualPlayers,
        noAnswerSpoiler: !review.noAnswerSpoiler,
      },
    });
    return false;
  }

  return true;
}

/**
 * Generates a single unique riddle using OpenAI.
 * @return {Promise<[string, string] | null>} A promise that resolves with a
 *   riddle [question, answer] or null if generation fails or is a duplicate.
 */
export async function generateUniqueRiddle(
  locale: SupportedLocale = "en",
  excludedAnswers: string[] = [],
): Promise<[string, string] | null> {
  const openai = initializeOpenAIClient();
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const localePrompt = getLocaleSpecificPrompt(locale);
  const answerExclusionPrompt =
    excludedAnswers.length > 0
      ? `\n- Do not use any answer in this exclusion list: ${JSON.stringify(
          [...new Set(excludedAnswers.map((answer) => normalizeGeneratedText(answer).toLocaleLowerCase()))].slice(-80),
        )}.`
      : "";

  try {
    const completion = await withSentrySpan(
      "openai.generateUniqueRiddle",
      "ai.generate",
      () =>
        openai.responses.parse({
          model,
          ...getReasoningSettings(model),
          instructions:
            "You design original, all-ages riddles for a mobile word game. Create one concise pub-quiz-style clue with exactly one natural answer. " +
            "Before returning it, silently verify that every detail is factually correct, each detail points to the supplied answer, and no other familiar answer fits equally well. " +
            "Use concrete, mutually reinforcing details instead of vague poetic associations. Prefer familiar knowledge and everyday concepts over specialist trivia or obscure proper nouns. " +
            "Vary subjects and clue structures; avoid stock riddles, repeated 'What am I?' openings, and awkward attempts at wordplay. " +
            "The clue must sound natural when read aloud and the answer must be the word a typical player would give without needing an explanation. " +
            localePrompt,
          input:
            `Return one riddle for locale "${locale}" as question and answer fields.\n` +
            "- Question: 10-120 characters; grammatical, natural, and specific.\n" +
            `- Answer: 1-${MAX_RIDDLE_ANSWER_CHARACTERS} lowercase characters using only a-z; no accents, spaces, digits, apostrophes, or hyphens.\n` +
            "- Use two or more compatible clue details that converge on one answer.\n" +
            "- Do not include the answer, a plural, close variant, or obvious word stem in the clue.\n" +
            "- Reject your own candidate and create another if the answer needs a strained interpretation, a disputed fact, or could be replaced by another common answer.\n" +
            "- Keep it engaging and suitable for casual players of all ages.\n" +
            "- Make it original in wording and angle, without sacrificing clarity or fairness." +
            answerExclusionPrompt,
          prompt_cache_key: "riddlequest-riddle-generation-v1",
          store: false,
          text: {format: zodTextFormat(OpenAIGeneratedRiddleSchema, "generated_riddle"), verbosity: "low"},
        }),
      {model, locale},
    );

    const generatedRiddle = completion.output_parsed;
    if (!generatedRiddle) {
      functions.logger.warn("OpenAI returned empty structured riddle content.");
      return null;
    }

    const validatedRiddle = validateGeneratedRiddle(generatedRiddle);
    if (!validatedRiddle) {
      return null;
    }

    const [question, answer] = validatedRiddle;
    const accepted = await reviewGeneratedRiddle(openai, model, locale, question, answer);
    if (!accepted) {
      return null;
    }

    functions.logger.info("Generated and quality-approved a riddle.", {answerLength: answer.length});
    return validatedRiddle;
  } catch (error) {
    functions.logger.error("OpenAI riddle generation failed.", {model, ...getSafeErrorMetadata(error)});
    captureException(error);
    return null; // Return null on error to prevent breaking the loop
  }
}

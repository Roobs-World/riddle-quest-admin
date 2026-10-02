import OpenAI from "openai";
import type {RaceCategoryId} from "@qwordly/core/race";
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
    difficulty: z.enum(["easy", "medium", "hard"]),
    categoryMatch: z.boolean(),
    issues: z.array(z.string().min(1).max(160)).max(5),
  })
  .strict();

/** Validates a blind solve performed before the proposed answer is revealed. */
const OpenAIBlindSolveSchema = z
  .object({
    answer: z
      .string()
      .min(1)
      .max(MAX_RIDDLE_ANSWER_CHARACTERS)
      .regex(/^[a-z]+$/),
    confidence: z.enum(["high", "medium", "low"]),
    alternativeAnswers: z.array(z.string().min(1).max(40)).max(3),
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
/** Describes a reviewer's answer when it has not seen the generated answer. */
type BlindSolve = z.infer<typeof OpenAIBlindSolveSchema>;

/** Pins authoring, blind solving, and review to the requested model. */
export const RIDDLE_GENERATION_MODEL = "gpt-6.1-sol";
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
  /** Provides open ai key behavior. */
  const openAIKey = process.env.OPENAI_API_KEY;

  // Ensure environment variables are set
  if (!openAIKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  openaiClient = new OpenAI({apiKey: openAIKey, timeout: 15_000, maxRetries: 0});
  return openaiClient;
}

/** Provides summarize zod issues behavior. */
function summarizeZodIssues(
  issues: {
    /** Stores path. */
    path: PropertyKey[]; /** Stores message. */
    /** Stores message. */
    message: string;
  }[],
): string {
  return issues
    .map((issue) => {
      /** Provides path behavior. */
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
  /** Provides question behavior. */
  const question = normalizeGeneratedText(generatedRiddle.question);
  /** Provides answer behavior. */
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

  /** Provides validation behavior. */
  const validation = GeneratedRiddleSchema.safeParse({question, answer});
  if (!validation.success) {
    functions.logger.warn(`Generated riddle failed schema validation: ${summarizeZodIssues(validation.error.issues)}`);
    return null;
  }

  return [validation.data.question, validation.data.answer];
}

/** Context shared by the author and independent editor. */
export type RiddleGenerationOptions = {
  /** Durable supply workers can spend longer per model request without delaying gameplay. */
  background?: boolean;
  /** Stores mode. */
  mode?: "classic" | "daily" | "multiplayer";
  /** Stores category id. */
  categoryId?: RaceCategoryId;
  /** Stores difficulty. */
  difficulty?: "easy" | "medium";
  /** Stores excluded questions. */
  excludedQuestions?: string[];
};

/** Offline bank authoring can wait longer without extending player-facing supply deadlines. */
const requestOptions = (options: RiddleGenerationOptions) => ({
  timeout: options.mode === "multiplayer" || options.background ? 60_000 : 15_000,
});

/** Defines difficulty by knowledge and inference rather than answer length. */
function getGenerationBrief(options: RiddleGenerationOptions): string {
  /** Provides mode behavior. */
  const mode = options.mode ?? "classic";
  return (
    `Mode: ${mode}. ` +
    "ONLY easy or medium riddles and questions. Easy means immediate recognition from everyday knowledge; medium means one straightforward inference from familiar facts. No specialist knowledge, obscure dates, trick wording, or multi-step deductions. " +
    (mode === "multiplayer"
      ? "This is a timed multiplayer race. "
      : mode === "daily"
        ? "Create a satisfying daily puzzle with a small aha moment, solvable from familiar knowledge and one fair inference. "
        : "Create a varied, accessible classic riddle with concrete clues and a satisfying deduction. ") +
    "Judge difficulty by the knowledge and reasoning needed, never by answer length. " +
    (options.difficulty ? `Required difficulty: ${options.difficulty}. ` : "Target easy to medium difficulty. ") +
    (options.difficulty === "medium"
      ? "Use an indirect clue that requires combining two familiar facts into one small deduction, rather than a direct definition or simple name recall. Keep all needed information in the clue. "
      : "") +
    (options.categoryId ? `Required subject category: ${options.categoryId}. ` : "")
  );
}

/** Compares punctuation and spacing variants without altering playable text. */
const comparisonKey = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\p{S}\s]+/gu, "");

/** Provides review passed behavior. */
function reviewPassed(review: RiddleReview, options: RiddleGenerationOptions): boolean {
  return (
    review.clueSupportsAnswer &&
    review.singleBestAnswer &&
    review.factuallySound &&
    review.naturalLanguage &&
    review.fairForCasualPlayers &&
    review.noAnswerSpoiler &&
    (!options.categoryId || review.categoryMatch) &&
    (review.difficulty === "easy" || review.difficulty === "medium") &&
    (!options.difficulty || review.difficulty === options.difficulty) &&
    review.issues.length === 0
  );
}

/** Provides blind solve passed behavior. */
function blindSolvePassed(solve: BlindSolve, answer: string): boolean {
  return (
    normalizeGeneratedText(solve.answer).toLocaleLowerCase() === answer &&
    solve.confidence === "high" &&
    solve.alternativeAnswers.length === 0
  );
}

/** Solves a clue without exposing the proposed answer. */
async function blindSolveGeneratedRiddle(
  openai: OpenAI,
  model: string,
  locale: SupportedLocale,
  question: string,
  answer: string,
  options: RiddleGenerationOptions,
): Promise<boolean> {
  /** Provides completion behavior. */
  const completion = await withSentrySpan(
    "openai.blindSolveGeneratedRiddle",
    "ai.review",
    () =>
      openai.responses.parse(
        {
          model,
          reasoning: {effort: RIDDLE_REASONING_EFFORT},
          instructions:
            "Solve the supplied mobile-game riddle exactly as a casual player would. You have not been given the author's answer. " +
            "Return the single lowercase a-z answer you would enter, your honest confidence, and up to three other genuinely plausible answers. " +
            "Use high confidence only when the clue clearly converges on one familiar answer and its expected romanized spelling is unambiguous. " +
            "Do not invent extra facts or explain away ambiguity.",
          input: JSON.stringify({targetLocale: locale, question}),
          prompt_cache_key: "riddlequest-riddle-blind-solve-v1",
          store: false,
          text: {format: zodTextFormat(OpenAIBlindSolveSchema, "riddle_blind_solve"), verbosity: "low"},
        },
        requestOptions(options),
      ),
    {model, locale},
  );

  /** Provides solve behavior. */
  const solve = completion.output_parsed;
  if (!solve) {
    functions.logger.warn("OpenAI returned empty blind-solve content.");
    return false;
  }

  if (!blindSolvePassed(solve, answer)) {
    functions.logger.warn("Generated riddle failed the blind-solve check.", {
      answerMatched: normalizeGeneratedText(solve.answer).toLocaleLowerCase() === answer,
      confidence: solve.confidence,
      alternativeCount: solve.alternativeAnswers.length,
    });
    return false;
  }

  return true;
}

/** Provides review generated riddle behavior. */
async function reviewGeneratedRiddle(
  openai: OpenAI,
  model: string,
  locale: SupportedLocale,
  question: string,
  answer: string,
  options: RiddleGenerationOptions,
): Promise<boolean> {
  /** Provides completion behavior. */
  const completion = await withSentrySpan(
    "openai.reviewGeneratedRiddle",
    "ai.review",
    () =>
      openai.responses.parse(
        {
          model,
          reasoning: {effort: RIDDLE_REASONING_EFFORT},
          instructions:
            "You are the independent quality editor for an all-ages mobile riddle game. " +
            "Review the candidate strictly; do not repair it and do not give it the benefit of the doubt. " +
            "The question must read naturally in the target locale. The game keyboard requires every answer to use only lowercase letters a-z: for non-Latin scripts, the supplied answer must be the standard unaccented Latin transliteration of the intended native word. " +
            "Check that the transliteration is correct and unambiguous, but do not reject a correct transliteration merely because the native language uses a different script. " +
            "A passing clue must logically and factually support the supplied answer, make that answer clearly better than other plausible answers, read naturally in the target language, and be fair to casual players. " +
            "Reject vague clues, strained associations, incorrect facts, translation-like wording, obscure trivia, and clues that reveal the answer or an obvious variant. " +
            "Assess difficulty honestly as easy, medium, or hard. Easy is everyday recognition; medium is one straightforward inference; hard needs specialist knowledge or multiple deductions. " +
            "Set categoryMatch only if the candidate fits the requested subject, or if no subject is requested. Reject time-sensitive facts, unsafe or adult content, and near-paraphrases of excluded questions. " +
            getGenerationBrief(options) +
            "Set every check independently. If any check fails, add a short, concrete issue. Return no issues only when every check passes.",
          input: JSON.stringify({
            targetLocale: locale,
            candidate: {question, answer},
            excludedQuestions: options.excludedQuestions?.slice(-40) ?? [],
          }),
          prompt_cache_key: "riddlequest-riddle-review-v2",
          store: false,
          text: {format: zodTextFormat(OpenAIRiddleReviewSchema, "riddle_review"), verbosity: "low"},
        },
        requestOptions(options),
      ),
    {model, locale},
  );

  /** Provides review behavior. */
  const review = completion.output_parsed;
  if (!review) {
    functions.logger.warn("OpenAI returned empty riddle review content.");
    return false;
  }

  if (!reviewPassed(review, options)) {
    functions.logger.warn("Generated riddle was rejected by quality review.", {
      issueCount: review.issues.length,
      failedChecks: {
        clueSupportsAnswer: !review.clueSupportsAnswer,
        singleBestAnswer: !review.singleBestAnswer,
        factuallySound: !review.factuallySound,
        naturalLanguage: !review.naturalLanguage,
        fairForCasualPlayers: !review.fairForCasualPlayers,
        noAnswerSpoiler: !review.noAnswerSpoiler,
        categoryMatch: !review.categoryMatch,
        difficultyMatch:
          !(review.difficulty === "easy" || review.difficulty === "medium") ||
          Boolean(options.difficulty && review.difficulty !== options.difficulty),
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
  options: RiddleGenerationOptions = {},
): Promise<[string, string] | null> {
  /** Provides openai behavior. */
  const openai = initializeOpenAIClient();
  /** Provides model behavior. */
  const model = RIDDLE_GENERATION_MODEL;
  /** Provides locale prompt behavior. */
  const localePrompt = getLocaleSpecificPrompt(locale);
  /** Provides answer exclusion prompt behavior. */
  const answerExclusionPrompt =
    excludedAnswers.length > 0
      ? `\n- Do not use any answer in this exclusion list: ${JSON.stringify(
          [...new Set(excludedAnswers.map((answer) => normalizeGeneratedText(answer).toLocaleLowerCase()))],
        )}.`
      : "";

  try {
    /** Provides completion behavior. */
    const completion = await withSentrySpan(
      "openai.generateUniqueRiddle",
      "ai.generate",
      () =>
        openai.responses.parse(
          {
            model,
            reasoning: {effort: RIDDLE_REASONING_EFFORT},
            instructions:
              "You design original, all-ages riddles for a mobile word game. Create one concise pub-quiz-style clue with exactly one natural answer. " +
              "Before returning it, silently verify that every detail is factually correct, each detail points to the supplied answer, and no other familiar answer fits equally well. " +
              "Use concrete, mutually reinforcing details instead of vague poetic associations. Prefer familiar knowledge and everyday concepts over specialist trivia or obscure proper nouns. " +
              "Vary subjects and clue structures; avoid stock riddles, repeated 'What am I?' openings, and awkward attempts at wordplay. " +
              "The clue must sound natural when read aloud and the answer must be the word a typical player would give without needing an explanation. " +
              "Avoid facts that change over time, answer spelling traps, and questions that require a particular regional spelling. " +
              getGenerationBrief(options) +
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
              answerExclusionPrompt +
              `\n- Do not repeat or lightly paraphrase these previous questions: ${JSON.stringify(options.excludedQuestions?.slice(-40) ?? [])}.`,
            prompt_cache_key: "riddlequest-riddle-generation-v2",
            store: false,
            text: {format: zodTextFormat(OpenAIGeneratedRiddleSchema, "generated_riddle"), verbosity: "low"},
          },
          requestOptions(options),
        ),
      {model, locale},
    );

    /** Provides generated riddle behavior. */
    const generatedRiddle = completion.output_parsed;
    if (!generatedRiddle) {
      functions.logger.warn("OpenAI returned empty structured riddle content.");
      return null;
    }

    /** Validates d riddle. */
    const validatedRiddle = validateGeneratedRiddle(generatedRiddle);
    if (!validatedRiddle) {
      return null;
    }

    /** Provides [question, answer] behavior. */
    const [question, answer] = validatedRiddle;
    if (
      excludedAnswers.some((previous) => comparisonKey(previous) === comparisonKey(answer)) ||
      options.excludedQuestions?.some((previous) => comparisonKey(previous) === comparisonKey(question))
    ) {
      functions.logger.warn("Generated riddle repeated excluded content and was rejected.");
      return null;
    }
    /** Provides solved behavior. */
    const solved = await blindSolveGeneratedRiddle(openai, model, locale, question, answer, options);
    if (!solved) {
      return null;
    }
    /** Provides accepted behavior. */
    const accepted = await reviewGeneratedRiddle(openai, model, locale, question, answer, options);
    if (!accepted) {
      return null;
    }

    functions.logger.info("Generated and quality-approved a riddle.", {answerLength: answer.length});
    return validatedRiddle;
  } catch (error) {
    functions.logger.error("OpenAI riddle generation failed.", {model, ...getSafeErrorMetadata(error)});
    captureException(error, getSafeErrorMetadata(error));
    return null; // Return null on error to prevent breaking the loop
  }
}

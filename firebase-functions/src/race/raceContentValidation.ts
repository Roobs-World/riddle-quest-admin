import {RACE_ANSWER_TEXT_UNITS, RACE_CATEGORY_IDS, RacePreloadedRiddleSchema, RaceRiddlePromptSchema, type RaceCategoryId, type RaceDifficultyBand} from "../../../src/races/contracts/index.js";
import {splitGraphemes} from "../../../src/gameplay/input/graphemes.js";
import {type SupportedLocale} from "../../../src/localization/locales.js";
import {clueContainsLiteralAnswer} from "../riddles/riddleQuality";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../shared/constants";
import type {ExistingRaceContentRecord} from "./raceContentMigration";

/** Maximum number of eligible riddles in each locale and race category pool. */
export const RACE_POOL_SIZE = 30;

/** Number of riddles selected from each difficulty band for a race deck. */
export const RACE_DECK_DIFFICULTY_COUNTS = {easy: 10, medium: 5, hard: 0} as const;

/** Minimum pool size needed to supply the unchanged race deck. */
export const RACE_MIN_POOL_SIZE = Object.values(RACE_DECK_DIFFICULTY_COUNTS).reduce<number>((total, count) => total + count, 0);

/** Stable machine-readable reason for a race content validation failure. */
export type RacePoolIssueCode =
  | "insufficient_pool"
  | "oversized_pool"
  | "missing_metadata"
  | "duplicate_question"
  | "duplicate_answer"
  | "duplicate_canonical"
  | "clue_leaks_answer"
  | "answer_too_long"
  | "missing_translation"
  | "difficulty_imbalance";

/** One actionable issue found while validating a race content pool. */
export type RacePoolIssue = {
  /** Stores code. */
  code: RacePoolIssueCode;
  /** Stores message. */
  message: string;
  /** Stores document paths. */
  documentPaths: string[];
};

/** Full validation result for one locale and race category. */
export type RacePoolValidation = {
  /** Stores valid. */
  valid: boolean;
  /** Stores locale. */
  locale: SupportedLocale;
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Stores eligible count. */
  eligibleCount: number;
  /** Stores difficulty counts. */
  difficultyCounts: Record<RaceDifficultyBand, number>;
  /** Stores issues. */
  issues: RacePoolIssue[];
};

/** Provides normalize behavior. */
const normalize = (value: string, locale: SupportedLocale): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase(locale).replace(/\s+/gu, " ");

/** Indicates whether is category. */
const isCategory = (value: unknown): value is RaceCategoryId =>
  typeof value === "string" && (RACE_CATEGORY_IDS as readonly string[]).includes(value);

/** Indicates whether is difficulty. */
const isDifficulty = (value: unknown): value is RaceDifficultyBand =>
  value === "easy" || value === "medium" || value === "hard";

/** Provides belongs to category behavior. */
const belongsToCategory = (record: ExistingRaceContentRecord, categoryId: RaceCategoryId): boolean =>
  record.data.categoryId === categoryId;

/** Validates pool size, metadata, uniqueness, translations, and difficulty balance. */
export function validateRacePool(
  records: ExistingRaceContentRecord[],
  options: {
    /** Stores locale. */
    locale: SupportedLocale;
    /** Stores category id. */
    categoryId: RaceCategoryId;
    /** Stores required locales. */
    requiredLocales?: readonly SupportedLocale[];
    /** Stores pool size. */
    poolSize?: number;
  },
): RacePoolValidation {
  /** Provides pool size behavior. */
  const maximumPoolSize = options.poolSize ?? RACE_POOL_SIZE;
  /** Minimum accepted pool size, or the explicit fixed-size override. */
  const minimumPoolSize = options.poolSize ?? RACE_MIN_POOL_SIZE;
  /** Provides locale records behavior. */
  const localeRecords = records.filter(
    (record) =>
      record.locale === options.locale &&
      record.data.raceEligible === true &&
      belongsToCategory(record, options.categoryId),
  );
  /** Provides difficulty counts behavior. */
  const difficultyCounts: Record<RaceDifficultyBand, number> = {easy: 0, medium: 0, hard: 0};
  /** Provides issues behavior. */
  const issues: RacePoolIssue[] = [];
  /** Provides questions behavior. */
  const questions = new Map<string, string[]>();
  /** Provides answers behavior. */
  const answers = new Map<string, string[]>();
  /** Provides canonicals behavior. */
  const canonicals = new Map<string, string[]>();
  /** Provides locales by canonical behavior. */
  const localesByCanonical = new Map<string, Set<SupportedLocale>>();

  for (const record of records.filter(
    (candidate) => candidate.data.raceEligible === true && belongsToCategory(candidate, options.categoryId),
  )) {
    /** Provides canonical behavior. */
    const canonical = typeof record.data.canonicalRiddleId === "string" ? record.data.canonicalRiddleId : null;
    if (canonical) {
      /** Provides locales behavior. */
      const locales = localesByCanonical.get(canonical) ?? new Set<SupportedLocale>();
      locales.add(record.locale);
      localesByCanonical.set(canonical, locales);
    }
  }

  for (const record of localeRecords) {
    /** Provides {data} behavior. */
    const {data} = record;
    /** Provides question behavior. */
    const question = typeof data.text === "string" ? data.text.trim() : "";
    /** Provides answer behavior. */
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    /** Oversized original text cannot enter Unicode duplicate/leak processing or published evaluation. */
    const answerWithinTextBudget = answer.length <= RACE_ANSWER_TEXT_UNITS;
    /** Native race edits discard whitespace-only NFC slots; bounded segmentation also supplies the slot count. */
    const answerSlots = answerWithinTextBudget ? splitGraphemes(answer, options.locale) : [];
    /** Published identity must be valid and unchanged by the client prompt schema's normalization. */
    const identity = RaceRiddlePromptSchema.shape.riddleId.safeParse(data.riddleId);
    /** Catalog readiness uses the same trimmed clue bounds as both published race response formats. */
    const clue = RaceRiddlePromptSchema.shape.text.safeParse(data.text);
    if (
      !identity.success || identity.data !== data.riddleId ||
      typeof data.canonicalRiddleId !== "string" ||
      !isCategory(data.categoryId) ||
      !isDifficulty(data.difficultyBand) ||
      typeof data.qualityVersion !== "string" ||
      !clue.success ||
      !answer || data.answer !== answer || answerSlots.some(slot => !slot.trim())
    ) {
      issues.push({
        code: "missing_metadata",
        message: "Race-eligible content requires canonical ID, category, difficulty, quality version, clue, and answer",
        documentPaths: [record.documentPath],
      });
      continue;
    }

    difficultyCounts[data.difficultyBand] += 1;
    /** Normalizes d question. */
    const normalizedQuestion = normalize(question, options.locale);
    canonicals.set(data.canonicalRiddleId, [...(canonicals.get(data.canonicalRiddleId) ?? []), record.documentPath]);
    questions.set(normalizedQuestion, [...(questions.get(normalizedQuestion) ?? []), record.documentPath]);
    if (answerWithinTextBudget) {
      /** Only bounded answer text can contribute useful playable duplicate diagnostics. */
      const normalizedAnswer = normalize(answer, options.locale);
      answers.set(normalizedAnswer, [...(answers.get(normalizedAnswer) ?? []), record.documentPath]);
    }

    if (answerWithinTextBudget && clueContainsLiteralAnswer(question, answer, options.locale)) {
      issues.push({
        code: "clue_leaks_answer",
        message: "Clue contains its literal answer",
        documentPaths: [record.documentPath],
      });
    }
    /** Immutable answers must fit the exact evaluation contract as well as the locale-aware slot limit. */
    const publishedAnswer = RacePreloadedRiddleSchema.shape.evaluation.shape.answer.safeParse(data.answer);
    if (!publishedAnswer.success || answerSlots.length > MAX_RIDDLE_ANSWER_CHARACTERS) {
      issues.push({
        code: "answer_too_long",
        message: `Answer exceeds the game's ${MAX_RIDDLE_ANSWER_CHARACTERS}-slot or published text limits`,
        documentPaths: [record.documentPath],
      });
    }
  }

  for (const [question, documentPaths] of questions.entries()) {
    if (documentPaths.length > 1) {
      issues.push({code: "duplicate_question", message: `Duplicate clue: ${question}`, documentPaths});
    }
  }
  for (const [answer, documentPaths] of answers.entries()) {
    if (documentPaths.length > 1) {
      issues.push({code: "duplicate_answer", message: `Duplicate answer: ${answer}`, documentPaths});
    }
  }
  for (const [canonicalRiddleId, documentPaths] of canonicals.entries()) {
    if (documentPaths.length > 1) {
      issues.push({
        code: "duplicate_canonical",
        message: `Duplicate canonical riddle ID: ${canonicalRiddleId}`,
        documentPaths,
      });
    }
  }
  if (localeRecords.length < minimumPoolSize) {
    issues.push({
      code: "insufficient_pool",
      message: `Pool has ${localeRecords.length} eligible riddles; at least ${minimumPoolSize} required`,
      documentPaths: localeRecords.map((record) => record.documentPath),
    });
  }
  if (localeRecords.length > maximumPoolSize) {
    issues.push({
      code: "oversized_pool",
      message: `Pool has ${localeRecords.length} eligible riddles; at most ${maximumPoolSize} allowed`,
      documentPaths: localeRecords.map((record) => record.documentPath),
    });
  }

  /** Provides required locales behavior. */
  const requiredLocales = options.requiredLocales ?? [];
  for (const [canonicalRiddleId, presentLocales] of localesByCanonical.entries()) {
    /** Provides missing behavior. */
    const missing = requiredLocales.filter((locale) => !presentLocales.has(locale));
    if (missing.length > 0) {
      issues.push({
        code: "missing_translation",
        message: `${canonicalRiddleId} is missing locales: ${missing.join(", ")}`,
        documentPaths: [],
      });
    }
  }

  for (const [difficulty, count] of Object.entries(difficultyCounts) as Array<[RaceDifficultyBand, number]>) {
    /** Required minimum riddles for this difficulty band. */
    const minimum = RACE_DECK_DIFFICULTY_COUNTS[difficulty];
    if (localeRecords.length >= minimumPoolSize && localeRecords.length <= maximumPoolSize && count < minimum) {
      issues.push({
        code: "difficulty_imbalance",
        message: `${difficulty} has ${count} riddles; at least ${minimum} required`,
        documentPaths: [],
      });
    }
  }

  return {
    valid: issues.length === 0,
    locale: options.locale,
    categoryId: options.categoryId,
    eligibleCount: localeRecords.length,
    difficultyCounts,
    issues,
  };
}

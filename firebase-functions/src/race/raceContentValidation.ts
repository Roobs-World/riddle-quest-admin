import {RACE_CATEGORY_IDS, RACE_DECK_SIZE, type RaceCategoryId, type RaceDifficultyBand} from "@qwordly/core/race";
import {graphemeLength} from "@qwordly/core/game";
import {type SupportedLocale} from "@qwordly/core/validation";
import {clueContainsLiteralAnswer} from "../riddles/riddleQuality";
import {MAX_RIDDLE_ANSWER_CHARACTERS} from "../shared/constants";
import type {ExistingRaceContentRecord} from "./raceContentMigration";

export const RACE_POOL_SIZE = 30;

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

export type RacePoolIssue = {
  code: RacePoolIssueCode;
  message: string;
  documentPaths: string[];
};

export type RacePoolValidation = {
  valid: boolean;
  locale: SupportedLocale;
  categoryId: RaceCategoryId;
  eligibleCount: number;
  difficultyCounts: Record<RaceDifficultyBand, number>;
  issues: RacePoolIssue[];
};

const normalize = (value: string): string => value.normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/gu, " ");

const isCategory = (value: unknown): value is RaceCategoryId =>
  typeof value === "string" && (RACE_CATEGORY_IDS as readonly string[]).includes(value);

const isDifficulty = (value: unknown): value is RaceDifficultyBand =>
  value === "easy" || value === "medium" || value === "hard";

const belongsToCategory = (record: ExistingRaceContentRecord, categoryId: RaceCategoryId): boolean =>
  record.data.categoryId === categoryId;

export function validateRacePool(
  records: ExistingRaceContentRecord[],
  options: {
    locale: SupportedLocale;
    categoryId: RaceCategoryId;
    requiredLocales?: readonly SupportedLocale[];
    poolSize?: number;
  },
): RacePoolValidation {
  const poolSize = options.poolSize ?? RACE_POOL_SIZE;
  const localeRecords = records.filter(
    (record) =>
      record.locale === options.locale &&
      record.data.raceEligible === true &&
      belongsToCategory(record, options.categoryId),
  );
  const difficultyCounts: Record<RaceDifficultyBand, number> = {easy: 0, medium: 0, hard: 0};
  const issues: RacePoolIssue[] = [];
  const questions = new Map<string, string[]>();
  const answers = new Map<string, string[]>();
  const canonicals = new Map<string, string[]>();
  const localesByCanonical = new Map<string, Set<SupportedLocale>>();

  for (const record of records.filter(
    (candidate) => candidate.data.raceEligible === true && belongsToCategory(candidate, options.categoryId),
  )) {
    const canonical = typeof record.data.canonicalRiddleId === "string" ? record.data.canonicalRiddleId : null;
    if (canonical) {
      const locales = localesByCanonical.get(canonical) ?? new Set<SupportedLocale>();
      locales.add(record.locale);
      localesByCanonical.set(canonical, locales);
    }
  }

  for (const record of localeRecords) {
    const {data} = record;
    const question = typeof data.text === "string" ? data.text.trim() : "";
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    if (
      typeof data.canonicalRiddleId !== "string" ||
      !isCategory(data.categoryId) ||
      !isDifficulty(data.difficultyBand) ||
      typeof data.qualityVersion !== "string" ||
      !question ||
      !answer
    ) {
      issues.push({
        code: "missing_metadata",
        message: "Race-eligible content requires canonical ID, category, difficulty, quality version, clue, and answer",
        documentPaths: [record.documentPath],
      });
      continue;
    }

    difficultyCounts[data.difficultyBand] += 1;
    const normalizedQuestion = normalize(question);
    const normalizedAnswer = normalize(answer);
    canonicals.set(data.canonicalRiddleId, [...(canonicals.get(data.canonicalRiddleId) ?? []), record.documentPath]);
    questions.set(normalizedQuestion, [...(questions.get(normalizedQuestion) ?? []), record.documentPath]);
    answers.set(normalizedAnswer, [...(answers.get(normalizedAnswer) ?? []), record.documentPath]);

    if (clueContainsLiteralAnswer(question, answer)) {
      issues.push({
        code: "clue_leaks_answer",
        message: "Clue contains its literal answer",
        documentPaths: [record.documentPath],
      });
    }
    if (graphemeLength(answer, options.locale) > MAX_RIDDLE_ANSWER_CHARACTERS) {
      issues.push({
        code: "answer_too_long",
        message: `Answer exceeds the game limit of ${MAX_RIDDLE_ANSWER_CHARACTERS} characters`,
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
  if (localeRecords.length < poolSize) {
    issues.push({
      code: "insufficient_pool",
      message: `Pool has ${localeRecords.length} eligible riddles; exactly ${poolSize} required`,
      documentPaths: localeRecords.map((record) => record.documentPath),
    });
  }
  if (localeRecords.length > poolSize) {
    issues.push({
      code: "oversized_pool",
      message: `Pool has ${localeRecords.length} eligible riddles; exactly ${poolSize} required`,
      documentPaths: localeRecords.map((record) => record.documentPath),
    });
  }

  const requiredLocales = options.requiredLocales ?? [];
  for (const [canonicalRiddleId, presentLocales] of localesByCanonical.entries()) {
    const missing = requiredLocales.filter((locale) => !presentLocales.has(locale));
    if (missing.length > 0) {
      issues.push({
        code: "missing_translation",
        message: `${canonicalRiddleId} is missing locales: ${missing.join(", ")}`,
        documentPaths: [],
      });
    }
  }

  const minimumPerBand = RACE_DECK_SIZE / 3;
  for (const [difficulty, count] of Object.entries(difficultyCounts) as Array<[RaceDifficultyBand, number]>) {
    if (localeRecords.length === poolSize && count < minimumPerBand) {
      issues.push({
        code: "difficulty_imbalance",
        message: `${difficulty} has ${count} riddles; at least ${minimumPerBand} required`,
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

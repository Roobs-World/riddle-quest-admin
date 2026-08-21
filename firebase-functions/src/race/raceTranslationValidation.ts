import {createHash} from "node:crypto";
import {
  RACE_CATEGORY_IDS,
  RACE_SUPPORTED_LOCALES,
  RaceCategoryIdSchema,
  RaceDifficultyBandSchema,
  type RaceCategoryId,
  type RaceLocale,
} from "@qwordly/core/race";
import {graphemeLength} from "@qwordly/core/game";
import {z} from "zod";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {RaceContentImportFileSchema, type RaceContentImportFile} from "./raceContentImport";
import {RACE_POOL_SIZE, validateRacePool} from "./raceContentValidation";

/** Defines the automated translation quality version value. */
export const AUTOMATED_TRANSLATION_QUALITY_VERSION = "automated_translation_v1" as const;

/** Validates the translation review data shape. */
const TranslationReviewSchema = z.object({
  criticModel: z.string().trim().min(1).max(160),
  backTranslation: z.string().trim().min(1).max(2_000),
  equivalentCanonical: z.literal(true),
  clueLeak: z.literal(false),
  prohibitedContent: z.literal(false),
  categoryMatch: z.literal(true),
  difficultyMatch: z.literal(true),
}).strict();

/** Validates the translation item data shape. */
const TranslationItemSchema = z.object({
  canonicalRiddleId: z.string().trim().min(1).max(160),
  sourceCanonicalHash: z.string().regex(/^[0-9a-f]{64}$/u),
  text: z.string().trim().min(1).max(2_000),
  answer: z.string().trim().min(1).max(100),
  categoryId: RaceCategoryIdSchema,
  difficultyBand: RaceDifficultyBandSchema,
  qualityVersion: z.literal(AUTOMATED_TRANSLATION_QUALITY_VERSION),
  review: TranslationReviewSchema,
}).strict();

/** Validates the race translation bundle data shape. */
export const RaceTranslationBundleSchema = z.object({
  locale: z.enum(RACE_SUPPORTED_LOCALES).refine((locale) => locale !== "en", "Translation locale must not be English"),
  provenance: z.literal(AUTOMATED_TRANSLATION_QUALITY_VERSION),
  translatorModel: z.string().trim().min(1).max(160),
  criticModel: z.string().trim().min(1).max(160),
  riddles: z.array(TranslationItemSchema).length(RACE_CATEGORY_IDS.length * RACE_POOL_SIZE),
}).strict().refine((bundle) => bundle.translatorModel !== bundle.criticModel, {
  message: "Translation and critique must use independent models",
  path: ["criticModel"],
});

/** Describes race translation issue. */
export type RaceTranslationIssue = Readonly<{
  code: "canonical_set" | "source_binding" | "metadata_mismatch" | "non_nfc" | "critic_mismatch" |
    "source_copy" | "locale_script" | "answer_format" | "duplicate_question" | "duplicate_answer" | "pool_invalid";
  canonicalRiddleId?: string;
  message: string;
}>;

/** Defines the required clue scripts value. */
const REQUIRED_CLUE_SCRIPTS: Partial<Record<(typeof RACE_SUPPORTED_LOCALES)[number], RegExp>> = {
  ar: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  zh: /\p{Script=Han}/u,
};

/** Describes playable translated answer issue. */
export type PlayableTranslatedAnswerIssue =
  "not_trimmed_text" | "non_nfc" | "letters_and_marks_only" | "grapheme_length";

/** Enforces the portable native-input contract shared by Race content and YouTube Playables. */
export function playableTranslatedAnswerIssue(
  value: unknown,
  locale: RaceLocale,
): PlayableTranslatedAnswerIssue | null {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) return "not_trimmed_text";
  if (value !== value.normalize("NFC")) return "non_nfc";
  if (!/^\p{L}[\p{L}\p{M}]*$/u.test(value)) return "letters_and_marks_only";
  const length = graphemeLength(value, locale);
  if (length < 1 || length > 7) return "grapheme_length";
  return null;
}

/** Describes race translation plan. */
export type RaceTranslationPlan = Readonly<{
  valid: boolean;
  locale: Exclude<(typeof RACE_SUPPORTED_LOCALES)[number], "en">;
  records: ExistingRaceContentRecord[];
  categoryCounts: Record<RaceCategoryId, number>;
  issues: RaceTranslationIssue[];
}>;

/** Describes race translation matrix plan. */
export type RaceTranslationMatrixPlan = Readonly<{
  valid: boolean;
  locales: Exclude<(typeof RACE_SUPPORTED_LOCALES)[number], "en">[];
  totalRiddles: number;
  issues: string[];
}>;

/** Binds every translation to one complete, domain-separated reviewed canonical record. */
export const raceTranslationCanonicalHash = (source: {
  canonicalRiddleId: string;
  text: string;
  answer: string;
  categoryId: string;
  difficultyBand: string;
}): string => createHash("sha256").update("race-reviewed-canonical-v1\0").update(JSON.stringify([
  source.canonicalRiddleId,
  source.text.normalize("NFC"),
  source.answer.normalize("NFC"),
  source.categoryId,
  source.difficultyBand,
])).digest("hex");

/** Normalizes d duplicate value. */
const normalizedDuplicateValue = (value: string, locale: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase(locale).replace(/\s+/gu, " ");

/** Validates a complete, independently critiqued machine-only locale bundle without writing it. */
export function createRaceTranslationPlan(input: unknown, sourceInput: unknown): RaceTranslationPlan {
  const bundle = RaceTranslationBundleSchema.parse(input);
  const source: RaceContentImportFile = RaceContentImportFileSchema.parse(sourceInput);
  const sourceByCanonical = new Map(source.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  const seen = new Set<string>();
  const clueOwner = new Map<string, string>();
  const answerOwner = new Map<string, string>();
  const issues: RaceTranslationIssue[] = [];
  const records = bundle.riddles.map((riddle): ExistingRaceContentRecord => {
    const canonical = sourceByCanonical.get(riddle.canonicalRiddleId);
    if (!canonical || seen.has(riddle.canonicalRiddleId)) {
      issues.push({code: "canonical_set", canonicalRiddleId: riddle.canonicalRiddleId, message: "Canonical ID is missing or duplicated"});
    }
    seen.add(riddle.canonicalRiddleId);
    if (canonical && riddle.sourceCanonicalHash !== raceTranslationCanonicalHash(canonical)) {
      issues.push({code: "source_binding", canonicalRiddleId: riddle.canonicalRiddleId, message: "Reviewed English source changed"});
    }
    if (canonical && (riddle.categoryId !== canonical.categoryId || riddle.difficultyBand !== canonical.difficultyBand)) {
      issues.push({code: "metadata_mismatch", canonicalRiddleId: riddle.canonicalRiddleId, message: "Category or difficulty differs from canonical source"});
    }
    if (canonical && riddle.text.normalize("NFC") === canonical.text.normalize("NFC")) {
      issues.push({
        code: "source_copy",
        canonicalRiddleId: riddle.canonicalRiddleId,
        message: "Non-English clue is an exact copy of the English source",
      });
    }
    const requiredScript = REQUIRED_CLUE_SCRIPTS[bundle.locale];
    if (requiredScript && !requiredScript.test(riddle.text)) {
      issues.push({
        code: "locale_script",
        canonicalRiddleId: riddle.canonicalRiddleId,
        message: `Translated clue does not contain the expected ${bundle.locale} script`,
      });
    }
    if (
      riddle.text !== riddle.text.normalize("NFC") ||
      riddle.answer !== riddle.answer.normalize("NFC") ||
      riddle.review.backTranslation !== riddle.review.backTranslation.normalize("NFC")
    ) issues.push({code: "non_nfc", canonicalRiddleId: riddle.canonicalRiddleId, message: "Text must be NFC normalized"});
    const answerIssue = playableTranslatedAnswerIssue(riddle.answer, bundle.locale);
    if (answerIssue) {
      issues.push({
        code: "answer_format",
        canonicalRiddleId: riddle.canonicalRiddleId,
        message: `Answer violates the native-input contract: ${answerIssue}`,
      });
    }
    if (riddle.review.criticModel !== bundle.criticModel) {
      issues.push({code: "critic_mismatch", canonicalRiddleId: riddle.canonicalRiddleId, message: "Review critic does not match independent bundle critic"});
    }
    const normalizedClue = normalizedDuplicateValue(riddle.text, bundle.locale);
    const normalizedAnswer = normalizedDuplicateValue(riddle.answer, bundle.locale);
    const priorClue = clueOwner.get(normalizedClue);
    const priorAnswer = answerOwner.get(normalizedAnswer);
    if (priorClue) {
      issues.push({
        code: "duplicate_question",
        canonicalRiddleId: riddle.canonicalRiddleId,
        message: `Clue duplicates ${priorClue} across the locale bundle`,
      });
    } else clueOwner.set(normalizedClue, riddle.canonicalRiddleId);
    if (priorAnswer) {
      issues.push({
        code: "duplicate_answer",
        canonicalRiddleId: riddle.canonicalRiddleId,
        message: `Answer duplicates ${priorAnswer} across the locale bundle`,
      });
    } else answerOwner.set(normalizedAnswer, riddle.canonicalRiddleId);
    const documentId = `race-${bundle.locale}-${createHash("sha256").update(riddle.canonicalRiddleId).digest("hex").slice(0, 24)}`;
    return {
      locale: bundle.locale,
      documentPath: `localizedRiddles/${bundle.locale}/riddles/${documentId}`,
      data: {
        riddleId: documentId,
        canonicalRiddleId: riddle.canonicalRiddleId,
        text: riddle.text,
        answer: riddle.answer,
        categoryId: riddle.categoryId,
        difficultyBand: riddle.difficultyBand,
        raceEligible: true,
        qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
      },
    };
  });
  for (const canonicalRiddleId of sourceByCanonical.keys()) {
    if (!seen.has(canonicalRiddleId)) issues.push({code: "canonical_set", canonicalRiddleId, message: "Canonical translation is missing"});
  }
  const categoryCounts = Object.fromEntries(RACE_CATEGORY_IDS.map((categoryId) => [
    categoryId,
    records.filter((record) => record.data.categoryId === categoryId).length,
  ])) as Record<RaceCategoryId, number>;
  for (const categoryId of RACE_CATEGORY_IDS) {
    const validation = validateRacePool(records, {locale: bundle.locale, categoryId});
    issues.push(...validation.issues.map((issue) => ({
      code: "pool_invalid" as const,
      message: `${issue.code}: ${issue.message}`,
    })));
  }
  return {valid: issues.length === 0, locale: bundle.locale, records, categoryCounts, issues};
}

/** Proves the generated corpus contains one valid 180-riddle bundle for every non-English locale. */
export function createRaceTranslationMatrixPlan(
  inputs: unknown[],
  sourceInput: unknown,
): RaceTranslationMatrixPlan {
  const expectedLocales = RACE_SUPPORTED_LOCALES.filter(
    (locale): locale is Exclude<(typeof RACE_SUPPORTED_LOCALES)[number], "en"> => locale !== "en",
  );
  const issues: string[] = [];
  const plans = inputs.flatMap((input, index) => {
    const parsed = RaceTranslationBundleSchema.safeParse(input);
    if (!parsed.success) {
      issues.push(`bundle-${index}:schema-invalid`);
      return [];
    }
    try {
      return [createRaceTranslationPlan(parsed.data, sourceInput)];
    } catch {
      issues.push(`${parsed.data.locale}:validation-threw`);
      return [];
    }
  });
  const localeCounts = new Map<string, number>();
  for (const plan of plans) {
    localeCounts.set(plan.locale, (localeCounts.get(plan.locale) ?? 0) + 1);
    for (const issue of plan.issues) {
      issues.push(`${plan.locale}:${issue.code}:${issue.canonicalRiddleId ?? "bundle"}`);
    }
  }
  for (const locale of expectedLocales) {
    const count = localeCounts.get(locale) ?? 0;
    if (count === 0) issues.push(`${locale}:missing-bundle`);
    else if (count !== 1) issues.push(`${locale}:duplicate-bundle:${count}`);
  }
  for (const locale of localeCounts.keys()) {
    if (!expectedLocales.includes(locale as typeof expectedLocales[number])) {
      issues.push(`${locale}:unexpected-bundle`);
    }
  }
  const totalRiddles = plans.reduce((total, plan) => total + plan.records.length, 0);
  const expectedTotal = expectedLocales.length * RACE_CATEGORY_IDS.length * RACE_POOL_SIZE;
  if (totalRiddles !== expectedTotal) issues.push(`corpus-count:${totalRiddles}:expected-${expectedTotal}`);
  return {
    valid: issues.length === 0,
    locales: [...expectedLocales],
    totalRiddles,
    issues,
  };
}

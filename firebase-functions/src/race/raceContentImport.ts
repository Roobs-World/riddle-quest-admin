import {createHash} from "node:crypto";
import {
  RACE_CATEGORY_IDS,
  RaceCategoryIdSchema,
  RaceDifficultyBandSchema,
  type RaceCategoryId,
} from "@qwordly/core/race";
import {z} from "zod";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {RACE_MIN_POOL_SIZE, RACE_POOL_SIZE, validateRacePool, type RacePoolIssue} from "./raceContentValidation";

/** Validates the reviewed quality version data shape. */
const ReviewedQualityVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => /^(reviewed|human_review)_/i.test(value), {
    message: "qualityVersion must identify reviewed content",
  });

/** Schema for one reviewed riddle in an authoritative race import. */
export const RaceContentImportItemSchema = z
  .object({
    canonicalRiddleId: z.string().trim().min(1).max(160),
    text: z.string().trim().min(1).max(2_000),
    answer: z.string().trim().min(1).max(100),
    categoryId: RaceCategoryIdSchema,
    difficultyBand: RaceDifficultyBandSchema,
    qualityVersion: ReviewedQualityVersionSchema,
  })
  .strict();

/** Schema for a complete English race content import file. */
export const RaceContentImportFileSchema = z
  .object({
    locale: z.literal("en"),
    riddles: z.array(RaceContentImportItemSchema).min(RACE_CATEGORY_IDS.length * RACE_MIN_POOL_SIZE).max(RACE_CATEGORY_IDS.length * RACE_POOL_SIZE),
  })
  .strict();

/** Validated shape of a complete race content import file. */
export type RaceContentImportFile = z.infer<typeof RaceContentImportFileSchema>;

/** Non-mutating import plan containing records, counts, and validation issues. */
export type RaceContentImportPlan = {
  /** Stores valid. */
  valid: boolean;
  /** Stores locale. */
  locale: "en";
  /** Stores total riddles. */
  totalRiddles: number;
  /** Stores records. */
  records: ExistingRaceContentRecord[];
  /** Stores category counts. */
  categoryCounts: Record<RaceCategoryId, number>;
  /** Stores issues. */
  issues: RacePoolIssue[];
};

/** Normalizes d. */
const normalized = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/gu, " ");

/** Provides document id for behavior. */
const documentIdFor = (canonicalRiddleId: string) =>
  `race-en-${createHash("sha256").update(canonicalRiddleId).digest("hex").slice(0, 24)}`;

/** Provides duplicate issues behavior. */
const duplicateIssues = (
  records: ExistingRaceContentRecord[],
  field: "canonicalRiddleId" | "text" | "answer",
  code: "duplicate_canonical" | "duplicate_question" | "duplicate_answer",
): RacePoolIssue[] => {
  /** Provides paths by value behavior. */
  const pathsByValue = new Map<string, string[]>();
  for (const record of records) {
    // Records in an import plan are constructed only after the strict import
    // schema has validated all three duplicate-comparison fields as strings.
    /** Provides raw behavior. */
    const raw = record.data[field] as string;
    /** Provides value behavior. */
    const value = field === "canonicalRiddleId" ? raw : normalized(raw);
    pathsByValue.set(value, [...(pathsByValue.get(value) ?? []), record.documentPath]);
  }
  return [...pathsByValue.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([value, documentPaths]) => ({code, message: `Duplicate ${field}: ${value}`, documentPaths}));
};

/** Parses content and creates a deterministic, validated import plan. */
export function createRaceContentImportPlan(input: unknown): RaceContentImportPlan {
  /** Provides file behavior. */
  const file = RaceContentImportFileSchema.parse(input);
  /** Records s. */
  const records = file.riddles.map((riddle): ExistingRaceContentRecord => {
    /** Provides document id behavior. */
    const documentId = documentIdFor(riddle.canonicalRiddleId);
    return {
      locale: "en",
      documentPath: `localizedRiddles/en/riddles/${documentId}`,
      data: {riddleId: documentId, ...riddle, raceEligible: true},
    };
  });
  /** Provides category counts behavior. */
  const categoryCounts = Object.fromEntries(
    RACE_CATEGORY_IDS.map((categoryId) => [
      categoryId,
      records.filter((record) => record.data.categoryId === categoryId).length,
    ]),
  ) as Record<RaceCategoryId, number>;
  /** Provides issues behavior. */
  const issues = RACE_CATEGORY_IDS.flatMap(
    (categoryId) => validateRacePool(records, {locale: "en", categoryId}).issues,
  );
  issues.push(
    ...duplicateIssues(records, "canonicalRiddleId", "duplicate_canonical"),
    ...duplicateIssues(records, "text", "duplicate_question"),
    ...duplicateIssues(records, "answer", "duplicate_answer"),
  );
  /** Provides unique issues behavior. */
  const uniqueIssues = [
    ...new Map(issues.map((issue) => [`${issue.code}:${issue.documentPaths.join("|")}`, issue])).values(),
  ];
  return {
    valid: uniqueIssues.length === 0,
    locale: "en",
    totalRiddles: records.length,
    records,
    categoryCounts,
    issues: uniqueIssues,
  };
}

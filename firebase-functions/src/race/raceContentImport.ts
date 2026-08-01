import {createHash} from "node:crypto";
import {
  RACE_CATEGORY_IDS,
  RaceCategoryIdSchema,
  RaceDifficultyBandSchema,
  type RaceCategoryId,
} from "@qwordly/core/race";
import {z} from "zod";
import type {ExistingRaceContentRecord} from "./raceContentMigration";
import {RACE_POOL_SIZE, validateRacePool, type RacePoolIssue} from "./raceContentValidation";

const ReviewedQualityVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => /^(reviewed|human_review)_/i.test(value), {
    message: "qualityVersion must identify reviewed content",
  });

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

export const RaceContentImportFileSchema = z
  .object({
    locale: z.literal("en"),
    riddles: z.array(RaceContentImportItemSchema).length(RACE_CATEGORY_IDS.length * RACE_POOL_SIZE),
  })
  .strict();

export type RaceContentImportFile = z.infer<typeof RaceContentImportFileSchema>;

export type RaceContentImportPlan = {
  valid: boolean;
  locale: "en";
  totalRiddles: number;
  records: ExistingRaceContentRecord[];
  categoryCounts: Record<RaceCategoryId, number>;
  issues: RacePoolIssue[];
};

const normalized = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("en").replace(/\s+/gu, " ");

const documentIdFor = (canonicalRiddleId: string) =>
  `race-en-${createHash("sha256").update(canonicalRiddleId).digest("hex").slice(0, 24)}`;

const duplicateIssues = (
  records: ExistingRaceContentRecord[],
  field: "canonicalRiddleId" | "text" | "answer",
  code: "duplicate_canonical" | "duplicate_question" | "duplicate_answer",
): RacePoolIssue[] => {
  const pathsByValue = new Map<string, string[]>();
  for (const record of records) {
    const raw = record.data[field];
    if (typeof raw !== "string") continue;
    const value = field === "canonicalRiddleId" ? raw : normalized(raw);
    pathsByValue.set(value, [...(pathsByValue.get(value) ?? []), record.documentPath]);
  }
  return [...pathsByValue.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([value, documentPaths]) => ({code, message: `Duplicate ${field}: ${value}`, documentPaths}));
};

export function createRaceContentImportPlan(input: unknown): RaceContentImportPlan {
  const file = RaceContentImportFileSchema.parse(input);
  const records = file.riddles.map((riddle): ExistingRaceContentRecord => {
    const documentId = documentIdFor(riddle.canonicalRiddleId);
    return {
      locale: "en",
      documentPath: `localizedRiddles/en/riddles/${documentId}`,
      data: {riddleId: documentId, ...riddle, raceEligible: true},
    };
  });
  const categoryCounts = Object.fromEntries(
    RACE_CATEGORY_IDS.map((categoryId) => [
      categoryId,
      records.filter((record) => record.data.categoryId === categoryId).length,
    ]),
  ) as Record<RaceCategoryId, number>;
  const issues = RACE_CATEGORY_IDS.flatMap(
    (categoryId) => validateRacePool(records, {locale: "en", categoryId, poolSize: RACE_POOL_SIZE}).issues,
  );
  issues.push(
    ...duplicateIssues(records, "canonicalRiddleId", "duplicate_canonical"),
    ...duplicateIssues(records, "text", "duplicate_question"),
    ...duplicateIssues(records, "answer", "duplicate_answer"),
  );
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

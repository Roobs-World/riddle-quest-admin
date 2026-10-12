"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceContentImportFileSchema = exports.RaceContentImportItemSchema = void 0;
exports.createRaceContentImportPlan = createRaceContentImportPlan;
const node_crypto_1 = require("node:crypto");
const race_1 = require("@qwordly/core/race");
const zod_1 = require("zod");
const raceContentValidation_1 = require("./raceContentValidation");
/** Validates the reviewed quality version data shape. */
const ReviewedQualityVersionSchema = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => /^(reviewed|human_review)_/i.test(value), {
    message: "qualityVersion must identify reviewed content",
});
/** Schema for one reviewed riddle in an authoritative race import. */
exports.RaceContentImportItemSchema = zod_1.z
    .object({
    canonicalRiddleId: zod_1.z.string().trim().min(1).max(160),
    text: zod_1.z.string().trim().min(1).max(2_000),
    answer: zod_1.z.string().trim().min(1).max(100),
    categoryId: race_1.RaceCategoryIdSchema,
    difficultyBand: race_1.RaceDifficultyBandSchema,
    qualityVersion: ReviewedQualityVersionSchema,
})
    .strict();
/** Schema for a complete English race content import file. */
exports.RaceContentImportFileSchema = zod_1.z
    .object({
    locale: zod_1.z.literal("en"),
    riddles: zod_1.z.array(exports.RaceContentImportItemSchema).length(race_1.RACE_CATEGORY_IDS.length * raceContentValidation_1.RACE_POOL_SIZE),
})
    .strict();
/** Normalizes d. */
const normalized = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/gu, " ");
/** Provides document id for behavior. */
const documentIdFor = (canonicalRiddleId) => `race-en-${(0, node_crypto_1.createHash)("sha256").update(canonicalRiddleId).digest("hex").slice(0, 24)}`;
/** Provides duplicate issues behavior. */
const duplicateIssues = (records, field, code) => {
    /** Provides paths by value behavior. */
    const pathsByValue = new Map();
    for (const record of records) {
        // Records in an import plan are constructed only after the strict import
        // schema has validated all three duplicate-comparison fields as strings.
        /** Provides raw behavior. */
        const raw = record.data[field];
        /** Provides value behavior. */
        const value = field === "canonicalRiddleId" ? raw : normalized(raw);
        pathsByValue.set(value, [...(pathsByValue.get(value) ?? []), record.documentPath]);
    }
    return [...pathsByValue.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([value, documentPaths]) => ({ code, message: `Duplicate ${field}: ${value}`, documentPaths }));
};
/** Parses content and creates a deterministic, validated import plan. */
function createRaceContentImportPlan(input) {
    /** Provides file behavior. */
    const file = exports.RaceContentImportFileSchema.parse(input);
    /** Records s. */
    const records = file.riddles.map((riddle) => {
        /** Provides document id behavior. */
        const documentId = documentIdFor(riddle.canonicalRiddleId);
        return {
            locale: "en",
            documentPath: `localizedRiddles/en/riddles/${documentId}`,
            data: { riddleId: documentId, ...riddle, raceEligible: true },
        };
    });
    /** Provides category counts behavior. */
    const categoryCounts = Object.fromEntries(race_1.RACE_CATEGORY_IDS.map((categoryId) => [
        categoryId,
        records.filter((record) => record.data.categoryId === categoryId).length,
    ]));
    /** Provides issues behavior. */
    const issues = race_1.RACE_CATEGORY_IDS.flatMap((categoryId) => (0, raceContentValidation_1.validateRacePool)(records, { locale: "en", categoryId, poolSize: raceContentValidation_1.RACE_POOL_SIZE }).issues);
    issues.push(...duplicateIssues(records, "canonicalRiddleId", "duplicate_canonical"), ...duplicateIssues(records, "text", "duplicate_question"), ...duplicateIssues(records, "answer", "duplicate_answer"));
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
//# sourceMappingURL=raceContentImport.js.map
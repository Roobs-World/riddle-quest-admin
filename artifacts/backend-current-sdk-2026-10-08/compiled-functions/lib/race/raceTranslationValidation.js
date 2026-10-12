"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceTranslationCanonicalHash = exports.RaceTranslationBundleSchema = exports.AUTOMATED_TRANSLATION_QUALITY_VERSION = void 0;
exports.playableTranslatedAnswerIssue = playableTranslatedAnswerIssue;
exports.createRaceTranslationPlan = createRaceTranslationPlan;
exports.createRaceTranslationMatrixPlan = createRaceTranslationMatrixPlan;
const node_crypto_1 = require("node:crypto");
const race_1 = require("@qwordly/core/race");
const game_1 = require("@qwordly/core/game");
const zod_1 = require("zod");
const raceContentImport_1 = require("./raceContentImport");
const raceContentValidation_1 = require("./raceContentValidation");
/** Defines the automated translation quality version value. */
exports.AUTOMATED_TRANSLATION_QUALITY_VERSION = "automated_translation_v1";
/** Validates the translation review data shape. */
const TranslationReviewSchema = zod_1.z
    .object({
    criticModel: zod_1.z.string().trim().min(1).max(160),
    backTranslation: zod_1.z.string().trim().min(1).max(2_000),
    equivalentCanonical: zod_1.z.literal(true),
    clueLeak: zod_1.z.literal(false),
    prohibitedContent: zod_1.z.literal(false),
    categoryMatch: zod_1.z.literal(true),
    difficultyMatch: zod_1.z.literal(true),
})
    .strict();
/** Validates the translation item data shape. */
const TranslationItemSchema = zod_1.z
    .object({
    canonicalRiddleId: zod_1.z.string().trim().min(1).max(160),
    sourceCanonicalHash: zod_1.z.string().regex(/^[0-9a-f]{64}$/u),
    text: zod_1.z.string().trim().min(1).max(2_000),
    answer: zod_1.z.string().trim().min(1).max(100),
    categoryId: race_1.RaceCategoryIdSchema,
    difficultyBand: race_1.RaceDifficultyBandSchema,
    qualityVersion: zod_1.z.literal(exports.AUTOMATED_TRANSLATION_QUALITY_VERSION),
    review: TranslationReviewSchema,
})
    .strict();
/** Validates the race translation bundle data shape. */
exports.RaceTranslationBundleSchema = zod_1.z
    .object({
    locale: zod_1.z
        .enum(race_1.RACE_SUPPORTED_LOCALES)
        .refine((locale) => locale !== "en", "Translation locale must not be English"),
    provenance: zod_1.z.literal(exports.AUTOMATED_TRANSLATION_QUALITY_VERSION),
    translatorModel: zod_1.z.string().trim().min(1).max(160),
    criticModel: zod_1.z.string().trim().min(1).max(160),
    riddles: zod_1.z.array(TranslationItemSchema).length(race_1.RACE_CATEGORY_IDS.length * raceContentValidation_1.RACE_POOL_SIZE),
})
    .strict()
    .refine((bundle) => bundle.translatorModel !== bundle.criticModel, {
    message: "Translation and critique must use independent models",
    path: ["criticModel"],
});
/** Defines the required clue scripts value. */
const REQUIRED_CLUE_SCRIPTS = {
    ar: /\p{Script=Arabic}/u,
    hi: /\p{Script=Devanagari}/u,
    ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
    ko: /\p{Script=Hangul}/u,
    ru: /\p{Script=Cyrillic}/u,
};
/** Enforces the portable native-input contract shared by Race content and YouTube Playables. */
function playableTranslatedAnswerIssue(value, locale) {
    if (typeof value !== "string" || value.trim() !== value || value.length === 0)
        return "not_trimmed_text";
    if (value !== value.normalize("NFC"))
        return "non_nfc";
    if (!/^\p{L}[\p{L}\p{M}]*$/u.test(value))
        return "letters_and_marks_only";
    /** Provides length behavior. */
    const length = (0, game_1.graphemeLength)(value, locale);
    if (length < 1 || length > 7)
        return "grapheme_length";
    return null;
}
/** Binds every translation to one complete, domain-separated reviewed canonical record. */
const raceTranslationCanonicalHash = (source) => (0, node_crypto_1.createHash)("sha256")
    .update("race-reviewed-canonical-v1\0")
    .update(JSON.stringify([
    source.canonicalRiddleId,
    source.text.normalize("NFC"),
    source.answer.normalize("NFC"),
    source.categoryId,
    source.difficultyBand,
]))
    .digest("hex");
exports.raceTranslationCanonicalHash = raceTranslationCanonicalHash;
/** Normalizes d duplicate value. */
const normalizedDuplicateValue = (value, locale) => value.normalize("NFKC").trim().toLocaleLowerCase(locale).replace(/\s+/gu, " ");
/** Validates a complete, independently critiqued machine-only locale bundle without writing it. */
function createRaceTranslationPlan(input, sourceInput) {
    /** Provides bundle behavior. */
    const bundle = exports.RaceTranslationBundleSchema.parse(input);
    /** Provides source behavior. */
    const source = raceContentImport_1.RaceContentImportFileSchema.parse(sourceInput);
    /** Provides source by canonical behavior. */
    const sourceByCanonical = new Map(source.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
    /** Provides seen behavior. */
    const seen = new Set();
    /** Provides clue owner behavior. */
    const clueOwner = new Map();
    /** Provides answer owner behavior. */
    const answerOwner = new Map();
    /** Provides issues behavior. */
    const issues = [];
    /** Records s. */
    const records = bundle.riddles.map((riddle) => {
        /** Provides canonical behavior. */
        const canonical = sourceByCanonical.get(riddle.canonicalRiddleId);
        if (!canonical || seen.has(riddle.canonicalRiddleId)) {
            issues.push({
                code: "canonical_set",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Canonical ID is missing or duplicated",
            });
        }
        seen.add(riddle.canonicalRiddleId);
        if (canonical && riddle.sourceCanonicalHash !== (0, exports.raceTranslationCanonicalHash)(canonical)) {
            issues.push({
                code: "source_binding",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Reviewed English source changed",
            });
        }
        if (canonical &&
            (riddle.categoryId !== canonical.categoryId || riddle.difficultyBand !== canonical.difficultyBand)) {
            issues.push({
                code: "metadata_mismatch",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Category or difficulty differs from canonical source",
            });
        }
        if (canonical && riddle.text.normalize("NFC") === canonical.text.normalize("NFC")) {
            issues.push({
                code: "source_copy",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Non-English clue is an exact copy of the English source",
            });
        }
        /** Provides required script behavior. */
        const requiredScript = REQUIRED_CLUE_SCRIPTS[bundle.locale];
        if (requiredScript && !requiredScript.test(riddle.text)) {
            issues.push({
                code: "locale_script",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: `Translated clue does not contain the expected ${bundle.locale} script`,
            });
        }
        if (riddle.text !== riddle.text.normalize("NFC") ||
            riddle.answer !== riddle.answer.normalize("NFC") ||
            riddle.review.backTranslation !== riddle.review.backTranslation.normalize("NFC"))
            issues.push({
                code: "non_nfc",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Text must be NFC normalized",
            });
        /** Provides answer issue behavior. */
        const answerIssue = playableTranslatedAnswerIssue(riddle.answer, bundle.locale);
        if (answerIssue) {
            issues.push({
                code: "answer_format",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: `Answer violates the native-input contract: ${answerIssue}`,
            });
        }
        if (riddle.review.criticModel !== bundle.criticModel) {
            issues.push({
                code: "critic_mismatch",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: "Review critic does not match independent bundle critic",
            });
        }
        /** Normalizes d clue. */
        const normalizedClue = normalizedDuplicateValue(riddle.text, bundle.locale);
        /** Normalizes d answer. */
        const normalizedAnswer = normalizedDuplicateValue(riddle.answer, bundle.locale);
        /** Provides prior clue behavior. */
        const priorClue = clueOwner.get(normalizedClue);
        /** Provides prior answer behavior. */
        const priorAnswer = answerOwner.get(normalizedAnswer);
        if (priorClue) {
            issues.push({
                code: "duplicate_question",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: `Clue duplicates ${priorClue} across the locale bundle`,
            });
        }
        else
            clueOwner.set(normalizedClue, riddle.canonicalRiddleId);
        if (priorAnswer) {
            issues.push({
                code: "duplicate_answer",
                canonicalRiddleId: riddle.canonicalRiddleId,
                message: `Answer duplicates ${priorAnswer} across the locale bundle`,
            });
        }
        else
            answerOwner.set(normalizedAnswer, riddle.canonicalRiddleId);
        /** Provides document id behavior. */
        const documentId = `race-${bundle.locale}-${(0, node_crypto_1.createHash)("sha256").update(riddle.canonicalRiddleId).digest("hex").slice(0, 24)}`;
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
                qualityVersion: exports.AUTOMATED_TRANSLATION_QUALITY_VERSION,
            },
        };
    });
    for (const canonicalRiddleId of sourceByCanonical.keys()) {
        if (!seen.has(canonicalRiddleId))
            issues.push({ code: "canonical_set", canonicalRiddleId, message: "Canonical translation is missing" });
    }
    /** Provides category counts behavior. */
    const categoryCounts = Object.fromEntries(race_1.RACE_CATEGORY_IDS.map((categoryId) => [
        categoryId,
        records.filter((record) => record.data.categoryId === categoryId).length,
    ]));
    for (const categoryId of race_1.RACE_CATEGORY_IDS) {
        /** Provides validation behavior. */
        const validation = (0, raceContentValidation_1.validateRacePool)(records, { locale: bundle.locale, categoryId });
        issues.push(...validation.issues.map((issue) => ({
            code: "pool_invalid",
            message: `${issue.code}: ${issue.message}`,
        })));
    }
    return { valid: issues.length === 0, locale: bundle.locale, records, categoryCounts, issues };
}
/** Proves the generated corpus contains one valid 180-riddle bundle for every non-English locale. */
function createRaceTranslationMatrixPlan(inputs, sourceInput) {
    /** Provides expected locales behavior. */
    const expectedLocales = race_1.RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en");
    /** Provides issues behavior. */
    const issues = [];
    /** Provides plans behavior. */
    const plans = inputs.flatMap((input, index) => {
        /** Parses d. */
        const parsed = exports.RaceTranslationBundleSchema.safeParse(input);
        if (!parsed.success) {
            issues.push(`bundle-${index}:schema-invalid`);
            return [];
        }
        try {
            return [createRaceTranslationPlan(parsed.data, sourceInput)];
        }
        catch {
            issues.push(`${parsed.data.locale}:validation-threw`);
            return [];
        }
    });
    /** Provides locale counts behavior. */
    const localeCounts = new Map();
    for (const plan of plans) {
        localeCounts.set(plan.locale, (localeCounts.get(plan.locale) ?? 0) + 1);
        for (const issue of plan.issues) {
            issues.push(`${plan.locale}:${issue.code}:${issue.canonicalRiddleId ?? "bundle"}`);
        }
    }
    for (const locale of expectedLocales) {
        /** Provides count behavior. */
        const count = localeCounts.get(locale) ?? 0;
        if (count === 0)
            issues.push(`${locale}:missing-bundle`);
        else if (count !== 1)
            issues.push(`${locale}:duplicate-bundle:${count}`);
    }
    for (const locale of localeCounts.keys()) {
        if (!expectedLocales.includes(locale)) {
            issues.push(`${locale}:unexpected-bundle`);
        }
    }
    /** Provides total riddles behavior. */
    const totalRiddles = plans.reduce((total, plan) => total + plan.records.length, 0);
    /** Provides expected total behavior. */
    const expectedTotal = expectedLocales.length * race_1.RACE_CATEGORY_IDS.length * raceContentValidation_1.RACE_POOL_SIZE;
    if (totalRiddles !== expectedTotal)
        issues.push(`corpus-count:${totalRiddles}:expected-${expectedTotal}`);
    return {
        valid: issues.length === 0,
        locales: [...expectedLocales],
        totalRiddles,
        issues,
    };
}
//# sourceMappingURL=raceTranslationValidation.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceTranslationCheckpointSchema = exports.TranslationCritiqueSchema = exports.TranslationDraftSchema = void 0;
exports.raceTranslationDraftHash = raceTranslationDraftHash;
exports.validateRaceTranslationCheckpoint = validateRaceTranslationCheckpoint;
exports.assertExactTranslationResponseIds = assertExactTranslationResponseIds;
exports.generateRaceTranslationBundle = generateRaceTranslationBundle;
const race_1 = require("@qwordly/core/race");
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const raceContentImport_1 = require("./raceContentImport");
const raceTranslationValidation_1 = require("./raceTranslationValidation");
/** Validates the non english race locale data shape. */
const NonEnglishRaceLocaleSchema = zod_1.z
    .enum(race_1.RACE_SUPPORTED_LOCALES)
    .refine((locale) => locale !== "en", "Translation locale must not be English");
/** Validates the translation draft data shape. */
exports.TranslationDraftSchema = zod_1.z
    .object({
    canonicalRiddleId: zod_1.z.string().trim().min(1).max(160),
    text: zod_1.z.string().trim().min(1).max(2_000),
    answer: zod_1.z.string().trim().min(1).max(100),
})
    .strict();
/** Validates the translation critique data shape. */
exports.TranslationCritiqueSchema = zod_1.z
    .object({
    canonicalRiddleId: zod_1.z.string().trim().min(1).max(160),
    backTranslation: zod_1.z.string().trim().min(1).max(2_000),
    equivalentCanonical: zod_1.z.boolean(),
    clueLeak: zod_1.z.boolean(),
    prohibitedContent: zod_1.z.boolean(),
    categoryMatch: zod_1.z.boolean(),
    difficultyMatch: zod_1.z.boolean(),
})
    .strict();
/** Validates the race translation checkpoint data shape. */
exports.RaceTranslationCheckpointSchema = zod_1.z
    .object({
    sourceFileHash: zod_1.z.string().regex(/^[0-9a-f]{64}$/),
    translatorModel: zod_1.z.string().trim().min(1).max(160),
    criticModel: zod_1.z.string().trim().min(1).max(160),
    translations: zod_1.z.record(zod_1.z.string(), exports.TranslationDraftSchema),
    critiques: zod_1.z.record(zod_1.z.string(), exports.TranslationCritiqueSchema),
    critiqueTranslationHashes: zod_1.z.record(zod_1.z.string(), zod_1.z.string().regex(/^[0-9a-f]{64}$/)),
})
    .strict();
/** Binds an independent critique to the exact normalized translation it inspected. */
function raceTranslationDraftHash(draft) {
    /** Parses d. */
    const parsed = exports.TranslationDraftSchema.parse(draft);
    return (0, node_crypto_1.createHash)("sha256")
        .update(`race-translation-draft-v1\0${parsed.canonicalRiddleId}\0${parsed.text.normalize("NFC")}\0${parsed.answer.normalize("NFC")}`, "utf8")
        .digest("hex");
}
/** Rejects stale critique approvals, unknown IDs, and checkpoint contract drift before resume. */
function validateRaceTranslationCheckpoint(value, expected) {
    /** Provides checkpoint behavior. */
    const checkpoint = exports.RaceTranslationCheckpointSchema.parse(value);
    if (checkpoint.sourceFileHash !== expected.sourceFileHash ||
        checkpoint.translatorModel !== expected.translatorModel ||
        checkpoint.criticModel !== expected.criticModel) {
        throw new Error("checkpoint-contract-mismatch");
    }
    /** Provides canonical ids behavior. */
    const canonicalIds = new Set(expected.canonicalRiddleIds);
    /** Provides translation ids behavior. */
    const translationIds = Object.keys(checkpoint.translations);
    /** Provides critique ids behavior. */
    const critiqueIds = Object.keys(checkpoint.critiques);
    /** Provides hash ids behavior. */
    const hashIds = Object.keys(checkpoint.critiqueTranslationHashes);
    if ([...translationIds, ...critiqueIds, ...hashIds].some((id) => !canonicalIds.has(id)) ||
        translationIds.some((id) => (0, raceTranslationValidation_1.playableTranslatedAnswerIssue)(checkpoint.translations[id].answer, expected.locale ?? "en") !== null) ||
        critiqueIds.length !== hashIds.length ||
        critiqueIds.some((id) => !checkpoint.translations[id] ||
            checkpoint.critiqueTranslationHashes[id] !== raceTranslationDraftHash(checkpoint.translations[id])) ||
        hashIds.some((id) => !checkpoint.critiques[id])) {
        throw new Error("checkpoint-critique-translation-mismatch");
    }
    return checkpoint;
}
/** Provides exact by canonical behavior. */
const exactByCanonical = (values, expectedIds, schema, label) => {
    /** Parses d. */
    const parsed = zod_1.z.array(schema).length(expectedIds.length).parse(values);
    assertExactTranslationResponseIds(parsed, expectedIds, label);
    /** Provides by id behavior. */
    const byId = new Map(parsed.map((value) => [value.canonicalRiddleId, value]));
    return byId;
};
/** Rejects duplicates, substitutions, and extras before a model response enters a checkpoint. */
function assertExactTranslationResponseIds(values, expectedIds, label) {
    /** Provides ids behavior. */
    const ids = values.map(({ canonicalRiddleId }) => canonicalRiddleId);
    if (ids.length !== expectedIds.length ||
        new Set(ids).size !== expectedIds.length ||
        expectedIds.some((id) => !ids.includes(id))) {
        throw new Error(`${label}-canonical-set-mismatch`);
    }
}
/** Generates one complete locale with a separate translator and critic, then runs every import gate. */
async function generateRaceTranslationBundle({ locale: localeInput, source: sourceInput, translatorModel, criticModel, port, batchSize = 15, }) {
    /** Provides locale behavior. */
    const locale = NonEnglishRaceLocaleSchema.parse(localeInput);
    /** Provides source behavior. */
    const source = raceContentImport_1.RaceContentImportFileSchema.parse(sourceInput);
    /** Provides source plan behavior. */
    const sourcePlan = (0, raceContentImport_1.createRaceContentImportPlan)(source);
    if (!sourcePlan.valid) {
        /** Provides codes behavior. */
        const codes = [...new Set(sourcePlan.issues.map(({ code }) => code))].sort();
        throw new Error(`translation-source-invalid:${codes.join(",")}`);
    }
    if (!translatorModel.trim() || !criticModel.trim() || translatorModel === criticModel) {
        throw new Error("translation-models-must-be-distinct");
    }
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 30)
        throw new Error("invalid-translation-batch-size");
    /** Provides riddles behavior. */
    const riddles = [];
    for (let offset = 0; offset < source.riddles.length; offset += batchSize) {
        /** Provides batch behavior. */
        const batch = source.riddles.slice(offset, offset + batchSize);
        /** Provides ids behavior. */
        const ids = batch.map(({ canonicalRiddleId }) => canonicalRiddleId);
        /** Provides translations behavior. */
        const translations = exactByCanonical(await port.translate({ locale, source: batch }), ids, exports.TranslationDraftSchema, "translation");
        /** Provides ordered translations behavior. */
        const orderedTranslations = ids.map((id) => translations.get(id));
        /** Provides invalid answer behavior. */
        const invalidAnswer = orderedTranslations.find((translation) => (0, raceTranslationValidation_1.playableTranslatedAnswerIssue)(translation.answer, locale) !== null);
        if (invalidAnswer) {
            throw new Error(`translation-answer-invalid:${invalidAnswer.canonicalRiddleId}:` +
                (0, raceTranslationValidation_1.playableTranslatedAnswerIssue)(invalidAnswer.answer, locale));
        }
        /** Provides critiques behavior. */
        const critiques = exactByCanonical(await port.critique({ locale, source: batch, translations: orderedTranslations }), ids, exports.TranslationCritiqueSchema, "critique");
        for (const canonical of batch) {
            /** Provides translated behavior. */
            const translated = translations.get(canonical.canonicalRiddleId);
            /** Provides critique behavior. */
            const critique = critiques.get(canonical.canonicalRiddleId);
            if (!critique.equivalentCanonical ||
                critique.clueLeak ||
                critique.prohibitedContent ||
                !critique.categoryMatch ||
                !critique.difficultyMatch) {
                throw new Error(`translation-critique-rejected:${canonical.canonicalRiddleId}`);
            }
            riddles.push({
                canonicalRiddleId: canonical.canonicalRiddleId,
                sourceCanonicalHash: (0, raceTranslationValidation_1.raceTranslationCanonicalHash)(canonical),
                text: translated.text.normalize("NFC"),
                answer: translated.answer.normalize("NFC"),
                categoryId: canonical.categoryId,
                difficultyBand: canonical.difficultyBand,
                qualityVersion: raceTranslationValidation_1.AUTOMATED_TRANSLATION_QUALITY_VERSION,
                review: {
                    criticModel,
                    backTranslation: critique.backTranslation.normalize("NFC"),
                    equivalentCanonical: true,
                    clueLeak: false,
                    prohibitedContent: false,
                    categoryMatch: true,
                    difficultyMatch: true,
                },
            });
        }
    }
    /** Provides bundle behavior. */
    const bundle = raceTranslationValidation_1.RaceTranslationBundleSchema.parse({
        locale,
        provenance: raceTranslationValidation_1.AUTOMATED_TRANSLATION_QUALITY_VERSION,
        translatorModel,
        criticModel,
        riddles,
    });
    /** Provides plan behavior. */
    const plan = (0, raceTranslationValidation_1.createRaceTranslationPlan)(bundle, source);
    if (!plan.valid) {
        throw new Error(`translation-plan-invalid:${plan.issues.map(({ code }) => code).join(",")}`);
    }
    return bundle;
}
//# sourceMappingURL=raceTranslationGenerator.js.map
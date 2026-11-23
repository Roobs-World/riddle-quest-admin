import {RACE_SUPPORTED_LOCALES, type RaceLocale} from "../../../../src/races/contracts/index.js";
import {createHash} from "node:crypto";
import {z} from "zod";
import {
  RaceContentImportFileSchema,
  createRaceContentImportPlan,
  type RaceContentImportFile,
} from "./raceContentImport";
import {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  RaceTranslationBundleSchema,
  createRaceTranslationPlan,
  playableTranslatedAnswerIssue,
  raceTranslationCanonicalHash,
} from "./raceTranslationValidation";

/** Validates the non english race locale data shape. */
const NonEnglishRaceLocaleSchema = z
  .enum(RACE_SUPPORTED_LOCALES)
  .refine((locale): locale is Exclude<RaceLocale, "en"> => locale !== "en", "Translation locale must not be English");

/** Validates the translation draft data shape. */
export const TranslationDraftSchema = z
  .object({
    canonicalRiddleId: z.string().trim().min(1).max(160),
    text: z.string().trim().min(1).max(2_000),
    answer: z.string().trim().min(1).max(100),
  })
  .strict();
/** Describes translation draft. */
export type TranslationDraft = z.infer<typeof TranslationDraftSchema>;

/** Validates the translation critique data shape. */
export const TranslationCritiqueSchema = z
  .object({
    canonicalRiddleId: z.string().trim().min(1).max(160),
    backTranslation: z.string().trim().min(1).max(2_000),
    equivalentCanonical: z.boolean(),
    clueLeak: z.boolean(),
    prohibitedContent: z.boolean(),
    categoryMatch: z.boolean(),
    difficultyMatch: z.boolean(),
  })
  .strict();
/** Describes translation critique. */
export type TranslationCritique = z.infer<typeof TranslationCritiqueSchema>;

/** Validates the race translation checkpoint data shape. */
export const RaceTranslationCheckpointSchema = z
  .object({
    sourceFileHash: z.string().regex(/^[0-9a-f]{64}$/),
    translatorModel: z.string().trim().min(1).max(160),
    criticModel: z.string().trim().min(1).max(160),
    translations: z.record(z.string(), TranslationDraftSchema),
    critiques: z.record(z.string(), TranslationCritiqueSchema),
    critiqueTranslationHashes: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  })
  .strict();
/** Describes race translation checkpoint. */
export type RaceTranslationCheckpoint = z.infer<typeof RaceTranslationCheckpointSchema>;

/** Binds an independent critique to the exact normalized translation it inspected. */
export function raceTranslationDraftHash(draft: TranslationDraft): string {
  /** Parses d. */
  const parsed = TranslationDraftSchema.parse(draft);
  return createHash("sha256")
    .update(
      `race-translation-draft-v1\0${parsed.canonicalRiddleId}\0${parsed.text.normalize("NFC")}\0${parsed.answer.normalize("NFC")}`,
      "utf8",
    )
    .digest("hex");
}

/** Rejects stale critique approvals, unknown IDs, and checkpoint contract drift before resume. */
export function validateRaceTranslationCheckpoint(
  value: unknown,
  expected: {
    /** Stores source file hash. */
    sourceFileHash: string;
    /** Stores translator model. */
    translatorModel: string;
    /** Stores critic model. */
    criticModel: string;
    /** Stores canonical riddle ids. */
    canonicalRiddleIds: string[];
    /** Stores locale. */
    locale?: RaceLocale;
  },
): RaceTranslationCheckpoint {
  /** Provides checkpoint behavior. */
  const checkpoint = RaceTranslationCheckpointSchema.parse(value);
  if (
    checkpoint.sourceFileHash !== expected.sourceFileHash ||
    checkpoint.translatorModel !== expected.translatorModel ||
    checkpoint.criticModel !== expected.criticModel
  ) {
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
  if (
    [...translationIds, ...critiqueIds, ...hashIds].some((id) => !canonicalIds.has(id)) ||
    translationIds.some(
      (id) => playableTranslatedAnswerIssue(checkpoint.translations[id].answer, expected.locale ?? "en") !== null,
    ) ||
    critiqueIds.length !== hashIds.length ||
    critiqueIds.some(
      (id) =>
        !checkpoint.translations[id] ||
        checkpoint.critiqueTranslationHashes[id] !== raceTranslationDraftHash(checkpoint.translations[id]),
    ) ||
    hashIds.some((id) => !checkpoint.critiques[id])
  ) {
    throw new Error("checkpoint-critique-translation-mismatch");
  }
  return checkpoint;
}

/** Defines the contract for race translation model port. */
export interface RaceTranslationModelPort {
  /** Provides translate behavior. */
  translate(input: {
    /** Stores locale. */
    locale: Exclude<RaceLocale, "en">;
    /** Stores source. */
    source: RaceContentImportFile["riddles"];
  }): Promise<TranslationDraft[]>;
  /** Provides critique behavior. */
  critique(input: {
    /** Stores locale. */
    locale: Exclude<RaceLocale, "en">;
    /** Stores source. */
    source: RaceContentImportFile["riddles"];
    /** Stores translations. */
    translations: TranslationDraft[];
  }): Promise<TranslationCritique[]>;
}

/** Provides exact by canonical behavior. */
const exactByCanonical = <
  Value extends {
    /** Stores canonical riddle id. */
    canonicalRiddleId: string;
  },
>(
  values: Value[],
  expectedIds: string[],
  schema: z.ZodType<Value>,
  label: string,
): Map<string, Value> => {
  /** Parses d. */
  const parsed = z.array(schema).length(expectedIds.length).parse(values);
  assertExactTranslationResponseIds(parsed, expectedIds, label);
  /** Provides by id behavior. */
  const byId = new Map(parsed.map((value) => [value.canonicalRiddleId, value]));
  return byId;
};

/** Rejects duplicates, substitutions, and extras before a model response enters a checkpoint. */
export function assertExactTranslationResponseIds(
  values: Array<{
    /** Stores canonical riddle id. */
    canonicalRiddleId: string;
  }>,
  expectedIds: string[],
  label: string,
): void {
  /** Provides ids behavior. */
  const ids = values.map(({canonicalRiddleId}) => canonicalRiddleId);
  if (
    ids.length !== expectedIds.length ||
    new Set(ids).size !== expectedIds.length ||
    expectedIds.some((id) => !ids.includes(id))
  ) {
    throw new Error(`${label}-canonical-set-mismatch`);
  }
}

/** Generates one complete locale with a separate translator and critic, then runs every import gate. */
export async function generateRaceTranslationBundle({
  locale: localeInput,
  source: sourceInput,
  translatorModel,
  criticModel,
  port,
  batchSize = 15,
}: {
  /** Stores locale. */
  locale: Exclude<RaceLocale, "en">;
  /** Stores source. */
  source: unknown;
  /** Stores translator model. */
  translatorModel: string;
  /** Stores critic model. */
  criticModel: string;
  /** Stores port. */
  port: RaceTranslationModelPort;
  /** Stores batch size. */
  batchSize?: number;
}): Promise<z.infer<typeof RaceTranslationBundleSchema>> {
  /** Provides locale behavior. */
  const locale = NonEnglishRaceLocaleSchema.parse(localeInput);
  /** Provides source behavior. */
  const source = RaceContentImportFileSchema.parse(sourceInput);
  /** Provides source plan behavior. */
  const sourcePlan = createRaceContentImportPlan(source);
  if (!sourcePlan.valid) {
    /** Provides codes behavior. */
    const codes = [...new Set(sourcePlan.issues.map(({code}) => code))].sort();
    throw new Error(`translation-source-invalid:${codes.join(",")}`);
  }
  if (!translatorModel.trim() || !criticModel.trim() || translatorModel === criticModel) {
    throw new Error("translation-models-must-be-distinct");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 30)
    throw new Error("invalid-translation-batch-size");

  /** Provides riddles behavior. */
  const riddles: Array<z.infer<typeof RaceTranslationBundleSchema>["riddles"][number]> = [];
  for (let offset = 0; offset < source.riddles.length; offset += batchSize) {
    /** Provides batch behavior. */
    const batch = source.riddles.slice(offset, offset + batchSize);
    /** Provides ids behavior. */
    const ids = batch.map(({canonicalRiddleId}) => canonicalRiddleId);
    /** Provides translations behavior. */
    const translations = exactByCanonical(
      await port.translate({locale, source: batch}),
      ids,
      TranslationDraftSchema,
      "translation",
    );
    /** Provides ordered translations behavior. */
    const orderedTranslations = ids.map((id) => translations.get(id)!);
    /** Provides invalid answer behavior. */
    const invalidAnswer = orderedTranslations.find(
      (translation) => playableTranslatedAnswerIssue(translation.answer, locale) !== null,
    );
    if (invalidAnswer) {
      throw new Error(
        `translation-answer-invalid:${invalidAnswer.canonicalRiddleId}:` +
          playableTranslatedAnswerIssue(invalidAnswer.answer, locale),
      );
    }
    /** Provides critiques behavior. */
    const critiques = exactByCanonical(
      await port.critique({locale, source: batch, translations: orderedTranslations}),
      ids,
      TranslationCritiqueSchema,
      "critique",
    );
    for (const canonical of batch) {
      /** Provides translated behavior. */
      const translated = translations.get(canonical.canonicalRiddleId)!;
      /** Provides critique behavior. */
      const critique = critiques.get(canonical.canonicalRiddleId)!;
      if (
        !critique.equivalentCanonical ||
        critique.clueLeak ||
        critique.prohibitedContent ||
        !critique.categoryMatch ||
        !critique.difficultyMatch
      ) {
        throw new Error(`translation-critique-rejected:${canonical.canonicalRiddleId}`);
      }
      riddles.push({
        canonicalRiddleId: canonical.canonicalRiddleId,
        sourceCanonicalHash: raceTranslationCanonicalHash(canonical),
        text: translated.text.normalize("NFC"),
        answer: translated.answer.normalize("NFC"),
        categoryId: canonical.categoryId,
        difficultyBand: canonical.difficultyBand,
        qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
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
  const bundle = RaceTranslationBundleSchema.parse({
    locale,
    provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
    translatorModel,
    criticModel,
    riddles,
  });
  /** Provides plan behavior. */
  const plan = createRaceTranslationPlan(bundle, source);
  if (!plan.valid) {
    throw new Error(`translation-plan-invalid:${plan.issues.map(({code}) => code).join(",")}`);
  }
  return bundle;
}

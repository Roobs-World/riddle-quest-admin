#!/usr/bin/env node
"use strict";

const OpenAI = require("openai").default;
const {zodTextFormat} = require("openai/helpers/zod");
const {z} = require("zod");
const {createHash} = require("node:crypto");
const {mkdir, readFile, rename, writeFile} = require("node:fs/promises");
const path = require("node:path");
const {RACE_SUPPORTED_LOCALES} = require("@qwordly/core/race");
const {
  RaceTranslationCheckpointSchema,
  assertExactTranslationResponseIds,
  generateRaceTranslationBundle,
  raceTranslationDraftHash,
  validateRaceTranslationCheckpoint,
} = require("../lib/race/raceTranslationGenerator.js");
const {
  RaceTranslationBundleSchema,
  createRaceTranslationPlan,
  playableTranslatedAnswerIssue,
} = require("../lib/race/raceTranslationValidation.js");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const translatorModel = option("--translator-model");
const criticModel = option("--critic-model");
const sourcePath = path.resolve(option("--source") || "content/race-en-reviewed-v2.json");
const outputDirectory = path.resolve(option("--output-dir") || "content/race-translations");
const requestedLocales = (option("--locales") || RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en").join(","))
  .split(",").map((locale) => locale.trim()).filter(Boolean);
const {TranslationCritiqueSchema, TranslationDraftSchema} = require("../lib/race/raceTranslationGenerator.js");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

const atomicJson = async (target, value) => {
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {flag: "wx", mode: 0o600});
  await rename(temporary, target);
};

const modelSettings = (model) => model.startsWith("gpt-5.6") ? {reasoning: {effort: "medium"}} : {};

if (!process.env.OPENAI_API_KEY) fail("Set OPENAI_API_KEY without placing it in the repository.");
else if (!translatorModel || !criticModel || translatorModel === criticModel) {
  fail("Provide distinct --translator-model and --critic-model values.");
} else if (requestedLocales.some((locale) => locale === "en" || !RACE_SUPPORTED_LOCALES.includes(locale))) {
  fail("--locales must contain only supported non-English locale codes.");
} else if (new Set(requestedLocales).size !== requestedLocales.length) {
  fail("--locales must not contain duplicates.");
} else {
  void (async () => {
    const sourceRaw = await readFile(sourcePath, "utf8");
    const source = JSON.parse(sourceRaw);
    const sourceFileHash = createHash("sha256").update(sourceRaw).digest("hex");
    await mkdir(outputDirectory, {recursive: true});
    const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2});

    for (const locale of requestedLocales) {
      const outputPath = path.join(outputDirectory, `race-${locale}-automated-translation-v1.json`);
      try {
        const existing = RaceTranslationBundleSchema.parse(JSON.parse(await readFile(outputPath, "utf8")));
        const plan = createRaceTranslationPlan(existing, source);
        if (!plan.valid) throw new Error(`existing-output-invalid:${locale}`);
        if (
          existing.locale !== locale || existing.translatorModel !== translatorModel ||
          existing.criticModel !== criticModel
        ) throw new Error(`existing-output-contract-mismatch:${locale}`);
        process.stdout.write(`${locale}: verified existing 180-riddle bundle; skipped\n`);
        continue;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      const checkpointPath = path.join(outputDirectory, `race-${locale}.checkpoint.json`);
      let checkpoint = {
        sourceFileHash,
        translatorModel,
        criticModel,
        translations: {},
        critiques: {},
        critiqueTranslationHashes: {},
      };
      try {
        const restored = validateRaceTranslationCheckpoint(
          RaceTranslationCheckpointSchema.parse(JSON.parse(await readFile(checkpointPath, "utf8"))),
          {
            sourceFileHash,
            translatorModel,
            criticModel,
            locale,
            canonicalRiddleIds: source.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
          },
        );
        checkpoint = restored;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      const port = {
        async translate({source: batch}) {
          const missing = batch.filter(({canonicalRiddleId}) => !checkpoint.translations[canonicalRiddleId]);
          if (missing.length > 0) {
            const schema = z.object({items: z.array(TranslationDraftSchema).length(missing.length)}).strict();
            const response = await openai.responses.parse({
              model: translatorModel,
              ...modelSettings(translatorModel),
              instructions:
                `Translate each all-ages quiz clue and its answer naturally into locale ${locale}. ` +
                "Preserve the exact canonical meaning, factual answer, category, and difficulty. Use native script and everyday native phrasing; do not explain, add clues, reveal the answer in the clue, or romanize unless that is the normal native answer form. " +
                "Each answer must be NFC-normalized, contain only Unicode letters and combining marks with no spaces or punctuation, and be one through seven grapheme clusters. Return every canonicalRiddleId exactly once.",
              input: JSON.stringify(missing.map(({canonicalRiddleId, text, answer, categoryId, difficultyBand}) =>
                ({canonicalRiddleId, text, answer, categoryId, difficultyBand}))),
              prompt_cache_key: `riddlequest-race-translation-${locale}-v1`,
              store: false,
              text: {format: zodTextFormat(schema, "race_translation_batch"), verbosity: "low"},
            });
            if (!response.output_parsed) throw new Error(`empty-translation-response:${locale}`);
            assertExactTranslationResponseIds(
              response.output_parsed.items,
              missing.map(({canonicalRiddleId}) => canonicalRiddleId),
              "translation",
            );
            for (const item of response.output_parsed.items) {
              const issue = playableTranslatedAnswerIssue(item.answer, locale);
              if (issue) throw new Error(`translation-answer-invalid:${locale}:${item.canonicalRiddleId}:${issue}`);
            }
            for (const item of response.output_parsed.items) checkpoint.translations[item.canonicalRiddleId] = item;
            await atomicJson(checkpointPath, checkpoint);
            process.stdout.write(`${locale}: translated ${Object.keys(checkpoint.translations).length}/180\n`);
          }
          return batch.map(({canonicalRiddleId}) => checkpoint.translations[canonicalRiddleId]);
        },
        async critique({source: batch, translations}) {
          const missingIndices = batch.flatMap(({canonicalRiddleId}, index) =>
            checkpoint.critiques[canonicalRiddleId] ? [] : [index]);
          if (missingIndices.length > 0) {
            const schema = z.object({items: z.array(TranslationCritiqueSchema).length(missingIndices.length)}).strict();
            const response = await openai.responses.parse({
              model: criticModel,
              ...modelSettings(criticModel),
              instructions:
                `Independently audit each ${locale} translation against its English canonical source. ` +
                "Back-translate the clue into English and set every boolean strictly. equivalentCanonical/categoryMatch/difficultyMatch are true only on a full match; clueLeak and prohibitedContent are true when present. Do not repair. Return every canonicalRiddleId exactly once.",
              input: JSON.stringify(missingIndices.map((index) => ({
                canonical: batch[index], translation: translations[index],
              }))),
              prompt_cache_key: `riddlequest-race-translation-critic-${locale}-v1`,
              store: false,
              text: {format: zodTextFormat(schema, "race_translation_critique_batch"), verbosity: "low"},
            });
            if (!response.output_parsed) throw new Error(`empty-critique-response:${locale}`);
            const expectedIds = missingIndices.map((index) => batch[index].canonicalRiddleId);
            assertExactTranslationResponseIds(response.output_parsed.items, expectedIds, "critique");
            for (const item of response.output_parsed.items) {
              checkpoint.critiques[item.canonicalRiddleId] = item;
              checkpoint.critiqueTranslationHashes[item.canonicalRiddleId] = raceTranslationDraftHash(
                checkpoint.translations[item.canonicalRiddleId],
              );
            }
            await atomicJson(checkpointPath, checkpoint);
            process.stdout.write(`${locale}: critiqued ${Object.keys(checkpoint.critiques).length}/180\n`);
          }
          return batch.map(({canonicalRiddleId}) => checkpoint.critiques[canonicalRiddleId]);
        },
      };

      const bundle = await generateRaceTranslationBundle({
        locale,
        source,
        translatorModel,
        criticModel,
        port,
      });
      await atomicJson(outputPath, bundle);
      process.stdout.write(`${locale}: wrote verified ${bundle.riddles.length}-riddle bundle\n`);
    }
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}

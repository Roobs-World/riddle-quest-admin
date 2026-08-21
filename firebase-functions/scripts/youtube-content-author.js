#!/usr/bin/env node
"use strict";

const OpenAI = require("openai").default;
const {zodTextFormat} = require("openai/helpers/zod");
const {z} = require("zod");
const path = require("node:path");
const {mkdir, readFile, rename, rm, unlink, writeFile} = require("node:fs/promises");
const {
  SUPPORTED_LOCALES,
  YOUTUBE_CLUE_MAX_LENGTH,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  sha256,
  stableJson,
} = require("./lib/youtube-content-pack.js");
const {authorYouTubeContent} = require("./lib/youtube-content-author.js");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`missing-option-value:${name}`);
  return args[index + 1];
};

const sourcePath = path.resolve(option("--source", "content/youtube-content-source-v1.json"));
const orderPath = path.resolve(option("--order", "content/youtube-content-order-v1.json"));
const outputDirectory = path.resolve(option("--translations-dir", "content/youtube-translations"));
const authoringDirectory = path.resolve(option("--checkpoint-dir", "content/youtube-authoring"));
const appendCount = Number(option("--append-count", "0"));
const dailyStartsOn = option("--daily-starts-on", undefined);
const batchSize = Number(option("--batch-size", "15"));
const checkpointPath = path.join(authoringDirectory, "youtube-content-author.checkpoint.json");
const commitJournalPath = path.join(authoringDirectory, "youtube-content-author.commit.json");
const preparedDirectory = path.join(authoringDirectory, "youtube-content-author.prepared");

const DraftSchema = z.object({
  canonicalRiddleId: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(YOUTUBE_CLUE_MAX_LENGTH),
  answer: z.string().trim().min(1).max(100),
}).strict();

const EnglishCritiqueSchema = z.object({
  canonicalRiddleId: z.string().trim().min(1).max(160),
  factual: z.boolean(),
  answerCorrect: z.boolean(),
  unambiguous: z.boolean(),
  clueLeak: z.boolean(),
  prohibitedContent: z.boolean(),
  categoryMatch: z.boolean(),
  difficultyMatch: z.boolean(),
}).strict();

const TranslationCritiqueSchema = z.object({
  canonicalRiddleId: z.string().trim().min(1).max(160),
  backTranslation: z.string().trim().min(1).max(2_000),
  equivalentCanonical: z.boolean(),
  clueLeak: z.boolean(),
  prohibitedContent: z.boolean(),
  categoryMatch: z.boolean(),
  difficultyMatch: z.boolean(),
}).strict();

const readJson = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  return {raw, value: JSON.parse(raw)};
};

const readOptionalJson = async (filePath) => {
  try {
    return (await readJson(filePath)).value;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

const atomicJson = async (target, value) => {
  await mkdir(path.dirname(target), {recursive: true});
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, stableJson(value), {encoding: "utf8", flag: "wx", mode: 0o600});
  await rename(temporary, target);
};

const atomicText = async (target, raw) => {
  await mkdir(path.dirname(target), {recursive: true});
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, raw, {encoding: "utf8", flag: "wx", mode: 0o600});
  await rename(temporary, target);
};

const outputTargets = () => Object.fromEntries([
  ...SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => [
    `translation:${locale}`,
    path.join(outputDirectory, `youtube-${locale}-automated-translation-v1.json`),
  ]),
  ["order", orderPath],
  ["source", sourcePath],
]);

const targetConfigurationHash = (targets) => sha256(stableJson(targets));

const resumePreparedCommit = async ({
  targets = outputTargets(),
  journalPath = commitJournalPath,
  preparedPath = preparedDirectory,
  checkpointFile = checkpointPath,
  afterPreparedCleanup = async () => {},
} = {}) => {
  const journal = await readOptionalJson(journalPath);
  if (!journal) return false;
  const expectedKeys = Object.keys(targets);
  if (journal?.schemaVersion !== 1 ||
    journal.targetConfigurationSha256 !== targetConfigurationHash(targets) ||
    !Array.isArray(journal.entries) || journal.entries.length !== expectedKeys.length ||
    new Set(journal.entries.map(({key}) => key)).size !== expectedKeys.length ||
    !expectedKeys.every((key) => journal.entries.some((entry) => entry.key === key))) {
    throw new Error("youtube-author-commit-journal-invalid");
  }
  for (const entry of journal.entries) {
    if (!entry || typeof entry.key !== "string" || !/^[0-9a-f]{64}$/u.test(entry.sha256 || "") ||
      typeof entry.stagedFile !== "string" || path.basename(entry.stagedFile) !== entry.stagedFile) {
      throw new Error("youtube-author-commit-entry-invalid");
    }
    const target = targets[entry.key];
    if (!target) throw new Error("youtube-author-commit-target-invalid");
    try {
      if (sha256(await readFile(target, "utf8")) === entry.sha256) continue;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const stagedRaw = await readFile(path.join(preparedPath, entry.stagedFile), "utf8");
    if (sha256(stagedRaw) !== entry.sha256) throw new Error(`youtube-author-staged-hash-mismatch:${entry.key}`);
    await atomicText(target, stagedRaw);
  }
  // Keep the journal until every cleanup step succeeds. If the process stops during cleanup, replay sees that all
  // targets already match, repeats these idempotent removals, and only then removes the recovery authority.
  await rm(preparedPath, {recursive: true, force: true});
  await afterPreparedCleanup();
  try {
    await unlink(checkpointFile);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await unlink(journalPath);
  process.stdout.write("Recovered and completed the prepared YouTube content commit.\n");
  return true;
};

const prepareAndCommit = async (result, locales) => {
  const targets = outputTargets();
  await rm(preparedDirectory, {recursive: true, force: true});
  await mkdir(preparedDirectory, {recursive: true});
  const values = Object.fromEntries([
    ...locales.map((locale) => [`translation:${locale}`, result.translationBundles[locale]]),
    ["order", result.orderManifest],
    ["source", result.sourceDocument],
  ]);
  const entries = [];
  for (const [index, key] of Object.keys(targets).entries()) {
    const raw = stableJson(values[key]);
    const stagedFile = `${String(index).padStart(2, "0")}-${key.replace(":", "-")}.json`;
    await writeFile(path.join(preparedDirectory, stagedFile), raw,
      {encoding: "utf8", flag: "wx", mode: 0o600});
    entries.push({key, stagedFile, sha256: sha256(raw)});
  }
  await atomicJson(commitJournalPath, {
    schemaVersion: 1,
    targetConfigurationSha256: targetConfigurationHash(targets),
    entries,
  });
  return resumePreparedCommit();
};

const parseResponse = async ({openai, model, schema, schemaName, instructions, input, cacheKey}) => {
  const response = await openai.responses.parse({
    model,
    ...(model.startsWith("gpt-5.6") ? {reasoning: {effort: "medium"}} : {}),
    instructions,
    input: JSON.stringify(input),
    prompt_cache_key: cacheKey,
    store: false,
    text: {format: zodTextFormat(z.object({items: z.array(schema).length(input.expectedCount)}).strict(),
      schemaName), verbosity: "low"},
  });
  if (!response.output_parsed) throw new Error(`empty-model-response:${schemaName}`);
  return response.output_parsed.items;
};

const main = async () => {
  if (!Number.isSafeInteger(appendCount) || appendCount < 0 || appendCount > 180) {
    throw new Error("--append-count must be an integer from 0 through 180.");
  }
  if (hasFlag("--require-append") && appendCount < 1) {
    throw new Error("This command requires --append-count with a value from 1 through 180.");
  }
  if (appendCount > 0 && !dailyStartsOn) {
    throw new Error("Appending requires --daily-starts-on YYYY-MM-DD for a new immutable schedule segment.");
  }
  if (appendCount === 0 && dailyStartsOn) {
    throw new Error("--daily-starts-on is valid only with --append-count.");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 30) {
    throw new Error("--batch-size must be an integer from 1 through 30.");
  }
  await mkdir(authoringDirectory, {recursive: true});
  await mkdir(outputDirectory, {recursive: true});
  if (await resumePreparedCommit()) return;
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY without placing it in the repository.");
  const [sourceInput, orderInput] = await Promise.all([readJson(sourcePath), readJson(orderPath)]);
  const seedPath = path.resolve(path.dirname(sourcePath), sourceInput.value?.seed?.file || "");
  if (path.dirname(seedPath) !== path.dirname(sourcePath)) throw new Error("youtube-source-seed-path-invalid");
  const seedInput = await readJson(seedPath);
  const locales = SUPPORTED_LOCALES.filter((locale) => locale !== "en");
  const existingBundles = {};
  for (const locale of locales) {
    const bundle = await readOptionalJson(
      path.join(outputDirectory, `youtube-${locale}-automated-translation-v1.json`),
    );
    if (bundle) existingBundles[locale] = bundle;
  }
  const checkpoint = await readOptionalJson(checkpointPath);
  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2});

  const port = {
    async generateEnglish({model, source, specs}) {
      return parseResponse({
        openai,
        model,
        schema: DraftSchema,
        schemaName: "youtube_english_riddle_batch",
        instructions:
          "Create each requested all-ages English riddle. Obey the supplied canonical ID, category, and difficulty. " +
          "The clue must be factual, unambiguous, naturally phrased, and must not contain its answer. The answer must " +
          "be NFC-normalized Unicode letters/marks only, with no spaces or punctuation, and one through seven grapheme " +
          "clusters. Do not repeat or lightly paraphrase any existing clue and do not reuse any existing answer. " +
          "Return every requested canonicalRiddleId exactly once.",
        input: {
          expectedCount: specs.length,
          specs,
          existing: source.map(({canonicalRiddleId, text, answer, categoryId, difficultyBand}) =>
            ({canonicalRiddleId, text, answer, categoryId, difficultyBand})),
        },
        cacheKey: "riddlequest-youtube-english-author-v1",
      });
    },
    async critiqueEnglish({model, source, specs, drafts}) {
      return parseResponse({
        openai,
        model,
        schema: EnglishCritiqueSchema,
        schemaName: "youtube_english_critique_batch",
        instructions:
          "Independently audit each proposed English riddle. Check the fact and exact answer, ambiguity, answer leakage, " +
          "all-ages safety, category, difficulty, and duplication against the existing catalog. Do not repair anything. " +
          "Set every boolean strictly and return every requested canonicalRiddleId exactly once.",
        input: {expectedCount: drafts.length, specs, drafts, existing: source},
        cacheKey: "riddlequest-youtube-english-critic-v1",
      });
    },
    async translate({model, locale, source, attempts, feedback}) {
      return parseResponse({
        openai,
        model,
        schema: DraftSchema,
        schemaName: "youtube_translation_batch",
        instructions:
          `Translate each all-ages clue and answer naturally into locale ${locale}. Preserve the exact canonical ` +
          "meaning, factual answer, category, and difficulty. Use native script and everyday native phrasing. Do not " +
          "explain, add clues, reveal the answer in the clue, or romanize unless it is the normal native answer form. " +
          "The clue must not contain its localized answer, even when that answer is a translated title or an ordinary " +
          "noun; rewrite with a natural synonym or circumlocution while preserving the original difficulty. For any " +
          "item whose attempt count is above zero, use materially different wording and repair every failed dimension " +
          "reported in its prior critic feedback; do not repeat the rejected draft. When equivalentCanonical is false, " +
          "replace the rejected answer with a more exact native term rather than only rewording the clue. When clueLeak " +
          "is true, retain an otherwise correct answer and rewrite the clue so it contains no literal answer. When " +
          "difficultyMatch is false, restore the source difficulty without changing the canonical fact. " +
          "Answers must be NFC-normalized Unicode letters/marks only, with no spaces or punctuation, and one through " +
          "seven grapheme clusters. Return every canonicalRiddleId exactly once.",
        input: {expectedCount: source.length, source, attempts, feedback},
        cacheKey: `riddlequest-youtube-translation-${locale}-v4`,
      });
    },
    async critiqueTranslation({model, locale, source, translations}) {
      return parseResponse({
        openai,
        model,
        schema: TranslationCritiqueSchema,
        schemaName: "youtube_translation_critique_batch",
        instructions:
          `Independently audit each ${locale} translation against its English canonical source. Back-translate the clue ` +
          "into English and set every boolean strictly. equivalentCanonical/categoryMatch/difficultyMatch are true only " +
          "on a full match; clueLeak and prohibitedContent are true when present. Do not repair anything. Return every " +
          "canonicalRiddleId exactly once.",
        input: {expectedCount: source.length, items: source.map((canonical, index) =>
          ({canonical, translation: translations[index]}))},
        cacheKey: `riddlequest-youtube-translation-critic-${locale}-v1`,
      });
    },
  };

  process.stdout.write(
    `YouTube authoring contract: ${YOUTUBE_TRANSLATOR_MODEL} generator/translator + ` +
    `${YOUTUBE_CRITIC_MODEL} independent critic; append ${appendCount}; ${locales.length} locales.\n`,
  );
  const result = await authorYouTubeContent({
    sourceDocument: sourceInput.value,
    seedRaw: seedInput.raw,
    seed: seedInput.value,
    orderManifest: orderInput.value,
    existingBundles,
    appendCount,
    dailyStartsOn,
    locales,
    batchSize,
    checkpoint,
    port,
    onCheckpoint: async (value) => atomicJson(checkpointPath, value),
  });

  await prepareAndCommit(result, locales);
  process.stdout.write(
    `YouTube authoring complete: ${result.source.riddles.length} canonical riddles and ` +
    `${locales.length} complete locale bundles.\n` +
    `Source SHA-256: ${sha256(stableJson(result.source))}\n`,
  );
};

if (require.main === module) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {resumePreparedCommit};

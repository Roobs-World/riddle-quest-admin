#!/usr/bin/env node
"use strict";

const path = require("node:path");
const {mkdir, readFile, rename, writeFile} = require("node:fs/promises");
const {
  SUPPORTED_LOCALES,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  compileYouTubeContent,
  createYouTubeContentAudit,
  sha256,
  stableJson,
} = require("./lib/youtube-content-pack.js");
const {resolveYouTubeCanonicalSource} = require("./lib/youtube-content-author.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`missing-option-value:${name}`);
  return args[index + 1];
};
const resolveOption = (name, fallback) => path.resolve(repositoryRoot, option(name, fallback));

const sourcePath = resolveOption("--source", "firebase-functions/content/youtube-content-source-v1.json");
const translationsDirectory = resolveOption("--translations-dir", "firebase-functions/content/youtube-translations");
const orderPath = resolveOption("--order", "firebase-functions/content/youtube-content-order-v1.json");
const outputPath = resolveOption("--output", "packages/portal/src/playable/generated/youtube-content-v1.json");
const auditPath = resolveOption(
  "--audit-output",
  "firebase-functions/artifacts/youtube-content/youtube-content-v1.audit.json",
);
const checkOnly = hasFlag("--check");
const fixture = hasFlag("--allow-incomplete-fixture");
const requestedLocales = option("--locales", SUPPORTED_LOCALES.join(",")).split(",").map((locale) => locale.trim())
  .filter(Boolean);
const fixtureCount = Number(option("--fixture-count", "3"));

const readJson = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  return {raw, value: JSON.parse(raw)};
};

const atomicWrite = async (filePath, value) => {
  await mkdir(path.dirname(filePath), {recursive: true});
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, value, {encoding: "utf8", flag: "wx", mode: 0o600});
  await rename(temporary, filePath);
};

const relative = (filePath) => path.relative(repositoryRoot, filePath);

void (async () => {
  if (fixture && !path.basename(outputPath).includes("fixture")) {
    throw new Error("fixture-output-must-contain-fixture");
  }
  if (!fixture && requestedLocales.join(",") !== SUPPORTED_LOCALES.join(",")) {
    throw new Error("release-requires-all-17-locales");
  }
  const [sourceInput, orderInput] = await Promise.all([readJson(sourcePath), readJson(orderPath)]);
  if (!sourceInput.value?.seed?.file) throw new Error("youtube-source-document-required");
  const seedPath = path.resolve(path.dirname(sourcePath), sourceInput.value.seed.file);
  if (path.dirname(seedPath) !== path.dirname(sourcePath)) throw new Error("youtube-source-seed-path-invalid");
  const seedInput = await readJson(seedPath);
  const source = resolveYouTubeCanonicalSource({
    document: sourceInput.value,
    seedRaw: seedInput.raw,
    seed: seedInput.value,
  });
  const translationInputs = {};
  const missing = [];
  for (const locale of requestedLocales.filter((value) => value !== "en")) {
    const translationPath = path.join(translationsDirectory, `youtube-${locale}-automated-translation-v1.json`);
    try {
      translationInputs[locale] = await readJson(translationPath);
    } catch (error) {
      if (error && error.code === "ENOENT") missing.push(locale);
      else throw error;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `missing-translation-bundles:${missing.join(",")}:run pnpm --dir firebase-functions ` +
      "youtube:content:author with OPENAI_API_KEY",
    );
  }
  const content = compileYouTubeContent({
    source,
    translationBundles: Object.fromEntries(
      Object.entries(translationInputs).map(([locale, input]) => [locale, input.value]),
    ),
    orderManifest: orderInput.value,
    locales: requestedLocales,
    fixture,
    fixtureCount,
  });
  const outputRaw = stableJson(content);
  const audit = createYouTubeContentAudit({
    content,
    // The descriptor binds the exact Race seed hash, every appended riddle, and its normalized critic receipt.
    sourceRaw: sourceInput.raw,
    orderRaw: orderInput.raw,
    bundleInputs: translationInputs,
    outputRaw,
  });
  audit.inputs.canonicalAuthoring = {
    sourceDescriptorSha256: sha256(sourceInput.raw),
    generatorModel: sourceInput.value.appendReceipts.at(-1)?.generatorModel ?? YOUTUBE_TRANSLATOR_MODEL,
    criticModel: YOUTUBE_CRITIC_MODEL,
    appendReceiptCount: sourceInput.value.appendReceipts.length,
    appendReceiptsSha256: sha256(stableJson(sourceInput.value.appendReceipts)),
  };
  const auditRaw = stableJson(audit);
  if (checkOnly) {
    const [committedOutput, committedAudit] = await Promise.all([
      readFile(outputPath, "utf8"),
      readFile(auditPath, "utf8"),
    ]);
    if (committedOutput !== outputRaw) throw new Error(`runtime-content-out-of-date:${relative(outputPath)}`);
    if (committedAudit !== auditRaw) throw new Error(`content-audit-out-of-date:${relative(auditPath)}`);
    process.stdout.write(
      `YouTube content ready: ${content.contentVersion}; ${content.locales.length} locales; ` +
      `${content.classicOrder.length} riddles per locale\n`,
    );
    return;
  }
  await atomicWrite(outputPath, outputRaw);
  await atomicWrite(auditPath, auditRaw);
  process.stdout.write(
    `${fixture ? "Fixture" : "Release"} content written: ${relative(outputPath)} (${content.contentVersion})\n` +
    `Audit written: ${relative(auditPath)}\n`,
  );
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

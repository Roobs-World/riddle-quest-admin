"use strict";

const assert = require("node:assert/strict");
const {readFile} = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  SUPPORTED_LOCALES,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  assertAppendOnlyOrderManifest,
  canonicalSourceHash,
  compileYouTubeContent,
  createYouTubeContentAudit,
  playableAnswerIssue,
  prefixHash,
  saveRiddleFingerprint,
  stableJson,
  validateOrderManifest,
} = require("./lib/youtube-content-pack.js");
const {resolveYouTubeCanonicalSource} = require("./lib/youtube-content-author.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceDocumentPath = path.join(
  repositoryRoot,
  "firebase-functions/content/youtube-content-source-v1.json",
);
const seedPath = path.join(repositoryRoot, "firebase-functions/content/race-en-reviewed-v1.json");
const orderPath = path.join(repositoryRoot, "firebase-functions/content/youtube-content-order-v1.json");
const fixturePath = path.join(
  repositoryRoot,
  "firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json",
);

const readInputs = async () => {
  const [sourceDocumentRaw, seedRaw, orderRaw] = await Promise.all([
    readFile(sourceDocumentPath, "utf8"),
    readFile(seedPath, "utf8"),
    readFile(orderPath, "utf8"),
  ]);
  const source = resolveYouTubeCanonicalSource({
    document: JSON.parse(sourceDocumentRaw),
    seedRaw,
    seed: JSON.parse(seedRaw),
  });
  return {sourceRaw: stableJson(source), source, orderRaw, order: JSON.parse(orderRaw)};
};

const SCRIPT_MARKERS = {ar: "ع", hi: "ह", ja: "日", ko: "한", ru: "Я"};

const translationBundle = (locale, source) => ({
  locale,
  provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
  translatorModel: YOUTUBE_TRANSLATOR_MODEL,
  criticModel: YOUTUBE_CRITIC_MODEL,
  riddles: source.riddles.map((canonical) => ({
    canonicalRiddleId: canonical.canonicalRiddleId,
    sourceCanonicalHash: canonicalSourceHash(canonical),
    text: `${SCRIPT_MARKERS[locale] || `Translated ${locale}`} ${canonical.text}`,
    answer: canonical.answer,
    categoryId: canonical.categoryId,
    difficultyBand: canonical.difficultyBand,
    qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
    review: {
      criticModel: YOUTUBE_CRITIC_MODEL,
      backTranslation: canonical.text,
      equivalentCanonical: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    },
  })),
});

test("accepts NFC native letters and marks through the localized answer limit", () => {
  assert.equal(playableAnswerIssue("東京", "ja"), null);
  assert.equal(playableAnswerIssue("إجابة", "ar"), null);
  assert.equal(playableAnswerIssue("éclair", "fr"), null);
  assert.equal(playableAnswerIssue("e\u0301clair", "fr"), "non-nfc");
  assert.equal(playableAnswerIssue("two words", "en"), "letters-and-marks-only");
  assert.equal(playableAnswerIssue("answer!", "en"), "letters-and-marks-only");
  assert.equal(playableAnswerIssue("answer2", "en"), "letters-and-marks-only");
  assert.equal(playableAnswerIssue("abcdefghijkl", "en"), null);
  assert.equal(playableAnswerIssue("abcdefghijklm", "en"), "grapheme-length");
  assert.equal(playableAnswerIssue("🧩", "en"), "letters-and-marks-only");
});

test("locks the v1 category-round-robin order and rejects released-prefix mutation", async () => {
  const {source, order} = await readInputs();
  assert.equal(validateOrderManifest(order, source), order);
  assert.deepEqual(order.classic.canonicalIds.slice(0, 12), [
    "race:history:01", "race:geography:01", "race:music:01", "race:film:01", "race:science:01",
    "race:mixed:01", "race:history:02", "race:geography:02", "race:music:02", "race:film:02",
    "race:science:02", "race:mixed:02",
  ]);
  assert.notDeepEqual(order.daily.segments[0].canonicalIds, order.classic.canonicalIds);
  assert.equal(new Set(order.daily.segments[0].canonicalIds).size, order.classic.canonicalIds.length);
  const appended = structuredClone(order);
  appended.classic.canonicalIds.push("race:history:31");
  appended.daily.scheduleVersion = 2;
  appended.daily.segments.push({
    startsOn: "2026-06-30",
    canonicalIds: ["race:history:31"],
    lockedPrefix: {length: 1, sha256: prefixHash(["race:history:31"])},
  });
  assert.doesNotThrow(() => assertAppendOnlyOrderManifest(order, appended));
  const reordered = structuredClone(appended);
  [reordered.classic.canonicalIds[0], reordered.classic.canonicalIds[1]] =
    [reordered.classic.canonicalIds[1], reordered.classic.canonicalIds[0]];
  assert.throws(() => assertAppendOnlyOrderManifest(order, reordered), /order-not-append-only:classic/u);
  const movedReleasedSegment = structuredClone(appended);
  movedReleasedSegment.daily.segments[0].startsOn = "2026-01-02";
  assert.throws(() => assertAppendOnlyOrderManifest(order, movedReleasedSegment), /daily-released-segment-mutated/u);
});

test("reproduces the committed non-release fixture from reviewed content", async () => {
  const {source, order} = await readInputs();
  const actual = compileYouTubeContent({source, orderManifest: order, locales: ["en"], fixture: true});
  const committed = await readFile(fixturePath, "utf8");
  assert.equal(stableJson(actual), committed);
  assert.equal(actual.releaseReady, false);
  assert.equal(actual.fixture, true);
  assert.deepEqual(
    new Set(Object.keys(actual.packs.en)),
    new Set([...actual.classicOrder, ...actual.dailySchedule.segments.flatMap(({canonicalIds}) => canonicalIds)]),
  );
  assert.equal(committed.includes("review"), false);
  assert.equal(committed.includes("backTranslation"), false);
  assert.equal(committed.includes("translatorModel"), false);
});

test("compiles all 16 audited locales deterministically and keeps provenance out of runtime", async () => {
  const {source, sourceRaw, order, orderRaw} = await readInputs();
  const translationBundles = Object.fromEntries(SUPPORTED_LOCALES.filter((locale) => locale !== "en")
    .map((locale) => [locale, translationBundle(locale, source)]));
  const first = compileYouTubeContent({source, translationBundles, orderManifest: order});
  const second = compileYouTubeContent({source, translationBundles, orderManifest: order});
  const outputRaw = stableJson(first);
  assert.equal(outputRaw, stableJson(second));
  assert.equal(first.releaseReady, true);
  assert.equal(first.fixture, false);
  assert.deepEqual(first.locales, SUPPORTED_LOCALES);
  assert.equal(first.classicOrder.length, 180);
  assert.equal(Object.keys(first.packs).length, 16);
  assert.equal(Object.values(first.packs).every((pack) => Object.keys(pack).length === 180), true);
  for (const canonical of source.riddles) {
    const fingerprints = SUPPORTED_LOCALES.map(
      (locale) => first.packs[locale][canonical.canonicalRiddleId].contentFingerprint,
    );
    assert.deepEqual(new Set(fingerprints), new Set([saveRiddleFingerprint(canonical)]));
  }
  assert.equal(outputRaw.includes(YOUTUBE_TRANSLATOR_MODEL), false);
  assert.equal(outputRaw.includes(YOUTUBE_CRITIC_MODEL), false);
  assert.equal(outputRaw.includes("backTranslation"), false);

  const bundleInputs = Object.fromEntries(Object.entries(translationBundles).map(([locale, value]) => [locale, {
    value,
    raw: stableJson(value),
  }]));
  const audit = createYouTubeContentAudit({content: first, sourceRaw, orderRaw, bundleInputs, outputRaw});
  assert.equal(audit.releaseReady, true);
  assert.equal(audit.runtime.localeCount, 16);
  assert.equal(audit.runtime.riddleCountPerLocale, 180);
  assert.deepEqual(Object.keys(audit.inputs.translationBundles), SUPPORTED_LOCALES.slice(1));
});

test("appends aligned canonical and locale records without remapping the released v1 prefix", async () => {
  const {source, order} = await readInputs();
  const baseBundles = Object.fromEntries(SUPPORTED_LOCALES.filter((locale) => locale !== "en")
    .map((locale) => [locale, translationBundle(locale, source)]));
  const base = compileYouTubeContent({source, translationBundles: baseBundles, orderManifest: order});
  const extendedSource = structuredClone(source);
  extendedSource.riddles.push({
    canonicalRiddleId: "race:history:31",
    text: "What name is given to the knotted record-keeping cords used by the Inca?",
    answer: "quipu",
    categoryId: "history",
    difficultyBand: "hard",
    qualityVersion: "reviewed_v2",
  });
  const extendedOrder = structuredClone(order);
  extendedOrder.classic.orderVersion = 2;
  extendedOrder.classic.canonicalIds.push("race:history:31");
  extendedOrder.daily.scheduleVersion = 2;
  extendedOrder.daily.segments.push({
    startsOn: "2026-06-30",
    canonicalIds: ["race:history:31"],
    lockedPrefix: {length: 1, sha256: prefixHash(["race:history:31"])},
  });
  assert.doesNotThrow(() => assertAppendOnlyOrderManifest(order, extendedOrder));
  const extendedBundles = Object.fromEntries(SUPPORTED_LOCALES.filter((locale) => locale !== "en")
    .map((locale) => [locale, translationBundle(locale, extendedSource)]));
  const extended = compileYouTubeContent({
    source: extendedSource,
    translationBundles: extendedBundles,
    orderManifest: extendedOrder,
  });
  assert.equal(extended.classicOrder.length, 181);
  assert.equal(extended.classicOrder.at(-1), "race:history:31");
  assert.deepEqual(extended.classicOrder.slice(0, 180), base.classicOrder);
  assert.deepEqual(extended.dailySchedule.segments[0], base.dailySchedule.segments[0]);
  assert.equal(extended.dailySchedule.segments[1].startsOn, "2026-06-30");
  for (const locale of SUPPORTED_LOCALES) {
    for (const id of base.classicOrder) {
      assert.equal(
        extended.packs[locale][id].contentFingerprint,
        base.packs[locale][id].contentFingerprint,
      );
    }
    assert(extended.packs[locale]["race:history:31"]);
  }
  assert.deepEqual(
    new Set(SUPPORTED_LOCALES.map(
      (locale) => extended.packs[locale]["race:history:31"].contentFingerprint,
    )),
    new Set([saveRiddleFingerprint(extendedSource.riddles.at(-1))]),
  );
});

test("fails release compilation closed on missing, unapproved, or unsafe translations", async () => {
  const {source, order} = await readInputs();
  assert.throws(
    () => compileYouTubeContent({source, orderManifest: order}),
    /translation-bundle-missing:es/u,
  );
  const es = translationBundle("es", source);
  es.translatorModel = "unapproved-model";
  assert.throws(
    () => compileYouTubeContent({source, translationBundles: {es}, orderManifest: order, locales: ["en", "es"]}),
    /release-locales-incomplete/u,
  );
  assert.throws(
    () => compileYouTubeContent({
      source,
      translationBundles: {es},
      orderManifest: order,
      locales: ["en", "es"],
      fixture: true,
    }),
    /translation-translator-model:es/u,
  );
  const invalidAnswer = translationBundle("es", source);
  invalidAnswer.riddles[0].answer = "two words";
  assert.throws(
    () => compileYouTubeContent({
      source,
      translationBundles: {es: invalidAnswer},
      orderManifest: order,
      locales: ["en", "es"],
      fixture: true,
    }),
    /translation-answer-invalid:race:history:01:letters-and-marks-only/u,
  );
});

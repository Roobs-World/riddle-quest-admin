"use strict";

const {createHash} = require("node:crypto");

const YOUTUBE_CONTENT_SCHEMA_VERSION = 1;
const YOUTUBE_CONTENT_VERSION_PREFIX = "youtube-content-v1";
const YOUTUBE_TRANSLATOR_MODEL = "gpt-5.6-sol";
const YOUTUBE_CRITIC_MODEL = "gpt-5.5";
const YOUTUBE_CLUE_MAX_LENGTH = 500;
const AUTOMATED_TRANSLATION_QUALITY_VERSION = "automated_translation_v1";
const REVIEWED_QUALITY_VERSION_PATTERN = /^(?:reviewed|human_review|automated_review)_/iu;
const SUPPORTED_LOCALES = [
  "en", "es", "pt", "fr", "de", "ja", "ko", "zh", "hi", "ru", "tr", "ar", "id", "it", "nl", "pl", "vi",
];
const CATEGORY_IDS = ["history", "geography", "music", "film", "science", "mixed"];
const DIFFICULTY_BANDS = ["easy", "medium", "hard"];
const REQUIRED_CLUE_SCRIPTS = {
  ar: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  zh: /\p{Script=Han}/u,
};
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const CANONICAL_ID_PATTERN = /^race:(?:history|geography|music|film|science|mixed):[0-9]{2,}$/u;
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const YOUTUBE_V1_CLASSIC_PREFIX_HASH = "5a90f6cff0a4811601b0e25785113cd8f4515d575ce6857603f47eb6f6813324";
const YOUTUBE_V1_DAILY_PREFIX_HASH = "78b8129993e29aed111822e14ee491ff179de426b83106a5f95e61dbe4beedf9";

class YouTubeContentError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "YouTubeContentError";
    this.code = code;
  }
}

const fail = (code, detail) => {
  throw new YouTubeContentError(code, detail);
};

const assert = (condition, code, detail) => {
  if (!condition) fail(code, detail);
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const domainHash = (domain, value) => sha256(`${domain}\0${value}`);

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const assertExactKeys = (value, keys, code) => {
  assert(isPlainObject(value), code, "not-an-object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), code, `keys-${actual.join(",")}`);
};

const assertString = (value, code, {max = 2_000, pattern} = {}) => {
  assert(typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max, code);
  if (pattern) assert(pattern.test(value), code);
};

const graphemeLength = (value, locale) => {
  if (typeof Intl.Segmenter !== "function") return Array.from(value.normalize("NFC")).length;
  return Array.from(new Intl.Segmenter(locale, {granularity: "grapheme"}).segment(value.normalize("NFC"))).length;
};

/** Returns null for a safe native answer or a stable reason for rejection. */
const playableAnswerIssue = (value, locale) => {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) return "not-trimmed-text";
  if (value !== value.normalize("NFC")) return "non-nfc";
  if (!/^\p{L}[\p{L}\p{M}]*$/u.test(value)) return "letters-and-marks-only";
  const length = graphemeLength(value, locale);
  if (length < 1 || length > 7) return "grapheme-length";
  return null;
};

const canonicalSourceHash = (source) => domainHash("race-reviewed-canonical-v1", JSON.stringify([
  source.canonicalRiddleId,
  source.text.normalize("NFC"),
  source.answer.normalize("NFC"),
  source.categoryId,
  source.difficultyBand,
]));

/** Stable save identity: canonical content changes invalidate it, localization never does. */
const saveRiddleFingerprint = (canonical) =>
  domainHash("youtube-save-riddle-v1", JSON.stringify([
    canonical.canonicalRiddleId,
    canonicalSourceHash(canonical),
  ]));

const normalizeDuplicate = (value, locale) =>
  value.normalize("NFKC").trim().toLocaleLowerCase(locale).replace(/\s+/gu, " ");

const clueContainsLiteralAnswer = (clue, answer, locale) => {
  const comparable = (value) => value.normalize("NFKC").toLocaleLowerCase(locale)
    .replace(/[\p{P}\p{Z}\p{S}_]+/gu, "");
  const normalizedClue = comparable(clue);
  const normalizedAnswer = comparable(answer);
  return normalizedClue.length > 0 && normalizedAnswer.length > 0 && normalizedClue.includes(normalizedAnswer);
};

const validateCanonicalRiddle = (riddle, index) => {
  assertExactKeys(riddle, [
    "canonicalRiddleId", "text", "answer", "categoryId", "difficultyBand", "qualityVersion",
  ], "canonical-riddle-schema");
  assertString(riddle.canonicalRiddleId, "canonical-id-invalid", {max: 160, pattern: CANONICAL_ID_PATTERN});
  assertString(riddle.text, "canonical-clue-invalid", {max: YOUTUBE_CLUE_MAX_LENGTH});
  assert(riddle.text === riddle.text.normalize("NFC"), "canonical-clue-non-nfc", riddle.canonicalRiddleId);
  const answerIssue = playableAnswerIssue(riddle.answer, "en");
  assert(answerIssue === null, "canonical-answer-invalid", `${riddle.canonicalRiddleId}:${answerIssue}`);
  assert(!clueContainsLiteralAnswer(riddle.text, riddle.answer, "en"),
    "canonical-literal-clue-leak", riddle.canonicalRiddleId);
  assert(CATEGORY_IDS.includes(riddle.categoryId), "canonical-category-invalid", riddle.canonicalRiddleId);
  assert(DIFFICULTY_BANDS.includes(riddle.difficultyBand), "canonical-difficulty-invalid", riddle.canonicalRiddleId);
  assertString(riddle.qualityVersion, "canonical-quality-invalid", {max: 80, pattern: REVIEWED_QUALITY_VERSION_PATTERN});
  assert(Number.isSafeInteger(index), "canonical-index-invalid");
};

/** Validates the audited English source without accepting partial or duplicate pools. */
const validateCanonicalSource = (source) => {
  assertExactKeys(source, ["locale", "riddles"], "canonical-source-schema");
  assert(source.locale === "en", "canonical-source-locale");
  assert(Array.isArray(source.riddles) && source.riddles.length >= 180, "canonical-source-count");
  const ids = new Set();
  const clues = new Set();
  const answers = new Set();
  const poolCounts = new Map();
  source.riddles.forEach((riddle, index) => {
    validateCanonicalRiddle(riddle, index);
    assert(!ids.has(riddle.canonicalRiddleId), "canonical-id-duplicate", riddle.canonicalRiddleId);
    const clue = normalizeDuplicate(riddle.text, "en");
    const answer = normalizeDuplicate(riddle.answer, "en");
    assert(!clues.has(clue), "canonical-clue-duplicate", riddle.canonicalRiddleId);
    assert(!answers.has(answer), "canonical-answer-duplicate", riddle.canonicalRiddleId);
    ids.add(riddle.canonicalRiddleId);
    clues.add(clue);
    answers.add(answer);
    const pool = `${riddle.categoryId}:${riddle.difficultyBand}`;
    poolCounts.set(pool, (poolCounts.get(pool) || 0) + 1);
  });
  for (const category of CATEGORY_IDS) {
    for (const difficulty of DIFFICULTY_BANDS) {
      assert((poolCounts.get(`${category}:${difficulty}`) || 0) >= 10,
        "canonical-pool-count", `${category}:${difficulty}`);
    }
  }
  return source;
};

const validateReview = (review, bundle, id) => {
  assertExactKeys(review, [
    "criticModel", "backTranslation", "equivalentCanonical", "clueLeak", "prohibitedContent",
    "categoryMatch", "difficultyMatch",
  ], "translation-review-schema");
  assert(review.criticModel === bundle.criticModel, "translation-critic-mismatch", id);
  assertString(review.backTranslation, "translation-back-translation-invalid");
  assert(review.backTranslation === review.backTranslation.normalize("NFC"), "translation-back-translation-non-nfc", id);
  assert(review.equivalentCanonical === true, "translation-equivalence-rejected", id);
  assert(review.clueLeak === false, "translation-clue-leak", id);
  assert(review.prohibitedContent === false, "translation-prohibited-content", id);
  assert(review.categoryMatch === true, "translation-category-rejected", id);
  assert(review.difficultyMatch === true, "translation-difficulty-rejected", id);
};

/** Validates one model-produced locale bundle against every reviewed source record. */
const validateTranslationBundle = (bundle, locale, canonicalById) => {
  assertExactKeys(bundle, ["locale", "provenance", "translatorModel", "criticModel", "riddles"],
    "translation-bundle-schema");
  assert(bundle.locale === locale && locale !== "en", "translation-locale-mismatch", locale);
  assert(bundle.provenance === AUTOMATED_TRANSLATION_QUALITY_VERSION, "translation-provenance", locale);
  assert(bundle.translatorModel === YOUTUBE_TRANSLATOR_MODEL, "translation-translator-model", locale);
  assert(bundle.criticModel === YOUTUBE_CRITIC_MODEL, "translation-critic-model", locale);
  assert(bundle.translatorModel !== bundle.criticModel, "translation-model-independence", locale);
  assert(Array.isArray(bundle.riddles) && bundle.riddles.length === canonicalById.size,
    "translation-riddle-count", locale);
  const seen = new Set();
  const clues = new Set();
  const answers = new Set();
  const byId = new Map();
  for (const riddle of bundle.riddles) {
    assertExactKeys(riddle, [
      "canonicalRiddleId", "sourceCanonicalHash", "text", "answer", "categoryId", "difficultyBand",
      "qualityVersion", "review",
    ], "translation-riddle-schema");
    const id = riddle.canonicalRiddleId;
    const canonical = canonicalById.get(id);
    assert(canonical, "translation-canonical-unknown", id);
    assert(!seen.has(id), "translation-canonical-duplicate", id);
    seen.add(id);
    assert(riddle.sourceCanonicalHash === canonicalSourceHash(canonical), "translation-source-binding", id);
    assertString(riddle.text, "translation-clue-invalid", {max: YOUTUBE_CLUE_MAX_LENGTH});
    assert(riddle.text === riddle.text.normalize("NFC"), "translation-clue-non-nfc", id);
    assert(riddle.text !== canonical.text.normalize("NFC"), "translation-source-copy", id);
    const requiredScript = REQUIRED_CLUE_SCRIPTS[locale];
    assert(!requiredScript || requiredScript.test(riddle.text), "translation-locale-script", id);
    const answerIssue = playableAnswerIssue(riddle.answer, locale);
    assert(answerIssue === null, "translation-answer-invalid", `${id}:${answerIssue}`);
    assert(!clueContainsLiteralAnswer(riddle.text, riddle.answer, locale), "translation-literal-clue-leak", id);
    assert(riddle.categoryId === canonical.categoryId, "translation-category-mismatch", id);
    assert(riddle.difficultyBand === canonical.difficultyBand, "translation-difficulty-mismatch", id);
    assert(riddle.qualityVersion === AUTOMATED_TRANSLATION_QUALITY_VERSION, "translation-quality", id);
    validateReview(riddle.review, bundle, id);
    const clue = normalizeDuplicate(riddle.text, locale);
    const answer = normalizeDuplicate(riddle.answer, locale);
    assert(!clues.has(clue), "translation-clue-duplicate", id);
    assert(!answers.has(answer), "translation-answer-duplicate", id);
    clues.add(clue);
    answers.add(answer);
    byId.set(id, riddle);
  }
  for (const id of canonicalById.keys()) assert(seen.has(id), "translation-canonical-missing", `${locale}:${id}`);
  return byId;
};

const prefixHash = (ids) => domainHash("youtube-content-order-prefix-v1", JSON.stringify(ids));

const validateLockedPrefix = (sequence, lockedPrefix, label) => {
  assertExactKeys(lockedPrefix, ["length", "sha256"], "order-prefix-schema");
  assert(Number.isSafeInteger(lockedPrefix.length) && lockedPrefix.length >= 1 && lockedPrefix.length <= sequence.length,
    "order-prefix-length", label);
  assertString(lockedPrefix.sha256, "order-prefix-hash", {pattern: SHA256_PATTERN});
  assert(prefixHash(sequence.slice(0, lockedPrefix.length)) === lockedPrefix.sha256,
    "order-prefix-mutated", label);
};

const assertUniqueExactCanonicalSet = (ids, canonicalIds, label) => {
  assert(Array.isArray(ids) && ids.length === canonicalIds.size, "order-count", label);
  assert(new Set(ids).size === ids.length, "order-duplicate", label);
  for (const id of ids) assert(canonicalIds.has(id), "order-unknown-canonical", `${label}:${id}`);
};

const utcDayNumber = (day) => Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 86_400_000);

const validateDailySegment = (segment, index, canonicalIds) => {
  assertExactKeys(segment, ["startsOn", "canonicalIds", "lockedPrefix"], "daily-segment-schema");
  assertString(segment.startsOn, "daily-start-invalid", {pattern: UTC_DATE_PATTERN});
  assert(new Date(`${segment.startsOn}T00:00:00.000Z`).toISOString().startsWith(segment.startsOn),
    "daily-start-invalid", segment.startsOn);
  assert(Array.isArray(segment.canonicalIds) && segment.canonicalIds.length >= 1,
    "daily-segment-empty", String(index));
  assert(new Set(segment.canonicalIds).size === segment.canonicalIds.length,
    "daily-segment-duplicate", String(index));
  for (const id of segment.canonicalIds) {
    assert(canonicalIds.has(id), "order-unknown-canonical", `daily-${index}:${id}`);
  }
  validateLockedPrefix(segment.canonicalIds, segment.lockedPrefix, `daily-${index}`);
};

/** Validates immutable Classic and Daily ordering and its append-only lock. */
const validateOrderManifest = (manifest, source) => {
  assertExactKeys(manifest, ["schemaVersion", "classic", "daily"], "order-manifest-schema");
  assert(manifest.schemaVersion === 1, "order-schema-version");
  assertExactKeys(manifest.classic, ["orderVersion", "canonicalIds", "lockedPrefix"], "classic-order-schema");
  assertExactKeys(manifest.daily, ["scheduleVersion", "segments"], "daily-order-schema");
  assert(Number.isSafeInteger(manifest.classic.orderVersion) && manifest.classic.orderVersion >= 1,
    "classic-order-version");
  assert(Number.isSafeInteger(manifest.daily.scheduleVersion) && manifest.daily.scheduleVersion >= 1,
    "daily-schedule-version");
  if (manifest.classic.orderVersion === 1) {
    assert(manifest.classic.canonicalIds.length === 180, "classic-v1-count");
  }
  const canonicalIds = new Set(source.riddles.map(({canonicalRiddleId}) => canonicalRiddleId));
  assertUniqueExactCanonicalSet(manifest.classic.canonicalIds, canonicalIds, "classic");
  validateLockedPrefix(manifest.classic.canonicalIds, manifest.classic.lockedPrefix, "classic");
  assert(Array.isArray(manifest.daily.segments) && manifest.daily.segments.length >= 1,
    "daily-segments-empty");
  assert(manifest.daily.scheduleVersion === manifest.daily.segments.length,
    "daily-schedule-version-segments");
  manifest.daily.segments.forEach((segment, index) => {
    validateDailySegment(segment, index, canonicalIds);
    if (index === 0) return;
    const previous = manifest.daily.segments[index - 1];
    const earliestNextStart = utcDayNumber(previous.startsOn) + previous.canonicalIds.length;
    assert(utcDayNumber(segment.startsOn) >= earliestNextStart,
      "daily-segment-overlap", segment.startsOn);
  });
  const scheduledIds = new Set(manifest.daily.segments.flatMap(({canonicalIds: ids}) => ids));
  for (const id of canonicalIds) assert(scheduledIds.has(id), "daily-canonical-unscheduled", id);
  const v1Segment = manifest.daily.segments[0];
  assert(v1Segment.canonicalIds.length === 180, "daily-v1-count");
  const initialCanonicalIds = new Set(source.riddles.slice(0, 180).map(({canonicalRiddleId}) => canonicalRiddleId));
  assertUniqueExactCanonicalSet(v1Segment.canonicalIds, initialCanonicalIds, "daily-v1");
  assert(prefixHash(manifest.classic.canonicalIds.slice(0, 180)) === YOUTUBE_V1_CLASSIC_PREFIX_HASH,
    "classic-v1-order-mismatch");
  assert(prefixHash(v1Segment.canonicalIds) === YOUTUBE_V1_DAILY_PREFIX_HASH,
    "daily-v1-order-mismatch");
  const sourceById = new Map(source.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  manifest.classic.canonicalIds.slice(0, 180).forEach((id, index) => {
    const riddle = sourceById.get(id);
    assert(riddle.categoryId === CATEGORY_IDS[index % CATEGORY_IDS.length], "classic-v1-category-order", id);
    assert(riddle.difficultyBand === DIFFICULTY_BANDS[Math.floor(index / 60)],
      "classic-v1-difficulty-order", id);
  });
  return manifest;
};

/** Checks a proposed manifest without allowing any released ID or daily epoch to change. */
const assertAppendOnlyOrderManifest = (previous, candidate) => {
  assert(candidate.schemaVersion === previous.schemaVersion, "order-schema-version-changed");
  assert(candidate.classic.orderVersion >= previous.classic.orderVersion, "classic-order-version-regressed");
  assert(candidate.daily.scheduleVersion >= previous.daily.scheduleVersion, "daily-schedule-version-regressed");
  const priorIds = previous.classic.canonicalIds;
  const nextIds = candidate.classic.canonicalIds;
  assert(nextIds.length >= priorIds.length, "order-truncated", "classic");
  assert(priorIds.every((id, index) => nextIds[index] === id), "order-not-append-only", "classic");
  assert(candidate.daily.segments.length >= previous.daily.segments.length,
    "order-truncated", "daily-segments");
  previous.daily.segments.forEach((segment, index) => {
    assert(stableJson(candidate.daily.segments[index]) === stableJson(segment),
      "daily-released-segment-mutated", String(index));
  });
};

const makeRuntimeRiddle = (locale, canonical, localized) => {
  const answer = localized.answer.toLocaleLowerCase(locale).normalize("NFC");
  const riddle = {
    text: localized.text.normalize("NFC"),
    answer,
    categoryId: canonical.categoryId,
    difficultyBand: canonical.difficultyBand,
  };
  return {
    ...riddle,
    contentFingerprint: saveRiddleFingerprint(canonical),
  };
};

/** Compiles deterministic, runtime-only content. Model reviews and source hashes never enter the output. */
const compileYouTubeContent = ({source: sourceInput, translationBundles = {}, orderManifest: orderInput,
  locales = SUPPORTED_LOCALES, fixture = false, fixtureCount = 3}) => {
  const source = validateCanonicalSource(sourceInput);
  const orderManifest = validateOrderManifest(orderInput, source);
  assert(Array.isArray(locales) && locales.length > 0 && new Set(locales).size === locales.length,
    "compile-locales-invalid");
  assert(locales.every((locale) => SUPPORTED_LOCALES.includes(locale)), "compile-locale-unsupported");
  if (!fixture) {
    assert(JSON.stringify(locales) === JSON.stringify(SUPPORTED_LOCALES), "release-locales-incomplete");
  } else {
    assert(Number.isSafeInteger(fixtureCount) && fixtureCount >= 1 && fixtureCount <= 10,
      "fixture-count-invalid");
  }
  const canonicalById = new Map(source.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  const localizedByLocale = new Map([["en", canonicalById]]);
  for (const locale of locales.filter((value) => value !== "en")) {
    const bundle = translationBundles[locale];
    assert(bundle, "translation-bundle-missing", locale);
    localizedByLocale.set(locale, validateTranslationBundle(bundle, locale, canonicalById));
  }
  const classicOrder = fixture ? orderManifest.classic.canonicalIds.slice(0, fixtureCount) :
    [...orderManifest.classic.canonicalIds];
  const dailySegments = fixture
    ? [{...orderManifest.daily.segments[0], canonicalIds: orderManifest.daily.segments[0].canonicalIds.slice(0, fixtureCount)}]
    : orderManifest.daily.segments.map((segment) => ({...segment, canonicalIds: [...segment.canonicalIds]}));
  const includedIds = new Set([...classicOrder, ...dailySegments.flatMap(({canonicalIds}) => canonicalIds)]);
  const packs = {};
  for (const locale of locales) {
    const localized = localizedByLocale.get(locale);
    packs[locale] = {};
    for (const id of orderManifest.classic.canonicalIds) {
      if (!includedIds.has(id)) continue;
      packs[locale][id] = makeRuntimeRiddle(locale, canonicalById.get(id), localized.get(id));
    }
  }
  const unsigned = {
    schemaVersion: YOUTUBE_CONTENT_SCHEMA_VERSION,
    releaseReady: !fixture,
    fixture,
    locales: [...locales],
    classicOrder,
    dailySchedule: {
      scheduleVersion: orderManifest.daily.scheduleVersion,
      segments: dailySegments.map(({startsOn, canonicalIds}) => ({startsOn, canonicalIds})),
    },
    packs,
  };
  const versionHash = domainHash("youtube-runtime-content-v1", JSON.stringify(unsigned)).slice(0, 16);
  return {
    schemaVersion: unsigned.schemaVersion,
    contentVersion: `${fixture ? `${YOUTUBE_CONTENT_VERSION_PREFIX}-fixture` : YOUTUBE_CONTENT_VERSION_PREFIX}-${versionHash}`,
    releaseReady: unsigned.releaseReady,
    fixture: unsigned.fixture,
    locales: unsigned.locales,
    classicOrder: unsigned.classicOrder,
    dailySchedule: unsigned.dailySchedule,
    packs: unsigned.packs,
  };
};

/** Creates a deterministic, non-runtime audit record for the compiler inputs and output. */
const createYouTubeContentAudit = ({content, sourceRaw, orderRaw, bundleInputs = {}, outputRaw}) => ({
  schemaVersion: 1,
  contentVersion: content.contentVersion,
  releaseReady: content.releaseReady,
  inputs: {
    canonicalSourceSha256: sha256(sourceRaw),
    orderManifestSha256: sha256(orderRaw),
    translationBundles: Object.fromEntries(Object.entries(bundleInputs).map(([locale, input]) => [locale, {
      sha256: sha256(input.raw),
      translatorModel: input.value.translatorModel,
      criticModel: input.value.criticModel,
    }])),
  },
  runtime: {
    sha256: sha256(outputRaw),
    localeCount: content.locales.length,
    riddleCountPerLocale: content.classicOrder.length,
  },
});

module.exports = {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  CATEGORY_IDS,
  DIFFICULTY_BANDS,
  SUPPORTED_LOCALES,
  YOUTUBE_CONTENT_SCHEMA_VERSION,
  YOUTUBE_CONTENT_VERSION_PREFIX,
  YOUTUBE_CLUE_MAX_LENGTH,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  YouTubeContentError,
  assertAppendOnlyOrderManifest,
  canonicalSourceHash,
  compileYouTubeContent,
  createYouTubeContentAudit,
  playableAnswerIssue,
  prefixHash,
  saveRiddleFingerprint,
  sha256,
  stableJson,
  validateCanonicalSource,
  validateOrderManifest,
  validateTranslationBundle,
};

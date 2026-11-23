"use strict";

const {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  CATEGORY_IDS,
  DIFFICULTY_BANDS,
  SUPPORTED_LOCALES,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_CLUE_MAX_LENGTH,
  YOUTUBE_GENERATOR_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  assertAppendOnlyOrderManifest,
  canonicalSourceHash,
  playableAnswerIssue,
  prefixHash,
  sha256,
  stableJson,
  validateCanonicalSource,
  validateOrderManifest,
  validateTranslationBundle,
} = require("./youtube-content-pack.js");

const YOUTUBE_AUTHOR_CONTRACT_SCHEMA_VERSION = 3;
const YOUTUBE_AUTHOR_SCHEMA_VERSION = 4;
const YOUTUBE_TRANSLATION_RETRY_POLICY_VERSION = 6;
const YOUTUBE_ENGLISH_QUALITY_VERSION = "automated_review_easy_medium_v2";
const LEGACY_ENGLISH_QUALITY_VERSION = "automated_review_v1";
const YOUTUBE_AUTHOR_MAX_ATTEMPTS = 6;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SAFE_SEED_FILE_PATTERN = /^[A-Za-z0-9._-]+$/u;

class YouTubeAuthoringError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "YouTubeAuthoringError";
    this.code = code;
  }
}

const fail = (code, detail) => {
  throw new YouTubeAuthoringError(code, detail);
};

const assert = (condition, code, detail) => {
  if (!condition) fail(code, detail);
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const assertExactKeys = (value, expected, code) => {
  assert(isPlainObject(value), code, "not-an-object");
  const actual = Object.keys(value).sort();
  assert(JSON.stringify(actual) === JSON.stringify([...expected].sort()), code, `keys-${actual.join(",")}`);
};

const normalizeText = (value, code, max = 2_000) => {
  assert(typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max, code);
  assert(value === value.normalize("NFC"), `${code}-non-nfc`);
  return value;
};

const stableHash = (domain, value) => sha256(`${domain}\0${stableJson(value)}`);

const exactById = (values, expectedIds, validate, label) => {
  assert(Array.isArray(values) && values.length === expectedIds.length, `${label}-canonical-set-mismatch`);
  const seen = new Set();
  const byId = new Map();
  for (const raw of values) {
    const value = validate(raw);
    assert(expectedIds.includes(value.canonicalRiddleId), `${label}-canonical-set-mismatch`);
    assert(!seen.has(value.canonicalRiddleId), `${label}-canonical-set-mismatch`);
    seen.add(value.canonicalRiddleId);
    byId.set(value.canonicalRiddleId, value);
  }
  assert(expectedIds.every((id) => seen.has(id)), `${label}-canonical-set-mismatch`);
  return byId;
};

const validateEnglishDraft = (value) => {
  assertExactKeys(value, ["canonicalRiddleId", "text", "answer"], "english-draft-schema");
  normalizeText(value.canonicalRiddleId, "english-draft-id", 160);
  normalizeText(value.text, "english-draft-text", YOUTUBE_CLUE_MAX_LENGTH);
  normalizeText(value.answer, "english-draft-answer", 100);
  const issue = playableAnswerIssue(value.answer, "en");
  assert(issue === null, "english-draft-answer-invalid", `${value.canonicalRiddleId}:${issue}`);
  return {...value};
};

const validateEnglishCritique = (value) => {
  assertExactKeys(value, [
    "canonicalRiddleId", "factual", "answerCorrect", "unambiguous", "clueLeak", "prohibitedContent",
    "categoryMatch", "difficultyMatch",
  ], "english-critique-schema");
  normalizeText(value.canonicalRiddleId, "english-critique-id", 160);
  for (const field of [
    "factual", "answerCorrect", "unambiguous", "clueLeak", "prohibitedContent", "categoryMatch",
    "difficultyMatch",
  ]) assert(typeof value[field] === "boolean", "english-critique-schema", field);
  return {...value};
};

const englishCritiqueApproved = (review) => review.factual && review.answerCorrect && review.unambiguous &&
  !review.clueLeak && !review.prohibitedContent && review.categoryMatch && review.difficultyMatch;

const validateTranslationDraft = (value) => {
  assertExactKeys(value, ["canonicalRiddleId", "text", "answer"], "translation-draft-schema");
  normalizeText(value.canonicalRiddleId, "translation-draft-id", 160);
  normalizeText(value.text, "translation-draft-text", YOUTUBE_CLUE_MAX_LENGTH);
  normalizeText(value.answer, "translation-draft-answer", 100);
  return {...value};
};

const validateTranslationCritique = (value) => {
  assertExactKeys(value, [
    "canonicalRiddleId", "backTranslation", "equivalentCanonical", "clueLeak", "prohibitedContent",
    "categoryMatch", "difficultyMatch",
  ], "translation-critique-schema");
  normalizeText(value.canonicalRiddleId, "translation-critique-id", 160);
  normalizeText(value.backTranslation, "translation-back-translation");
  for (const field of [
    "equivalentCanonical", "clueLeak", "prohibitedContent", "categoryMatch", "difficultyMatch",
  ]) assert(typeof value[field] === "boolean", "translation-critique-schema", field);
  return {...value};
};

const translationCritiqueApproved = (review) => review.equivalentCanonical && !review.clueLeak &&
  !review.prohibitedContent && review.categoryMatch && review.difficultyMatch;

const validateCommittedEnglishApproval = (value) => {
  assertExactKeys(value, [
    "canonicalRiddleId", "draftSha256", "factual", "answerCorrect", "unambiguous", "clueLeak",
    "prohibitedContent", "categoryMatch", "difficultyMatch",
  ], "append-approval-schema");
  assert(typeof value.draftSha256 === "string" && SHA256_PATTERN.test(value.draftSha256),
    "append-approval-draft-hash", value.canonicalRiddleId);
  const {draftSha256: _draftSha256, ...reviewInput} = value;
  const review = validateEnglishCritique(reviewInput);
  assert(englishCritiqueApproved(review), "append-approval-rejected", value.canonicalRiddleId);
  return value;
};

/** Allocates append-only IDs and metadata without asking a model to make release-order decisions. */
const createYouTubeAppendSpecs = (source, appendCount, {legacyDifficulty = false} = {}) => {
  validateCanonicalSource(source);
  assert(Number.isSafeInteger(appendCount) && appendCount >= 0 && appendCount <= 7_820,
    "append-count-invalid");
  const perCategory = Object.fromEntries(CATEGORY_IDS.map((category) => [category,
    source.riddles.filter(({categoryId}) => categoryId === category).length]));
  return Array.from({length: appendCount}, (_, offset) => {
    const globalIndex = source.riddles.length + offset;
    const categoryId = CATEGORY_IDS[globalIndex % CATEGORY_IDS.length];
    const difficultyBand = legacyDifficulty
      ? DIFFICULTY_BANDS[Math.floor(globalIndex / 60) % DIFFICULTY_BANDS.length]
      : ["easy", "medium"][Math.floor((globalIndex - 180) / 60) % 2];
    perCategory[categoryId] += 1;
    return {
      canonicalRiddleId: `race:${categoryId}:${String(perCategory[categoryId]).padStart(2, "0")}`,
      categoryId,
      difficultyBand,
    };
  });
};

const validateAppendReceipt = (receipt) => {
  assertExactKeys(receipt, [
    "batchId", "baseCanonicalSha256", "generatorModel", "criticModel", "canonicalIds",
    "generatedRiddlesSha256", "criticApprovals", "criticApprovalsSha256",
  ], "append-receipt-schema");
  assert(typeof receipt.batchId === "string" && SHA256_PATTERN.test(receipt.batchId), "append-receipt-batch-id");
  assert(SHA256_PATTERN.test(receipt.baseCanonicalSha256), "append-receipt-base-hash");
  assert([YOUTUBE_GENERATOR_MODEL, "gpt-5.6-sol"].includes(receipt.generatorModel), "append-receipt-generator-model");
  assert(receipt.criticModel === YOUTUBE_CRITIC_MODEL, "append-receipt-critic-model");
  assert(Array.isArray(receipt.canonicalIds) && receipt.canonicalIds.length > 0 &&
    new Set(receipt.canonicalIds).size === receipt.canonicalIds.length, "append-receipt-canonical-ids");
  assert(SHA256_PATTERN.test(receipt.generatedRiddlesSha256), "append-receipt-riddles-hash");
  assert(Array.isArray(receipt.criticApprovals) && receipt.criticApprovals.length === receipt.canonicalIds.length,
    "append-receipt-approvals");
  receipt.criticApprovals.forEach(validateCommittedEnglishApproval);
  assert(JSON.stringify(receipt.criticApprovals.map(({canonicalRiddleId}) => canonicalRiddleId)) ===
    JSON.stringify(receipt.canonicalIds), "append-receipt-approval-coverage");
  assert(receipt.criticApprovalsSha256 === stableHash(
    "youtube-english-critiques-v1",
    receipt.criticApprovals,
  ), "append-receipt-critiques-hash");
  assert(SHA256_PATTERN.test(receipt.criticApprovalsSha256), "append-receipt-critiques-hash");
  return receipt;
};

/** Resolves the locked Race seed plus the YouTube-only append log into the compiler's canonical shape. */
const resolveYouTubeCanonicalSource = ({document, seedRaw, seed}) => {
  assertExactKeys(document, ["schemaVersion", "seed", "appendedRiddles", "appendReceipts"],
    "youtube-source-document-schema");
  assert(document.schemaVersion === 1, "youtube-source-schema-version");
  assertExactKeys(document.seed, ["file", "sha256"], "youtube-source-seed-schema");
  assert(typeof document.seed.file === "string" && SAFE_SEED_FILE_PATTERN.test(document.seed.file),
    "youtube-source-seed-file");
  assert(typeof seedRaw === "string" && sha256(seedRaw) === document.seed.sha256,
    "youtube-source-seed-hash");
  const validatedSeed = validateCanonicalSource(seed);
  assert(validatedSeed.riddles.length === 180, "youtube-source-seed-count");
  assert(Array.isArray(document.appendedRiddles), "youtube-source-appended-schema");
  assert(Array.isArray(document.appendReceipts), "youtube-source-receipts-schema");
  const resolved = validateCanonicalSource({
    locale: "en",
    riddles: [...validatedSeed.riddles, ...document.appendedRiddles],
  });
  const expectedSpecs = createYouTubeAppendSpecs(validatedSeed, document.appendedRiddles.length);
  const legacySpecs = createYouTubeAppendSpecs(validatedSeed, document.appendedRiddles.length, {legacyDifficulty: true});
  document.appendedRiddles.forEach((riddle, index) => {
    const expected = riddle.qualityVersion === LEGACY_ENGLISH_QUALITY_VERSION ? legacySpecs[index] : expectedSpecs[index];
    assert(riddle.canonicalRiddleId === expected.canonicalRiddleId &&
      riddle.categoryId === expected.categoryId && riddle.difficultyBand === expected.difficultyBand,
    "youtube-source-append-policy", riddle.canonicalRiddleId);
    assert([YOUTUBE_ENGLISH_QUALITY_VERSION, LEGACY_ENGLISH_QUALITY_VERSION].includes(riddle.qualityVersion),
      "youtube-source-append-quality", riddle.canonicalRiddleId);
  });
  const receiptIds = document.appendReceipts.flatMap((receipt) => validateAppendReceipt(receipt).canonicalIds);
  assert(JSON.stringify(receiptIds) === JSON.stringify(document.appendedRiddles.map(({canonicalRiddleId}) =>
    canonicalRiddleId)), "youtube-source-receipt-coverage");
  let receiptOffset = 0;
  let receiptBase = {locale: "en", riddles: [...validatedSeed.riddles]};
  for (const receipt of document.appendReceipts) {
    assert(receipt.baseCanonicalSha256 === stableHash("youtube-resolved-source-v1", receiptBase),
      "youtube-source-receipt-base-hash", receipt.batchId);
    const receiptRiddles = document.appendedRiddles.slice(
      receiptOffset,
      receiptOffset + receipt.canonicalIds.length,
    );
    assert(receipt.generatedRiddlesSha256 === stableHash("youtube-appended-riddles-v1", receiptRiddles),
      "youtube-source-receipt-riddles-hash", receipt.batchId);
    receipt.criticApprovals.forEach((approval, index) => {
      const riddle = receiptRiddles[index];
      assert(approval.draftSha256 === stableHash("youtube-english-draft-v1", {
        canonicalRiddleId: riddle.canonicalRiddleId,
        text: riddle.text,
        answer: riddle.answer,
      }), "youtube-source-receipt-approval-draft-hash", approval.canonicalRiddleId);
    });
    receiptBase = {locale: "en", riddles: [...receiptBase.riddles, ...receiptRiddles]};
    receiptOffset += receiptRiddles.length;
  }
  return resolved;
};

const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const utcDayNumber = (day) => Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 86_400_000);

const createCandidateOrder = (previous, appendedIds, dailyStartsOn) => {
  if (appendedIds.length === 0) {
    assert(dailyStartsOn === undefined, "daily-start-without-append");
    return structuredClone(previous);
  }
  assert(typeof dailyStartsOn === "string" && UTC_DATE_PATTERN.test(dailyStartsOn) &&
    new Date(`${dailyStartsOn}T00:00:00.000Z`).toISOString().startsWith(dailyStartsOn),
  "daily-start-required");
  const priorSegment = previous.daily.segments.at(-1);
  assert(priorSegment && utcDayNumber(dailyStartsOn) >=
    utcDayNumber(priorSegment.startsOn) + priorSegment.canonicalIds.length,
  "daily-segment-overlap", dailyStartsOn);
  const dailySegment = [...appendedIds].sort((left, right) => {
    const leftHash = sha256(`youtube-daily-append-v1\0${left}`);
    const rightHash = sha256(`youtube-daily-append-v1\0${right}`);
    return leftHash.localeCompare(rightHash) || left.localeCompare(right);
  });
  const candidate = structuredClone(previous);
  candidate.classic.orderVersion += 1;
  candidate.classic.canonicalIds.push(...appendedIds);
  candidate.classic.lockedPrefix = {
    length: candidate.classic.canonicalIds.length,
    sha256: prefixHash(candidate.classic.canonicalIds),
  };
  candidate.daily.segments.push({
    startsOn: dailyStartsOn,
    canonicalIds: dailySegment,
    lockedPrefix: {length: dailySegment.length, sha256: prefixHash(dailySegment)},
  });
  candidate.daily.scheduleVersion = candidate.daily.segments.length;
  assertAppendOnlyOrderManifest(previous, candidate);
  return candidate;
};

const blankCheckpoint = (contractHash) => ({
  schemaVersion: YOUTUBE_AUTHOR_SCHEMA_VERSION,
  translationRetryPolicyVersion: YOUTUBE_TRANSLATION_RETRY_POLICY_VERSION,
  contractHash,
  englishDrafts: {},
  englishCritiques: {},
  englishCritiqueDraftHashes: {},
  englishAttempts: {},
  translations: {},
  translationCritiques: {},
  translationCritiqueDraftHashes: {},
  translationAttempts: {},
  translationRetryFeedback: {},
});

const resetUnapprovedTranslationAttempts = (checkpoint) => {
  for (const [locale, attempts] of Object.entries(checkpoint.translationAttempts)) {
    const approved = checkpoint.translationCritiques[locale] || {};
    for (const id of Object.keys(attempts)) {
      if (!approved[id]) attempts[id] = 0;
    }
  }
};

const migrateCheckpoint = (value, contractHash) => {
  if (!isPlainObject(value)) return value;
  if (value.schemaVersion === YOUTUBE_AUTHOR_SCHEMA_VERSION) {
    if (![3, 4, 5].includes(value.translationRetryPolicyVersion)) return value;
    const migrated = structuredClone(value);
    assertExactKeys(migrated, [
      "schemaVersion", "translationRetryPolicyVersion", "contractHash", "englishDrafts", "englishCritiques",
      "englishCritiqueDraftHashes", "englishAttempts", "translations", "translationCritiques",
      "translationCritiqueDraftHashes", "translationAttempts", "translationRetryFeedback",
    ], "author-checkpoint-schema");
    assert(migrated.contractHash === contractHash, "author-checkpoint-contract-mismatch");
    migrated.translationRetryPolicyVersion = YOUTUBE_TRANSLATION_RETRY_POLICY_VERSION;
    resetUnapprovedTranslationAttempts(migrated);
    return migrated;
  }
  if (![2, 3].includes(value.schemaVersion)) return value;
  let migrated = structuredClone(value);
  if (migrated.schemaVersion === 2) {
    assertExactKeys(migrated, [
      "schemaVersion", "contractHash", "englishDrafts", "englishCritiques", "englishCritiqueDraftHashes",
      "englishAttempts", "translations", "translationCritiques", "translationCritiqueDraftHashes",
      "translationAttempts",
    ], "author-checkpoint-schema");
    migrated.schemaVersion = 3;
    migrated.translationRetryPolicyVersion = 2;
  }
  assertExactKeys(migrated, [
    "schemaVersion", "translationRetryPolicyVersion", "contractHash", "englishDrafts", "englishCritiques",
    "englishCritiqueDraftHashes", "englishAttempts", "translations", "translationCritiques",
    "translationCritiqueDraftHashes", "translationAttempts",
  ], "author-checkpoint-schema");
  assert(migrated.contractHash === contractHash, "author-checkpoint-contract-mismatch");
  migrated.schemaVersion = YOUTUBE_AUTHOR_SCHEMA_VERSION;
  migrated.translationRetryPolicyVersion = YOUTUBE_TRANSLATION_RETRY_POLICY_VERSION;
  migrated.translationRetryFeedback = {};
  resetUnapprovedTranslationAttempts(migrated);
  return migrated;
};

const validateCheckpoint = (value, contractHash, englishAllowedIds, translationAllowedIds, locales) => {
  value = migrateCheckpoint(value, contractHash);
  assertExactKeys(value, [
    "schemaVersion", "translationRetryPolicyVersion", "contractHash", "englishDrafts", "englishCritiques",
    "englishCritiqueDraftHashes", "englishAttempts", "translations", "translationCritiques",
    "translationCritiqueDraftHashes", "translationAttempts", "translationRetryFeedback",
  ], "author-checkpoint-schema");
  assert(value.schemaVersion === YOUTUBE_AUTHOR_SCHEMA_VERSION && value.contractHash === contractHash,
    "author-checkpoint-contract-mismatch");
  assert(value.translationRetryPolicyVersion === YOUTUBE_TRANSLATION_RETRY_POLICY_VERSION,
    "author-checkpoint-retry-policy-mismatch");
  const englishAllowed = new Set(englishAllowedIds);
  const translationAllowed = new Set(translationAllowedIds);
  assert(isPlainObject(value.englishAttempts), "author-checkpoint-attempts-schema", "english");
  for (const [id, attempts] of Object.entries(value.englishAttempts)) {
    assert(englishAllowed.has(id) && Number.isSafeInteger(attempts) && attempts >= 0 &&
      attempts <= YOUTUBE_AUTHOR_MAX_ATTEMPTS, "author-checkpoint-attempts-invalid", id);
  }
  for (const [id, raw] of Object.entries(value.englishDrafts)) {
    assert(englishAllowed.has(id), "author-checkpoint-unknown-id", id);
    const draft = validateEnglishDraft(raw);
    assert(draft.canonicalRiddleId === id, "author-checkpoint-id-mismatch", id);
  }
  for (const [id, raw] of Object.entries(value.englishCritiques)) {
    assert(value.englishDrafts[id], "author-checkpoint-critique-without-draft", id);
    const review = validateEnglishCritique(raw);
    assert(review.canonicalRiddleId === id && englishCritiqueApproved(review),
      "author-checkpoint-critique-invalid", id);
    assert(value.englishCritiqueDraftHashes[id] === stableHash("youtube-english-draft-v1", value.englishDrafts[id]),
      "author-checkpoint-critique-hash", id);
  }
  assert(Object.keys(value.englishCritiqueDraftHashes).every((id) => value.englishCritiques[id]),
    "author-checkpoint-orphan-hash");
  for (const container of [
    value.translations,
    value.translationCritiques,
    value.translationCritiqueDraftHashes,
    value.translationAttempts,
    value.translationRetryFeedback,
  ]) {
    assert(isPlainObject(container) && Object.keys(container).every((locale) => locales.includes(locale)),
      "author-checkpoint-locale");
  }
  for (const locale of locales) {
    assert((value.translations[locale] === undefined || isPlainObject(value.translations[locale])) &&
      (value.translationCritiques[locale] === undefined || isPlainObject(value.translationCritiques[locale])) &&
      (value.translationCritiqueDraftHashes[locale] === undefined ||
        isPlainObject(value.translationCritiqueDraftHashes[locale])) &&
      (value.translationAttempts[locale] === undefined || isPlainObject(value.translationAttempts[locale])) &&
      (value.translationRetryFeedback[locale] === undefined ||
        isPlainObject(value.translationRetryFeedback[locale])),
    "author-checkpoint-locale-schema", locale);
    const translations = value.translations[locale] || {};
    const critiques = value.translationCritiques[locale] || {};
    const hashes = value.translationCritiqueDraftHashes[locale] || {};
    const attempts = value.translationAttempts[locale] || {};
    const retryFeedback = value.translationRetryFeedback[locale] || {};
    for (const [id, count] of Object.entries(attempts)) {
      assert(translationAllowed.has(id) && Number.isSafeInteger(count) && count >= 0 &&
        count <= YOUTUBE_AUTHOR_MAX_ATTEMPTS,
      "author-checkpoint-attempts-invalid", `${locale}:${id}`);
    }
    for (const [id, raw] of Object.entries(translations)) {
      assert(translationAllowed.has(id), "author-checkpoint-unknown-id", `${locale}:${id}`);
      const draft = validateTranslationDraft(raw);
      assert(draft.canonicalRiddleId === id && playableAnswerIssue(draft.answer, locale) === null,
        "author-checkpoint-translation-invalid", `${locale}:${id}`);
    }
    for (const [id, raw] of Object.entries(critiques)) {
      assert(translations[id], "author-checkpoint-critique-without-draft", `${locale}:${id}`);
      const review = validateTranslationCritique(raw);
      assert(review.canonicalRiddleId === id && translationCritiqueApproved(review),
        "author-checkpoint-critique-invalid", `${locale}:${id}`);
      assert(hashes[id] === stableHash("youtube-translation-draft-v1", translations[id]),
        "author-checkpoint-critique-hash", `${locale}:${id}`);
    }
    for (const [id, feedback] of Object.entries(retryFeedback)) {
      assert(translationAllowed.has(id) && isPlainObject(feedback),
        "author-checkpoint-feedback-invalid", `${locale}:${id}`);
      assertExactKeys(feedback, ["draft", "review"], "author-checkpoint-feedback-invalid");
      const draft = validateTranslationDraft(feedback.draft);
      const review = validateTranslationCritique(feedback.review);
      assert(draft.canonicalRiddleId === id && review.canonicalRiddleId === id &&
        !translationCritiqueApproved(review) && !critiques[id],
      "author-checkpoint-feedback-invalid", `${locale}:${id}`);
    }
    assert(Object.keys(hashes).every((id) => critiques[id]), "author-checkpoint-orphan-hash", locale);
  }
  return structuredClone(value);
};

const batches = (values, size) => Array.from({length: Math.ceil(values.length / size)}, (_, index) =>
  values.slice(index * size, (index + 1) * size));

const assertRetryAvailable = (attempts, stage, id) => {
  if ((attempts[id] || 0) >= YOUTUBE_AUTHOR_MAX_ATTEMPTS) {
    fail("author-retry-exhausted", `${stage}:${id}`);
  }
};

const invalidateEnglishDraft = (checkpoint, id) => {
  checkpoint.englishAttempts[id] = (checkpoint.englishAttempts[id] || 0) + 1;
  delete checkpoint.englishDrafts[id];
  delete checkpoint.englishCritiques[id];
  delete checkpoint.englishCritiqueDraftHashes[id];
};

const invalidateTranslationDraft = (checkpoint, locale, id, feedback) => {
  checkpoint.translationAttempts[locale] ||= {};
  checkpoint.translationAttempts[locale][id] = (checkpoint.translationAttempts[locale][id] || 0) + 1;
  checkpoint.translationRetryFeedback[locale] ||= {};
  if (feedback) checkpoint.translationRetryFeedback[locale][id] = feedback;
  delete checkpoint.translations[locale][id];
  delete checkpoint.translationCritiques[locale][id];
  delete checkpoint.translationCritiqueDraftHashes[locale][id];
};

const implicatedCanonicalId = (error, allowedIds) => {
  const matches = String(error instanceof Error ? error.message : error)
    .match(/race:(?:history|geography|music|film|science|mixed):[0-9]{2,}/gu) || [];
  const allowed = new Set(allowedIds);
  return matches.findLast((id) => allowed.has(id));
};

const makeTranslationBundle = (locale, source, existingById, drafts, critiques) => ({
  locale,
  provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
  translatorModel: YOUTUBE_TRANSLATOR_MODEL,
  criticModel: YOUTUBE_CRITIC_MODEL,
  riddles: source.riddles.map((canonical) => {
    const existing = existingById.get(canonical.canonicalRiddleId);
    if (existing) return existing;
    const translated = drafts[canonical.canonicalRiddleId];
    const review = critiques[canonical.canonicalRiddleId];
    assert(translated && review, "author-translation-incomplete", `${locale}:${canonical.canonicalRiddleId}`);
    return {
      canonicalRiddleId: canonical.canonicalRiddleId,
      sourceCanonicalHash: canonicalSourceHash(canonical),
      text: translated.text,
      answer: translated.answer,
      categoryId: canonical.categoryId,
      difficultyBand: canonical.difficultyBand,
      qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
      review: {
        criticModel: YOUTUBE_CRITIC_MODEL,
        backTranslation: review.backTranslation,
        equivalentCanonical: true,
        clueLeak: false,
        prohibitedContent: false,
        categoryMatch: true,
        difficultyMatch: true,
      },
    };
  }),
});

/**
 * Authors a complete candidate entirely through an injected model port. The caller persists each checkpoint;
 * ordinary builds call neither this function nor the model port.
 */
const authorYouTubeContent = async ({
  sourceDocument,
  seedRaw,
  seed,
  orderManifest,
  existingBundles = {},
  appendCount = 0,
  dailyStartsOn,
  locales = SUPPORTED_LOCALES.filter((locale) => locale !== "en"),
  batchSize = 15,
  checkpoint: checkpointInput,
  port,
  onCheckpoint = async () => {},
}) => {
  const baseSource = resolveYouTubeCanonicalSource({document: sourceDocument, seedRaw, seed});
  validateOrderManifest(orderManifest, baseSource);
  assert(Number.isSafeInteger(batchSize) && batchSize >= 1 && batchSize <= 30, "author-batch-size-invalid");
  assert(Array.isArray(locales) && locales.length > 0 && new Set(locales).size === locales.length &&
    locales.every((locale) => locale !== "en" && SUPPORTED_LOCALES.includes(locale)), "author-locales-invalid");
  assert(port && ["generateEnglish", "critiqueEnglish", "translate", "critiqueTranslation"]
    .every((method) => typeof port[method] === "function"), "author-model-port-invalid");

  assert(Number.isSafeInteger(appendCount) && appendCount >= 0 && appendCount <= 180,
    "append-count-invalid");
  const appendSpecs = createYouTubeAppendSpecs(baseSource, appendCount);
  if (appendCount > 0) {
    assert(typeof dailyStartsOn === "string", "daily-start-required");
  } else {
    assert(dailyStartsOn === undefined, "daily-start-without-append");
  }
  const appendedIds = appendSpecs.map(({canonicalRiddleId}) => canonicalRiddleId);
  const candidateOrder = createCandidateOrder(orderManifest, appendedIds, dailyStartsOn);
  const existingByLocale = {};
  const existingBundleHashes = {};
  const baseCanonicalById = new Map(baseSource.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  for (const locale of locales) {
    const bundle = existingBundles[locale];
    if (!bundle) {
      existingByLocale[locale] = new Map();
      existingBundleHashes[locale] = null;
      continue;
    }
    existingByLocale[locale] = validateTranslationBundle(bundle, locale, baseCanonicalById);
    existingBundleHashes[locale] = stableHash("youtube-existing-translation-v1", bundle);
  }
  const contract = {
    schemaVersion: YOUTUBE_AUTHOR_CONTRACT_SCHEMA_VERSION,
    sourceDocumentSha256: stableHash("youtube-source-document-v1", sourceDocument),
    resolvedBaseSourceSha256: stableHash("youtube-resolved-source-v1", baseSource),
    orderManifestSha256: stableHash("youtube-order-manifest-v1", orderManifest),
    appendCount,
    dailyStartsOn: dailyStartsOn ?? null,
    appendSpecs,
    locales,
    generatorModel: YOUTUBE_GENERATOR_MODEL,
    criticModel: YOUTUBE_CRITIC_MODEL,
    existingBundleHashes,
  };
  const contractHash = stableHash("youtube-author-contract-v1", contract);
  let checkpoint = checkpointInput ? validateCheckpoint(
    checkpointInput,
    contractHash,
    appendSpecs.map(({canonicalRiddleId}) => canonicalRiddleId),
    [
      ...baseSource.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
      ...appendSpecs.map(({canonicalRiddleId}) => canonicalRiddleId),
    ],
    locales,
  ) : blankCheckpoint(contractHash);
  const persist = async () => onCheckpoint(structuredClone(checkpoint));

  let appendedRiddles;
  let candidateSource;
  while (!candidateSource) {
    for (const batch of batches(appendSpecs, batchSize)) {
      while (batch.some(({canonicalRiddleId}) => !checkpoint.englishCritiques[canonicalRiddleId])) {
        const pending = batch.filter(({canonicalRiddleId}) => !checkpoint.englishCritiques[canonicalRiddleId]);
        const missing = pending.filter(({canonicalRiddleId}) => !checkpoint.englishDrafts[canonicalRiddleId]);
        if (missing.length > 0) {
          const ids = missing.map(({canonicalRiddleId}) => canonicalRiddleId);
          ids.forEach((id) => assertRetryAvailable(checkpoint.englishAttempts, "english", id));
          try {
            const generated = exactById(await port.generateEnglish({
              model: YOUTUBE_GENERATOR_MODEL,
              source: baseSource.riddles,
              specs: missing,
            }), ids, validateEnglishDraft, "english-generation");
            for (const id of ids) checkpoint.englishDrafts[id] = generated.get(id);
            await persist();
          } catch (error) {
            if (!(error instanceof YouTubeAuthoringError)) throw error;
            ids.forEach((id) => invalidateEnglishDraft(checkpoint, id));
            await persist();
            continue;
          }
        }
        const awaitingCritique = pending.filter(({canonicalRiddleId}) =>
          !checkpoint.englishCritiques[canonicalRiddleId]);
        if (awaitingCritique.length === 0) continue;
        const ids = awaitingCritique.map(({canonicalRiddleId}) => canonicalRiddleId);
        let reviewed;
        try {
          reviewed = exactById(await port.critiqueEnglish({
            model: YOUTUBE_CRITIC_MODEL,
            source: baseSource.riddles,
            specs: awaitingCritique,
            drafts: ids.map((id) => checkpoint.englishDrafts[id]),
          }), ids, validateEnglishCritique, "english-critique");
        } catch (error) {
          if (!(error instanceof YouTubeAuthoringError)) throw error;
          ids.forEach((id) => invalidateEnglishDraft(checkpoint, id));
          await persist();
          continue;
        }
        for (const id of ids) {
          const review = reviewed.get(id);
          if (!englishCritiqueApproved(review)) {
            invalidateEnglishDraft(checkpoint, id);
            continue;
          }
          checkpoint.englishCritiques[id] = review;
          checkpoint.englishCritiqueDraftHashes[id] = stableHash(
            "youtube-english-draft-v1",
            checkpoint.englishDrafts[id],
          );
        }
        await persist();
      }
    }

    appendedRiddles = appendSpecs.map((spec) => ({
      ...checkpoint.englishDrafts[spec.canonicalRiddleId],
      categoryId: spec.categoryId,
      difficultyBand: spec.difficultyBand,
      qualityVersion: YOUTUBE_ENGLISH_QUALITY_VERSION,
    }));
    try {
      candidateSource = validateCanonicalSource({
        locale: "en",
        riddles: [...baseSource.riddles, ...appendedRiddles],
      });
      validateOrderManifest(candidateOrder, candidateSource);
    } catch (error) {
      candidateSource = undefined;
      const implicatedId = implicatedCanonicalId(error, appendedIds);
      if (!implicatedId) throw error;
      invalidateEnglishDraft(checkpoint, implicatedId);
      await persist();
    }
  }

  const bundles = {};
  const candidateById = new Map(candidateSource.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  for (const locale of locales) {
    checkpoint.translations[locale] ||= {};
    checkpoint.translationCritiques[locale] ||= {};
    checkpoint.translationCritiqueDraftHashes[locale] ||= {};
    checkpoint.translationAttempts[locale] ||= {};
    checkpoint.translationRetryFeedback[locale] ||= {};
    const missingCanonical = candidateSource.riddles.filter(({canonicalRiddleId}) =>
      !existingByLocale[locale].has(canonicalRiddleId));
    while (!bundles[locale]) {
      for (const batch of batches(missingCanonical, batchSize)) {
        while (batch.some(({canonicalRiddleId}) =>
          !checkpoint.translationCritiques[locale][canonicalRiddleId])) {
          const pending = batch.filter(({canonicalRiddleId}) =>
            !checkpoint.translationCritiques[locale][canonicalRiddleId]);
          const missing = pending.filter(({canonicalRiddleId}) =>
            !checkpoint.translations[locale][canonicalRiddleId]);
          if (missing.length > 0) {
            const ids = missing.map(({canonicalRiddleId}) => canonicalRiddleId);
            ids.forEach((id) => assertRetryAvailable(
              checkpoint.translationAttempts[locale],
              `translation:${locale}`,
              id,
            ));
            let translated;
            try {
              translated = exactById(await port.translate({
                model: YOUTUBE_TRANSLATOR_MODEL,
                locale,
                source: missing,
                localizedCatalog: [
                  ...existingByLocale[locale].values(),
                  ...Object.values(checkpoint.translations[locale]),
                ],
                attempts: Object.fromEntries(ids.map((id) => [
                  id,
                  checkpoint.translationAttempts[locale][id] || 0,
                ])),
                feedback: Object.fromEntries(ids.map((id) => [
                  id,
                  checkpoint.translationRetryFeedback[locale][id] || null,
                ])),
              }), ids, validateTranslationDraft, "translation");
            } catch (error) {
              if (!(error instanceof YouTubeAuthoringError)) throw error;
              ids.forEach((id) => invalidateTranslationDraft(checkpoint, locale, id));
              await persist();
              continue;
            }
            let terminalAnswerIssue;
            for (const id of ids) {
              const draft = translated.get(id);
              const answerIssue = playableAnswerIssue(draft.answer, locale);
              if (answerIssue !== null) {
                invalidateTranslationDraft(checkpoint, locale, id);
                if (checkpoint.translationAttempts[locale][id] >= YOUTUBE_AUTHOR_MAX_ATTEMPTS) {
                  terminalAnswerIssue = `${locale}:${id}:${answerIssue}`;
                }
                continue;
              }
              checkpoint.translations[locale][id] = draft;
            }
            await persist();
            if (terminalAnswerIssue) fail("translation-answer-invalid", terminalAnswerIssue);
          }
          const awaitingCritique = pending.filter(({canonicalRiddleId}) =>
            checkpoint.translations[locale][canonicalRiddleId] &&
            !checkpoint.translationCritiques[locale][canonicalRiddleId]);
          if (awaitingCritique.length === 0) continue;
          const ids = awaitingCritique.map(({canonicalRiddleId}) => canonicalRiddleId);
          let reviewed;
          try {
            reviewed = exactById(await port.critiqueTranslation({
              model: YOUTUBE_CRITIC_MODEL,
              locale,
              source: awaitingCritique,
              translations: ids.map((id) => checkpoint.translations[locale][id]),
            }), ids, validateTranslationCritique, "translation-critique");
          } catch (error) {
            if (!(error instanceof YouTubeAuthoringError)) throw error;
            ids.forEach((id) => invalidateTranslationDraft(checkpoint, locale, id));
            await persist();
            continue;
          }
          for (const id of ids) {
            const review = reviewed.get(id);
            if (!translationCritiqueApproved(review)) {
              invalidateTranslationDraft(checkpoint, locale, id, {
                draft: checkpoint.translations[locale][id],
                review,
              });
              continue;
            }
            delete checkpoint.translationRetryFeedback[locale][id];
            checkpoint.translationCritiques[locale][id] = review;
            checkpoint.translationCritiqueDraftHashes[locale][id] = stableHash(
              "youtube-translation-draft-v1",
              checkpoint.translations[locale][id],
            );
          }
          await persist();
        }
      }
      try {
        const bundle = makeTranslationBundle(
          locale,
          candidateSource,
          existingByLocale[locale],
          checkpoint.translations[locale],
          checkpoint.translationCritiques[locale],
        );
        validateTranslationBundle(bundle, locale, candidateById);
        bundles[locale] = bundle;
      } catch (error) {
        const implicatedId = implicatedCanonicalId(
          error,
          missingCanonical.map(({canonicalRiddleId}) => canonicalRiddleId),
        );
        if (!implicatedId) throw error;
        invalidateTranslationDraft(checkpoint, locale, implicatedId);
        await persist();
      }
    }
  }

  let candidateSourceDocument = structuredClone(sourceDocument);
  if (appendedIds.length > 0) {
    const criticApprovals = appendedIds.map((id) => ({
      ...checkpoint.englishCritiques[id],
      draftSha256: checkpoint.englishCritiqueDraftHashes[id],
    }));
    const receipt = {
      batchId: sha256(`youtube-append-batch-v1\0${contractHash}`),
      baseCanonicalSha256: stableHash("youtube-resolved-source-v1", baseSource),
      generatorModel: YOUTUBE_GENERATOR_MODEL,
      criticModel: YOUTUBE_CRITIC_MODEL,
      canonicalIds: appendedIds,
      generatedRiddlesSha256: stableHash("youtube-appended-riddles-v1", appendedRiddles),
      criticApprovals,
      criticApprovalsSha256: stableHash("youtube-english-critiques-v1", criticApprovals),
    };
    candidateSourceDocument.appendedRiddles.push(...appendedRiddles);
    candidateSourceDocument.appendReceipts.push(receipt);
  }
  resolveYouTubeCanonicalSource({document: candidateSourceDocument, seedRaw, seed});

  return {
    sourceDocument: candidateSourceDocument,
    source: candidateSource,
    orderManifest: candidateOrder,
    translationBundles: bundles,
    checkpoint,
    contract,
  };
};

module.exports = {
  YOUTUBE_AUTHOR_SCHEMA_VERSION,
  YOUTUBE_ENGLISH_QUALITY_VERSION,
  YouTubeAuthoringError,
  authorYouTubeContent,
  createCandidateOrder,
  createYouTubeAppendSpecs,
  resolveYouTubeCanonicalSource,
  stableHash,
  validateCheckpoint,
};

"use strict";

const assert = require("node:assert/strict");
const {readFile} = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  SUPPORTED_LOCALES,
  YOUTUBE_CRITIC_MODEL,
  YOUTUBE_GENERATOR_MODEL,
  YOUTUBE_TRANSLATOR_MODEL,
  canonicalSourceHash,
  saveRiddleFingerprint,
  validateCanonicalSource,
  validateTranslationBundle,
} = require("./lib/youtube-content-pack.js");
const {
  YOUTUBE_ENGLISH_QUALITY_VERSION,
  authorYouTubeContent,
  createYouTubeAppendSpecs,
  resolveYouTubeCanonicalSource,
  stableHash,
} = require("./lib/youtube-content-author.js");

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceDocumentPath = path.join(
  repositoryRoot,
  "firebase-functions/content/youtube-content-source-v1.json",
);
const seedPath = path.join(repositoryRoot, "firebase-functions/content/race-en-reviewed-v1.json");
const orderPath = path.join(repositoryRoot, "firebase-functions/content/youtube-content-order-v1.json");

const inputs = async () => {
  const [documentRaw, seedRaw, orderRaw] = await Promise.all([
    readFile(sourceDocumentPath, "utf8"),
    readFile(seedPath, "utf8"),
    readFile(orderPath, "utf8"),
  ]);
  const sourceDocument = JSON.parse(documentRaw);
  const seed = JSON.parse(seedRaw);
  return {
    sourceDocument,
    seedRaw,
    seed,
    source: resolveYouTubeCanonicalSource({document: sourceDocument, seedRaw, seed}),
    order: JSON.parse(orderRaw),
  };
};

const existingBundle = (locale, source) => ({
  locale,
  provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
  translatorModel: YOUTUBE_TRANSLATOR_MODEL,
  criticModel: YOUTUBE_CRITIC_MODEL,
  riddles: source.riddles.map((canonical) => ({
    canonicalRiddleId: canonical.canonicalRiddleId,
    sourceCanonicalHash: canonicalSourceHash(canonical),
    text: `Texto ${locale}: ${canonical.text}`,
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

const generated = {
  "race:history:31": {
    text: "What name did the Inca give to knotted cords used for keeping records?",
    answer: "quipu",
    translatedText: "¿Qué nombre daban los incas a los cordones anudados para llevar registros?",
    translatedAnswer: "quipu",
  },
  "race:geography:31": {
    text: "What name describes a long, narrow sea inlet carved by a glacier?",
    answer: "fjord",
    translatedText: "¿Cómo se llama una entrada de mar larga y estrecha excavada por un glaciar?",
    translatedAnswer: "fiordo",
  },
};

const scriptMarker = {ar: "ع", hi: "ह", ja: "日", ko: "한", ru: "Я"};

const fakePort = ({rejectTranslation = false, calls = []} = {}) => ({
  async generateEnglish({model, specs}) {
    calls.push({method: "generateEnglish", model, ids: specs.map(({canonicalRiddleId}) => canonicalRiddleId)});
    return specs.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId].text,
      answer: generated[canonicalRiddleId].answer,
    }));
  },
  async critiqueEnglish({model, drafts}) {
    calls.push({method: "critiqueEnglish", model, ids: drafts.map(({canonicalRiddleId}) => canonicalRiddleId)});
    return drafts.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      factual: true,
      answerCorrect: true,
      unambiguous: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    }));
  },
  async translate({model, locale, source}) {
    calls.push({method: "translate", model, locale, ids: source.map(({canonicalRiddleId}) => canonicalRiddleId)});
    return source.map(({canonicalRiddleId, text, answer}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId]?.translatedText ||
        `${scriptMarker[locale] || `Texto ${locale}`} ${text}`,
      answer: generated[canonicalRiddleId]?.translatedAnswer || answer,
    }));
  },
  async critiqueTranslation({model, locale, source, translations}) {
    calls.push({
      method: "critiqueTranslation",
      model,
      locale,
      ids: translations.map(({canonicalRiddleId}) => canonicalRiddleId),
    });
    return translations.map(({canonicalRiddleId}, index) => ({
      canonicalRiddleId,
      backTranslation: generated[canonicalRiddleId]?.text || source[index].text,
      equivalentCanonical: !rejectTranslation,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    }));
  },
});

test("authors complete isolated bundles for all 15 non-English locales without changing the Race seed", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  const calls = [];
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    appendCount: 0,
    batchSize: 30,
    port: fakePort({calls}),
  });
  const nonEnglishLocales = SUPPORTED_LOCALES.filter((locale) => locale !== "en");
  assert.deepEqual(Object.keys(result.translationBundles), nonEnglishLocales);
  assert.equal(Object.values(result.translationBundles).every(({riddles}) => riddles.length === 180), true);
  assert.equal(calls.some(({method}) => method === "generateEnglish" || method === "critiqueEnglish"), false);
  assert.equal(calls.filter(({method}) => method === "translate").length, nonEnglishLocales.length * 6);
  assert.equal(calls.filter(({method}) => method === "critiqueTranslation").length,
    nonEnglishLocales.length * 6);
  assert.equal(seed.riddles.length, 180);
  assert.deepEqual(result.source.riddles, source.riddles);
});

test("accepts 500-character clues and rejects 501 characters in pack and authoring validation", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  const atLimit = `${"Q".repeat(499)}?`;
  const localizedAtLimit = `${"R".repeat(499)}?`;
  const packCandidate = structuredClone(source);
  packCandidate.riddles[0].text = atLimit;
  assert.doesNotThrow(() => validateCanonicalSource(packCandidate));
  packCandidate.riddles[0].text = `${atLimit}x`;
  assert.throws(() => validateCanonicalSource(packCandidate), /canonical-clue-invalid/u);
  const localized = existingBundle("es", source);
  localized.riddles[0].text = atLimit;
  const canonicalById = new Map(source.riddles.map((riddle) => [riddle.canonicalRiddleId, riddle]));
  assert.doesNotThrow(() => validateTranslationBundle(localized, "es", canonicalById));
  localized.riddles[0].text = `${atLimit}x`;
  assert.throws(() => validateTranslationBundle(localized, "es", canonicalById),
    /translation-clue-invalid/u);

  let generationCalls = 0;
  let translationCalls = 0;
  const port = fakePort();
  port.generateEnglish = async ({specs}) => {
    generationCalls += 1;
    return specs.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generationCalls === 1 ? `${atLimit}x` : atLimit,
      answer: "quipu",
    }));
  };
  port.translate = async ({source: batch}) => {
    translationCalls += 1;
    return batch.map(({canonicalRiddleId, answer}) => ({
      canonicalRiddleId,
      text: translationCalls === 1 ? `${localizedAtLimit}x` : localizedAtLimit,
      answer,
    }));
  };
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port,
  });
  assert.equal(generationCalls, 2);
  assert.equal(translationCalls, 2);
  assert.equal(result.source.riddles.at(-1).text.length, 500);
  assert.equal(result.translationBundles.es.riddles.at(-1).text.length, 500);
  assert.equal(result.checkpoint.englishAttempts["race:history:31"], 1);
  assert.equal(result.checkpoint.translationAttempts.es["race:history:31"], 1);
});

test("persists English rejection invalidation and resumes by generating a new draft", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let savedCheckpoint;
  let generationCalls = 0;
  const interruptedPort = fakePort();
  interruptedPort.generateEnglish = async ({specs}) => {
    generationCalls += 1;
    if (generationCalls > 1) throw new Error("stop-after-english-rejection");
    return specs.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId].text,
      answer: generated[canonicalRiddleId].answer,
    }));
  };
  interruptedPort.critiqueEnglish = async ({drafts}) => drafts.map(({canonicalRiddleId}) => ({
    canonicalRiddleId,
    factual: false,
    answerCorrect: true,
    unambiguous: true,
    clueLeak: false,
    prohibitedContent: false,
    categoryMatch: true,
    difficultyMatch: true,
  }));
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: interruptedPort,
    onCheckpoint: async (value) => {
      savedCheckpoint = value;
    },
  }), /stop-after-english-rejection/u);
  assert.equal(savedCheckpoint.englishAttempts["race:history:31"], 1);
  assert.equal(savedCheckpoint.englishDrafts["race:history:31"], undefined);

  const resumedPort = fakePort();
  resumedPort.generateEnglish = async ({specs}) => specs.map(({canonicalRiddleId}) => ({
    canonicalRiddleId,
    text: "Which Inca record system used cords tied with carefully placed knots?",
    answer: "quipu",
  }));
  const resumed = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    checkpoint: savedCheckpoint,
    port: resumedPort,
  });
  assert.equal(resumed.source.riddles.at(-1).text,
    "Which Inca record system used cords tied with carefully placed knots?");
});

test("persists translation rejection invalidation and resumes by generating a new draft", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let savedCheckpoint;
  let translationCalls = 0;
  const interruptedPort = fakePort();
  interruptedPort.translate = async ({source: batch}) => {
    translationCalls += 1;
    if (translationCalls > 1) throw new Error("stop-after-translation-rejection");
    return batch.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId].translatedText,
      answer: generated[canonicalRiddleId].translatedAnswer,
    }));
  };
  interruptedPort.critiqueTranslation = async ({translations}) => translations.map(({canonicalRiddleId}) => ({
    canonicalRiddleId,
    backTranslation: generated[canonicalRiddleId].text,
    equivalentCanonical: false,
    clueLeak: false,
    prohibitedContent: false,
    categoryMatch: true,
    difficultyMatch: true,
  }));
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: interruptedPort,
    onCheckpoint: async (value) => {
      savedCheckpoint = value;
    },
  }), /stop-after-translation-rejection/u);
  assert.equal(savedCheckpoint.translationAttempts.es["race:history:31"], 1);
  assert.equal(savedCheckpoint.translations.es["race:history:31"], undefined);

  const resumedPort = fakePort();
  resumedPort.translate = async ({source: batch}) => batch.map(({canonicalRiddleId}) => ({
    canonicalRiddleId,
    text: "¿Qué sistema inca de registro empleaba cuerdas con nudos?",
    answer: "quipu",
  }));
  const resumed = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    checkpoint: savedCheckpoint,
    port: resumedPort,
  });
  assert.equal(resumed.translationBundles.es.riddles.at(-1).text,
    "¿Qué sistema inca de registro empleaba cuerdas con nudos?");
});

test("reopens exhausted translations after schema or retry policy changes", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let checkpoint;
  let translationCalls = 0;
  const interruptedPort = fakePort();
  interruptedPort.translate = async ({source: batch}) => {
    translationCalls += 1;
    if (translationCalls > 1) throw new Error("stop-after-rejection");
    return batch.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId].translatedText,
      answer: generated[canonicalRiddleId].translatedAnswer,
    }));
  };
  interruptedPort.critiqueTranslation = async ({translations}) => translations.map(({canonicalRiddleId}) => ({
    canonicalRiddleId,
    backTranslation: generated[canonicalRiddleId].text,
    equivalentCanonical: true,
    clueLeak: true,
    prohibitedContent: false,
    categoryMatch: true,
    difficultyMatch: true,
  }));
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: interruptedPort,
    onCheckpoint: async (value) => {
      checkpoint = value;
    },
  }), /stop-after-rejection/u);
  checkpoint.translationAttempts.es["race:history:31"] = 6;
  const v2Checkpoint = structuredClone(checkpoint);
  v2Checkpoint.schemaVersion = 2;
  delete v2Checkpoint.translationRetryPolicyVersion;
  delete v2Checkpoint.translationRetryFeedback;
  const staleRetryPolicyCheckpoint = structuredClone(checkpoint);
  staleRetryPolicyCheckpoint.translationRetryPolicyVersion = 3;

  for (const legacyCheckpoint of [v2Checkpoint, staleRetryPolicyCheckpoint]) {
    const resumed = await authorYouTubeContent({
      sourceDocument,
      seedRaw,
      seed,
      orderManifest: order,
      existingBundles: {es: existingBundle("es", source)},
      appendCount: 1,
      dailyStartsOn: "2027-01-01",
      locales: ["es"],
      checkpoint: legacyCheckpoint,
      port: fakePort(),
    });
    assert.equal(resumed.checkpoint.schemaVersion, 4);
    assert.equal(resumed.checkpoint.translationRetryPolicyVersion, 6);
    assert.equal(resumed.checkpoint.translationAttempts.es["race:history:31"], 0);
  }
});

test("passes retry counts to the translator so rejected wording can be repaired", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let translationCalls = 0;
  const port = fakePort();
  port.translate = async ({source: batch, attempts, feedback}) => {
    translationCalls += 1;
    const id = batch[0].canonicalRiddleId;
    assert.equal(attempts[id], translationCalls - 1);
    if (translationCalls === 1) {
      assert.equal(feedback[id], null);
    } else {
      assert.equal(feedback[id].review.clueLeak, true);
      assert.equal(feedback[id].draft.answer, "quipu");
    }
    return [{
      canonicalRiddleId: id,
      text: translationCalls === 1
        ? "¿Qué quipu utilizaban los incas para registrar información?"
        : "¿Qué sistema de cuerdas anudadas utilizaban los incas para registrar información?",
      answer: "quipu",
    }];
  };
  port.critiqueTranslation = async ({translations}) => translations.map(({canonicalRiddleId, text}) => ({
    canonicalRiddleId,
    backTranslation: generated[canonicalRiddleId].text,
    equivalentCanonical: true,
    clueLeak: text.includes("quipu"),
    prohibitedContent: false,
    categoryMatch: true,
    difficultyMatch: true,
  }));
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port,
  });
  assert.equal(translationCalls, 2);
  assert.equal(result.translationBundles.es.riddles.at(-1).answer, "quipu");
});

test("retries only the invalid translation instead of charging its whole batch", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let translationCalls = 0;
  const port = fakePort();
  port.translate = async ({source: batch}) => {
    translationCalls += 1;
    if (translationCalls === 2) {
      assert.deepEqual(batch.map(({canonicalRiddleId}) => canonicalRiddleId), ["race:geography:31"]);
    }
    return batch.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: generated[canonicalRiddleId].translatedText,
      answer: translationCalls === 1 && canonicalRiddleId === "race:geography:31"
        ? "dos palabras"
        : generated[canonicalRiddleId].translatedAnswer,
    }));
  };
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    batchSize: 2,
    port,
  });
  assert.equal(translationCalls, 2);
  assert.equal(result.checkpoint.translationAttempts.es["race:history:31"] || 0, 0);
  assert.equal(result.checkpoint.translationAttempts.es["race:geography:31"], 1);
});

test("regenerates drafts implicated by deterministic English and translation validation", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let englishCalls = 0;
  let translationCalls = 0;
  const port = fakePort();
  port.generateEnglish = async ({specs}) => {
    englishCalls += 1;
    return specs.map(({canonicalRiddleId}) => ({
      canonicalRiddleId,
      text: englishCalls === 1 ? source.riddles[0].text : generated[canonicalRiddleId].text,
      answer: generated[canonicalRiddleId].answer,
    }));
  };
  port.translate = async ({source: batch}) => {
    translationCalls += 1;
    return batch.map(({canonicalRiddleId, text, answer}) => ({
      canonicalRiddleId,
      text: translationCalls === 1 ? text : generated[canonicalRiddleId].translatedText,
      answer: translationCalls === 1 ? answer : generated[canonicalRiddleId].translatedAnswer,
    }));
  };
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port,
  });
  assert.equal(englishCalls, 2);
  assert.equal(translationCalls, 2);
  assert.equal(result.checkpoint.englishAttempts["race:history:31"], 1);
  assert.equal(result.checkpoint.translationAttempts.es["race:history:31"], 1);
});

test("appends 181st+ canonical records under deterministic policy and preserves every released prefix", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  const calls = [];
  const result = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: fakePort({calls}),
  });

  assert.equal(result.source.riddles.length, 182);
  assert.deepEqual(result.source.riddles.slice(0, 180), source.riddles);
  assert.deepEqual(result.orderManifest.classic.canonicalIds.slice(0, 180), order.classic.canonicalIds);
  assert.deepEqual(result.orderManifest.daily.segments.slice(0, order.daily.segments.length), order.daily.segments);
  assert.deepEqual(result.orderManifest.classic.canonicalIds.slice(180), [
    "race:history:31",
    "race:geography:31",
  ]);
  assert.equal(result.source.riddles[180].difficultyBand, "easy");
  assert.equal(result.source.riddles[180].qualityVersion, YOUTUBE_ENGLISH_QUALITY_VERSION);
  assert.deepEqual(
    source.riddles.map(canonicalSourceHash),
    result.source.riddles.slice(0, 180).map(canonicalSourceHash),
  );
  assert.deepEqual(
    source.riddles.map(saveRiddleFingerprint),
    result.source.riddles.slice(0, 180).map(saveRiddleFingerprint),
  );
  assert.equal(result.translationBundles.es.riddles.length, 182);
  assert.deepEqual(
    result.translationBundles.es.riddles.slice(0, 180),
    existingBundle("es", source).riddles,
  );
  assert.deepEqual(result.sourceDocument.appendReceipts[0].canonicalIds, [
    "race:history:31",
    "race:geography:31",
  ]);
  assert.equal(result.orderManifest.daily.scheduleVersion, 2);
  assert.equal(result.orderManifest.daily.segments[1].startsOn, "2027-01-01");
  assert.deepEqual(new Set(result.orderManifest.daily.segments[1].canonicalIds), new Set([
    "race:history:31",
    "race:geography:31",
  ]));
  assert.deepEqual(
    calls.filter(({method}) => method === "generateEnglish" || method === "translate")
      .map(({model}) => model),
    [YOUTUBE_GENERATOR_MODEL, YOUTUBE_TRANSLATOR_MODEL],
  );
  assert.deepEqual(
    calls.filter(({method}) => method.includes("critique")).map(({model}) => model),
    [YOUTUBE_CRITIC_MODEL, YOUTUBE_CRITIC_MODEL],
  );
  assert.notEqual(YOUTUBE_TRANSLATOR_MODEL, YOUTUBE_CRITIC_MODEL);
  assert.doesNotThrow(() => resolveYouTubeCanonicalSource({
    document: result.sourceDocument,
    seedRaw,
    seed,
  }));
  const tamperedReceiptSource = structuredClone(result.sourceDocument);
  tamperedReceiptSource.appendedRiddles[0].text += " Today";
  assert.throws(() => resolveYouTubeCanonicalSource({
    document: tamperedReceiptSource,
    seedRaw,
    seed,
  }), /youtube-source-receipt-riddles-hash/u);
  const tamperedApproval = structuredClone(result.sourceDocument);
  tamperedApproval.appendReceipts[0].criticApprovals[0].draftSha256 = "a".repeat(64);
  tamperedApproval.appendReceipts[0].criticApprovalsSha256 = stableHash(
    "youtube-english-critiques-v1",
    tamperedApproval.appendReceipts[0].criticApprovals,
  );
  assert.throws(() => resolveYouTubeCanonicalSource({
    document: tamperedApproval,
    seedRaw,
    seed,
  }), /youtube-source-receipt-approval-draft-hash/u);
});

test("resumes from model/hash-bound checkpoints without repeating completed generation or translation", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  let savedCheckpoint;
  const firstCalls = [];
  const firstPort = fakePort({calls: firstCalls});
  firstPort.critiqueTranslation = async () => {
    throw new Error("simulated-critic-interruption");
  };
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: firstPort,
    onCheckpoint: async (checkpoint) => {
      savedCheckpoint = checkpoint;
    },
  }), /simulated-critic-interruption/u);
  assert(savedCheckpoint);
  assert.equal(Object.keys(savedCheckpoint.englishDrafts).length, 2);
  assert.equal(Object.keys(savedCheckpoint.englishCritiques).length, 2);
  assert.equal(Object.keys(savedCheckpoint.translations.es).length, 2);

  const resumedCalls = [];
  const resumed = await authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    checkpoint: savedCheckpoint,
    port: fakePort({calls: resumedCalls}),
  });
  assert.equal(resumed.source.riddles.length, 182);
  assert.deepEqual(resumedCalls.map(({method}) => method), ["critiqueTranslation"]);

  const tampered = structuredClone(resumed.checkpoint);
  tampered.translations.es["race:history:31"].answer = "cuerda";
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    checkpoint: tampered,
    port: fakePort(),
  }), /author-checkpoint-critique-hash/u);
});

test("fails closed on stale seed bindings, substituted IDs, and rejected independent critique", async () => {
  const {sourceDocument, seedRaw, seed, source, order} = await inputs();
  assert.throws(() => resolveYouTubeCanonicalSource({
    document: sourceDocument,
    seedRaw: `${seedRaw} `,
    seed,
  }), /youtube-source-seed-hash/u);

  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    locales: ["es"],
    port: fakePort(),
  }), /daily-start-required/u);
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2026-06-29",
    locales: ["es"],
    port: fakePort(),
  }), /daily-segment-overlap/u);

  const wrongIdPort = fakePort();
  wrongIdPort.generateEnglish = async () => [{
    canonicalRiddleId: "race:science:99",
    text: "Which metal has the chemical symbol Co?",
    answer: "cobalt",
  }];
  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 1,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: wrongIdPort,
  }), /author-retry-exhausted:english:race:history:31/u);

  await assert.rejects(authorYouTubeContent({
    sourceDocument,
    seedRaw,
    seed,
    orderManifest: order,
    existingBundles: {es: existingBundle("es", source)},
    appendCount: 2,
    dailyStartsOn: "2027-01-01",
    locales: ["es"],
    port: fakePort({rejectTranslation: true}),
  }), /author-retry-exhausted:translation:es:race:history:31/u);
});

test("keeps the strict Race seed at exactly 180 while allocating deterministic future batches", async () => {
  const {seed, source} = await inputs();
  assert.equal(seed.riddles.length, 180);
  assert.deepEqual(createYouTubeAppendSpecs(source, 7), [
    {canonicalRiddleId: "race:history:31", categoryId: "history", difficultyBand: "easy"},
    {canonicalRiddleId: "race:geography:31", categoryId: "geography", difficultyBand: "easy"},
    {canonicalRiddleId: "race:music:31", categoryId: "music", difficultyBand: "easy"},
    {canonicalRiddleId: "race:film:31", categoryId: "film", difficultyBand: "easy"},
    {canonicalRiddleId: "race:science:31", categoryId: "science", difficultyBand: "easy"},
    {canonicalRiddleId: "race:mixed:31", categoryId: "mixed", difficultyBand: "easy"},
    {canonicalRiddleId: "race:history:32", categoryId: "history", difficultyBand: "easy"},
  ]);
});

test("allocates only easy and medium Classic and Daily additions across later batches", async () => {
  const {source} = await inputs();
  const specs = createYouTubeAppendSpecs(source, 180);
  assert.equal(specs.filter(({difficultyBand}) => difficultyBand === "easy").length, 120);
  assert.equal(specs.filter(({difficultyBand}) => difficultyBand === "medium").length, 60);
  assert.equal(specs.filter(({difficultyBand}) => difficultyBand === "hard").length, 0);
});

test("keeps legacy append receipts readable when their historical policy included hard cards", async () => {
  const {sourceDocument, seedRaw, seed, source} = await inputs();
  const appendedRiddles = createYouTubeAppendSpecs(source, 121, {legacyDifficulty: true}).map((spec, index) => ({
    ...spec,
    text: `A historical clue for puzzle number ${index}.`,
    answer: `zzzz${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`,
    qualityVersion: "automated_review_v1",
  }));
  assert.equal(appendedRiddles.at(-1).difficultyBand, "hard");
  const criticApprovals = appendedRiddles.map(({canonicalRiddleId, text, answer}) => ({
    canonicalRiddleId,
    factual: true, answerCorrect: true, unambiguous: true, clueLeak: false, prohibitedContent: false,
    categoryMatch: true, difficultyMatch: true,
    draftSha256: stableHash("youtube-english-draft-v1", {canonicalRiddleId, text, answer}),
  }));
  const document = {
    ...sourceDocument,
    appendedRiddles,
    appendReceipts: [{
      batchId: "1".repeat(64),
      baseCanonicalSha256: stableHash("youtube-resolved-source-v1", source),
      generatorModel: "gpt-5.6-sol",
      criticModel: YOUTUBE_CRITIC_MODEL,
      canonicalIds: appendedRiddles.map(({canonicalRiddleId}) => canonicalRiddleId),
      generatedRiddlesSha256: stableHash("youtube-appended-riddles-v1", appendedRiddles),
      criticApprovals,
      criticApprovalsSha256: stableHash("youtube-english-critiques-v1", criticApprovals),
    }],
  };
  assert.equal(resolveYouTubeCanonicalSource({document, seedRaw, seed}).riddles.length, 301);
  document.appendedRiddles.at(-1).qualityVersion = YOUTUBE_ENGLISH_QUALITY_VERSION;
  assert.throws(() => resolveYouTubeCanonicalSource({document, seedRaw, seed}), /youtube-source-append-policy/u);
});

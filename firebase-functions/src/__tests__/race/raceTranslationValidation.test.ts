import reviewedEnglish from "../../../content/race-en-reviewed-v1.json";
import {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  createRaceTranslationMatrixPlan,
  createRaceTranslationPlan,
  playableTranslatedAnswerIssue,
  raceTranslationCanonicalHash,
} from "../../race/raceTranslationValidation";
import {RACE_SUPPORTED_LOCALES} from "@qwordly/core/race";

/** Creates bundle. */
const createBundle = () => ({
  locale: "ja",
  provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
  translatorModel: "translator-v1",
  criticModel: "critic-v2",
  riddles: reviewedEnglish.riddles.map((source) => ({
    canonicalRiddleId: source.canonicalRiddleId,
    sourceCanonicalHash: raceTranslationCanonicalHash(source),
    text: `日本語 ${source.text}`,
    answer: source.answer,
    categoryId: source.categoryId,
    difficultyBand: source.difficultyBand,
    qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
    review: {
      criticModel: "critic-v2",
      backTranslation: source.text,
      equivalentCanonical: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    },
  })),
});

describe("machine-only race translation validation", () => {
  it("accepts only NFC Unicode letters and marks from one through seven graphemes", () => {
    expect(playableTranslatedAnswerIssue("東京", "ja")).toBeNull();
    expect(playableTranslatedAnswerIssue("إجابة", "ar")).toBeNull();
    expect(playableTranslatedAnswerIssue("éclair", "fr")).toBeNull();
    expect(playableTranslatedAnswerIssue("e\u0301clair", "fr")).toBe("non_nfc");
    expect(playableTranslatedAnswerIssue("two words", "en")).toBe("letters_and_marks_only");
    expect(playableTranslatedAnswerIssue("answer!", "en")).toBe("letters_and_marks_only");
    expect(playableTranslatedAnswerIssue("abcdefgh", "en")).toBe("grapheme_length");
  });

  it("binds the source digest to every canonical field with a domain-separated hash", () => {
    /** Provides canonical behavior. */
    const canonical = reviewedEnglish.riddles[0];
    /** Provides baseline behavior. */
    const baseline = raceTranslationCanonicalHash(canonical);
    expect(baseline).toMatch(/^[0-9a-f]{64}$/);
    for (const changed of [
      {...canonical, canonicalRiddleId: `${canonical.canonicalRiddleId}-changed`},
      {...canonical, text: `${canonical.text} changed`},
      {...canonical, answer: `${canonical.answer}changed`},
      {...canonical, categoryId: canonical.categoryId === "history" ? "science" : "history"},
      {...canonical, difficultyBand: canonical.difficultyBand === "easy" ? "hard" : "easy"},
    ])
      expect(raceTranslationCanonicalHash(changed)).not.toBe(baseline);
  });

  it("accepts a complete source-bound, independently critiqued 180-riddle contract", () => {
    /** Provides plan behavior. */
    const plan = createRaceTranslationPlan(createBundle(), reviewedEnglish);
    expect(plan.valid).toBe(true);
    expect(plan.records).toHaveLength(180);
    expect(Object.values(plan.categoryCounts)).toEqual([30, 30, 30, 30, 30, 30]);
    expect(plan.records.every(({data}) => data.qualityVersion === "automated_translation_v1")).toBe(true);
  });

  it("rejects stale source bindings, changed canonical metadata, and critic substitution", () => {
    /** Provides bundle behavior. */
    const bundle = createBundle();
    bundle.riddles[0].sourceCanonicalHash = "0".repeat(64);
    bundle.riddles[1].categoryId = "science";
    bundle.riddles[2].review.criticModel = "translator-v1";
    /** Provides plan behavior. */
    const plan = createRaceTranslationPlan(bundle, reviewedEnglish);
    expect(plan.issues.map(({code}) => code).sort()).toEqual(
      expect.arrayContaining(["source_binding", "metadata_mismatch", "critic_mismatch", "pool_invalid"]),
    );
  });

  it("rejects same-model critique, false safety/equivalence gates, and wrong pool size", () => {
    /** Provides same model behavior. */
    const sameModel = createBundle();
    sameModel.criticModel = sameModel.translatorModel;
    expect(() => createRaceTranslationPlan(sameModel, reviewedEnglish)).toThrow("independent models");
    /** Provides unsafe behavior. */
    const unsafe = createBundle();
    unsafe.riddles[0].review.prohibitedContent = true as false;
    expect(() => createRaceTranslationPlan(unsafe, reviewedEnglish)).toThrow();
    /** Provides short behavior. */
    const short = createBundle();
    short.riddles.pop();
    /** Translation plan missing one canonical question. */
    const incomplete = createRaceTranslationPlan(short, reviewedEnglish);
    expect(incomplete.valid).toBe(false);
    expect(incomplete.issues.some((issue) => issue.code === "canonical_set")).toBe(true);
  });

  it("rejects untranslated source copies and clues without the locale's required script", () => {
    /** Provides source copy behavior. */
    const sourceCopy = createBundle();
    sourceCopy.riddles[0].text = reviewedEnglish.riddles[0].text;
    sourceCopy.riddles[0].answer = `translated-${reviewedEnglish.riddles[0].answer}`;
    sourceCopy.riddles[1].text = "Latin characters only";
    /** Provides plan behavior. */
    const plan = createRaceTranslationPlan(sourceCopy, reviewedEnglish);
    expect(plan.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: "source_copy", canonicalRiddleId: sourceCopy.riddles[0].canonicalRiddleId}),
        expect.objectContaining({code: "locale_script", canonicalRiddleId: sourceCopy.riddles[1].canonicalRiddleId}),
      ]),
    );
  });

  it("rejects locale-wide compatibility duplicates across category boundaries", () => {
    /** Provides bundle behavior. */
    const bundle = createBundle();
    /** Provides first behavior. */
    const first = bundle.riddles.find((riddle) => riddle.categoryId === "history")!;
    /** Provides other category behavior. */
    const otherCategory = bundle.riddles.find((riddle) => riddle.categoryId === "geography")!;
    /** Provides another category behavior. */
    const anotherCategory = bundle.riddles.find((riddle) => riddle.categoryId === "music")!;
    otherCategory.text = first.text.replace("日本語", "日本語　");
    anotherCategory.answer = first.answer;
    /** Provides issues behavior. */
    const issues = createRaceTranslationPlan(bundle, reviewedEnglish).issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: "duplicate_question", canonicalRiddleId: otherCategory.canonicalRiddleId}),
        expect.objectContaining({code: "duplicate_answer", canonicalRiddleId: anotherCategory.canonicalRiddleId}),
      ]),
    );
  });

  it("rejects answers that native input cannot represent safely", () => {
    /** Provides bundle behavior. */
    const bundle = createBundle();
    bundle.riddles[0].answer = "two words";
    bundle.riddles[1].answer = "abcdefgh";
    expect(createRaceTranslationPlan(bundle, reviewedEnglish).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: "answer_format", canonicalRiddleId: bundle.riddles[0].canonicalRiddleId}),
        expect.objectContaining({code: "answer_format", canonicalRiddleId: bundle.riddles[1].canonicalRiddleId}),
      ]),
    );
  });

  it.each([
    ["ar", "ع"],
    ["hi", "ह"],
    ["ja", "日"],
    ["ko", "한"],
    ["ru", "Я"],
  ] as const)("enforces the expected native script for %s clues", (locale, marker) => {
    /** Provides bundle behavior. */
    const bundle = createBundle();
    bundle.locale = locale;
    bundle.riddles.forEach((riddle, index) => {
      riddle.text = `${marker} ${reviewedEnglish.riddles[index].text}`;
    });
    expect(createRaceTranslationPlan(bundle, reviewedEnglish).valid).toBe(true);
    bundle.riddles[0].text = "Latin characters only";
    expect(createRaceTranslationPlan(bundle, reviewedEnglish).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({code: "locale_script", canonicalRiddleId: bundle.riddles[0].canonicalRiddleId}),
      ]),
    );
  });

  it("proves one complete bundle per non-English locale and exactly 2,700 records", () => {
    /** Provides script markers behavior. */
    const scriptMarkers: Record<string, string> = {
      ar: "ع",
      hi: "ह",
      ja: "日",
      ko: "한",
      ru: "Я",
    };
    /** Provides bundles behavior. */
    const bundles = RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => {
      /** Provides bundle behavior. */
      const bundle = createBundle();
      bundle.locale = locale;
      bundle.riddles.forEach((riddle, index) => {
        riddle.text = `${scriptMarkers[locale] ?? `Translated ${locale}`} ${reviewedEnglish.riddles[index].text}`;
      });
      return bundle;
    });
    expect(createRaceTranslationMatrixPlan(bundles, reviewedEnglish)).toEqual({
      valid: true,
      locales: RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en"),
      totalRiddles: 2_700,
      issues: [],
    });

    /** Provides missing behavior. */
    const missing = createRaceTranslationMatrixPlan(bundles.slice(1), reviewedEnglish);
    expect(missing.valid).toBe(false);
    expect(missing.issues).toEqual(
      expect.arrayContaining([`${bundles[0].locale}:missing-bundle`, "corpus-count:2520:expected-2700"]),
    );

    /** Provides duplicate behavior. */
    const duplicate = createRaceTranslationMatrixPlan([...bundles, bundles[0]], reviewedEnglish);
    expect(duplicate.valid).toBe(false);
    expect(duplicate.issues).toEqual(
      expect.arrayContaining([`${bundles[0].locale}:duplicate-bundle:2`, "corpus-count:2880:expected-2700"]),
    );
  });

  it("requires every locale to match the smaller canonical question set", () => {
    /** Medium history question removed from the canonical fixture. */
    const removed = reviewedEnglish.riddles.find((riddle) => riddle.categoryId === "history" && riddle.difficultyBand === "medium");
    if (!removed) throw new Error("Missing medium history fixture");
    /** Canonical source containing the smaller reviewed question set. */
    const source = {...reviewedEnglish, riddles: reviewedEnglish.riddles.filter((riddle) => riddle.canonicalRiddleId !== removed.canonicalRiddleId)};
    /** Locale bundle reduced to the same canonical set. */
    const bundle = createBundle();
    bundle.riddles = bundle.riddles.filter((riddle) => riddle.canonicalRiddleId !== removed.canonicalRiddleId);
    expect(createRaceTranslationPlan(bundle, source).valid).toBe(true);
    /** Whole-corpus plan for the reduced source and one locale bundle. */
    const matrix = createRaceTranslationMatrixPlan([bundle], source);
    /** Number of non-English locales required in the matrix. */
    const localeCount = RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en").length;
    expect(matrix.issues).toContain(`corpus-count:179:expected-${179 * localeCount}`);
    /** Unchanged locale bundle checked against the reduced canonical source. */
    const stale = createRaceTranslationPlan(createBundle(), source);
    expect(stale.valid).toBe(false);
    expect(stale.issues.some((issue) => issue.code === "canonical_set")).toBe(true);
  });

  it("propagates per-locale quality failures into the whole-corpus audit", () => {
    /** Provides bundle behavior. */
    const bundle = createBundle();
    bundle.riddles[0].text = bundle.riddles[0].answer;
    /** Provides matrix behavior. */
    const matrix = createRaceTranslationMatrixPlan([bundle], reviewedEnglish);
    expect(matrix.valid).toBe(false);
    expect(matrix.issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/^ja:pool_invalid:/u), "corpus-count:180:expected-2700"]),
    );
  });
});

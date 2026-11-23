import reviewedEnglish from "../../../content/race-en-reviewed-v1.json";
import {
  assertRaceTranslationAtomicWriteCount,
  assertRaceTranslationImportSnapshotStable,
  createRaceTranslationImportPlan,
} from "../../race/content/raceTranslationImport";
import {
  AUTOMATED_TRANSLATION_QUALITY_VERSION,
  raceTranslationCanonicalHash,
} from "../../race/content/raceTranslationValidation";

/** Provides bundle behavior. */
const bundle = () => ({
  locale: "ja",
  provenance: AUTOMATED_TRANSLATION_QUALITY_VERSION,
  translatorModel: "translator-v1",
  criticModel: "critic-v2",
  riddles: reviewedEnglish.riddles.map((canonical) => ({
    canonicalRiddleId: canonical.canonicalRiddleId,
    sourceCanonicalHash: raceTranslationCanonicalHash(canonical),
    text: `日本語 ${canonical.text}`,
    answer: canonical.answer,
    categoryId: canonical.categoryId,
    difficultyBand: canonical.difficultyBand,
    qualityVersion: AUTOMATED_TRANSLATION_QUALITY_VERSION,
    review: {
      criticModel: "critic-v2",
      backTranslation: canonical.text,
      equivalentCanonical: true,
      clueLeak: false,
      prohibitedContent: false,
      categoryMatch: true,
      difficultyMatch: true,
    },
  })),
});

describe("race translation import boundary", () => {
  it("rejects concurrent target or eligible-set changes after backup", () => {
    /** Provides expected behavior. */
    const expected = [
      {path: "localizedRiddles/ja/riddles/a", version: "10:1"},
      {path: "localizedRiddles/ja/riddles/b", version: null},
    ];
    expect(() => assertRaceTranslationImportSnapshotStable(expected, [...expected].reverse(), "targets")).not.toThrow();
    expect(() =>
      assertRaceTranslationImportSnapshotStable(expected, [{...expected[0], version: "10:2"}, expected[1]], "targets"),
    ).toThrow("translation-import-state-changed:targets");
    expect(() =>
      assertRaceTranslationImportSnapshotStable(
        expected,
        [...expected, {path: "localizedRiddles/ja/riddles/c", version: "1:0"}],
        "eligible",
      ),
    ).toThrow("translation-import-state-changed:eligible");
  });

  it("permits one complete batch and rejects partial or invalid write counts", () => {
    expect(assertRaceTranslationAtomicWriteCount(180, 320)).toBe(500);
    expect(() => assertRaceTranslationAtomicWriteCount(180, 321)).toThrow("translation-import-atomic-limit:501");
    expect(() => assertRaceTranslationAtomicWriteCount(-1, 0)).toThrow("translation-import-write-count-invalid");
    expect(() => assertRaceTranslationAtomicWriteCount(Number.MAX_SAFE_INTEGER, 1)).toThrow(
      "translation-import-atomic-limit",
    );
  });

  it("accepts only the exact locale/provenance filename and produces 180 exact writes", () => {
    /** Provides plan behavior. */
    const plan = createRaceTranslationImportPlan(
      bundle(),
      reviewedEnglish,
      "/private/race-ja-automated-translation-v1.json",
    );
    expect(plan.valid).toBe(true);
    expect(plan.records).toHaveLength(180);
    expect(
      plan.records.every(
        ({locale, data}) => locale === "ja" && data.qualityVersion === AUTOMATED_TRANSLATION_QUALITY_VERSION,
      ),
    ).toBe(true);
    expect(() =>
      createRaceTranslationImportPlan(bundle(), reviewedEnglish, "/private/race-fr-automated-translation-v1.json"),
    ).toThrow("translation-input-filename-mismatch:race-ja-automated-translation-v1.json");
  });
});

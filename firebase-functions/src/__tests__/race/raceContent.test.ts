import {
  RACE_CATEGORY_IDS,
  RACE_SUPPORTED_LOCALES,
  type RaceCategoryId,
  type RaceDifficultyBand,
} from "../../../../src/core/race/index.js";
import type {SupportedLocale} from "../../../../src/core/validation/index.js";
import {
  createRaceContentDryRun,
  inferCanonicalRiddleId,
  inferRaceDifficulty,
  type ExistingRaceContentRecord,
} from "../../race/raceContentMigration";
import {validateRacePool} from "../../race/raceContentValidation";

/** Provides record behavior. */
const record = ({
  locale = "en",
  index = 1,
  categoryId = "history",
  difficultyBand = "easy",
  text = `Clue ${index} has a unique trail to follow`,
  answer = `a${String(index).padStart(6, "0")}`,
  raceEligible = true,
}: {
  /** Stores locale. */
  locale?: SupportedLocale;
  /** Stores index. */
  index?: number;
  /** Stores category id. */
  categoryId?: RaceCategoryId;
  /** Stores difficulty band. */
  difficultyBand?: RaceDifficultyBand;
  /** Stores text. */
  text?: string;
  /** Stores answer. */
  answer?: string;
  /** Stores race eligible. */
  raceEligible?: boolean;
} = {}): ExistingRaceContentRecord => ({
  locale,
  documentPath: `localizedRiddles/${locale}/riddles/classic_${index}`,
  data: {
    riddleId: `classic_${index}`,
    classicIndex: index,
    canonicalRiddleId: `classic:${index}`,
    text,
    answer,
    categoryId,
    difficultyBand,
    raceEligible,
    qualityVersion: "human_review_v1",
  },
});

describe("race content migration dry run", () => {
  it("infers stable locale-independent canonical IDs and difficulty", () => {
    expect(inferCanonicalRiddleId(record({locale: "ja", index: 7}))).toBe("classic:7");
    expect(inferRaceDifficulty("sun")).toBe("easy");
    expect(inferRaceDifficulty("piano")).toBe("medium");
    expect(inferRaceDifficulty("empire")).toBe("hard");
  });

  it("infers daily identifiers and rejects unsupported legacy metadata", () => {
    /** Provides base behavior. */
    const base = record();
    expect(inferCanonicalRiddleId({...base, data: {challengeKey: " 2026-08-04:1 "}})).toBe("daily:2026-08-04:1");
    expect(inferCanonicalRiddleId({...base, data: {dailyIndex: 3}})).toBe("daily:3");
    expect(inferCanonicalRiddleId({...base, data: {classicIndex: -1, dailyIndex: 1.5}})).toBeNull();
  });

  it("proposes conservative metadata without enabling unreviewed content", () => {
    /** Provides legacy behavior. */
    const legacy: ExistingRaceContentRecord = {
      locale: "en",
      documentPath: "localizedRiddles/en/riddles/classic_1",
      data: {classicIndex: 1, text: "A legacy clue", answer: "piano"},
    };
    /** Provides report behavior. */
    const report = createRaceContentDryRun([legacy]);
    expect(report.proposedWrites).toEqual([
      {
        documentPath: legacy.documentPath,
        patch: {
          canonicalRiddleId: "classic:1",
          categoryId: "mixed",
          difficultyBand: "medium",
          raceEligible: false,
          qualityVersion: "unreviewed_v1",
        },
      },
    ]);
    expect(report.missingTranslations).toEqual([
      {
        canonicalRiddleId: "classic:1",
        locales: RACE_SUPPORTED_LOCALES.filter((locale) => locale !== "en"),
      },
    ]);
  });

  it("reports canonical collisions and unclassifiable documents without writes", () => {
    /** Provides first behavior. */
    const first = record({index: 1});
    /** Provides duplicate behavior. */
    const duplicate = {...record({index: 1}), documentPath: `${first.documentPath}-duplicate`};
    /** Provides invalid behavior. */
    const invalid: ExistingRaceContentRecord = {
      locale: "en",
      documentPath: "localizedRiddles/en/riddles/broken",
      data: {text: "Missing its answer and index"},
    };
    /** Provides report behavior. */
    const report = createRaceContentDryRun([first, duplicate, invalid]);
    expect(report.collisions).toEqual([
      {locale: "en", canonicalRiddleId: "classic:1", documentPaths: [first.documentPath, duplicate.documentPath]},
    ]);
    expect(report.unclassifiable).toEqual([
      {documentPath: invalid.documentPath, reason: "A canonical index/key and non-empty answer are required"},
    ]);
  });

  it("sorts multiple collision groups deterministically", () => {
    /** Provides first behavior. */
    const first = record({index: 2});
    /** Provides first duplicate behavior. */
    const firstDuplicate = {...record({index: 2}), documentPath: `${first.documentPath}-z`};
    /** Provides second behavior. */
    const second = record({index: 1});
    /** Provides second duplicate behavior. */
    const secondDuplicate = {...record({index: 1}), documentPath: `${second.documentPath}-z`};

    /** Provides report behavior. */
    const report = createRaceContentDryRun([first, firstDuplicate, second, secondDuplicate]);

    expect(report.collisions.map((collision) => collision.canonicalRiddleId)).toEqual(["classic:1", "classic:2"]);
  });

  it("sorts proposed writes, invalid records, and missing translations", () => {
    /** Provides legacy behavior. */
    const legacy = (index: number, path: string, locale: SupportedLocale = "en"): ExistingRaceContentRecord => ({
      locale,
      documentPath: path,
      data: {classicIndex: index, answer: "piano"},
    });
    /** Provides invalid behavior. */
    const invalid = (path: string): ExistingRaceContentRecord => ({
      locale: "en",
      documentPath: path,
      data: {},
    });

    /** Provides report behavior. */
    const report = createRaceContentDryRun([
      legacy(2, "z-write"),
      legacy(1, "a-write"),
      invalid("z-invalid"),
      invalid("a-invalid"),
      legacy(4, "z-ja", "ja"),
      legacy(3, "a-ja", "ja"),
    ]);

    expect(report.proposedWrites.map((write) => write.documentPath)).toEqual(["a-ja", "a-write", "z-ja", "z-write"]);
    expect(report.unclassifiable.map((item) => item.documentPath)).toEqual(["a-invalid", "z-invalid"]);
    expect(report.missingTranslations.map((item) => item.canonicalRiddleId)).toEqual([
      "classic:1",
      "classic:2",
      "classic:3",
      "classic:4",
    ]);
  });

  it("does not report a canonical riddle translated into every supported locale", () => {
    /** Provides report behavior. */
    const report = createRaceContentDryRun(RACE_SUPPORTED_LOCALES.map((locale) => record({locale, index: 5})));

    expect(report.missingTranslations).toEqual([]);
  });
});

describe("race content pool validation", () => {
  it.each(RACE_CATEGORY_IDS)("rejects an undersized %s pool", (categoryId) => {
    /** Provides result behavior. */
    const result = validateRacePool([record({categoryId})], {locale: "en", categoryId});
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "insufficient_pool")).toBe(true);
  });

  it("accepts a reviewed balanced 30-riddle pool", () => {
    /** Provides difficulties behavior. */
    const difficulties: RaceDifficultyBand[] = ["easy", "medium", "hard"];
    /** Records s. */
    const records = Array.from({length: 30}, (_, index) =>
      record({
        index: index + 1,
        difficultyBand: difficulties[index % difficulties.length],
        text: `Unique clue ${index + 1} points along its own path`,
        answer: `a${String(index + 1).padStart(6, "0")}`,
      }),
    );
    /** Provides result behavior. */
    const result = validateRacePool(records, {locale: "en", categoryId: "history"});
    expect(result.valid).toBe(true);
    expect(result.eligibleCount).toBe(30);
    expect(result.difficultyCounts).toEqual({easy: 10, medium: 10, hard: 10});
  });

  it("requires enough easy riddles to fill the easier deck", () => {
    /** Pool fixture with too few easy riddles. */
    const records = Array.from({length: 30}, (_, index) =>
      record({index: index + 1, difficultyBand: index < 5 ? "easy" : "medium"}),
    );
    /** Validation result for the imbalanced pool. */
    const result = validateRacePool(records, {locale: "en", categoryId: "history"});
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({code: "difficulty_imbalance", message: expect.stringContaining("easy has 5")}),
    ]));
  });

  it("rejects duplicate, leaking, oversized, and untranslated content", () => {
    /** Provides duplicate behavior. */
    const duplicate = record({index: 2, text: "A piano has keys", answer: "piano"});
    duplicate.data.canonicalRiddleId = "classic:1";
    /** Records s. */
    const records = [
      record({index: 1, text: "A piano has keys", answer: "piano"}),
      duplicate,
      record({index: 3, answer: "toolong8"}),
    ];
    /** Provides result behavior. */
    const result = validateRacePool(records, {
      locale: "en",
      categoryId: "history",
      requiredLocales: ["en", "ja"],
      poolSize: 3,
    });
    expect(new Set(result.issues.map((issue) => issue.code))).toEqual(
      new Set([
        "duplicate_question",
        "duplicate_answer",
        "duplicate_canonical",
        "clue_leaks_answer",
        "answer_too_long",
        "missing_translation",
        "difficulty_imbalance",
      ]),
    );
  });

  it("detects locale-cased and compatibility-normalized duplicate clues", () => {
    /** Provides turkish behavior. */
    const turkish = validateRacePool(
      [
        record({locale: "tr", index: 1, text: "IŞIK hakkında soru", answer: "bir"}),
        record({locale: "tr", index: 2, text: "ışık hakkında soru", answer: "iki"}),
      ],
      {locale: "tr", categoryId: "history", poolSize: 2},
    );
    expect(turkish.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "duplicate_question"})]));

    /** Provides compatibility behavior. */
    const compatibility = validateRacePool(
      [
        record({index: 1, text: "ＡＢＣ follows this trail", answer: "first"}),
        record({index: 2, text: "ABC follows this trail", answer: "second"}),
      ],
      {locale: "en", categoryId: "history", poolSize: 2},
    );
    expect(compatibility.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({code: "duplicate_question"})]),
    );
  });

  it("rejects oversized pools", () => {
    /** Provides result behavior. */
    const result = validateRacePool([record({index: 1}), record({index: 2})], {
      locale: "en",
      categoryId: "history",
      poolSize: 1,
    });
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "oversized_pool"})]));
  });

  it.each([
    ["canonical", {canonicalRiddleId: null}],
    ["difficulty", {difficultyBand: "unknown"}],
    ["quality", {qualityVersion: null}],
    ["question type", {text: 4}],
    ["question empty", {text: " "}],
    ["answer type", {answer: 4}],
    ["answer empty", {answer: " "}],
  ])("rejects missing %s metadata", (_label, change) => {
    /** Provides invalid behavior. */
    const invalid = record();
    Object.assign(invalid.data, change);
    /** Provides result behavior. */
    const result = validateRacePool([invalid], {locale: "en", categoryId: "history", poolSize: 1});
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "missing_metadata"})]));
  });

  it.each([4, "unknown"])("excludes content with invalid category %p", (categoryId) => {
    /** Provides invalid behavior. */
    const invalid = record();
    invalid.data.categoryId = categoryId;
    /** Provides result behavior. */
    const result = validateRacePool([invalid], {locale: "en", categoryId: "history", poolSize: 1});
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "insufficient_pool"})]));
  });
});

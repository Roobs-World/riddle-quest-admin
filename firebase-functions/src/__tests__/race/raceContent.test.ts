import {RACE_CATEGORY_IDS, type RaceCategoryId, type RaceDifficultyBand} from "@qwordly/core/race";
import type {SupportedLocale} from "@qwordly/core/validation";
import {
  createRaceContentDryRun,
  inferCanonicalRiddleId,
  inferRaceDifficulty,
  type ExistingRaceContentRecord,
} from "../../race/raceContentMigration";
import {validateRacePool} from "../../race/raceContentValidation";

const record = ({
  locale = "en",
  index = 1,
  categoryId = "history",
  difficultyBand = "easy",
  text = `Clue ${index} has a unique trail to follow`,
  answer = `a${String(index).padStart(6, "0")}`,
  raceEligible = true,
}: {
  locale?: SupportedLocale;
  index?: number;
  categoryId?: RaceCategoryId;
  difficultyBand?: RaceDifficultyBand;
  text?: string;
  answer?: string;
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
    const base = record();
    expect(inferCanonicalRiddleId({...base, data: {challengeKey: " 2026-08-04:1 "}})).toBe(
      "daily:2026-08-04:1",
    );
    expect(inferCanonicalRiddleId({...base, data: {dailyIndex: 3}})).toBe("daily:3");
    expect(inferCanonicalRiddleId({...base, data: {classicIndex: -1, dailyIndex: 1.5}})).toBeNull();
  });

  it("proposes conservative metadata without enabling unreviewed content", () => {
    const legacy: ExistingRaceContentRecord = {
      locale: "en",
      documentPath: "localizedRiddles/en/riddles/classic_1",
      data: {classicIndex: 1, text: "A legacy clue", answer: "piano"},
    };
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
    expect(report.missingTranslations).toEqual([]);
  });

  it("reports canonical collisions and unclassifiable documents without writes", () => {
    const first = record({index: 1});
    const duplicate = {...record({index: 1}), documentPath: `${first.documentPath}-duplicate`};
    const invalid: ExistingRaceContentRecord = {
      locale: "en",
      documentPath: "localizedRiddles/en/riddles/broken",
      data: {text: "Missing its answer and index"},
    };
    const report = createRaceContentDryRun([first, duplicate, invalid]);
    expect(report.collisions).toEqual([
      {locale: "en", canonicalRiddleId: "classic:1", documentPaths: [first.documentPath, duplicate.documentPath]},
    ]);
    expect(report.unclassifiable).toEqual([
      {documentPath: invalid.documentPath, reason: "A canonical index/key and non-empty answer are required"},
    ]);
  });

  it("sorts multiple collision groups deterministically", () => {
    const first = record({index: 2});
    const firstDuplicate = {...record({index: 2}), documentPath: `${first.documentPath}-z`};
    const second = record({index: 1});
    const secondDuplicate = {...record({index: 1}), documentPath: `${second.documentPath}-z`};

    const report = createRaceContentDryRun([first, firstDuplicate, second, secondDuplicate]);

    expect(report.collisions.map((collision) => collision.canonicalRiddleId)).toEqual(["classic:1", "classic:2"]);
  });

  it("sorts proposed writes, invalid records, and missing translations", () => {
    const legacy = (index: number, path: string, locale: SupportedLocale = "en"): ExistingRaceContentRecord => ({
      locale,
      documentPath: path,
      data: {classicIndex: index, answer: "piano"},
    });
    const invalid = (path: string): ExistingRaceContentRecord => ({
      locale: "en",
      documentPath: path,
      data: {},
    });

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
    expect(report.missingTranslations.map((item) => item.canonicalRiddleId)).toEqual(["classic:3", "classic:4"]);
  });
});

describe("race content pool validation", () => {
  it.each(RACE_CATEGORY_IDS)("rejects an undersized %s pool", (categoryId) => {
    const result = validateRacePool([record({categoryId})], {locale: "en", categoryId});
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "insufficient_pool")).toBe(true);
  });

  it("accepts a reviewed balanced 30-riddle pool", () => {
    const difficulties: RaceDifficultyBand[] = ["easy", "medium", "hard"];
    const records = Array.from({length: 30}, (_, index) =>
      record({
        index: index + 1,
        difficultyBand: difficulties[index % difficulties.length],
        text: `Unique clue ${index + 1} points along its own path`,
        answer: `a${String(index + 1).padStart(6, "0")}`,
      }),
    );
    const result = validateRacePool(records, {locale: "en", categoryId: "history"});
    expect(result.valid).toBe(true);
    expect(result.eligibleCount).toBe(30);
    expect(result.difficultyCounts).toEqual({easy: 10, medium: 10, hard: 10});
  });

  it("rejects duplicate, leaking, oversized, and untranslated content", () => {
    const duplicate = record({index: 2, text: "A piano has keys", answer: "piano"});
    duplicate.data.canonicalRiddleId = "classic:1";
    const records = [
      record({index: 1, text: "A piano has keys", answer: "piano"}),
      duplicate,
      record({index: 3, answer: "toolong8"}),
    ];
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

  it("rejects oversized pools", () => {
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
    const invalid = record();
    Object.assign(invalid.data, change);
    const result = validateRacePool([invalid], {locale: "en", categoryId: "history", poolSize: 1});
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "missing_metadata"})]));
  });

  it.each([4, "unknown"])("excludes content with invalid category %p", (categoryId) => {
    const invalid = record();
    invalid.data.categoryId = categoryId;
    const result = validateRacePool([invalid], {locale: "en", categoryId: "history", poolSize: 1});
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code: "insufficient_pool"})]));
  });
});

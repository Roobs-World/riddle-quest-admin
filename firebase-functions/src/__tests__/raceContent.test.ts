import {RACE_CATEGORY_IDS, type RaceCategoryId, type RaceDifficultyBand} from "@qwordly/core/race";
import type {SupportedLocale} from "@qwordly/core/validation";
import {
  createRaceContentDryRun,
  inferCanonicalRiddleId,
  inferRaceDifficulty,
  type ExistingRaceContentRecord,
} from "../race/raceContentMigration";
import {validateRacePool} from "../race/raceContentValidation";

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
});

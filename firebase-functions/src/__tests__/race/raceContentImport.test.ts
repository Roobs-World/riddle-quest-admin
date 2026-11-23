import {RACE_CATEGORY_IDS, type RaceCategoryId, type RaceDifficultyBand} from "../../../../src/races/contracts/index.js";
import easierEnglish from "../../../content/race-en-reviewed-v2.json";
import {createRaceContentImportPlan} from "../../race/content/raceContentImport";

/** Provides valid file behavior. */
const validFile = () => ({
  locale: "en" as const,
  riddles: RACE_CATEGORY_IDS.flatMap((categoryId: RaceCategoryId) =>
    Array.from({length: 30}, (_, index) => ({
      canonicalRiddleId: `${categoryId}:${index + 1}`,
      text: `Unique ${categoryId} clue number ${index + 1}`,
      answer: `${{history: "hi", geography: "ge", music: "mu", film: "fi", science: "sc", mixed: "mx"}[categoryId]}${String(index + 1).padStart(5, "0")}`,
      categoryId,
      difficultyBand: (["easy", "medium", "hard"] as RaceDifficultyBand[])[index % 3],
      qualityVersion: "reviewed_v1",
    })),
  ),
});

describe("English Race content import planning", () => {
  it("holds the filtered English source when geography lacks its tenth easy question", () => {
    /** Provides plan behavior. */
    const plan = createRaceContentImportPlan(easierEnglish);
    expect(plan.valid).toBe(false);
    expect(plan.totalRiddles).toBe(177);
    expect(plan.issues).toEqual([expect.objectContaining({code: "difficulty_imbalance"})]);
    expect(plan.records.filter((record) => record.data.qualityVersion === "reviewed_v2")).toHaveLength(58);
  });

  it("accepts exactly 30 reviewed riddles in each of the six categories", () => {
    /** Provides plan behavior. */
    const plan = createRaceContentImportPlan(validFile());
    expect(plan.valid).toBe(true);
    expect(plan.totalRiddles).toBe(180);
    expect(plan.categoryCounts).toEqual({history: 30, geography: 30, music: 30, film: 30, science: 30, mixed: 30});
    expect(new Set(plan.records.map((record) => record.documentPath)).size).toBe(180);
  });

  it("rejects answers beyond the current seven-character game limit", () => {
    /** Provides file behavior. */
    const file = validFile();
    file.riddles[0].answer = "eight888";
    /** Provides plan behavior. */
    const plan = createRaceContentImportPlan(file);
    expect(plan.valid).toBe(false);
    expect(plan.issues.some((issue) => issue.code === "answer_too_long")).toBe(true);
  });

  it("rejects duplicate content across categories", () => {
    /** Provides file behavior. */
    const file = validFile();
    file.riddles[30].answer = file.riddles[0].answer;
    file.riddles[30].text = file.riddles[0].text;
    file.riddles[30].canonicalRiddleId = file.riddles[0].canonicalRiddleId;
    /** Provides plan behavior. */
    const plan = createRaceContentImportPlan(file);
    expect(plan.valid).toBe(false);
    /** Provides codes behavior. */
    const codes = new Set(plan.issues.map((issue) => issue.code));
    expect(codes.has("duplicate_answer")).toBe(true);
    expect(codes.has("duplicate_question")).toBe(true);
    expect(codes.has("duplicate_canonical")).toBe(true);
  });
});

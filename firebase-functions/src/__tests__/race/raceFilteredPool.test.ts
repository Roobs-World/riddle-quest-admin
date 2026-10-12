import filteredEnglish from "../../../content/race-en-reviewed-v2.json";
import reviewedEnglish from "../../../content/archive/race-en-reviewed-v2-before-length-exclusions.json";
import {RACE_CATEGORY_IDS} from "@qwordly/core/race";
import {createRaceContentImportPlan} from "../../race/raceContentImport";
import {buildDeterministicRaceDeck} from "../../race/raceSetupService";

/** Canonical questions removed because faithful translated answers exceed seven slots. */
const exclusions = new Set(["race:geography:07", "race:geography:v2:17", "race:history:v2:20"]);

describe("race question removal", () => {
  it("removes only the three confirmed conflicts and preserves the remaining reviewed content", () => {
    expect(filteredEnglish.riddles).toEqual(reviewedEnglish.riddles.filter(({canonicalRiddleId}) => !exclusions.has(canonicalRiddleId)));
    expect(filteredEnglish.riddles).toHaveLength(177);
  });

  it("accepts reduced categories that can still supply the required race deck", () => {
    /** Reviewed source with one hard history question removed. */
    const historyReduced = {...reviewedEnglish, riddles: reviewedEnglish.riddles.filter(({canonicalRiddleId}) => canonicalRiddleId !== "race:history:v2:20")};
    /** Import plan for the reduced but playable category. */
    const plan = createRaceContentImportPlan(historyReduced);
    expect(plan.valid).toBe(true);
    expect(plan.totalRiddles).toBe(179);
    expect(plan.categoryCounts.history).toBe(29);
    for (const categoryId of RACE_CATEGORY_IDS) {
      /** Fifteen-question deck selected from the reduced category. */
      const deck = buildDeterministicRaceDeck(plan.records.filter(({data}) => data.categoryId === categoryId), {locale: "en", categoryId, seed: "filtered-content"});
      expect(deck.riddles).toHaveLength(15);
    }
  });

  it("keeps geography unavailable when exclusions leave only nine easy questions", () => {
    /** Import plan retaining the geography difficulty deficit. */
    const plan = createRaceContentImportPlan(filteredEnglish);
    expect(plan.valid).toBe(false);
    expect(plan.issues).toEqual([expect.objectContaining({code: "difficulty_imbalance", message: "easy has 9 riddles; at least 10 required"})]);
    expect(() => buildDeterministicRaceDeck(plan.records.filter(({data}) => data.categoryId === "geography"), {locale: "en", categoryId: "geography", seed: "filtered-content"})).toThrow("Race category is not ready");
  });

  it("rejects a category below the fifteen-question deck size", () => {
    /** Source whose history category contains fewer than fifteen questions. */
    const source = {...reviewedEnglish, riddles: reviewedEnglish.riddles.filter((riddle, index) => riddle.categoryId !== "history" || index < 14)};
    /** Import plan expected to reject the undersized history pool. */
    const plan = createRaceContentImportPlan(source);
    expect(plan.valid).toBe(false);
    expect(plan.issues.some(({code}) => code === "insufficient_pool")).toBe(true);
  });

  it("continues rejecting answers beyond seven slots after pool-size changes", () => {
    /** Source with an answer longer than the seven-slot limit. */
    const source = {...reviewedEnglish, riddles: reviewedEnglish.riddles.map((riddle, index) => index === 0 ? {...riddle, answer: "castillo"} : riddle)};
    expect(createRaceContentImportPlan(source).issues.some(({code}) => code === "answer_too_long")).toBe(true);
  });
});

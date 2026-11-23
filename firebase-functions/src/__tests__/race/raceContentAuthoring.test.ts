import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {RACE_CATEGORY_IDS} from "../../../../src/core/race/index.js";

/** Provides mock generate behavior. */
const mockGenerate = jest.fn();
jest.mock("../../riddles/openaiService", () => ({
  ...jest.requireActual<typeof import("../../riddles/openaiService")>("../../riddles/openaiService"),
  RIDDLE_GENERATION_MODEL: "gpt-6.1-sol",
  generateUniqueRiddle: (...args: unknown[]) => mockGenerate(...args),
}));

import {authorRaceContent} from "../../race/raceContentAuthoring";
import {createRaceContentImportPlan} from "../../race/raceContentImport";
import type {RaceContentImportFile} from "../../race/raceContentImport";

describe("multiplayer bank authoring", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    /** Provides index behavior. */
    let index = 0;
    mockGenerate.mockImplementation(async () => {
      index++;
      // Unique keyboard-compatible answers avoid depending on external models in these tests.
      return [
        `A distinct familiar subject described by clue ${index}.`,
        `z${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
      ];
    });
  });

  it("produces a valid full bank with only independently requested easy and medium cards", async () => {
    /** Provides progress behavior. */
    const progress = jest.fn();
    /** Provides bank behavior. */
    const bank = await authorRaceContent([{text: "A previous clue", answer: "old"}], progress);
    expect(createRaceContentImportPlan(bank).valid).toBe(true);
    expect(bank.riddles).toHaveLength(180);
    for (const category of RACE_CATEGORY_IDS) {
      /** Provides cards behavior. */
      const cards = bank.riddles.filter((card) => card.categoryId === category);
      expect(cards.filter((card) => card.difficultyBand === "easy")).toHaveLength(20);
      expect(cards.filter((card) => card.difficultyBand === "medium")).toHaveLength(10);
    }
    expect(bank.riddles.every((card) => card.qualityVersion === "reviewed_gpt-6.1-sol_v1")).toBe(true);
    expect(mockGenerate).toHaveBeenCalledWith(
      "en",
      expect.arrayContaining(["old"]),
      expect.objectContaining({
        mode: "multiplayer",
        categoryId: "history",
        difficulty: "easy",
        excludedQuestions: expect.arrayContaining(["A previous clue"]),
      }),
    );
    expect(progress).toHaveBeenLastCalledWith(180, 180);
  });

  it("retries rejected cards without publishing an incomplete bank", async () => {
    mockGenerate.mockResolvedValue(null);
    /** Provides progress behavior. */
    const progress = jest.fn();
    await expect(authorRaceContent([], progress)).rejects.toThrow("exhausted attempts for history slot 1");
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(progress).not.toHaveBeenCalled();
  });

  it("recovers from a rejected candidate and does not count it as an authored card", async () => {
    mockGenerate.mockResolvedValueOnce(null);
    /** Provides bank behavior. */
    const bank = await authorRaceContent();
    expect(bank.riddles).toHaveLength(180);
    expect(mockGenerate).toHaveBeenCalledTimes(181);
  });

  it("fails final validation rather than allowing duplicate answers into an import", async () => {
    mockGenerate.mockResolvedValue(["A familiar red fruit that grows on trees.", "apple"]);
    await expect(authorRaceContent()).rejects.toThrow("failed import validation");
  });

  it("resumes approved progress after an interruption without regenerating those cards", async () => {
    /** Provides completed behavior. */
    let completed: RaceContentImportFile["riddles"] = [];
    await expect(
      authorRaceContent([], undefined, {
        save: async (riddles) => {
          completed = riddles;
          if (riddles.length === 5) throw new Error("interrupted");
        },
      }),
    ).rejects.toThrow("interrupted");
    expect(completed).toHaveLength(5);
    /** Provides bank behavior. */
    const bank = await authorRaceContent([], undefined, {completed});
    expect(bank.riddles.slice(0, 5)).toEqual(completed);
    expect(mockGenerate).toHaveBeenCalledTimes(180);
    expect(createRaceContentImportPlan(bank).valid).toBe(true);
  });

  it("rejects stale checkpoint metadata before calling the model", async () => {
    /** Provides bank behavior. */
    const bank = await authorRaceContent();
    mockGenerate.mockClear();
    bank.riddles[0].difficultyBand = "hard";
    await expect(authorRaceContent([], undefined, {completed: bank.riddles})).rejects.toThrow(
      "Invalid race authoring checkpoint",
    );
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

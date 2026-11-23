import * as core from "..";
import * as game from "../game";
import * as pricing from "../pricing";
import * as validation from "../validation";

describe("public package barrels", () => {
  it("filters hosted keyboard input through the public game API", () => {
    for (const letter of ["i", "I", "İ", "ı"]) {
      expect(game.isSinglePlayerKeyboardLetter(letter)).toBe(true);
    }
    for (const input of ["Enter", "Backspace", "ii", "", null]) {
      expect(game.isSinglePlayerKeyboardLetter(input)).toBe(false);
    }
  });

  it("exposes the supported Core APIs", () => {
    expect(core.GameEngine).toBe(game.GameEngine);
    expect(core.parseProductPricing).toBe(pricing.parseProductPricing);
    expect(core.PlayerSchema).toBe(validation.PlayerSchema);
    expect(core.RaceRunViewSchema).toBeDefined();
    expect(game.computeFeedback).toBeDefined();
    expect(game.computeLetterStates).toBeDefined();
    expect(game.isValidGuess).toBeDefined();
    expect(game.computeGuestCompletionRewards).toBeDefined();
    expect(game.splitGraphemes).toBeDefined();
    expect([...game.iterateGraphemes("a\u0301👩‍🚀")]).toEqual(["á", "👩‍🚀"]);
    expect(game.lowerCaseGraphemes).toBeDefined();
    expect(game.graphemeLength).toBeDefined();
    expect(game.countCoinRewardAchievements).toBe(core.countCoinRewardAchievements);
    expect(game.findNewMilestoneAchievementIds).toBe(core.findNewMilestoneAchievementIds);
    expect(game.ACHIEVEMENT_MILESTONES).toBe(core.ACHIEVEMENT_MILESTONES);
    expect(game.MAX_RIDDLE_ANSWER_CHARACTERS).toBeGreaterThan(0);
  });
});

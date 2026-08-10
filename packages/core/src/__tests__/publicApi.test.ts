import * as core from "../index";
import * as game from "../game";
import * as pricing from "../pricing";
import * as validation from "../validation";

describe("public package barrels", () => {
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
    expect(game.lowerCaseGraphemes).toBeDefined();
    expect(game.graphemeLength).toBeDefined();
    expect(game.MAX_RIDDLE_ANSWER_CHARACTERS).toBeGreaterThan(0);
  });
});

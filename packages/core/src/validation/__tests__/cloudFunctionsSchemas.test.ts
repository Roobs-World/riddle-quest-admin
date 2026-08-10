import {
  BackendGameModeSchema,
  CompleteGameInputSchema,
  CompleteGameOutputSchema,
  DailyChallengeQuestionSchema,
} from "../cloudFunctionsSchemas";

describe("shared Cloud Functions schemas", () => {
  it("validates completion inputs and outputs", () => {
    expect(BackendGameModeSchema.parse("classic")).toBe("classic");
    expect(CompleteGameInputSchema.parse({riddleId: "r1", gameMode: "challenge", attempts: 1, isCorrect: true}))
      .toBeDefined();
    expect(CompleteGameOutputSchema.parse({coinsEarned: 10, newlyUnlockedAchievementIds: []})).toBeDefined();
  });

  it("validates daily challenge questions and rejects invalid completion attempts", () => {
    expect(DailyChallengeQuestionSchema.parse({riddleId: "r1", text: "clue", answer: "word", questionNumber: 1}))
      .toBeDefined();
    expect(CompleteGameInputSchema.safeParse({riddleId: "r1", gameMode: "classic", attempts: 0, isCorrect: false}).success)
      .toBe(false);
  });
});

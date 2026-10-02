import {
  BackendGameModeSchema,
  CompleteGameInputSchema,
  CompleteGameOutputSchema,
  DailyChallengeQuestionSchema,
  SubmitSinglePlayerGuessInputSchema,
  SubmitSinglePlayerGuessOutputSchema,
} from "../cloudFunctionsSchemas";

describe("shared Cloud Functions schemas", () => {
  /** Provides session token behavior. */
  const sessionToken = "00000000-0000-4000-8000-000000000001";

  it("validates completion inputs and outputs", () => {
    expect(BackendGameModeSchema.parse("classic")).toBe("classic");
    expect(CompleteGameInputSchema.parse({riddleId: "r1", gameMode: "challenge", sessionToken})).toBeDefined();
    expect(
      CompleteGameOutputSchema.parse({
        attempts: 1,
        isCorrect: true,
        coinsEarned: 10,
        newlyUnlockedAchievementIds: [],
      }),
    ).toBeDefined();
  });

  it("validates daily challenge questions and rejects invalid completion attempts", () => {
    expect(
      DailyChallengeQuestionSchema.parse({
        riddleId: "r1",
        text: "clue",
        answerLength: 4,
        sessionToken,
        questionNumber: 1,
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      }),
    ).toBeDefined();
    expect(
      DailyChallengeQuestionSchema.safeParse({
        riddleId: "r1",
        text: "clue",
        answerLength: 4,
        sessionToken,
        questionNumber: 1,
        attemptsUsed: 5,
        hasUsedContinue: false,
        awaitingContinue: true,
      }).success,
    ).toBe(true);
    for (const continueState of [
      {attemptsUsed: 6, hasUsedContinue: false, awaitingContinue: false},
      {attemptsUsed: 5, hasUsedContinue: false, awaitingContinue: false},
      {attemptsUsed: 4, hasUsedContinue: true, awaitingContinue: false},
    ] as const) {
      expect(
        DailyChallengeQuestionSchema.safeParse({
          riddleId: "r1",
          text: "clue",
          answerLength: 4,
          sessionToken,
          questionNumber: 1,
          ...continueState,
        }).success,
      ).toBe(false);
    }
    expect(
      CompleteGameInputSchema.safeParse({
        riddleId: "r1",
        gameMode: "classic",
        sessionToken,
        attempts: 0,
        isCorrect: false,
      }).success,
    ).toBe(false);
  });

  it("enforces direct Cloud Function size bounds", () => {
    /** Provides input behavior. */
    const input = {
      riddleId: "r1",
      gameMode: "classic",
      sessionToken,
      requestId: "guess-request-1",
      guess: "piano",
    };
    expect(SubmitSinglePlayerGuessInputSchema.safeParse(input).success).toBe(true);
    expect(SubmitSinglePlayerGuessInputSchema.safeParse({...input, guess: "abcdefgh"}).success).toBe(false);
    for (const guess of ["pi ano", "pi\nno", "pïano", "🎹"] as const) {
      expect(SubmitSinglePlayerGuessInputSchema.safeParse({...input, guess}).success).toBe(false);
    }
    expect(SubmitSinglePlayerGuessInputSchema.safeParse({...input, riddleId: "r".repeat(161)}).success).toBe(false);
    expect(
      SubmitSinglePlayerGuessOutputSchema.safeParse({
        feedback: Array.from({length: 8}, () => ({letter: "a", status: "red"})),
        attempts: 1,
        isCorrect: false,
        gameOver: false,
      }).success,
    ).toBe(false);
  });
});

it("rejects inconsistent recovery hints and guesses without discarding valid progress", () => {
  /** Provides question behavior. */
  const question = {riddleId: "r1", text: "clue", answerLength: 4,
    sessionToken: "00000000-0000-4000-8000-000000000001", questionNumber: 1,
    attemptsUsed: 1, hasUsedContinue: false, awaitingContinue: false};
  /** Provides feedback behavior. */
  const feedback = [..."tree"].map(letter => ({letter, status: "red"}));
  /** Provides accepted guesses behavior. */
  const acceptedGuesses = [{attempt: 1, feedback}];
  expect(DailyChallengeQuestionSchema.safeParse({...question, acceptedGuesses}).success).toBe(true);
  expect(DailyChallengeQuestionSchema.safeParse({...question, acceptedGuesses: []}).success).toBe(false);
  expect(DailyChallengeQuestionSchema.safeParse({...question, acceptedGuesses: [{...acceptedGuesses[0], feedback: feedback.slice(1)}]}).success).toBe(false);
  expect(DailyChallengeQuestionSchema.safeParse({...question, revealedHints: [{index: 0, letter: "t"}]}).success).toBe(true);
  expect(DailyChallengeQuestionSchema.safeParse({...question, revealedHints: [{index: 4, letter: "t"}]}).success).toBe(false);
});

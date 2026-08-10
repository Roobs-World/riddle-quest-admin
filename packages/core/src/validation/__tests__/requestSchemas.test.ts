import {
  BasicSuccessMessageResponseSchema,
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
  FeedbackItemSchema,
  GetCurrentDailyChallengeResponseSchema,
  GetHintRequestSchema,
  GetHintResponseSchema,
  GetLeaderboardRequestSchema,
  GetLeaderboardResponseSchema,
  SkipRiddleRequestSchema,
  SkipRiddleResponseSchema,
  SpendCoinsRequestSchema,
  SpendCoinsResponseSchema,
  SubmitGuessAuthContextSchema,
  SubmitGuessRequestDataSchema,
  SubmitGuessResponseDataSchema,
  UpdateAvatarRequestSchema,
  UpdateAvatarResponseSchema,
  UpdateUsernameRequestSchema,
} from "../requestSchemas";

describe("callable request and response schemas", () => {
  it("accepts valid gameplay contracts", () => {
    expect(BasicSuccessMessageResponseSchema.parse({success: true, message: "ok"})).toBeDefined();
    expect(FeedbackItemSchema.parse({letter: "a", status: "green"})).toBeDefined();
    expect(SubmitGuessRequestDataSchema.parse({guess: "piano", riddleId: "r1", gameMode: "classic", attempts: 1}))
      .toBeDefined();
    expect(SubmitGuessAuthContextSchema.parse({uid: "u1"})).toBeDefined();
    expect(SubmitGuessResponseDataSchema.parse({feedback: [], isCorrect: false, gameOver: false})).toBeDefined();
    expect(CompleteGameRequestDataSchema.parse({riddleId: "r1", gameMode: "challenge", attempts: 2, isCorrect: true}))
      .toBeDefined();
    expect(CompleteGameResponseDataSchema.parse({
      coinsEarned: 5,
      newlyUnlockedAchievementIds: [],
      scoreEarned: 100,
      xpEarned: 10,
      newXp: 20,
      newLevel: 2,
      leveledUp: true,
    })).toBeDefined();
  });

  it("accepts daily, hint, skip, and currency contracts", () => {
    expect(GetCurrentDailyChallengeResponseSchema.parse({
      challenge: {questions: [{riddleId: "r1", text: "clue", answer: "word", questionNumber: 1}], totalQuestions: 1},
    })).toBeDefined();
    expect(SkipRiddleRequestSchema.parse({riddleId: "r1", gameMode: "classic"})).toBeDefined();
    expect(SkipRiddleResponseSchema.parse({success: true, newProgress: null, message: "ok", costDeducted: 5}))
      .toBeDefined();
    expect(SpendCoinsRequestSchema.parse({reason: "hint"})).toBeDefined();
    expect(SpendCoinsResponseSchema.parse({newCoins: 10})).toBeDefined();
    expect(GetHintRequestSchema.parse({currentAttempt: ["a"], riddleId: "r1", gameMode: "challenge"}))
      .toBeDefined();
    expect(GetHintResponseSchema.parse(null)).toBeNull();
  });

  it("accepts profile and leaderboard contracts and applies defaults", () => {
    expect(UpdateUsernameRequestSchema.parse({username: "player"})).toBeDefined();
    const imageDataUrl = "data:image/png;base64,YQ==";
    expect(UpdateAvatarRequestSchema.parse({imageDataUrl})).toBeDefined();
    expect(UpdateAvatarResponseSchema.parse({success: true, message: "ok", avatarUrl: "https://example.com/a.png"}))
      .toBeDefined();
    expect(GetLeaderboardRequestSchema.parse(undefined)).toEqual({type: "xp"});
    expect(GetLeaderboardResponseSchema.parse({entries: [], requestingUserId: "u1"})).toBeDefined();
  });

  it("rejects malformed and unknown fields", () => {
    expect(SubmitGuessRequestDataSchema.safeParse({guess: "", unexpected: true}).success).toBe(false);
    expect(UpdateAvatarRequestSchema.safeParse({imageDataUrl: "http://example.com/a.png"}).success).toBe(false);
    expect(GetLeaderboardRequestSchema.safeParse({type: "coins"}).success).toBe(false);
  });
});

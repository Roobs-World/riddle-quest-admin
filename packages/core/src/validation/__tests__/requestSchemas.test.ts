import {
  BasicSuccessMessageResponseSchema,
  CompleteGameRequestDataSchema,
  CompleteGameResponseDataSchema,
  DailyChallengeDataSchema,
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
  SubmitSinglePlayerGuessRequestDataSchema,
  SubmitSinglePlayerGuessResponseDataSchema,
  UpdateAvatarRequestSchema,
  UpdateAvatarResponseSchema,
  UpdateUsernameRequestSchema,
} from "../requestSchemas";

describe("callable request and response schemas", () => {
  /** Provides session token behavior. */
  const sessionToken = "00000000-0000-4000-8000-000000000001";

  it("accepts valid gameplay contracts", () => {
    expect(BasicSuccessMessageResponseSchema.parse({success: true, message: "ok"})).toBeDefined();
    expect(FeedbackItemSchema.parse({letter: "a", status: "green"})).toBeDefined();
    expect(
      SubmitGuessRequestDataSchema.parse({guess: "piano", riddleId: "r1", gameMode: "classic", attempts: 1}),
    ).toBeDefined();
    expect(SubmitGuessAuthContextSchema.parse({uid: "u1"})).toBeDefined();
    expect(SubmitGuessResponseDataSchema.parse({feedback: [], isCorrect: false, gameOver: false})).toBeDefined();
    expect(CompleteGameRequestDataSchema.parse({riddleId: "r1", gameMode: "challenge", sessionToken})).toBeDefined();
    expect(
      CompleteGameResponseDataSchema.parse({
        attempts: 2,
        isCorrect: true,
        coinsEarned: 5,
        newlyUnlockedAchievementIds: [],
        scoreEarned: 100,
        xpEarned: 10,
        newXp: 20,
        newLevel: 2,
        leveledUp: true,
        rewardBreakdown: {
          baseWinCoins: 5,
          levelUpBonus: 0,
          dailyStreakBonus: 0,
          achievementBonus: 0,
          referralBonus: 100,
          totalAwarded: 105,
          newBalance: 405,
        },
      }),
    ).toBeDefined();
  });

  it("accepts optional canonical Classic progress while rejecting invalid positions", () => {
    expect(GetCurrentDailyChallengeResponseSchema.parse({classicIndex: 17})).toEqual({classicIndex: 17});
    for (const classicIndex of [0, -1, 1.5, "17"]) {
      expect(GetCurrentDailyChallengeResponseSchema.safeParse({classicIndex}).success).toBe(false);
    }
    expect(GetCurrentDailyChallengeResponseSchema.parse({})).toEqual({});
  });

  it("accepts daily, hint, skip, and currency contracts", () => {
    expect(
      GetCurrentDailyChallengeResponseSchema.parse({
        challenge: {
          questions: [
            {
              riddleId: "r1",
              text: "clue",
              answerLength: 4,
              sessionToken,
              questionNumber: 1,
              attemptsUsed: 0,
              hasUsedContinue: false,
              awaitingContinue: false,
            },
          ],
          totalQuestions: 1,
        },
      }),
    ).toBeDefined();
    expect(
      SkipRiddleRequestSchema.parse({
        riddleId: "r1",
        gameMode: "classic",
        sessionToken,
        requestId: "skip-request-1",
      }),
    ).toBeDefined();
    expect(
      SkipRiddleResponseSchema.parse({success: true, newProgress: null, message: "ok", costDeducted: 5, newCoins: 10}),
    ).toBeDefined();
    expect(
      SpendCoinsRequestSchema.parse({
        reason: "continue",
        gameMode: "classic",
        riddleId: "r1",
        sessionToken,
        requestId: "continue-request-1",
      }),
    ).toBeDefined();
    expect(SpendCoinsResponseSchema.parse({newCoins: 10})).toBeDefined();
    expect(
      GetHintRequestSchema.parse({
        currentAttempt: ["a"],
        riddleId: "r1",
        gameMode: "challenge",
        sessionToken,
        requestId: "hint-request-1",
      }),
    ).toBeDefined();
    expect(GetHintResponseSchema.parse(null)).toBeNull();
  });

  it("accepts profile and leaderboard contracts and applies defaults", () => {
    expect(UpdateUsernameRequestSchema.parse({username: "player"})).toBeDefined();
    expect(UpdateUsernameRequestSchema.parse({username: "  player  "})).toEqual({username: "player"});
    expect(UpdateUsernameRequestSchema.parse({username: "  Łukasz O’Neil  "})).toEqual({
      username: "Łukasz O’Neil",
    });
    expect(UpdateUsernameRequestSchema.parse({username: "  Ｎóva  "})).toEqual({username: "Nóva"});
    expect(() => UpdateUsernameRequestSchema.parse({username: "x".repeat(25)})).toThrow();
    expect(UpdateUsernameRequestSchema.safeParse({username: "x".repeat(97)}).success).toBe(false);
    for (const username of ["Ali\nce", "Ali\u0000ce", "Ali\u202Ece", "<b>", "___"]) {
      expect(UpdateUsernameRequestSchema.safeParse({username}).success).toBe(false);
    }
    /** Provides image data url behavior. */
    const imageDataUrl = "data:image/png;base64,YQ==";
    expect(UpdateAvatarRequestSchema.parse({imageDataUrl})).toBeDefined();
    expect(
      UpdateAvatarResponseSchema.parse({success: true, message: "ok", avatarUrl: "https://example.com/a.png"}),
    ).toBeDefined();
    expect(GetLeaderboardRequestSchema.parse(undefined)).toEqual({type: "xp"});
    expect(GetLeaderboardResponseSchema.parse({entries: [], requestingUserId: "u1"})).toBeDefined();
  });

  it("rejects malformed and unknown fields", () => {
    expect(SubmitGuessRequestDataSchema.safeParse({guess: "", unexpected: true}).success).toBe(false);
    expect(UpdateAvatarRequestSchema.safeParse({imageDataUrl: "http://example.com/a.png"}).success).toBe(false);
    expect(GetLeaderboardRequestSchema.safeParse({type: "coins"}).success).toBe(false);
    expect(
      CompleteGameRequestDataSchema.safeParse({
        riddleId: "r1",
        gameMode: "classic",
        sessionToken,
        attempts: 1,
        isCorrect: true,
      }).success,
    ).toBe(false);
  });

  it("bounds authenticated single-player payload work", () => {
    /** Provides request behavior. */
    const request = {
      riddleId: "r1",
      gameMode: "classic" as const,
      sessionToken,
      requestId: "guess-request-1",
      guess: "piano",
    };
    expect(SubmitSinglePlayerGuessRequestDataSchema.safeParse(request).success).toBe(true);
    expect(SubmitSinglePlayerGuessRequestDataSchema.safeParse({...request, riddleId: "r".repeat(161)}).success).toBe(
      false,
    );
    expect(SubmitSinglePlayerGuessRequestDataSchema.safeParse({...request, guess: "abcdefgh"}).success).toBe(false);
    for (const guess of ["pi ano", "pi\nno", "pïano", "🎹"] as const) {
      expect(SubmitSinglePlayerGuessRequestDataSchema.safeParse({...request, guess}).success).toBe(false);
    }
    expect(
      SubmitSinglePlayerGuessResponseDataSchema.safeParse({
        feedback: Array.from({length: 8}, () => ({letter: "a", status: "red"})),
        attempts: 1,
        isCorrect: false,
        gameOver: false,
      }).success,
    ).toBe(false);
    expect(
      GetHintRequestSchema.safeParse({
        riddleId: "r1",
        gameMode: "classic",
        sessionToken,
        requestId: "hint-request-1",
        currentAttempt: Array.from({length: 8}, () => ""),
      }).success,
    ).toBe(false);
    /** Provides question behavior. */
    const question = {riddleId: "r1", text: "clue", answerLength: 4, sessionToken, questionNumber: 1};
    expect(DailyChallengeDataSchema.safeParse({questions: [question, question], totalQuestions: 1}).success).toBe(
      false,
    );
    expect(GetLeaderboardRequestSchema.safeParse({type: "xp", limit: 101}).success).toBe(false);
  });
});

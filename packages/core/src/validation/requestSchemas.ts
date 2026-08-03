import {z} from "zod";
import {DailyChallengeQuestionSchema} from "./cloudFunctionsSchemas";

const FunctionGameModeSchema = z.enum(["challenge", "classic"]);

export const BasicSuccessMessageResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .strict();

export const FeedbackColorValueSchema = z.enum(["green", "yellow", "red"]);
export type FeedbackColorValue = z.infer<typeof FeedbackColorValueSchema>;

export const FeedbackItemSchema = z
  .object({
    letter: z.string().length(1),
    status: FeedbackColorValueSchema,
  })
  .strict();
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

export const SubmitGuessRequestDataSchema = z
  .object({
    guess: z.string().min(1),
    riddleId: z.string().min(1),
    gameMode: z.enum(["challenge", "classic"]),
    attempts: z.number().int().positive(),
  })
  .strict();
export type SubmitGuessRequestData = z.infer<typeof SubmitGuessRequestDataSchema>;

export const SubmitGuessAuthContextSchema = z
  .object({
    uid: z.string().min(1),
    isAnonymous: z.boolean().optional(),
  })
  .strict();
export type SubmitGuessAuthContext = z.infer<typeof SubmitGuessAuthContextSchema>;

export const SubmitGuessResponseDataSchema = z
  .object({
    feedback: z.array(FeedbackItemSchema),
    isCorrect: z.boolean(),
    gameOver: z.boolean(),
    correctAnswer: z.string().optional(),
    coinsEarned: z.number().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
    newWinStreak: z.number().int().nonnegative().optional(),
  })
  .strict();
export type SubmitGuessResponseData = z.infer<typeof SubmitGuessResponseDataSchema>;

export const CompleteGameRequestDataSchema = z
  .object({
    riddleId: z.string().min(1),
    gameMode: z.enum(["challenge", "classic"]),
    attempts: z.number().int().positive().max(100),
    isCorrect: z.boolean(),
  })
  .strict();
export type CompleteGameRequestData = z.infer<typeof CompleteGameRequestDataSchema>;

export const CompleteGameResponseDataSchema = z
  .object({
    coinsEarned: z.number().nonnegative(),
    newlyUnlockedAchievementIds: z.array(z.string()),
    scoreEarned: z.number().nonnegative(),
    xpEarned: z.number().nonnegative(),
    newXp: z.number().nonnegative(),
    newLevel: z.number().int().positive(),
    leveledUp: z.boolean(),
    newWinStreak: z.number().int().nonnegative().optional(),
    rewardBreakdown: z
      .object({
        baseWinCoins: z.number().nonnegative(),
        levelUpBonus: z.number().nonnegative(),
        dailyStreakBonus: z.number().nonnegative(),
        achievementBonus: z.number().nonnegative(),
        totalAwarded: z.number().nonnegative(),
        newBalance: z.number().nonnegative(),
      })
      .optional(),
  })
  .strict();
export type CompleteGameResponseData = z.infer<typeof CompleteGameResponseDataSchema>;

export const DailyChallengeDataSchema = z
  .object({
    date: z.string().optional(),
    questions: z.array(DailyChallengeQuestionSchema),
    totalQuestions: z.number().int().positive(),
  })
  .strict();

export const GetCurrentDailyChallengeResponseSchema = z
  .object({
    challenge: DailyChallengeDataSchema.optional(),
    currentQuestion: z.number().int().nonnegative().optional(),
    hasCompletedToday: z.boolean().optional(),
    questionsCompleted: z.number().int().nonnegative().optional(),
    error: z.string().optional(),
  })
  .strict();
export type GetCurrentDailyChallengeResponse = z.infer<typeof GetCurrentDailyChallengeResponseSchema>;

export const SkipRiddleRequestSchema = z
  .object({
    riddleId: z.string().min(1),
    gameMode: FunctionGameModeSchema,
  })
  .strict();
export type SkipRiddleRequest = z.infer<typeof SkipRiddleRequestSchema>;

const PlayerProgressPatchSchema = z
  .object({
    classicIndex: z.number().int().nonnegative().optional(),
    dailyChallengeIndex: z.number().int().nonnegative().optional(),
    dailyChallengeCurrentQuestion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const SkipRiddleResponseSchema = z
  .object({
    success: z.boolean(),
    newProgress: PlayerProgressPatchSchema.nullish(),
    message: z.string(),
    costDeducted: z.number().int().nonnegative(),
  })
  .strict();
export type SkipRiddleResponse = z.infer<typeof SkipRiddleResponseSchema>;

export const SpendCoinsRequestSchema = z
  .object({
    reason: z.enum(["hint", "skip", "continue"]),
    gameMode: z.enum(["classic", "challenge"]).optional(),
    amount: z.number().positive().optional(),
  })
  .strict();
export type SpendCoinsRequest = z.infer<typeof SpendCoinsRequestSchema>;

export const SpendCoinsResponseSchema = z
  .object({
    newCoins: z.number().int().nonnegative(),
  })
  .strict();

export const GetHintRequestSchema = z
  .object({
    currentAttempt: z.array(z.string().length(1)),
    riddleId: z.string().min(1),
    gameMode: FunctionGameModeSchema,
  })
  .strict();

export const GetHintResponseSchema = z
  .object({
    revealedLetter: z.string().length(1),
    index: z.number().int().nonnegative(),
    coinsCost: z.number().int().nonnegative(),
    newCoins: z.number().int().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
  })
  .nullable();

export const UpdateUsernameRequestSchema = z
  .object({
    username: z.string().min(3),
  })
  .strict();

export const UpdateAvatarRequestSchema = z
  .object({
    imageDataUrl: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export const UpdateAvatarResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
    avatarUrl: z.string().url(),
  })
  .strict();

export const LeaderboardTypeSchema = z.enum(["xp", "totalWins", "bestStreak"]);
export type LeaderboardType = z.infer<typeof LeaderboardTypeSchema>;

export const GetLeaderboardRequestSchema = z
  .object({
    type: LeaderboardTypeSchema.default("xp"),
    limit: z.number().int().positive().optional(),
  })
  .strict()
  .default({type: "xp"});
export type GetLeaderboardRequest = z.infer<typeof GetLeaderboardRequestSchema>;

export const LeaderboardEntrySchema = z
  .object({
    userId: z.string().min(1),
    username: z.string().min(1),
    avatarUrl: z.string().optional(),
    level: z.number().int().positive(),
    xp: z.number().int().nonnegative(),
    progressScore: z.number().nonnegative(),
    totalWins: z.number().int().nonnegative(),
    bestStreak: z.number().int().nonnegative(),
    updatedAt: z.number().nonnegative(),
  })
  .strict();
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const GetLeaderboardResponseSchema = z
  .object({
    entries: z.array(LeaderboardEntrySchema),
    requestingUserId: z.string().min(1),
  })
  .strict();
export type GetLeaderboardResponse = z.infer<typeof GetLeaderboardResponseSchema>;

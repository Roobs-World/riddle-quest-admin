import {z} from "zod";
import {PlayerSchema, type Player} from "./firestoreSchemas";

export const EmptyRequestDataSchema = z.union([z.object({}).strict(), z.undefined(), z.null()]).transform(() => ({}));

export const BooleanResponseSchema = z.boolean();

export const MessageResponseSchema = z
  .object({
    message: z.string(),
  })
  .strict();

export const BasicSuccessMessageResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .strict();

export const GameModeSchema = z.enum(["challenge", "classic"]);

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
    gameMode: GameModeSchema,
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
    gameMode: GameModeSchema,
    attempts: z.number().int().positive(),
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
    // Reward breakdown for UI display
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

export const HasCompletedDailyChallengeRequestSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();
export type HasCompletedDailyChallengeRequest = z.infer<typeof HasCompletedDailyChallengeRequestSchema>;

export const DailyChallengeQuestionSchema = z
  .object({
    riddleId: z.string().min(1),
    text: z.string().min(1),
    questionNumber: z.number().int().positive(),
  })
  .strict();

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

export const AdvanceDailyChallengeProgressResponseSchema = z
  .object({
    newQuestionIndex: z.number().int().nonnegative(),
    isFullyCompleted: z.boolean(),
    message: z.string(),
  })
  .strict();

export const SkipRiddleRequestSchema = z
  .object({
    riddleId: z.string().min(1),
    gameMode: GameModeSchema,
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
    gameMode: GameModeSchema.optional(),
    amount: z.number().positive().optional(), // Legacy: validated against calculated cost server-side
  })
  .strict();
export type SpendCoinsRequest = z.infer<typeof SpendCoinsRequestSchema>;

export const SpendCoinsResponseSchema = z
  .object({
    newCoins: z.number().int().nonnegative(),
  })
  .strict();

export const RewardedAdPlacementSchema = z.enum(["loss_continue", "coin_shop"]);
export type RewardedAdPlacement = z.infer<typeof RewardedAdPlacementSchema>;

export const AwardedAdCallbackRequestSchema = z
  .object({
    userId: z.string().min(1),
    placement: RewardedAdPlacementSchema,
    callbackId: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict();
export type AwardedAdCallbackRequest = z.infer<typeof AwardedAdCallbackRequestSchema>;

export const AwardedAdCallbackResponseSchema = z
  .object({
    success: z.boolean(),
    placement: RewardedAdPlacementSchema,
    callbackId: z.string().min(1),
    rewardCoins: z.number().int().nonnegative(),
    newCoins: z.number().int().nonnegative(),
    alreadyProcessed: z.boolean(),
    message: z.string(),
  })
  .strict();
export type AwardedAdCallbackResponse = z.infer<typeof AwardedAdCallbackResponseSchema>;

export const UpdateAvatarRequestSchema = z
  .object({
    avatarUrl: z.string().min(1),
  })
  .strict();

export const UpdateUsernameRequestSchema = z
  .object({
    username: z.string().min(3),
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

export const GenerateTodaysDailyChallengeRequestSchema = z
  .object({
    forceGenerate: z.boolean().optional(),
  })
  .strict()
  .default({});

export const GenerateTodaysDailyChallengeResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    questionsGenerated: z.number().int().nonnegative(),
  })
  .strict();

export const GenerateRiddlesResponseSchema = BasicSuccessMessageResponseSchema;

export const InitializeRiddleDatabaseResponseSchema = BasicSuccessMessageResponseSchema.extend({
  riddlesGenerated: z.number().int().nonnegative(),
}).strict();

export const ValidatePurchaseRequestSchema = z
  .object({
    purchaseToken: z.string().min(1),
    productId: z.string().min(1),
    platform: z.enum(["ios", "android"]),
  })
  .strict();
export type ValidatePurchaseRequest = z.infer<typeof ValidatePurchaseRequestSchema>;

export const ValidatePurchaseResponseSchema = z
  .object({
    success: z.boolean(),
    newCoins: z.number().int().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
  })
  .strict();

export const GrantDevCoinsForPurchaseRequestSchema = z
  .object({
    productId: z.string().min(1),
  })
  .strict();

export const GrantDevCoinsForPurchaseResponseSchema = z
  .object({
    success: z.boolean(),
    newCoins: z.number().int().nonnegative(),
    coinsAwarded: z.number().int().nonnegative(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
  })
  .strict();

export const InitializeUserRequestDataSchema = z
  .object({
    email: z.string().email(),
    username: z.string().min(1),
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
    seed: z
      .custom<
        Partial<Player>
      >((value) => value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value)))
      .optional(),
  })
  .strict();
export type InitializeUserRequestData = z.infer<typeof InitializeUserRequestDataSchema>;

export const InitializeUserResponseDataSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    userId: z.string().min(1),
    player: PlayerSchema,
  })
  .strict();
export type InitializeUserResponseData = z.infer<typeof InitializeUserResponseDataSchema>;

export const DeleteAccountResponseDataSchema = BasicSuccessMessageResponseSchema;
export type DeleteAccountResponseData = z.infer<typeof DeleteAccountResponseDataSchema>;

export const UpdateUserStatsRequestDataSchema = z
  .object({
    targetUserId: z.string().min(1),
    statsUpdate: z
      .object({
        dailyPuzzlesCompleted: z.number().optional(),
        bestStreak: z.number().optional(),
        totalWordsGuessed: z.number().optional(),
        winRate: z.number().optional(),
        averageGuesses: z.number().optional(),
        totalScore: z.number().optional(),
        highestLevelClassic: z.number().optional(),
        gamesPlayed: z.number().optional(),
        wins: z.number().optional(),
        challengeWins: z.number().optional(),
        winStreak: z.number().optional(),
        totalWins: z.number().optional(),
        totalGuessesInWins: z.number().optional(),
      })
      .strict(),
  })
  .strict();
export type UpdateUserStatsRequestData = z.infer<typeof UpdateUserStatsRequestDataSchema>;

import {z} from "zod";
import {DailyChallengeQuestionSchema} from "./cloudFunctionsSchemas";

/** Minimum number of Unicode code points accepted in a normalized username. */
export const USERNAME_MIN_LENGTH = 3;
/** Maximum number of Unicode code points accepted in a normalized username. */
export const USERNAME_MAX_LENGTH = 24;
/** Maximum untrusted UTF-16 input units processed before Unicode normalization. */
export const USERNAME_RAW_MAX_LENGTH = 96;

/** Normalizes a display username without applying its uniqueness case fold. */
export function normalizeUsernameDisplay(username: string): string {
  return username.trim().normalize("NFKC");
}

/** Validates the shared browser/bridge/callable username boundary. */
export const UsernameSchema = z
  .string()
  .max(USERNAME_RAW_MAX_LENGTH, "Username input is too large.")
  .refine((username) => !/[\p{Cc}\p{Cf}]/u.test(username), {
    message: "Username must not contain control or formatting characters.",
  })
  .transform(normalizeUsernameDisplay)
  .refine(
    (username) => {
      /** Provides length behavior. */
      const length = [...username].length;
      return length >= USERNAME_MIN_LENGTH && length <= USERNAME_MAX_LENGTH;
    },
    {message: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`},
  )
  .refine((username) => /^[\p{L}\p{M}\p{N} ._'’-]+$/u.test(username), {
    message: "Username contains unsupported characters.",
  })
  .refine((username) => /[\p{L}\p{N}]/u.test(username), {
    message: "Username must contain a letter or number.",
  });

/** Validates the function game mode data shape. */
const FunctionGameModeSchema = z.enum(["challenge", "classic"]);
/** Bounds canonical riddle identifiers accepted by gameplay callables. */
const RiddleIdSchema = z.string().min(1).max(160);
/** Bounds guesses to the shipped seven-keyboard-slot policy. */
const PlayableGuessSchema = z
  .string()
  .min(1)
  .max(7)
  .regex(/^[a-z]+$/i);

/** Validates the basic success message response data shape. */
export const BasicSuccessMessageResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .strict();

/** Validates the feedback color value data shape. */
export const FeedbackColorValueSchema = z.enum(["green", "yellow", "red"]);
/** Describes feedback color value. */
export type FeedbackColorValue = z.infer<typeof FeedbackColorValueSchema>;

/** Validates the feedback item data shape. */
export const FeedbackItemSchema = z
  .object({
    letter: z.string().length(1),
    status: FeedbackColorValueSchema,
  })
  .strict();
/** Describes feedback item. */
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

/** Validates the submit guess request data data shape. */
export const SubmitGuessRequestDataSchema = z
  .object({
    guess: PlayableGuessSchema,
    riddleId: RiddleIdSchema,
    gameMode: z.enum(["challenge", "classic"]),
    attempts: z.number().int().positive().max(6),
  })
  .strict();
/** Describes submit guess request data. */
export type SubmitGuessRequestData = z.infer<typeof SubmitGuessRequestDataSchema>;

/** Validates the submit guess auth context data shape. */
export const SubmitGuessAuthContextSchema = z
  .object({
    uid: z.string().min(1),
    isAnonymous: z.boolean().optional(),
  })
  .strict();
/** Describes submit guess auth context. */
export type SubmitGuessAuthContext = z.infer<typeof SubmitGuessAuthContextSchema>;

/** Validates the submit guess response data data shape. */
export const SubmitGuessResponseDataSchema = z
  .object({
    feedback: z.array(FeedbackItemSchema).max(7),
    isCorrect: z.boolean(),
    gameOver: z.boolean(),
    coinsEarned: z.number().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
    newWinStreak: z.number().int().nonnegative().optional(),
  })
  .strict();
/** Describes submit guess response data. */
export type SubmitGuessResponseData = z.infer<typeof SubmitGuessResponseDataSchema>;

/** Validates a server-authoritative single-player guess request. */
export const SubmitSinglePlayerGuessRequestDataSchema = z
  .object({
    riddleId: RiddleIdSchema,
    gameMode: FunctionGameModeSchema,
    sessionToken: z.string().min(20).max(128),
    guess: PlayableGuessSchema,
    requestId: z.string().min(8).max(128),
  })
  .strict();
/** Describes a server-authoritative single-player guess request. */
export type SubmitSinglePlayerGuessRequestData = z.infer<typeof SubmitSinglePlayerGuessRequestDataSchema>;

/** Validates a server-authoritative single-player guess response. */
export const SubmitSinglePlayerGuessResponseDataSchema = z
  .object({
    feedback: z.array(FeedbackItemSchema).max(7),
    attempts: z.number().int().positive().max(6),
    isCorrect: z.boolean(),
    gameOver: z.boolean(),
    canContinue: z.boolean().optional(),
  })
  .strict();
/** Describes a server-authoritative single-player guess response. */
export type SubmitSinglePlayerGuessResponseData = z.infer<typeof SubmitSinglePlayerGuessResponseDataSchema>;

/** Validates the complete game request data data shape. */
export const CompleteGameRequestDataSchema = z
  .object({
    riddleId: RiddleIdSchema,
    gameMode: z.enum(["challenge", "classic"]),
    sessionToken: z.string().min(20).max(128),
  })
  .strict();
/** Describes complete game request data. */
export type CompleteGameRequestData = z.infer<typeof CompleteGameRequestDataSchema>;

/** Validates the complete game response data data shape. */
export const CompleteGameResponseDataSchema = z
  .object({
    attempts: z.number().int().positive().max(6),
    isCorrect: z.boolean(),
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
        referralBonus: z.number().nonnegative().optional(),
        totalAwarded: z.number().nonnegative(),
        newBalance: z.number().nonnegative(),
      })
      .optional(),
  })
  .strict();
/** Describes complete game response data. */
export type CompleteGameResponseData = z.infer<typeof CompleteGameResponseDataSchema>;

/** Validates the daily challenge data data shape. */
export const DailyChallengeDataSchema = z
  .object({
    date: z.string().optional(),
    questions: z.array(DailyChallengeQuestionSchema).max(1),
    totalQuestions: z.number().int().positive().max(1),
  })
  .strict();

/** Validates the get current daily challenge response data shape. */
export const GetCurrentDailyChallengeResponseSchema = z
  .object({
    challenge: DailyChallengeDataSchema.optional(),
    currentQuestion: z.number().int().nonnegative().optional(),
    hasCompletedToday: z.boolean().optional(),
    questionsCompleted: z.number().int().nonnegative().optional(),
    error: z.string().optional(),
  })
  .strict();
/** Describes get current daily challenge response. */
export type GetCurrentDailyChallengeResponse = z.infer<typeof GetCurrentDailyChallengeResponseSchema>;

/** Validates the skip riddle request data shape. */
export const SkipRiddleRequestSchema = z
  .object({
    riddleId: RiddleIdSchema,
    gameMode: FunctionGameModeSchema,
    sessionToken: z.string().min(20).max(128),
    requestId: z.string().min(8).max(128),
  })
  .strict();
/** Describes skip riddle request. */
export type SkipRiddleRequest = z.infer<typeof SkipRiddleRequestSchema>;

/** Validates the player progress patch data shape. */
const PlayerProgressPatchSchema = z
  .object({
    classicIndex: z.number().int().nonnegative().optional(),
    dailyChallengeIndex: z.number().int().nonnegative().optional(),
    dailyChallengeCurrentQuestion: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Validates the skip riddle response data shape. */
export const SkipRiddleResponseSchema = z
  .object({
    success: z.boolean(),
    newProgress: PlayerProgressPatchSchema.nullish(),
    message: z.string(),
    costDeducted: z.number().int().nonnegative(),
  })
  .strict();
/** Describes skip riddle response. */
export type SkipRiddleResponse = z.infer<typeof SkipRiddleResponseSchema>;

/** Validates the spend coins request data shape. */
export const SpendCoinsRequestSchema = z
  .object({
    reason: z.literal("continue"),
    gameMode: z.enum(["classic", "challenge"]),
    riddleId: RiddleIdSchema,
    sessionToken: z.string().min(20).max(128),
    requestId: z.string().min(8).max(128),
    amount: z.number().positive().optional(),
  })
  .strict();
/** Describes spend coins request. */
export type SpendCoinsRequest = z.infer<typeof SpendCoinsRequestSchema>;

/** Validates the spend coins response data shape. */
export const SpendCoinsResponseSchema = z
  .object({
    newCoins: z.number().int().nonnegative(),
  })
  .strict();

/** Validates the get hint request data shape. */
export const GetHintRequestSchema = z
  .object({
    currentAttempt: z
      .array(
        z
          .string()
          .max(1)
          .regex(/^[a-z]?$/i),
      )
      .max(7),
    riddleId: RiddleIdSchema,
    gameMode: FunctionGameModeSchema,
    sessionToken: z.string().min(20).max(128),
    requestId: z.string().min(8).max(128),
  })
  .strict();

/** Validates the get hint response data shape. */
export const GetHintResponseSchema = z
  .object({
    revealedLetter: z.string().length(1),
    index: z.number().int().nonnegative(),
    coinsCost: z.number().int().nonnegative(),
    newCoins: z.number().int().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
  })
  .nullable();

/** Validates the update username request data shape. */
export const UpdateUsernameRequestSchema = z
  .object({
    username: UsernameSchema,
  })
  .strict();

/** Validates the update avatar request data shape. */
export const UpdateAvatarRequestSchema = z
  .object({
    imageDataUrl: z
      .string()
      .max(700_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

/** Validates the update avatar response data shape. */
export const UpdateAvatarResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
    avatarUrl: z.string().url(),
  })
  .strict();

/** Validates the leaderboard type data shape. */
export const LeaderboardTypeSchema = z.enum(["xp", "totalWins", "bestStreak"]);
/** Describes leaderboard type. */
export type LeaderboardType = z.infer<typeof LeaderboardTypeSchema>;

/** Validates the get leaderboard request data shape. */
export const GetLeaderboardRequestSchema = z
  .object({
    type: LeaderboardTypeSchema.default("xp"),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict()
  .default({type: "xp"});
/** Describes get leaderboard request. */
export type GetLeaderboardRequest = z.infer<typeof GetLeaderboardRequestSchema>;

/** Validates the leaderboard entry data shape. */
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
/** Describes leaderboard entry. */
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/** Validates the get leaderboard response data shape. */
export const GetLeaderboardResponseSchema = z
  .object({
    entries: z.array(LeaderboardEntrySchema),
    requestingUserId: z.string().min(1),
  })
  .strict();
/** Describes get leaderboard response. */
export type GetLeaderboardResponse = z.infer<typeof GetLeaderboardResponseSchema>;

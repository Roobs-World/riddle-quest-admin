import {z} from "zod";

/** Validates the backend game mode data shape. */
export const BackendGameModeSchema = z.enum(["challenge", "classic"]);

/** Validates the complete game input data shape. */
export const CompleteGameInputSchema = z.object({
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: BackendGameModeSchema,
  attempts: z.number().int().positive("Attempts must be a positive integer").max(100),
  isCorrect: z.boolean(),
});

/** Validates the complete game output data shape. */
export const CompleteGameOutputSchema = z.object({
  coinsEarned: z.number().nonnegative(),
  newlyUnlockedAchievementIds: z.array(z.string()),
  scoreEarned: z.number().nonnegative().optional(),
  xpEarned: z.number().nonnegative().optional(),
  newXp: z.number().nonnegative().optional(),
  newLevel: z.number().int().positive().optional(),
  leveledUp: z.boolean().optional(),
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
});

/** Describes complete game input. */
export type CompleteGameInput = z.infer<typeof CompleteGameInputSchema>;
/** Describes complete game output. */
export type CompleteGameOutput = z.infer<typeof CompleteGameOutputSchema>;

/** Validates the daily challenge question data shape. */
export const DailyChallengeQuestionSchema = z.object({
  riddleId: z.string(),
  text: z.string(),
  answer: z.string().min(1),
  questionNumber: z.number().int().positive(),
});

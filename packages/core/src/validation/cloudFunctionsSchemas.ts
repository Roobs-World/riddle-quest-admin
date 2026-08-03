import {z} from "zod";

export const BackendGameModeSchema = z.enum(["challenge", "classic"]);

export const CompleteGameInputSchema = z.object({
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: BackendGameModeSchema,
  attempts: z.number().int().positive("Attempts must be a positive integer").max(100),
  isCorrect: z.boolean(),
});

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

export type CompleteGameInput = z.infer<typeof CompleteGameInputSchema>;
export type CompleteGameOutput = z.infer<typeof CompleteGameOutputSchema>;

export const DailyChallengeQuestionSchema = z.object({
  riddleId: z.string(),
  text: z.string(),
  answer: z.string().min(1),
  questionNumber: z.number().int().positive(),
});

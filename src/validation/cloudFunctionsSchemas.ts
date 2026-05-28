import {z} from "zod";

// Define valid game modes
export const GameModeSchema = z.union([z.literal("daily"), z.literal("classic"), z.literal("challenge")]);
export const BackendGameModeSchema = z.enum(["challenge", "classic"]);
export const EmptyInputSchema = z.object({}).strict();

// Schemas for functions identified in firebase-functions/index.ts

// getQuestion
export const GetQuestionInputSchema = z.object({
  gameMode: GameModeSchema,
  currentIndex: z.number().int().nonnegative(),
});
export const GetQuestionOutputSchema = z
  .object({
    question: z.string(),
    answerLength: z.number().int().nonnegative(),
  })
  .nullable();

// getAnswer
export const GetAnswerInputSchema = z.object({
  gameMode: GameModeSchema,
  activeIndex: z.number().int().nonnegative(),
});
export const GetAnswerOutputSchema = z.string().nullable();

// getAnswerLength
export const GetAnswerLengthInputSchema = z.object({
  gameMode: GameModeSchema,
  activeIndex: z.number().int().nonnegative(),
});
export const GetAnswerLengthOutputSchema = z
  .object({
    answerLength: z.number().int().nonnegative(),
  })
  .nullable();

// checkLetterIsInAnswer
export const CheckLetterIsInAnswerInputSchema = z.object({
  gameMode: GameModeSchema,
  currentIndex: z.number().int().nonnegative(),
  letter: z.string().length(1),
});
export const CheckLetterIsInAnswerOutputSchema = z.boolean();

// checkLetterIsInCorrectPlace
export const CheckLetterIsInCorrectPlaceInputSchema = z.object({
  gameMode: GameModeSchema,
  currentIndex: z.number().int().nonnegative(),
  letter: z.string().length(1),
  activeIndex: z.number().int().nonnegative(),
});
export const CheckLetterIsInCorrectPlaceOutputSchema = z.boolean();

// generateClassicRiddles (assuming minimal input and a success output based on RiddleService usage)
export const GenerateClassicRiddlesInputSchema = z.object({});
export const GenerateClassicRiddlesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// getHint
export const GetHintInputSchema = z.object({
  currentAttempt: z.array(z.string().length(1)),
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: GameModeSchema,
});
export const GetHintOutputSchema = z
  .object({
    revealedLetter: z.string().length(1),
    index: z.number().int().nonnegative(),
    coinsCost: z.number().int().nonnegative(),
    // Optional server-provided fields: total coins after hint and any unlocked achievements
    newCoins: z.number().nonnegative().optional(),
    newlyUnlockedAchievementIds: z.array(z.string()).optional(),
  })
  .nullable();

export type GetHintOutput = z.infer<typeof GetHintOutputSchema>;

// Define a schema for guess feedback (green, yellow, red)
export const GuessFeedbackSchema = z.union([z.literal("green"), z.literal("yellow"), z.literal("red")]);

// submitGuess
export const SubmitGuessInputSchema = z.object({
  guess: z.string().min(1, "Guess cannot be empty"),
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: z.enum(["challenge", "classic"]),
  attempts: z.number().int().positive("Attempts must be a positive integer"),
});

export const SubmitGuessOutputSchema = z.object({
  feedback: z.array(
    z.object({
      letter: z.string(),
      status: z.enum(["green", "yellow", "red"]),
    }),
  ),
  isCorrect: z.boolean(),
  gameOver: z.boolean(),
  correctAnswer: z.string().optional(),
  coinsEarned: z.number().default(0),
  newlyUnlockedAchievementIds: z.array(z.string()).optional(),
});

export type SubmitGuessInput = z.infer<typeof SubmitGuessInputSchema>;
export type SubmitGuessOutput = z.infer<typeof SubmitGuessOutputSchema>;

// completeGame
export const CompleteGameInputSchema = z.object({
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: BackendGameModeSchema,
  attempts: z.number().int().positive("Attempts must be a positive integer"),
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
});

export type CompleteGameInput = z.infer<typeof CompleteGameInputSchema>;
export type CompleteGameOutput = z.infer<typeof CompleteGameOutputSchema>;

// skipRiddle
export const SkipRiddleInputSchema = z.object({
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: GameModeSchema,
});

export const SkipRiddleOutputSchema = z.object({
  success: z.boolean(),
  newProgress: z.unknown().optional(),
  message: z.string(),
  costDeducted: z.number(),
});

// spendCoins
export const SpendCoinsInputSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  reason: z.enum(["hint", "skip", "continue"]),
});

export const SpendCoinsOutputSchema = z.object({
  newCoins: z.number().nonnegative(),
});

// initializeRiddleDatabase
export const InitializeRiddleDatabaseInputSchema = z.object({});
export const InitializeRiddleDatabaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  riddlesGenerated: z.number().int().nonnegative(),
});

export const DailyChallengeQuestionSchema = z.object({
  riddleId: z.string(),
  text: z.string(),
  questionNumber: z.number().int().positive(),
});

export const CurrentDailyChallengeOutputSchema = z.object({
  challenge: z
    .object({
      date: z.string().optional(),
      questions: z.array(DailyChallengeQuestionSchema),
      totalQuestions: z.number().int().positive(),
    })
    .optional(),
  currentQuestion: z.number().int().nonnegative().optional(),
  hasCompletedToday: z.boolean().optional(),
  questionsCompleted: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const UpdateUsernameInputSchema = z.object({
  username: z.string().trim().min(3),
});

export const BasicSuccessMessageOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const GenerateTodaysDailyChallengeInputSchema = z.object({
  forceGenerate: z.boolean(),
});

export const GenerateTodaysDailyChallengeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  questionsGenerated: z.number().int().nonnegative(),
});

export const RewardedAdPlacementSchema = z.enum(["loss_continue", "coin_shop"]);

export const AwardedAdCallbackInputSchema = z.object({
  userId: z.string().min(1),
  placement: RewardedAdPlacementSchema,
  callbackId: z.string().min(1),
  provider: z.string().min(1),
});

export const AwardedAdCallbackOutputSchema = z.object({
  success: z.boolean(),
  placement: RewardedAdPlacementSchema,
  callbackId: z.string(),
  rewardCoins: z.number().nonnegative(),
  newCoins: z.number().nonnegative(),
  alreadyProcessed: z.boolean(),
  message: z.string(),
});

export const ValidatePurchaseInputSchema = z.object({
  purchaseToken: z.string().min(1),
  productId: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

export const ValidatePurchaseOutputSchema = z.object({
  success: z.boolean(),
  newCoins: z.number().nonnegative().optional(),
  newlyUnlockedAchievementIds: z.array(z.string()).optional(),
});

export const GrantDevCoinsForPurchaseInputSchema = z.object({
  productId: z.string().min(1),
});

export const GrantDevCoinsForPurchaseOutputSchema = z.object({
  success: z.boolean(),
  newCoins: z.number().nonnegative(),
  coinsAwarded: z.number().nonnegative(),
  newlyUnlockedAchievementIds: z.array(z.string()).optional(),
});

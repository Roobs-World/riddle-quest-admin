import { z } from "zod";

// Define valid game modes
export const GameModeSchema = z.union([
  z.literal("daily"),
  z.literal("classic"),
  z.literal("challenge"),
  z.literal("tutorial"),
]);

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

// Define a schema for guess feedback (green, yellow, red)
export const GuessFeedbackSchema = z.union([
  z.literal("green"),
  z.literal("yellow"),
  z.literal("red"),
]);

// submitGuess
export const SubmitGuessInputSchema = z.object({
  guess: z.string().min(1, "Guess cannot be empty"),
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: z.enum(["challenge", "classic", "tutorial"]),
  attempts: z.number().int().positive("Attempts must be a positive integer"),
});

export const SubmitGuessOutputSchema = z.object({
  feedback: z.array(
    z.object({
      letter: z.string(),
      status: z.enum(["green", "yellow", "red"]),
    })
  ),
  isCorrect: z.boolean(),
  gameOver: z.boolean(),
  correctAnswer: z.string().optional(),
  coinsEarned: z.number().default(0),
  newlyUnlockedAchievementIds: z.array(z.string()).optional(),
});

export type SubmitGuessInput = z.infer<typeof SubmitGuessInputSchema>;
export type SubmitGuessOutput = z.infer<typeof SubmitGuessOutputSchema>;

// skipRiddle
export const SkipRiddleInputSchema = z.object({
  riddleId: z.string().min(1, "Riddle ID is required"),
  gameMode: GameModeSchema,
});

export const SkipRiddleOutputSchema = z.object({
  success: z.boolean(),
  newProgress: z.any().optional(),
  message: z.string(),
  costDeducted: z.number(),
});

// spendCoins
export const SpendCoinsInputSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  reason: z.enum(["hint", "skip"]),
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

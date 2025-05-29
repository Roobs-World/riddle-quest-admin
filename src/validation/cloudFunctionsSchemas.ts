import { z } from "zod";

// Define valid game modes
export const GameModeSchema = z.union([
  z.literal("daily"),
  z.literal("classic"),
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
export const GenerateClassicRiddlesOutputSchema = z
  .object({
    success: z.boolean(),
  })
  .optional();

// Define a schema for guess feedback (green, yellow, red)
export const GuessFeedbackSchema = z.union([
  z.literal("green"),
  z.literal("yellow"),
  z.literal("red"),
]);

export const SubmitGuessInputSchema = z.object({
  gameMode: GameModeSchema,
  riddleId: z.string(),
  guess: z.string().min(1),
  attempts: z.number().int().positive(),
});

export const SubmitGuessOutputSchema = z.object({
  feedback: z.array(
    z.object({
      letter: z.string(),
      status: GuessFeedbackSchema,
    })
  ),
  isCorrect: z.boolean(),
  correctAnswer: z.string().optional(),
  coinsEarned: z.number().int().nonnegative().optional(),
});

// getHint
export const GetHintInputSchema = z.object({
  currentAttempt: z.array(z.string()), // Each string could be a letter
  riddleId: z.string(),
});

export const GetHintOutputSchema = z
  .object({
    revealedLetter: z.string(),
    index: z.number().int().nonnegative(),
    coinsCost: z.number().int().positive(),
  })
  .nullable();

// skipRiddle
export const SkipRiddleInputSchema = z.object({
  gameMode: GameModeSchema, // Use existing GameModeSchema
  riddleId: z.string(),
});

export const SkipRiddleOutputSchema = z.object({
  newRiddleIndex: z.number().int(),
  newQuestion: z.string(),
  newAnswerLength: z.number().int().nonnegative(),
  coinsCost: z.number().int().positive(),
  newRiddleId: z.string(),
});

// resetStats
export const ResetStatsInputSchema = z.object({}); // No input data from client

export const ResetStatsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// initializeRiddleDatabase
export const InitializeRiddleDatabaseInputSchema = z.object({});
export const InitializeRiddleDatabaseOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  riddlesGenerated: z.number().int().nonnegative(),
});

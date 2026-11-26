import {SinglePlayerGuessSchema} from "../input/singlePlayerInput";
import {AcceptedGuessesSchema} from "./acceptedGuesses";
import {RevealedHintsSchema} from "./revealedHints";
import {z} from "zod";

/** Validates the backend game mode data shape. */
export const BackendGameModeSchema = z.enum(["challenge", "classic"]);
/** Bounds canonical riddle identifiers accepted by Cloud Functions. */
const RiddleIdSchema = z.string().min(1, "Riddle ID is required").max(160);
/** Bounds guesses to the shipped seven-keyboard-slot policy. */
const PlayableGuessSchema = SinglePlayerGuessSchema;

/** Validates the complete game input data shape. */
export const CompleteGameInputSchema = z
  .object({
    riddleId: RiddleIdSchema,
    gameMode: BackendGameModeSchema,
    sessionToken: z.string().min(20).max(128),
  })
  .strict();

/** Validates a server-authoritative single-player guess input. */
export const SubmitSinglePlayerGuessInputSchema = z
  .object({
    riddleId: RiddleIdSchema,
    gameMode: BackendGameModeSchema,
    sessionToken: z.string().min(20).max(128),
    guess: PlayableGuessSchema,
    requestId: z.string().min(8).max(128),
    includeCompletion: z.literal(true).optional(),
  })
  .strict();

/** Validates the complete game output data shape. */
export const CompleteGameOutputSchema = z.object({
  attempts: z.number().int().positive().max(6),
  isCorrect: z.boolean(),
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
      referralBonus: z.number().nonnegative().optional(),
      totalAwarded: z.number().nonnegative(),
      newBalance: z.number().nonnegative(),
    })
    .optional(),
});

/** Describes complete game input. */
export type CompleteGameInput = z.infer<typeof CompleteGameInputSchema>;
/** Describes complete game output. */
export type CompleteGameOutput = z.infer<typeof CompleteGameOutputSchema>;
/** Describes a server-authoritative single-player guess input. */
export type SubmitSinglePlayerGuessInput = z.infer<typeof SubmitSinglePlayerGuessInputSchema>;

/** Validates a server-authoritative single-player guess output. */
export const SubmitSinglePlayerGuessOutputSchema = z
  .object({
    feedback: z
      .array(
        z.object({
          letter: z.string().length(1),
          status: z.enum(["green", "yellow", "red"]),
        }),
      )
      .max(7),
    attempts: z.number().int().positive().max(6),
    isCorrect: z.boolean(),
    gameOver: z.boolean(),
    canContinue: z.boolean().optional(),
    completion: CompleteGameOutputSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.completion && (!result.gameOver || result.completion.attempts !== result.attempts ||
      result.completion.isCorrect !== result.isCorrect))
      context.addIssue({code: z.ZodIssueCode.custom, path: ["completion"], message: "Completion must match its terminal guess."});
  });
/** Describes a server-authoritative single-player guess output. */
export type SubmitSinglePlayerGuessOutput = z.infer<typeof SubmitSinglePlayerGuessOutputSchema>;

/** Validates the daily challenge question data shape. */
export const DailyChallengeQuestionSchema = z
  .object({
    riddleId: RiddleIdSchema,
    text: z.string().min(1).max(120),
    answerLength: z.number().int().positive().max(7),
    // Presentation-only scoring data; submissions and rewards remain server-validated.
    evaluation: z.object({answer: z.string().min(1).max(64), locale: z.string().min(2).max(35)}).strict().optional(),
    sessionToken: z.string().min(20).max(128),
    questionNumber: z.number().int().positive().max(1),
    revealedHints: RevealedHintsSchema.optional(),
    acceptedGuesses: AcceptedGuessesSchema.optional(),
    attemptsUsed: z.number().int().nonnegative().max(6),
    hasUsedContinue: z.boolean(),
    awaitingContinue: z.boolean(),
  })
  .strict()
  .superRefine((question, context) => {
    /** Provides expected awaiting behavior. */
    if (question.revealedHints?.some(({index}) => index >= question.answerLength)) {
      context.addIssue({code: z.ZodIssueCode.custom, message: "Revealed hint is outside the answer."});
    }
    if (question.acceptedGuesses && (question.acceptedGuesses.length !== question.attemptsUsed ||
      question.acceptedGuesses.some((guess) => guess.feedback.length !== question.answerLength))) {
      context.addIssue({code: z.ZodIssueCode.custom, message: "Accepted guess recovery is inconsistent."});
    }
    /** The base attempt cap requires a Continue decision before another guess. */
    const expectedAwaiting = question.attemptsUsed === 5 && !question.hasUsedContinue;
    if (question.awaitingContinue !== expectedAwaiting) {
      context.addIssue({code: z.ZodIssueCode.custom, message: "Continue recovery state is inconsistent."});
    }
    if (question.hasUsedContinue && question.attemptsUsed < 5) {
      context.addIssue({code: z.ZodIssueCode.custom, message: "Continue cannot precede the base attempt cap."});
    }
    if (question.attemptsUsed > 5 + (question.hasUsedContinue ? 1 : 0)) {
      context.addIssue({code: z.ZodIssueCode.custom, message: "Attempt count exceeds the available limit."});
    }
  });

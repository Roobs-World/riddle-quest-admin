import {z} from "zod";
import {RACE_DECK_SIZE, RACE_MAX_GUESSES_PER_RIDDLE} from "./raceDefinitionSchemas";

/** Bounded locator for one historical accepted attempt; never a command or account selector. */
export const LiveGuessReceiptQuerySchema = z.object({
  ticketId: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().min(8).max(160),
  riddleId: z.string().min(1).max(160),
  position: z.number().int().min(0).max(RACE_DECK_SIZE - 1),
  guessesUsedBefore: z.number().int().min(0).max(RACE_MAX_GUESSES_PER_RIDDLE - 2),
}).strict();
/** A missing or legacy proof cannot authorize ambiguous local draft recovery. */
export const LiveGuessReceiptResultSchema = z.object({status: z.enum(["accepted", "unconfirmed"])}).strict();
/** Target-neutral receipt locator without submitted word or replay instructions. */
export type LiveGuessReceiptQuery = z.infer<typeof LiveGuessReceiptQuerySchema>;
/** Private proof lookup acknowledgement contains no gameplay or economy state. */
export type LiveGuessReceiptResult = z.infer<typeof LiveGuessReceiptResultSchema>;

import {z} from "zod";
import {splitGraphemes} from "../input/graphemes";

/** Public feedback for guesses already accepted by the authoritative session. */
export const AcceptedGuessesSchema = z.array(z.object({
  attempt: z.number().int().positive().max(6),
  feedback: z.array(z.object({
    letter: z.string().min(1).max(32).refine((letter) => splitGraphemes(letter).length === 1),
    status: z.enum(["green", "yellow", "red"]),
  }).strict()).min(1).max(7),
}).strict()).max(6).refine((guesses) => guesses.every((guess, index) => guess.attempt === index + 1));

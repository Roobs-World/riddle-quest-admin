import {z} from "zod";
import {isSinglePlayerKeyboardLetter} from "./singlePlayerKeyboard";

/** Bounds submitted words to the seven hosted keyboard slots without rewriting receipt bytes. */
export const SinglePlayerGuessSchema = z.string().min(1).max(7)
  .refine(value => [...value].every(isSinglePlayerKeyboardLetter));
/** A partial attempt contains an empty slot or exactly one supported displayed keyboard letter. */
export const SinglePlayerAttemptCellSchema = z.string().max(1)
  .refine(value => value === "" || isSinglePlayerKeyboardLetter(value));

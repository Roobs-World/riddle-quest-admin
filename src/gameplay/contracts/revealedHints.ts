import {z} from "zod";
import {splitGraphemes} from "../input/graphemes";

/** Validates only letters already purchased in an issued authoritative session. */
export const RevealedHintsSchema = z.array(z.object({
  index: z.number().int().nonnegative().max(63),
  letter: z.string().min(1).max(32).refine((letter) => splitGraphemes(letter).length === 1),
}).strict()).max(64).refine((hints) => new Set(hints.map(({index}) => index)).size === hints.length);

import type {ScoredGuess} from "../../../core/game";

/** Aligns known feedback with authoritative consumed attempts without inventing missing scores. */
export const raceBoardAttempts = (guesses: ScoredGuess[], used: number, projectedWrongGuess = false): ScoredGuess[] => {
  /** Optimistic confirmed-display rows may precede the next server attempt counter. */
  const missing = Math.max(0, used + Number(projectedWrongGuess) - guesses.length);
  return missing ? [...Array.from({length: missing}, () => ({guess: [], feedback: []})), ...guesses] : guesses;
};

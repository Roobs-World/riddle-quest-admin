import type {RaceRunView} from "@qwordly/core/race";
import type {ScoredGuess} from "@qwordly/core/game";
import {raceBoardAttempts} from "./raceBoardAttempts";

/** A same-question hint may observe attempts committed by another tab while preserving local input. */
export const raceHintHistory = (run: RaceRunView, previous: RaceRunView, guesses: ScoredGuess[]): ScoredGuess[] => {
  /** Earlier known rows retain their exact consumed indexes. */
  const used = previous.currentRiddle?.guessesUsed ?? 0, known = raceBoardAttempts(guesses, used);
  /** Canonical returned rows describe their latest authoritative attempt positions. */
  const prompt = run.currentRiddle;
  if (prompt?.confirmedGuesses?.length) return structuredClone(raceBoardAttempts(prompt.confirmedGuesses, prompt.guessesUsed)
    .map((row, index) => row.guess.length ? row : known[index] ?? row));
  /** New attempts without history occupy unknown trailing slots rather than shifting old words. */
  return [...structuredClone(known),
    ...Array.from({length: Math.max(0, (prompt?.guessesUsed ?? used) - used)}, () => ({guess: [], feedback: []}))];
};

import type {RaceRunView, SubmitRaceGuessResponse} from "@riddle-quest/core/race";
import {lowerCaseGraphemes, type ScoredGuess} from "@riddle-quest/core/game";
import {raceBoardAttempts} from "./raceBoardAttempts";

/** A wrong guess receipt ends with this submission after any concurrently consumed attempts. */
export const raceGuessHistory = (run: RaceRunView, previous: RaceRunView, guesses: ScoredGuess[]): ScoredGuess[] => {
  /** Confirmed checkpoint history ends with the locally submitted, server-scored answer. */
  const latest = guesses.at(-1);
  if (!latest) return [];
  /** Original consumed count anchors older rows independently of the new server count. */
  const used = previous.currentRiddle?.guessesUsed ?? 0;
  /** Unreported intervening attempts occupy neutral slots before the accepted local submission. */
  const aligned = [...raceBoardAttempts(guesses.slice(0, -1), used),
    ...Array.from({length: Math.max(0, (run.currentRiddle?.guessesUsed ?? used + 1) - used - 1)}, () => ({guess: [], feedback: []})), latest];
  /** Returned canonical suffix rows replace only their exact attempt indexes. */
  const prompt = run.currentRiddle;
  return structuredClone(prompt?.confirmedGuesses?.length
    ? raceBoardAttempts(prompt.confirmedGuesses, prompt.guessesUsed).map((row, index) => row.guess.length ? row : aligned[index] ?? row)
    : aligned);
};

/** Optional latest canonical rows must agree with the correlated submission before checkpoint consumption. */
export const assertRaceGuessHistory = (result: SubmitRaceGuessResponse, previous: RaceRunView | null | undefined): void => {
  /** Only a wrong submission still showing its own question has a corresponding latest history row. */
  const prompt = result.run.currentRiddle, original = previous?.currentRiddle;
  if (result.isCorrect || result.autoSkipped || !prompt || !original || prompt.position !== original.position || prompt.riddleId !== original.riddleId) return;
  /** The mutation receipt's final consumed index is the correlated local submission. */
  const row = prompt.confirmedGuesses?.at(-1);
  if (row && (row.guess.length !== result.feedback.length || row.feedback.length !== result.feedback.length ||
    result.feedback.some((entry, index) => row.feedback[index] !== entry.status ||
      lowerCaseGraphemes(row.guess[index], result.run.locale).join("") !== lowerCaseGraphemes(entry.letter, result.run.locale).join(""))))
    throw new Error("Contradictory confirmed guess history");
};

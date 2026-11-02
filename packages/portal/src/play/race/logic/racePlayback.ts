import type {RaceOpponent} from "@riddle-quest/core/race";

/** Returns the opponent score reached at an authoritative adjusted elapsed time. */
export const getGhostCorrectCount = (opponent: RaceOpponent | undefined, adjustedElapsedMs: number): number => {
  if (!opponent) return 0;
  if (adjustedElapsedMs >= opponent.adjustedFinishMs) return 10;
  // Skip and hint events carry the authority's cumulative progress too.
  // Reordered or duplicated recordings must not move the progress bar backwards.
  return opponent.events.reduce((progress, event) => event.adjustedElapsedMs <= adjustedElapsedMs
    ? Math.max(progress, event.correctCount) : progress, 0);
};

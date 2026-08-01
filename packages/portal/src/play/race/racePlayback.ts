import type {RaceOpponent} from "@qwordly/core/race";

export const getGhostCorrectCount = (opponent: RaceOpponent | undefined, adjustedElapsedMs: number): number => {
  if (!opponent) return 0;
  if (adjustedElapsedMs >= opponent.adjustedFinishMs) return 10;
  return (
    opponent.events.filter((event) => event.type === "correct" && event.adjustedElapsedMs <= adjustedElapsedMs).at(-1)
      ?.correctCount ?? 0
  );
};

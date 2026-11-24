import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {raceClock, type RaceRunRecord} from "../runs/raceEngine";
import type {LiveMatch} from "./raceLiveState";

/** Only a completed ten-riddle run establishes a penalty-adjusted finish time. */
export function liveFinishMs(run: RaceRunRecord): number | undefined {
  return run.status === "completed" && run.correctCount === RACE_RULES.targetCorrect && run.wallFinishMs !== undefined
    ? raceClock(run, run.finishedAtMs ?? run.startedAtMs).adjustedElapsedMs : undefined;
}

/** Settles only once the rival finishes or can no longer beat the best penalty-adjusted finish. */
export function settleLiveFinish(match: LiveMatch, nowMs: number): boolean {
  if (match.startsAtMs === null || match.winner !== undefined) return false;
  /** Fixed scores stay independent of later polls and the rival's active clock. */
  const finishes = match.runs.map(liveFinishMs);
  if (finishes[0] !== undefined && finishes[1] !== undefined) {
    match.winner = finishes[0] === finishes[1] ? null : finishes[0] < finishes[1] ? 0 : 1;
  } else {
    /** At most one completed seat leaves an active opponent with a remaining opportunity. */
    const finishedSeat = finishes[0] !== undefined ? 0 : finishes[1] !== undefined ? 1 : undefined;
    if (finishedSeat !== undefined) {
      // The rival's penalties reduce their remaining wall time; the finisher's penalties extend it.
      if (raceClock(match.runs[1 - finishedSeat], nowMs).adjustedElapsedMs < finishes[finishedSeat]!) return false;
      match.winner = finishedSeat;
    } else {
      if (nowMs < match.startsAtMs + RACE_RULES.maxAdjustedTimeMs) return false;
      match.winner = null;
    }
  }
  return true;
}

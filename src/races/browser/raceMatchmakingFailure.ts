import {classifyRaceMatchFailure, type RaceMatchFailure} from "../contracts/index";
import type {MatchmakingResult} from "../../platform/contracts/capabilities";

/** Keeps provider failure details out of display text while preserving recovery semantics. */
export function raceMatchmakingFailureResult(error: unknown): MatchmakingResult {
  /** Only validated reason/recovery/delay fields cross the platform seam. */
  const failure: RaceMatchFailure = classifyRaceMatchFailure(error);
  return {status: failure.recovery === "none" ? "terminal-failure" : "retryable-failure",
    message: `race-matchmaking-${failure.reason}`, failure};
}

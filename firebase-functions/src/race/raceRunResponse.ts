import {RaceRunResponseSchema, type RaceRunResponse} from "@riddle-quest/core/race";
import {HttpsError} from "firebase-functions/v2/https";
import {toRaceRunView, type RaceRunRecord} from "./raceEngine";

/** Validates the exact accepted public projection before its caller commits any effects. */
export function projectRaceRunResponse(run: RaceRunRecord, nowMs: number, includeEvaluation = false, includeGuessHistory = false): RaceRunResponse {
  /** Strict decoding stays inside the transaction; diagnostics never expose immutable answers. */
  const response = RaceRunResponseSchema.safeParse({run: toRaceRunView(run, nowMs, includeEvaluation, includeGuessHistory)});
  if (!response.success) throw new HttpsError("data-loss", "Stored race view is invalid.");
  return response.data;
}

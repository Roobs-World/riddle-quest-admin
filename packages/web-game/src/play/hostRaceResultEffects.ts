import type {RaceOutcome} from "@riddle-quest/core/race";

/** Provider recording and result presentation share the original account ownership guard. */
export async function deliverHostRaceResult(result: RaceOutcome, owned: () => boolean,
  record?: (result: RaceOutcome) => void | Promise<void>, showResults?: () => void | Promise<void>): Promise<void> {
  if (!owned()) return;
  await record?.(result);
  if (owned()) await showResults?.();
}

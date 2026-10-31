import type {LiveRaceView} from "@qwordly/core/race";

/** Failed or unsupported push connections retain fast foreground PvP recovery. */
export const LIVE_RACE_POLL_TICK_MS = 500;

/** Healthy notifications wake human matches immediately; polls reconcile missed updates and timed finishes. */
export function liveRacePollInterval(view: (Pick<LiveRaceView, "phase" | "opponent"> &
  Partial<Pick<LiveRaceView, "run">>) | null, visible: boolean, pushConnected = false): number {
  if (!visible || view?.phase !== "racing" || view.opponent?.bot !== false) return 1_000;
  return pushConnected && view.run?.status !== "completed" && view.opponent.correctCount < 10 ? 5_000 : LIVE_RACE_POLL_TICK_MS;
}

import {LIVE_RACE_COUNTDOWN_MS, LIVE_RACE_PLAYER_WAIT_MS, LIVE_RACE_WAIT_MS} from "@riddle-quest/core/race";
import {tr} from "../../i18n";

/** Presents the authoritative search deadline as a filling ring without visible numbers. */
export function LiveRaceSearchWheel({endsAtMs, now, starting = false, waitForPlayer = false}: {
  /** Search or shared-start deadline returned for the current matchmaking seat. */
  endsAtMs?: number;
  /** Monotonic server-time estimate already maintained by the live journey. */
  now: number;
  /** Shared match countdown uses its own authoritative five-second interval. */
  starting?: boolean;
  /** Resumable public seats use the same server-owned opponent search window. */
  waitForPlayer?: boolean;
}) {
  /** Unknown delivery starts empty; retries retain the server-owned deadline. */
  const progress = endsAtMs === undefined ? 0 : Math.min(1, Math.max(0,
    1 - (endsAtMs - now) / (starting ? LIVE_RACE_COUNTDOWN_MS : waitForPlayer ? LIVE_RACE_PLAYER_WAIT_MS : LIVE_RACE_WAIT_MS)));
  return <div className="live-race-search-wheel" data-phase={starting ? "countdown" : "searching"} role="progressbar"
    aria-label={tr(starting ? "RaceTo10.LIVE_STARTING" : "RaceTo10.LIVE_FINDING")} aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={Math.round(progress * 100)}>
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <circle className="live-race-search-track" cx="48" cy="48" r="38" />
      <circle className="live-race-search-fill" cx="48" cy="48" r="38"
        pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress}
        transform="rotate(-90 48 48)" />
    </svg>
  </div>;
}

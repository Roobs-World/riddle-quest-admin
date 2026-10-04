import {useEffect, useState} from "react";
import {estimatedRaceServerNow} from "../logic/raceCountdown";
import {formatRaceTime} from "../logic/racePresentation";

/** Latest accepted server clock, anchored to the browser's monotonic clock. */
export type LiveRaceClockAnchor = {
  /** Server time when the receipt was accepted. */ serverNowMs: number;
  /** Monotonic browser time when the receipt was accepted. */ receivedAtMs: number;
  /** Shared authoritative start time. */ startsAtMs: number;
};

/** Keeps tenths-of-a-second updates local to the clock, away from answer input. */
export function LiveRaceElapsedTime({anchor, penaltyMs}: {
  /** Accepted receipt clock; device wall-clock changes cannot rewind it. */ anchor: LiveRaceClockAnchor;
  /** Server-confirmed hint and skip penalties. */ penaltyMs: number;
}) {
  /** Monotonic sample used only to animate this text. */
  const [sample, setSample] = useState(() => performance.now());
  useEffect(() => {
    /** Updates the visible clock after an animation interval or foreground transition. */
    const tick = () => setSample(performance.now());
    /** Clock animation has no effect on gameplay or transport admission. */
    const timer = window.setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return formatRaceTime(Math.max(0, estimatedRaceServerNow(anchor.serverNowMs, anchor.receivedAtMs,
    Math.max(sample, anchor.receivedAtMs)) - anchor.startsAtMs) + penaltyMs);
}

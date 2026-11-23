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
    /** Retired effects and cancelled timer generations cannot publish a clock sample. */
    let disposed = false, generation = 0;
    /** A hidden clock retains its monotonic anchor without scheduling animation. */
    let timer: number | null = null;
    /** Stops the current animation and invalidates callbacks already queued by the browser. */
    const stop = () => {
      generation++;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    /** Foregrounding immediately samples elapsed time and owns exactly one visible animation. */
    const refresh = () => {
      if (disposed) return;
      stop();
      if (document.hidden) return;
      setSample(performance.now());
      /** Only this interval may update the still-mounted visible clock. */
      const ownedGeneration = generation;
      timer = window.setInterval(() => {
        if (disposed || generation !== ownedGeneration || document.hidden) return;
        setSample(performance.now());
      }, 100);
    };
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return formatRaceTime(Math.max(0, estimatedRaceServerNow(anchor.serverNowMs, anchor.receivedAtMs,
    Math.max(sample, anchor.receivedAtMs)) - anchor.startsAtMs) + penaltyMs);
}

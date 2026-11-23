import {useEffect, useRef} from "react";
import type {LiveRaceCapability, LiveRaceView} from "../../contracts/index";

/** Owns one optional platform subscription for the mounted, nonterminal seat. */
export function useLiveRaceSignals(transport: LiveRaceCapability, view: LiveRaceView | null, refresh: () => void,
  /** Connectivity changes rearm the current polling cadence without replacing its seat. */
  reschedule?: () => void) {
  /** Polling reads connectivity without restarting its scheduler on every notification. */
  const connected = useRef(false);
  /** End subscriptions once results settle or the player leaves. */
  const ticketId = view && !["result", "cancelled"].includes(view.phase) ? view.ticketId : undefined;
  useEffect(() => {
    connected.current = false;
    if (!ticketId || !transport.observe) return;
    /** Discards callbacks from a retired subscription even with an imperfect platform adapter. */
    let active = true;
    try {
      /** Provides unsubscribe behavior. */
      const unsubscribe = transport.observe(ticketId, () => {if (active) refresh();},
        status => {if (active) {connected.current = status; reschedule?.(); if (!status) refresh();}});
      return () => {
        active = false;
        connected.current = false;
        // An optional push adapter cannot interrupt the surrounding game's retirement.
        try {unsubscribe();} catch {}
      };
    } catch {active = false; connected.current = false; reschedule?.();}
    return () => {active = false; connected.current = false;};
  }, [transport, ticketId, refresh, reschedule]);
  return connected;
}

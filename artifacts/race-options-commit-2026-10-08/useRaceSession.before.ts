import {useEffect, useRef, useSyncExternalStore} from "react";
import {HOST_TO_GAME_EVENT} from "../../localBridge";
import {RaceSession} from "../RaceSession";
import type {RaceSessionEntry, RaceSessionOptions} from "../RaceSession.types";

/** React owns only subscription, bridge delivery and browser scheduling adapters. */
export function useRaceSession(entry: RaceSessionEntry, options: RaceSessionOptions) {
  /** Keep effect adapters fresh without replacing an owned session during render. */
  const optionsRef = useRef(options);
  optionsRef.current = options;
  /** One session module owns all lifecycle state for this mounted surface. */
  const sessionRef = useRef<RaceSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new RaceSession(entry, {
    postToHost: message => optionsRef.current.postToHost(message),
    effect: effect => optionsRef.current.effect?.(effect),
    getMatchmaking: () => optionsRef.current.getMatchmaking?.(),
  });
  /** Stable module identity survives harmless rendering changes. */
  const session = sessionRef.current;
  /** Immutable snapshot consumed by rendering. */
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    /** Install the listener before entry can issue a synchronously answered command. */
    const handle = (event: Event) => session.receive((event as CustomEvent<unknown>).detail);
    window.addEventListener(HOST_TO_GAME_EVENT, handle);
    session.setVisible(document.visibilityState === "visible");
    session.enter(entry);
    return () => {session.dispose(); window.removeEventListener(HOST_TO_GAME_EVENT, handle);};
    // Catalog updates do not create a new player journey.
  }, [session, entry.ownerId, entry.locale, entry.challengeId, entry.openInbox, entry.tournamentLocale]);
  useEffect(() => {
    /** Browser timer is an adapter; the session chooses all clock transitions. */
    const timer = window.setInterval(session.tick, 50);
    /** Resume immediately when browser timers were suspended in the background. */
    const visible = () => session.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visible);
    return () => {window.clearInterval(timer); document.removeEventListener("visibilitychange", visible);};
  }, [session]);
  return {session, state};
}

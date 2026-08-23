import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {captureBrowserException} from "../observability/browserErrorReporter";
import type {ActivePresenceState, PlatformPresenceSession} from "../presence/PlatformPresenceSession";
import {reconcilePresenceOptIn} from "../presence/reconcilePresenceOptIn";
import {startOptionalPresence} from "../presence/startOptionalPresence";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestPlatformPort, JestSession} from "./types";

/** Owns the optional Jest presence session and its preference toggle. */
export function useJestPresence({
  gate,
  platform,
  session,
  sessionRef,
  setSession,
  trackFailure,
}: {
  gate: NotificationOperationGate;
  platform: JestPlatformPort;
  session: JestSession | null;
  sessionRef: MutableRefObject<JestSession | null>;
  setSession: Dispatch<SetStateAction<JestSession | null>>;
  trackFailure: (eventName: string) => void;
}) {
  const presenceRef = useRef<PlatformPresenceSession | null>(null);
  const firebaseAuthenticated = session?.firebaseAuthenticated;
  const firebaseUid = session?.firebaseUid;

  useEffect(() => {
    if (!firebaseAuthenticated || firebaseUid === undefined) return;
    let active = true;
    let removeVisibilityListener: (() => void) | undefined;
    void (async () => {
      const [{FirebasePresenceTransport}, {PlatformPresenceSession}] = await Promise.all([
        import("../presence/FirebasePresenceTransport"),
        import("../presence/PlatformPresenceSession"),
      ]);
      if (!active) return;
      const presence = new PlatformPresenceSession(
        new FirebasePresenceTransport(firebaseUid),
        {sessionId: crypto.randomUUID(), platform: "jest"},
      );
      presenceRef.current = presence;
      await startOptionalPresence({
        enabled: sessionRef.current?.preferences.presenceEnabled === true,
        canStart: document.visibilityState !== "hidden",
        start: () => presence.start(true),
        reportFailure: (error) => captureBrowserException(error, {
          component: "jest_presence",
          operation: "initialize",
        }),
      });
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          void presence.stop();
        } else if (sessionRef.current?.preferences.presenceEnabled === true) {
          void startOptionalPresence({
            enabled: true,
            canStart: true,
            start: () => presence.start(true),
            reportFailure: (error) => captureBrowserException(error, {
              component: "jest_presence",
              operation: "resume",
            }),
          });
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      removeVisibilityListener = () => document.removeEventListener("visibilitychange", handleVisibility);
    })().catch((presenceError) => {
      captureBrowserException(presenceError, {component: "jest_presence", operation: "initialize"});
    });
    return () => {
      active = false;
      removeVisibilityListener?.();
      const presence = presenceRef.current;
      presenceRef.current = null;
      void presence?.stop();
    };
  }, [firebaseAuthenticated, firebaseUid, sessionRef]);

  const togglePresence = useCallback(() => {
    const currentSession = sessionRef.current;
    const presence = presenceRef.current;
    if (!currentSession || !presence || !gate.isOpen()) return;
    const next = currentSession.preferences.presenceEnabled !== true;
    void gate.run(async () => {
      await platform.writePreferences({presenceEnabled: next});
      await reconcilePresenceOptIn({
        enabled: next,
        canStart: document.visibilityState !== "hidden",
        start: () => presence.start(true),
        stop: () => presence.stop(),
        setConsent: async (enabled) => {
          const {setPresenceConsent} = await import("../firebase");
          await setPresenceConsent({enabled});
        },
      });
      const preferences = {...currentSession.preferences, presenceEnabled: next};
      sessionRef.current = {...currentSession, preferences};
      setSession((value) => value ? {...value, preferences: {...value.preferences, presenceEnabled: next}} : value);
    }).catch((presenceError) => {
      captureBrowserException(presenceError, {component: "jest_presence", operation: "toggle"});
      trackFailure("presence_toggle_failed");
    });
  }, [gate, platform, sessionRef, setSession, trackFailure]);

  const setPresenceState = useCallback((state: ActivePresenceState) => {
    void presenceRef.current?.setState(state).catch((presenceError) => {
      captureBrowserException(presenceError, {component: "jest_presence", operation: "state"});
    });
  }, []);

  return {setPresenceState, togglePresence};
}

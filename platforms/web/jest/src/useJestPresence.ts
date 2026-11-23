import {useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction} from "react";
import {captureBrowserException} from "../../../../packages/web-game/src/observability/browserErrorReporter";
import type {ActivePresenceState, PlatformPresenceSession} from "../../../../packages/web-game/src/presence/PlatformPresenceSession";
import {reconcilePresenceOptIn} from "../../../../packages/web-game/src/presence/reconcilePresenceOptIn";
import {startOptionalPresence} from "../../../../packages/web-game/src/presence/startOptionalPresence";
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
  /** Stores gate. */
  gate: NotificationOperationGate;
  /** Stores platform. */
  platform: JestPlatformPort;
  /** Stores session. */
  session: JestSession | null;
  /** Stores session ref. */
  sessionRef: MutableRefObject<JestSession | null>;
  /** Stores set session. */
  setSession: Dispatch<SetStateAction<JestSession | null>>;
  /** Stores track failure. */
  trackFailure: (eventName: string) => void;
}) {
  /** Provides presence ref behavior. */
  const presenceRef = useRef<PlatformPresenceSession | null>(null);
  /** Provides firebase authenticated behavior. */
  const firebaseAuthenticated = session?.firebaseAuthenticated;
  /** Provides firebase uid behavior. */
  const firebaseUid = session?.firebaseUid;

  useEffect(() => {
    if (!firebaseAuthenticated || firebaseUid === undefined) return;
    /** Provides active behavior. */
    let active = true;
    /** Removes visibility listener. */
    let removeVisibilityListener: (() => void) | undefined;
    void (async () => {
      /** Provides [{firebase presence transport}, {platform presence session}] behavior. */
      const [{FirebasePresenceTransport}, {PlatformPresenceSession}] = await Promise.all([
        import("../../../../packages/web-game/src/presence/FirebasePresenceTransport"),
        import("../../../../packages/web-game/src/presence/PlatformPresenceSession"),
      ]);
      if (!active) return;
      /** Provides presence behavior. */
      const presence = new PlatformPresenceSession(new FirebasePresenceTransport(firebaseUid), {
        sessionId: crypto.randomUUID(),
        platform: "jest",
      });
      presenceRef.current = presence;
      await startOptionalPresence({
        enabled: sessionRef.current?.preferences.presenceEnabled === true,
        canStart: document.visibilityState !== "hidden",
        start: () => presence.start(true),
        reportFailure: (error) =>
          captureBrowserException(error, {
            component: "jest_presence",
            operation: "initialize",
          }),
      });
      /** Handles visibility. */
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          void presence.stop();
        } else if (sessionRef.current?.preferences.presenceEnabled === true) {
          void startOptionalPresence({
            enabled: true,
            canStart: true,
            start: () => presence.start(true),
            reportFailure: (error) =>
              captureBrowserException(error, {
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
      /** Provides presence behavior. */
      const presence = presenceRef.current;
      presenceRef.current = null;
      void presence?.stop();
    };
  }, [firebaseAuthenticated, firebaseUid, sessionRef]);

  /** Provides toggle presence behavior. */
  const togglePresence = useCallback(() => {
    /** Provides current session behavior. */
    const currentSession = sessionRef.current;
    /** Provides presence behavior. */
    const presence = presenceRef.current;
    if (!currentSession || !presence || !gate.isOpen()) return;
    /** Provides next behavior. */
    const next = currentSession.preferences.presenceEnabled !== true;
    void gate
      .run(async () => {
        await platform.writePreferences({presenceEnabled: next});
        await reconcilePresenceOptIn({
          enabled: next,
          canStart: document.visibilityState !== "hidden",
          start: () => presence.start(true),
          stop: () => presence.stop(),
          setConsent: async (enabled) => {
            /** Provides {set presence consent} behavior. */
            const {setPresenceConsent} = await import("../../../../packages/web-game/src/firebase");
            await setPresenceConsent({enabled});
          },
        });
        /** Provides preferences behavior. */
        const preferences = {...currentSession.preferences, presenceEnabled: next};
        sessionRef.current = {...currentSession, preferences};
        setSession((value) => (value ? {...value, preferences: {...value.preferences, presenceEnabled: next}} : value));
      })
      .catch((presenceError) => {
        captureBrowserException(presenceError, {component: "jest_presence", operation: "toggle"});
        trackFailure("presence_toggle_failed");
      });
  }, [gate, platform, sessionRef, setSession, trackFailure]);

  /** Sets presence state. */
  const setPresenceState = useCallback((state: ActivePresenceState) => {
    void presenceRef.current?.setState(state).catch((presenceError) => {
      captureBrowserException(presenceError, {component: "jest_presence", operation: "state"});
    });
  }, []);

  return {setPresenceState, togglePresence};
}

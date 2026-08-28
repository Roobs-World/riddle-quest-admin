import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {subscribeToPlayerPreferenceChanges} from "../play/playerPreferences";
import type {JestEngagementProgress, JestPlayerData, JestPlayerDataUpdate, JestSession} from "./types";
import type {JestPlatformPort} from "./types";
import type {NotificationOperationGate} from "./notifications/operationGate";

/** Owns every queued app-state SDK write so deletion can quiesce and drain them together. */
export function useJestPlayerStateWrites({
  platform,
  gate,
  sessionRef,
  setSession,
  setEngagementProgress,
  trackFailure,
}: {
  /** Stores platform. */
  platform: JestPlatformPort;
  /** Stores gate. */
  gate: NotificationOperationGate;
  /** Stores session ref. */
  sessionRef: MutableRefObject<JestSession | null>;
  /** Stores set session. */
  setSession: Dispatch<SetStateAction<JestSession | null>>;
  /** Stores set engagement progress. */
  setEngagementProgress: Dispatch<SetStateAction<JestEngagementProgress>>;
  /** Stores track failure. */
  trackFailure: (eventName: string) => void;
}) {
  /** Provides player data ref behavior. */
  const playerDataRef = useRef<JestPlayerData | null>(null);
  /** Provides player data write queue ref behavior. */
  const playerDataWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  /** Provides preference write queue ref behavior. */
  const preferenceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  /** Provides enabled ref behavior. */
  const enabledRef = useRef(false);

  useEffect(
    () =>
      subscribeToPlayerPreferenceChanges((change) => {
        /** Provides current session behavior. */
        const currentSession = sessionRef.current;
        if (!enabledRef.current || !currentSession || !gate.isOpen()) return;
        /** Provides preferences behavior. */
        const preferences = {...currentSession.preferences, ...change};
        sessionRef.current = {...currentSession, preferences};
        setSession((current) => (current ? {...current, preferences: {...current.preferences, ...change}} : current));
        /** Provides write behavior. */
        const write = preferenceWriteQueueRef.current
          .catch(() => undefined)
          .then(() => gate.run(() => platform.writePreferences(change)));
        preferenceWriteQueueRef.current = write;
        void write.catch((error) => {
          console.warn("[riddle-quest] Jest preference save failed", error);
          trackFailure("preference_save_failed");
        });
      }),
    [gate, platform, sessionRef, setSession, trackFailure],
  );

  /** Saves player data. */
  const savePlayerData = useCallback(
    (update: JestPlayerDataUpdate) => {
      if (!enabledRef.current || !sessionRef.current || !gate.isOpen()) return;
      if (update.profile) {
        setEngagementProgress({
          level: update.profile.level,
          winStreak: update.profile.winStreak,
          wins: update.profile.wins,
        });
      }
      /** Provides next behavior. */
      const next: JestPlayerData = {
        ...(playerDataRef.current ?? {}),
        schemaVersion: 1,
        updatedAt: Date.now(),
        ...update,
      };
      playerDataRef.current = next;
      /** Provides write behavior. */
      const write = playerDataWriteQueueRef.current
        .catch(() => undefined)
        .then(() => gate.run(() => platform.writePlayerData(next)));
      playerDataWriteQueueRef.current = write;
      void write.catch((error) => {
        console.warn("[riddle-quest] Jest player data save failed", error);
        trackFailure("player_data_save_failed");
      });
    },
    [gate, platform, sessionRef, setEngagementProgress, trackFailure],
  );

  return useMemo(
    () => ({
      savePlayerData,
      disable: () => {
        enabledRef.current = false;
      },
      enable: (playerData: JestPlayerData | null) => {
        playerDataRef.current = playerData;
        enabledRef.current = true;
      },
      drainAndClear: async () => {
        enabledRef.current = false;
        await Promise.all([
          playerDataWriteQueueRef.current.catch(() => undefined),
          preferenceWriteQueueRef.current.catch(() => undefined),
        ]);
        playerDataRef.current = null;
        /** Provides current session behavior. */
        const currentSession = sessionRef.current;
        if (currentSession) {
          sessionRef.current = {...currentSession, preferences: {}, playerData: null};
          setSession((current) => (current ? {...current, preferences: {}, playerData: null} : current));
        }
      },
    }),
    [savePlayerData, sessionRef, setSession],
  );
}

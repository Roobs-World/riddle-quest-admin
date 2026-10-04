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
import {PlayerSaveRecovery} from "../platform/PlayerSaveRecovery";
import {reconcileJestPlayerProjection} from "./reconcileJestPlayerProjection";

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
  /** Latest projections stay dirty until their own SDK write is acknowledged. */
  const dirtyPlayerDataRef = useRef<JestPlayerData | null>(null);
  /** Merged preferences also survive a failed SDK flush. */
  const dirtyPreferencesRef = useRef<JestSession["preferences"] | null>(null);
  /** Retry policy invokes the latest queue adapter without resubscribing browser signals. */
  const retryRef = useRef<() => Promise<void>>(async () => undefined);
  /** Gate identity follows the latest target session without replacing the recovery owner. */
  const gateRef = useRef(gate);
  gateRef.current = gate;
  /** One bounded recovery owner shares the React view's lifetime. */
  const recoveryRef = useRef<PlayerSaveRecovery | null>(null);
  if (!recoveryRef.current) recoveryRef.current = new PlayerSaveRecovery(() => retryRef.current(), () =>
    enabledRef.current && gateRef.current.isOpen() && (typeof navigator === "undefined" || navigator.onLine !== false) &&
    (typeof document === "undefined" || document.visibilityState !== "hidden"));
  /** One recovery owner spans the current view. */
  const recovery = recoveryRef.current;
  /** A successful older write must not cancel retries for newer unacknowledged state. */
  const recoverIfClean = useCallback(() => {
    if (!dirtyPlayerDataRef.current && !dirtyPreferencesRef.current) recovery.recovered();
  }, [recovery]);
  /** Session visits retire callbacks even when the same player starts again. */
  const generationRef = useRef(0);
  /** First accepted update binds a startup projection after its session has been committed. */
  const projectionOwnerRef = useRef<string | null>(null);
  /** Only a waiting snapshot can be replaced; SDK writes already entered remain fixed. */
  const queuedPlayerWriteRef = useRef<{
    /** Latest complete client projection in this waiting group. */ snapshot: JestPlayerData;
    /** Owning session visit. */ generation: number;
  } | null>(null);
  /** Rechecks ownership after cross-context lock acquisition and before SDK mutation. */
  const ownsWrite = useCallback((generation: number, playerId: string) =>
    generationRef.current === generation && sessionRef.current?.player.playerId === playerId, [sessionRef]);
  /** An unannounced identity change cannot reuse another player's cached projection. */
  const claimOwner = useCallback((playerId: string) => {
    if (projectionOwnerRef.current !== null && projectionOwnerRef.current !== playerId) {
      generationRef.current++;
      queuedPlayerWriteRef.current = null;
      playerDataRef.current = null;
      dirtyPlayerDataRef.current = null;
      dirtyPreferencesRef.current = null;
      recovery.recovered();
    }
    projectionOwnerRef.current = playerId;
  }, [recovery]);

  /** Queues merged unacknowledged preference patches without overwriting unrelated SDK metadata. */
  const savePreferences = useCallback((preferences: JestSession["preferences"]) => {
    /** Captures target identity before entering asynchronous storage work. */
    const currentSession = sessionRef.current;
    if (!enabledRef.current || !currentSession || !gate.isOpen()) return Promise.resolve();
    /** The accepting session visit owns this asynchronous storage operation. */
    const generation = generationRef.current;
    /** Controlled provider writes expose retry and acknowledgement ordering. */
    const write = preferenceWriteQueueRef.current.catch(() => undefined).then(() => gate.run(async () => {
      if (!ownsWrite(generation, currentSession.player.playerId)) return;
      await platform.writePreferences(preferences);
      if (!ownsWrite(generation, currentSession.player.playerId)) return;
      if (dirtyPreferencesRef.current === preferences) dirtyPreferencesRef.current = null;
      recoverIfClean();
    }));
    preferenceWriteQueueRef.current = write;
    void write.catch((error) => {
      if (!ownsWrite(generation, currentSession.player.playerId)) return;
      recovery.failed();
      console.warn("[riddle-quest] Jest preference save failed", error);
      trackFailure("preference_save_failed");
    });
    return write;
  }, [gate, ownsWrite, platform, recoverIfClean, recovery, sessionRef, trackFailure]);

  useEffect(() => subscribeToPlayerPreferenceChanges((change) => {
    /** Captures target identity before entering asynchronous storage work. */
    const currentSession = sessionRef.current;
    if (!enabledRef.current || !currentSession || !gate.isOpen()) return;
    claimOwner(currentSession.player.playerId);
    /** Complete preference saves retain earlier failed fields. */
    const preferences = {...currentSession.preferences, ...change};
    sessionRef.current = {...currentSession, preferences};
    setSession((current) => (current ? {...current, preferences: {...current.preferences, ...change}} : current));
    dirtyPreferencesRef.current = {...(dirtyPreferencesRef.current ?? {}), ...change};
    void savePreferences(dirtyPreferencesRef.current);
  }), [claimOwner, gate, savePreferences, sessionRef, setSession]);

  /** Saves player data. */
  const savePlayerData = useCallback(
    (update: JestPlayerDataUpdate) => {
      /** Current target player owns both UI projection and its later SDK write. */
      const currentSession = sessionRef.current;
      if (!enabledRef.current || !currentSession || !gate.isOpen()) return;
      claimOwner(currentSession.player.playerId);
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
      dirtyPlayerDataRef.current = next;
      /** Later accepted values replace only the snapshot that has not entered the SDK. */
      const queued = queuedPlayerWriteRef.current;
      if (queued && queued.generation === generationRef.current) {
        queued.snapshot = next;
        return;
      }
      /** One queue node and failure report cover a complete group of waiting updates. */
      const batch = {snapshot: next, generation: generationRef.current};
      queuedPlayerWriteRef.current = batch;
      /** SDK acknowledgement remains the durability boundary. */
      const write = playerDataWriteQueueRef.current
        .catch(() => undefined)
        .then(() => gate.run(async () => {
          if (!ownsWrite(batch.generation, currentSession.player.playerId)) return;
          if (queuedPlayerWriteRef.current === batch) queuedPlayerWriteRef.current = null;
          await platform.writePlayerData(batch.snapshot);
          if (!ownsWrite(batch.generation, currentSession.player.playerId)) return;
          if (dirtyPlayerDataRef.current === batch.snapshot) dirtyPlayerDataRef.current = null;
          recoverIfClean();
        }))
        .finally(() => {
          if (queuedPlayerWriteRef.current === batch) queuedPlayerWriteRef.current = null;
        });
      playerDataWriteQueueRef.current = write;
      void write.catch((error) => {
        if (!ownsWrite(batch.generation, currentSession.player.playerId)) return;
        recovery.failed();
        console.warn("[riddle-quest] Jest player data save failed", error);
        trackFailure("player_data_save_failed");
      });
    },
    [claimOwner, gate, ownsWrite, platform, recoverIfClean, recovery, sessionRef, setEngagementProgress, trackFailure],
  );

  /** Recovery uses the same owned queues and newest accepted projections as ordinary saves. */
  retryRef.current = async () => {
    /** Captures target identity before entering asynchronous storage work. */
    const currentSession = sessionRef.current;
    /** The accepting session visit owns this asynchronous storage operation. */
    const generation = generationRef.current;
    if (!enabledRef.current || !gate.isOpen() || !currentSession ||
      currentSession.player.playerId !== projectionOwnerRef.current) return;
    /** A healthy in-flight save may acknowledge dirty state before retry becomes necessary. */
    await Promise.all([playerDataWriteQueueRef.current.catch(() => undefined), preferenceWriteQueueRef.current.catch(() => undefined)]);
    if (!enabledRef.current || !gate.isOpen() || !ownsWrite(generation, currentSession.player.playerId)) return;
    if (dirtyPlayerDataRef.current) savePlayerData({});
    if (dirtyPreferencesRef.current) void savePreferences(dirtyPreferencesRef.current);
    await Promise.all([playerDataWriteQueueRef.current, preferenceWriteQueueRef.current]);
  };

  useEffect(() => {
    recovery.attach();
    /** Browser lifecycle triggers the owned bounded recovery path. */
    const wake = () => recovery.wake();
    if (typeof window !== "undefined") window.addEventListener("online", wake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);
    return () => {
      recovery.detach();
      if (typeof window !== "undefined") window.removeEventListener("online", wake);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", wake);
    };
  }, [recovery]);

  return useMemo(
    () => ({
      /** Stable controller lets the game view observe health without replacing startup controls. */
      recovery,
      savePlayerData,
      disable: () => {
        enabledRef.current = false;
        recovery.recovered();
        generationRef.current++;
        queuedPlayerWriteRef.current = null;
      },
      enable: (playerData: JestPlayerData | null, playerId = sessionRef.current?.player.playerId) => {
        /** Stable target identity preserves only client progress, never an older authority profile. */
        const restored = playerId && projectionOwnerRef.current === playerId
          ? reconcileJestPlayerProjection(playerDataRef.current, playerData) : playerData;
        generationRef.current++;
        queuedPlayerWriteRef.current = null;
        projectionOwnerRef.current = playerId ?? null;
        recovery.recovered();
        dirtyPlayerDataRef.current = null;
        dirtyPreferencesRef.current = null;
        playerDataRef.current = restored;
        enabledRef.current = true;
        return restored;
      },
      drainAndClear: async () => {
        enabledRef.current = false;
        recovery.recovered();
        /** A concurrently enabled session must survive this older drain's completion. */
        const generation = generationRef.current;
        await Promise.all([
          playerDataWriteQueueRef.current.catch(() => undefined),
          preferenceWriteQueueRef.current.catch(() => undefined),
        ]);
        if (generationRef.current !== generation) return;
        generationRef.current++;
        queuedPlayerWriteRef.current = null;
        projectionOwnerRef.current = null;
        playerDataRef.current = null;
        dirtyPlayerDataRef.current = null;
        dirtyPreferencesRef.current = null;
        /** Provides current session behavior. */
        const currentSession = sessionRef.current;
        if (currentSession) {
          sessionRef.current = {...currentSession, preferences: {}, playerData: null};
          setSession((current) => (current ? {...current, preferences: {}, playerData: null} : current));
        }
      },
    }),
    [recovery, savePlayerData, sessionRef, setSession],
  );
}

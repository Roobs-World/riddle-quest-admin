import {useCallback, useEffect, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {trackEvent} from "../analytics/events";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import type {AuthSnapshot, HostServices, WebGameMode} from "./types";

/** Input required to own the host's complete single-player riddle lifecycle. */
type HostRiddleLifecycleOptions = Readonly<{
  /** Current authenticated player identifier, when available. */
  userId: string | undefined;
  /** Current profile used in correlated riddle responses. */
  profile: AuthSnapshot["profile"];
  /** Initial mode selected by the release target. */
  initialGameMode: WebGameMode;
  /** Current game locale. */
  locale: string;
  /** Target-specific host operations. */
  services: Pick<HostServices, "loadRiddle">;
  /** Runs globally blocking server activity. */
  withActivity: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  /** Delivers a bridge message to the game. */
  postToGame: (message: HostToGameMessage) => void;
  /** Delivers a correlated operation result. */
  postOperation: (
    requestId: string | undefined,
    operation: "loadRiddle",
    ok: boolean,
    data?: unknown,
    error?: string,
  ) => void;
  /** Nonfatal release-configuration warning restored after a successful load. */
  configurationWarning: string | null;
  /** Updates the host notice surface. */
  setNotice: (notice: string | null) => void;
  /** Runs once when the first riddle becomes interactive. */
  onPlayable?: () => void;
  /** Resynchronizes host state before each automatic recovery attempt. */
  onRecoveryAttempt: () => void;
}>;

/** Interface exposed to host routing and rendering. */
export type HostRiddleLifecycle = Readonly<{
  /** Current mode selected by the latest load request. */
  gameMode: WebGameMode;
  /** Whether at least one riddle has loaded in the current host lifetime. */
  startupComplete: boolean;
  /** Loads and delivers a riddle, preserving optional request correlation. */
  loadRiddle: (
    input: {
      /** Requested play mode. */
      gameMode: WebGameMode;
      /** Requested content locale. */
      locale: string;
      /** Optional classic progression index. */
      classicIndex?: number;
      /** The authoritative used by the current operation. */
      authoritative?: boolean;
    },
    requestId?: string,
  ) => Promise<boolean>;
}>;

/** Owns deduplicated loading, stale-result rejection, recovery, and readiness. */
export function useHostRiddleLifecycle({
  userId,
  profile,
  initialGameMode,
  locale,
  services,
  withActivity,
  postToGame,
  postOperation,
  configurationWarning,
  setNotice,
  onPlayable,
  onRecoveryAttempt,
}: HostRiddleLifecycleOptions): HostRiddleLifecycle {
  /** Current accepted play mode. */
  const [gameMode, setGameMode] = useState<WebGameMode>(initialGameMode);
  /** Whether the first riddle has loaded. */
  const [startupComplete, setStartupComplete] = useState(false);
  /** Whether the current context already has a playable riddle. */
  const loadedRef = useRef(false);
  /** Shared uncorrelated automatic load, when present. */
  const loadInFlightRef = useRef<Promise<boolean> | null>(null);
  /** Generation that rejects stale async load results. */
  const contextVersionRef = useRef(0);
  /** Latest recovery scheduler used by failed load attempts. */
  const scheduleRecoveryRef = useRef<() => void>(() => undefined);
  /** Latest accepted mode used by recovery. */
  const gameModeRef = useRef(gameMode);
  /** Latest classic progression index used by recovery. */
  const classicIndexRef = useRef(profile?.classicIndex);
  gameModeRef.current = gameMode;
  classicIndexRef.current = profile?.classicIndex;

  /** Loads and delivers one correlated or automatic riddle. */
  const loadRiddle = useCallback(
    async (
      input: {
        /** Requested play mode. */
        gameMode: WebGameMode;
        /** Requested content locale. */
        locale: string;
        /** Optional classic progression index. */
        classicIndex?: number;
        /** The authoritative used by the current operation. */
        authoritative?: boolean;
      },
      requestId?: string,
    ): Promise<boolean> => {
      // Recovery calls may share one request. Correlated game requests must run
      // independently so every requestId receives its own response.
      if (!requestId && loadInFlightRef.current) return loadInFlightRef.current;
      /** Context generation captured before asynchronous work. */
      const contextVersion = contextVersionRef.current;
      /** Complete pending load outcome. */
      const pending = (async () => {
        try {
          setGameMode(input.gameMode);
          /** Authoritative riddle returned by the active target adapter. */
          const riddle = await withActivity(() => services.loadRiddle(input));
          if (contextVersion !== contextVersionRef.current) return false;
          loadedRef.current = true;
          postToGame({
            type: "host:riddleLoaded",
            requestId,
            payload: {riddle, profile},
          });
          postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
          trackEvent("level_start", {
            game_mode: riddle.gameMode,
            level_name: riddle.index === undefined ? riddle.gameMode : `${riddle.gameMode}_${riddle.index}`,
            level_number: riddle.index,
          });
          setNotice(configurationWarning);
          setStartupComplete(true);
          onPlayable?.();
          return true;
        } catch (error) {
          loadedRef.current = false;
          captureBrowserException(error, {component: "play_host", operation: "loadRiddle"});
          /** Safe player-facing failure notice. */
          const message = getHostErrorMessage(error);
          setNotice(message);
          postOperation(requestId, "loadRiddle", false, undefined, message);
          scheduleRecoveryRef.current();
          return false;
        }
      })();
      loadInFlightRef.current = pending;
      return pending.finally(() => {
        if (loadInFlightRef.current === pending) loadInFlightRef.current = null;
      });
    },
    [configurationWarning, onPlayable, postOperation, postToGame, profile, services, setNotice, withActivity],
  );
  /** Latest load implementation used by recovery timers. */
  const loadRiddleRef = useRef(loadRiddle);
  loadRiddleRef.current = loadRiddle;

  useEffect(() => {
    contextVersionRef.current += 1;
    loadInFlightRef.current = null;
    loadedRef.current = false;
    if (!userId) return;
    /** Whether this context generation has been disposed. */
    let cancelled = false;
    /** Active recovery timer. */
    let recoveryTimer: number | undefined;
    /** Consecutive failed recovery attempts. */
    let failedAttempts = 0;
    /** Replaces the active recovery timer with a bounded retry. */
    const scheduleRecovery = (delayMs: number) => {
      if (cancelled) return;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => void recoverRiddle(), delayMs);
    };
    /** Resynchronizes the host and retries the current riddle context. */
    const recoverRiddle = async () => {
      onRecoveryAttempt();
      if (loadedRef.current || cancelled) return;
      /** Whether the recovery produced a playable riddle. */
      const loaded = await loadRiddleRef.current({
        gameMode: gameModeRef.current,
        locale,
        classicIndex: classicIndexRef.current,
      });
      if (loaded || cancelled) return;
      failedAttempts += 1;
      scheduleRecovery(Math.min(30_000, 500 * 2 ** Math.min(failedAttempts, 6)));
    };
    scheduleRecoveryRef.current = () => scheduleRecovery(250);
    scheduleRecovery(250);
    return () => {
      cancelled = true;
      scheduleRecoveryRef.current = () => undefined;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
    };
  }, [locale, onRecoveryAttempt, userId]);

  return {gameMode, startupComplete, loadRiddle};
}

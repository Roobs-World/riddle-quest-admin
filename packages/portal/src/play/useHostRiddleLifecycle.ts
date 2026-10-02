import {useCallback, useEffect, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {trackEvent} from "../analytics/events";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import type {AuthSnapshot, HostServices, WebGameMode} from "./types";
import {preloadGameModals} from "./preloadGameModals";

/** Input required to own the host's complete single-player riddle lifecycle. */
type HostRiddleLifecycleOptions = Readonly<{
  /** Current authenticated player identifier, when available. */
  userId: string | undefined;
  /** Current profile used in correlated riddle responses. */
  profile: AuthSnapshot["profile"];
  /** Initial mode selected by the release target. */
  initialGameMode: WebGameMode;
  /** Exposes a rendered startup failure through the target’s loading overlay. */
  onStartupUnavailable?: () => void;
  /** Current game locale. */
  locale: string;
  /** Target-specific host operations. */
  services: Pick<HostServices, "loadRiddle" | "preloadInitialRiddles">;
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
  /** Whether a failed load has exposed recovery controls before the first riddle. */
  startupUnavailable: boolean;
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
  onStartupUnavailable,
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
  /** Keeps failed startup distinct from readiness and automatic Classic routing. */
  const [startupUnavailable, setStartupUnavailable] = useState(false);
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
      if (input.classicIndex !== undefined) classicIndexRef.current = input.classicIndex;
      // Recovery calls may share one request. Correlated game requests must run
      // independently so every requestId receives its own response.
      if (!requestId && loadInFlightRef.current) return loadInFlightRef.current;
      /** Context generation captured before asynchronous work. */
      const contextVersion = contextVersionRef.current;
      /** Complete pending load outcome. */
      const pending = (async () => {
        try {
          setGameMode(input.gameMode);
          // Prepare Hint/Skip while the adapter loads and refills its issued question buffer.
          void preloadGameModals().catch(() => undefined);
          /** Authoritative riddle returned by the active target adapter. */
          const riddle = loadedRef.current && !input.authoritative
            ? await services.loadRiddle(input)
            : await withActivity(() => services.loadRiddle(input));
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
          setStartupUnavailable(false);
          onPlayable?.();
          return true;
        } catch (error) {
          // A speculative Skip load is optional; the accepted Skip response will load its successor.
          if (contextVersion !== contextVersionRef.current || requestId?.startsWith("skip-preview-")) return false;
          loadedRef.current = false;
          /** Server-confirmed completion is an expected routing outcome. */
          const dailyCompleted = input.gameMode === "challenge" && typeof error === "object" &&
            error !== null && "code" in error && error.code === "daily-completed";
          if (!dailyCompleted) captureBrowserException(error, {component: "play_host", operation: "loadRiddle"});
          /** Safe player-facing failure notice. */
          const message = getHostErrorMessage(error);
          setNotice(message);
          postOperation(requestId, "loadRiddle", false, undefined, message);
          // Only the server-confirmed completion of today’s Daily allows an automatic Classic launch.
          // Outages remain on Daily and use the existing bounded recovery loop.
          if (dailyCompleted && !requestId) {
            gameModeRef.current = "classic";
            setGameMode("classic");
            try {
              /** Canonical next question supplied by the current authority-owned content state. */
              const riddle = await withActivity(() => services.loadRiddle({
                gameMode: "classic", locale: input.locale, classicIndex: classicIndexRef.current,
              }));
              if (contextVersion !== contextVersionRef.current) return false;
              loadedRef.current = true;
              postToGame({type: "host:riddleLoaded", payload: {riddle, profile}});
              setStartupComplete(true);
              setStartupUnavailable(false);
              // Completion is an expected launch decision, not a failure notice.
              setNotice(configurationWarning);
              trackEvent("level_start", {game_mode: riddle.gameMode,
                level_name: riddle.index === undefined ? riddle.gameMode : `${riddle.gameMode}_${riddle.index}`,
                level_number: riddle.index});
              onPlayable?.();
              return true;
            } catch (fallbackError) {
              if (contextVersion !== contextVersionRef.current) return false;
              captureBrowserException(fallbackError, {component: "play_host", operation: "loadRiddle"});
              setNotice(getHostErrorMessage(fallbackError));
            }
          }
          setStartupUnavailable(true);
          onStartupUnavailable?.();
          scheduleRecoveryRef.current();
          return false;
        }
      })();
      loadInFlightRef.current = pending;
      return pending.finally(() => {
        if (loadInFlightRef.current === pending) loadInFlightRef.current = null;
      });
    },
    [configurationWarning, onPlayable, onStartupUnavailable, postOperation, postToGame, profile, services, setNotice, withActivity],
  );
  /** Latest load implementation used by recovery timers. */
  const loadRiddleRef = useRef(loadRiddle);
  loadRiddleRef.current = loadRiddle;

  useEffect(() => {
    contextVersionRef.current += 1;
    loadInFlightRef.current = null;
    loadedRef.current = false;
    if (!userId) return;
    services.preloadInitialRiddles?.(locale);
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

  return {gameMode, startupComplete, startupUnavailable, loadRiddle};
}

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {trackEvent} from "../analytics/events";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import type {AuthSnapshot, HostServices, WebGameMode} from "./types";
import {preloadGameModals} from "./preloadGameModals";
import {riddleLoadDeadline} from "./riddleLoadDeadline";

/** Input required to own the host's complete single-player riddle lifecycle. */
type HostRiddleLifecycleOptions = Readonly<{
  /** Current authenticated player identifier, when available. */
  userId: string | undefined;
  /** Recreated identities with the same UID start a fresh content lifetime. */
  accountGeneration?: number;
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
  /** Target admission must still permit consuming previously issued local content. */
  canUsePreparedQuestions?: () => boolean;
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
      /** Originating session binds a silent Classic successor preparation. */
      sessionToken?: string;
      /** Originating question must match the one already delivered to this account. */
      riddleId?: string;
      /** Silent, read-only preparation leaves presentation and progression unchanged. */
      prepareNext?: true;
    },
    requestId?: string,
  ) => Promise<boolean>;
}>;

/** Owns deduplicated loading, stale-result rejection, recovery, and readiness. */
export function useHostRiddleLifecycle({
  userId,
  accountGeneration,
  profile,
  initialGameMode,
  onStartupUnavailable,
  locale,
  services,
  canUsePreparedQuestions,
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
  /** Only the latest visible load may publish content or start failure recovery. */
  const deliveryRef = useRef<AbortController | null>(null);
  /** Generation that rejects stale async load results. */
  const contextVersionRef = useRef(0);
  /** Retires bounded content waits immediately when identity, locale, or host lifetime changes. */
  const contextAbortRef = useRef<AbortController | null>(null);
  if (!contextAbortRef.current) contextAbortRef.current = new AbortController();
  /** Profile changes during content delivery must not rewind confirmed balances or progression. */
  const profileRef = useRef(profile);
  profileRef.current = profile;
  /** Stable content ownership excludes ordinary balance and presentation updates. */
  const preparationScope = useMemo(() => ({userId, accountGeneration, locale, services, canUsePreparedQuestions}),
    [userId, accountGeneration, locale, services, canUsePreparedQuestions]);
  /** Only a committed content lifetime may issue or consume preparation. */
  const preparationScopeRef = useRef<typeof preparationScope | null>(preparationScope);
  useLayoutEffect(() => {
    preparationScopeRef.current = preparationScope;
    return () => {if (preparationScopeRef.current === preparationScope) preparationScopeRef.current = null;};
  }, [preparationScope]);
  /** Only the successor of the last delivered question may be prepared. */
  const deliveredRiddleRef = useRef<Awaited<ReturnType<HostServices["loadRiddle"]>> | null>(null);
  /** Delivered content keeps its admitting account visit until a new question actually arrives. */
  const deliveredScopeRef = useRef<typeof preparationScope | null>(null);
  /** One short-lived issued question is consumed once, without caching profile or economy state. */
  const preparedRef = useRef<{
    /** Current authentication/content context captured before guarded service work. */
    scope: typeof preparationScope;
    /** Passive context retirement and ABA replacement invalidate this read. */
    version: number;
    /** The still-displayed predecessor owns this successor. */
    parentToken: string;
    /** Exact issued successor position requested through the provider adapter. */
    index: number;
    /** Ready snapshot remains bounded independently of victory presentation duration. */
    readyAt: number;
    /** Only a successful adapter response can be used by explicit Next. */
    riddle: Awaited<ReturnType<HostServices["loadRiddle"]>> | null;
  } | null>(null);
  /** Render-time replacement cannot admit an earlier prepared account, locale or provider. */
  const ownsPreparation = (entry: NonNullable<typeof preparedRef.current>) => {
    /** Latest render's scope revokes stale preparations before effect cleanup. */
    const current = preparationScopeRef.current;
    return !contextAbortRef.current?.signal.aborted && entry.version === contextVersionRef.current &&
      entry.scope === current &&
      deliveredScopeRef.current === entry.scope && deliveredRiddleRef.current?.sessionToken === entry.parentToken;
  };
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
        /** Bound predecessor session for preparation, or ordinary resume identity. */
        sessionToken?: string;
        /** Bound predecessor question for preparation, or ordinary resume identity. */
        riddleId?: string;
        /** Prepares an issued successor without changing visible host state. */
        prepareNext?: true;
      },
      requestId?: string,
    ): Promise<boolean> => {
      if (input.prepareNext) {
        /** Current delivered content supplies the sole permitted preparation origin. */
        const parent = deliveredRiddleRef.current;
        if (preparationScopeRef.current !== preparationScope || deliveredScopeRef.current !== preparationScope || !userId || input.gameMode !== "classic" || input.locale !== locale || input.authoritative ||
          !parent || parent.gameMode !== "classic" || !Number.isSafeInteger(parent.index) || !Number.isSafeInteger(parent.index! + 1) ||
          input.classicIndex !== parent.index! + 1 || input.sessionToken !== parent.sessionToken ||
          input.riddleId !== parent.riddleId || contextAbortRef.current!.signal.aborted) return false;
        /** Only the preparation installed by this invocation may be cleared on failure. */
        let entry: NonNullable<typeof preparedRef.current> | null = null;
        try {
          if (canUsePreparedQuestions && !canUsePreparedQuestions()) return false;
          /** Repeated presentation renders share one preparation for this exact predecessor. */
          const previous = preparedRef.current;
          if (previous && ownsPreparation(previous) && previous.index === input.classicIndex &&
            (!previous.riddle || (Date.now() - previous.readyAt >= 0 && Date.now() - previous.readyAt < 15_000))) return true;
          /** Publication requires both this slot and its original account context to remain owned. */
          entry = {scope: preparationScope,
            version: contextVersionRef.current, parentToken: parent.sessionToken, index: input.classicIndex,
            readyAt: 0, riddle: null};
          preparedRef.current = entry;
          /** The existing adapter and its account gate issue the question; origin IDs never become resume IDs. */
          const riddle = await riddleLoadDeadline(services.loadRiddle({gameMode: "classic", locale: input.locale,
            classicIndex: input.classicIndex}), contextAbortRef.current!.signal);
          if (preparedRef.current !== entry || !ownsPreparation(entry)) return false;
          if (riddle.gameMode !== "classic" || riddle.index !== entry.index || riddle.sessionToken === parent.sessionToken) {
            preparedRef.current = null; return false;
          }
          entry.riddle = riddle; entry.readyAt = Date.now();
          return true;
        } catch {
          // Preparation is optional. A failed read never changes startup, notices or recovery cadence.
          if (entry && preparedRef.current === entry) preparedRef.current = null;
          return false;
        }
      }
      if (input.classicIndex !== undefined) classicIndexRef.current = input.classicIndex;
      // Automatic recovery shares the active request. Correlated reads remain
      // independent, but a newer visible request retires the older delivery wait.
      if (!requestId && loadInFlightRef.current) return loadInFlightRef.current;
      /** Context generation captured before asynchronous work. */
      const contextVersion = contextVersionRef.current;
      /** The admitting context owns both the first load and any completed-Daily fallback. */
      const contextSignal = contextAbortRef.current!.signal;
      if (contextSignal.aborted) return false;
      /** Supersession releases loading activity without cancelling admitted provider work. */
      const delivery = new AbortController();
      deliveryRef.current?.abort();
      deliveryRef.current = delivery;
      /** Account retirement and request supersession both retire this bounded wait. */
      const retireDelivery = () => delivery.abort();
      contextSignal.addEventListener("abort", retireDelivery, {once: true});
      /** Obsolete successes and failures cannot mutate the latest board's host state. */
      const ownsDelivery = () => contextVersion === contextVersionRef.current &&
        deliveryRef.current === delivery && !delivery.signal.aborted;
      /** Complete pending load outcome. */
      const pending = (async () => {
        try {
          setGameMode(input.gameMode);
          // Prepare Hint/Skip while the adapter loads and refills its issued question buffer.
          void preloadGameModals().catch(() => undefined);
          /** Authoritative riddle returned by the active target adapter. */
          const prepared = preparedRef.current;
          preparedRef.current = null;
          /** Explicit Next consumes only a fresh successor under the still-open target admission guard. */
          /** A failed synchronous guard disables the optimization without breaking the ordinary guarded load. */
          let preparationAllowed = preparationScopeRef.current === preparationScope;
          try {preparationAllowed = preparationAllowed && (!canUsePreparedQuestions || canUsePreparedQuestions());}
          catch {preparationAllowed = false;}
          /** A prepared response is still bound to the admitted account and exact successor. */
          const ready = preparationAllowed && prepared && ownsPreparation(prepared) && prepared.riddle &&
            Date.now() - prepared.readyAt >= 0 && Date.now() - prepared.readyAt < 15_000 &&
            input.gameMode === "classic" && input.locale === prepared.scope.locale && input.classicIndex === prepared.index &&
            !input.authoritative && !input.sessionToken && !input.riddleId ? prepared.riddle : null;
          /** Prepared local content needs no further provider operation or lock acquisition. */
          const riddle = ready ?? (loadedRef.current && !input.authoritative
            ? await riddleLoadDeadline(services.loadRiddle(input), delivery.signal)
            : await withActivity(() => riddleLoadDeadline(services.loadRiddle(input), delivery.signal)));
          if (!ownsDelivery()) return false;
          loadedRef.current = true;
          deliveredRiddleRef.current = riddle;
          deliveredScopeRef.current = preparationScope;
          postToGame({
            type: "host:riddleLoaded",
            requestId,
            payload: {riddle, profile: profileRef.current},
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
          if (!ownsDelivery() || requestId?.startsWith("skip-preview-")) return false;
          loadedRef.current = false;
          /** Server-confirmed completion is an expected routing outcome. */
          const dailyCompleted = input.gameMode === "challenge" && typeof error === "object" &&
            error !== null && "code" in error && error.code === "daily-completed";
          if (!dailyCompleted) captureBrowserException(error, {component: "play_host", operation: "loadRiddle"});
          /** Safe player-facing failure notice. */
          const message = getHostErrorMessage(error);
          // Confirmed Daily completion routes both launch and Next Level requests to Classic.
          // Outages remain on Daily and use the existing bounded recovery loop.
          if (dailyCompleted) {
            gameModeRef.current = "classic";
            setGameMode("classic");
            try {
              /** Canonical next question supplied by the current authority-owned content state. */
              const riddle = await withActivity(() => riddleLoadDeadline(services.loadRiddle({
                gameMode: "classic", locale: input.locale, classicIndex: classicIndexRef.current,
              }), delivery.signal));
              if (!ownsDelivery()) return false;
              loadedRef.current = true;
              deliveredRiddleRef.current = riddle;
              deliveredScopeRef.current = preparationScope;
              postToGame({type: "host:riddleLoaded", requestId, payload: {riddle, profile: profileRef.current}});
              postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
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
              if (!ownsDelivery()) return false;
              captureBrowserException(fallbackError, {component: "play_host", operation: "loadRiddle"});
              /** Safe failure text returned through the original correlated load request. */
              const fallbackMessage = getHostErrorMessage(fallbackError);
              setNotice(fallbackMessage);
              postOperation(requestId, "loadRiddle", false, undefined, fallbackMessage);
            }
          } else {
            setNotice(message);
            postOperation(requestId, "loadRiddle", false, undefined, message);
          }
          setStartupUnavailable(true);
          onStartupUnavailable?.();
          scheduleRecoveryRef.current();
          return false;
        }
      })();
      loadInFlightRef.current = pending;
      return pending.finally(() => {
        contextSignal.removeEventListener("abort", retireDelivery);
        if (deliveryRef.current === delivery) deliveryRef.current = null;
        if (loadInFlightRef.current === pending) loadInFlightRef.current = null;
      });
    },
    [configurationWarning, onPlayable, onStartupUnavailable, postOperation, postToGame, services, setNotice, withActivity,
      userId, locale, canUsePreparedQuestions, preparationScope],
  );
  /** Latest load implementation used by recovery timers. */
  const loadRiddleRef = useRef(loadRiddle);
  loadRiddleRef.current = loadRiddle;

  useEffect(() => {
    contextVersionRef.current += 1;
    contextAbortRef.current?.abort();
    contextAbortRef.current = new AbortController();
    loadInFlightRef.current = null;
    loadedRef.current = false;
    preparedRef.current = null;
    deliveredRiddleRef.current = null;
    deliveredScopeRef.current = null;
    classicIndexRef.current = profileRef.current?.classicIndex;
    setStartupComplete(false);
    setStartupUnavailable(false);
    if (!userId) return;
    services.preloadInitialRiddles?.(locale);
    /** Whether this context generation has been disposed. */
    let cancelled = false;
    /** Active recovery timer. */
    let recoveryTimer: number | undefined;
    /** Consecutive failed recovery attempts. */
    let failedAttempts = 0;
    /** One recovery observer owns a shared content result and its failure accounting. */
    let recovering = false;
    /** Replaces the active recovery timer with a bounded retry. */
    const scheduleRecovery = (delayMs: number) => {
      if (cancelled) return;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => void recoverRiddle(), delayMs);
    };
    /** Resynchronizes the host and retries the current riddle context. */
    const recoverRiddle = async () => {
      if (loadedRef.current || cancelled || recovering || navigator.onLine === false) return;
      recovering = true;
      try {
        onRecoveryAttempt();
        /** Whether the recovery produced a playable riddle. */
        const loaded = await loadRiddleRef.current({
          gameMode: gameModeRef.current,
          locale,
          classicIndex: classicIndexRef.current,
        });
        if (loaded || cancelled) return;
        failedAttempts += 1;
        scheduleRecovery(Math.min(30_000, 500 * 2 ** Math.min(failedAttempts, 6)));
      } finally {recovering = false;}
    };
    scheduleRecoveryRef.current = () => scheduleRecovery(250);
    /** Recover immediately when the browser regains connectivity or returns to the game. */
    const resumeRecovery = () => {
      if (cancelled || loadedRef.current || navigator.onLine === false) return;
      failedAttempts = 0;
      if (!recovering) scheduleRecovery(0);
    };
    /** Hidden frames keep their existing retry schedule; foregrounding supplies a fresh signal. */
    const onVisibilityChange = () => {if (document.visibilityState === "visible") resumeRecovery();};
    window.addEventListener("online", resumeRecovery);
    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleRecovery(250);
    return () => {
      cancelled = true;
      // Invalidate pending requests even when this cleanup is a final unmount.
      contextVersionRef.current += 1;
      contextAbortRef.current?.abort();
      preparedRef.current = null;
      deliveredRiddleRef.current = null;
      deliveredScopeRef.current = null;
      scheduleRecoveryRef.current = () => undefined;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      window.removeEventListener("online", resumeRecovery);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [accountGeneration, locale, onRecoveryAttempt, userId]);

  return {gameMode, startupComplete, startupUnavailable, loadRiddle};
}

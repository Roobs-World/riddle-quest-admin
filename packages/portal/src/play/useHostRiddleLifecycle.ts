import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {trackEvent} from "../analytics/events";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {getHostErrorMessage} from "./hostMessageHandlers";
import type {AuthSnapshot, HostServices, WebGameMode} from "./types";
import {preloadGameModals} from "./preloadGameModals";
import {riddleLoadDeadline} from "./riddleLoadDeadline";

/** Reports riddle failures through the fixed host diagnostic scope. */
const reportRiddleFailure = (error: unknown) => captureBrowserException(error, {component: "play_host", operation: "loadRiddle"});

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
  /** A retired game frame (failed bridge validation) must not start automatic riddle recovery. */
  recoverySuspended?: boolean;
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
  recoverySuspended = false,
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
  /** Recovery timers read committed suspension so abandoned renders cannot change provider admission. */
  const recoverySuspendedRef = useRef(recoverySuspended);
  /** Shared uncorrelated automatic load, when present. */
  const loadInFlightRef = useRef<Promise<boolean> | null>(null);
  /** Only the latest visible load may publish content or start failure recovery. */
  const deliveryRef = useRef<AbortController | null>(null);
  /** Optional Skip previews never retire canonical delivery or own automatic recovery. */
  const skipPreviewDeliveryRef = useRef<AbortController | null>(null);
  /** Generation that rejects stale async load results. */
  const contextVersionRef = useRef(0);
  /** Retires bounded content waits immediately when identity, locale, or host lifetime changes. */
  const contextAbortRef = useRef<AbortController | null>(null);
  if (!contextAbortRef.current) contextAbortRef.current = new AbortController();
  /** Profile changes during content delivery must not rewind confirmed balances or progression. */
  const profileRef = useRef(profile);
  /** Ordinary loads belong to an account visit, locale, and provider, independently of optional preparation. */
  const contextScope = useMemo(() => ({userId, accountGeneration, locale, services}),
    [userId, accountGeneration, locale, services]);
  /** Only committed ownership may admit a visible read or accept its result. */
  const contextScopeRef = useRef<typeof contextScope | null>(null);
  /** The account visit and locale whose visible board the committed context last owned. */
  const boardScopeRef = useRef<{
    /** Account whose board is visible. */ userId: string | undefined;
    /** Account visit generation. */ accountGeneration: number | undefined;
    /** Content language. */ locale: string;
  } | null>(null);
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
    /** Committed context retirement and ABA replacement invalidate this read. */
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
  /** Committed replacement cannot admit an earlier prepared account, locale or provider. */
  const ownsPreparation = (entry: NonNullable<typeof preparedRef.current>) => {
    /** Latest committed scope revokes stale preparations before passive effect cleanup. */
    const current = preparationScopeRef.current;
    return !contextAbortRef.current?.signal.aborted && entry.version === contextVersionRef.current &&
      entry.scope === current &&
      deliveredScopeRef.current === entry.scope && deliveredRiddleRef.current?.sessionToken === entry.parentToken;
  };
  /** Deferred content preparation retires independently of already admitted visible reads. */
  const warmupAbortRef = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    /** Only a committed context may retain lazy warmup admission. */
    const warmup = new AbortController();
    warmupAbortRef.current = warmup;
    if (recoverySuspended) warmup.abort();
    return () => {warmup.abort();};
  }, [contextScope, recoverySuspended]);
  /** Latest recovery scheduler used by failed load attempts. */
  const scheduleRecoveryRef = useRef<() => void>(() => undefined);
  /** Latest accepted mode used by recovery. */
  const gameModeRef = useRef(gameMode);
  /** Latest classic progression index used by recovery. */
  const classicIndexRef = useRef(profile?.classicIndex);
  /** Recovery observes the callback from the latest committed render without restarting content ownership. */
  const onRecoveryAttemptRef = useRef(onRecoveryAttempt);

  useLayoutEffect(() => {
    /** This commit owns its own controller; older passive cleanup cannot abort it. */
    const context = new AbortController();
    contextScopeRef.current = contextScope;
    contextVersionRef.current += 1;
    contextAbortRef.current?.abort();
    contextAbortRef.current = context;
    loadInFlightRef.current = null;
    preparedRef.current = null;
    // Provider-owned content is released on every context change, so an old provider's
    // question cannot seed preparation or stay reachable from the replacement.
    deliveredRiddleRef.current = null;
    deliveredScopeRef.current = null;
    scheduleRecoveryRef.current = () => undefined;
    /** A provider swap within the same account visit keeps the visible board; its reads still retire above. */
    const board = boardScopeRef.current;
    if (!board || board.userId !== userId || board.accountGeneration !== accountGeneration || board.locale !== locale) {
      boardScopeRef.current = {userId, accountGeneration, locale};
      loadedRef.current = false;
      classicIndexRef.current = profile?.classicIndex;
      setStartupComplete(false);
      setStartupUnavailable(false);
    }
    return () => {
      context.abort();
      if (contextScopeRef.current === contextScope) contextScopeRef.current = null;
    };
    // Profile refreshes must preserve an admitted request and its progression pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextScope]);

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
      if (requestId?.startsWith("skip-preview-")) {
        /** Only a delivered Classic origin permits its optional next-question preview. */
        const parent = deliveredRiddleRef.current;
        /** Capture ownership before optional module loading can yield to a newer commit. */
        const visible = deliveryRef.current;
        /** Deferred code and delivery share the admitted account/provider signal. */
        const contextSignal = contextAbortRef.current!.signal;
        try {
          /** Optional preview code stays outside the initial game resource budget. */
          const {loadOptionalSkipPreview} = await import("./loadOptionalSkipPreview");
          return await loadOptionalSkipPreview({input, parent, services, contextSignal, userId, locale,
            deliveryRef: skipPreviewDeliveryRef,
            owns: () => !recoverySuspendedRef.current && contextScopeRef.current === contextScope &&
              deliveryRef.current === visible && deliveredRiddleRef.current === parent,
            publish: riddle => postToGame({type: "host:riddleLoaded", requestId, payload: {riddle, profile: profileRef.current}})});
        } catch {
          return false;
        }
      }
      if (input.prepareNext) {
        /** Current delivered content supplies the sole permitted preparation origin. */
        const parent = deliveredRiddleRef.current;
        /** Preserve the admitting context across deferred optional module loading. */
        const signal = contextAbortRef.current!.signal;
        /** Generation belongs to admission, rather than a later account visit. */
        const version = contextVersionRef.current;
        try {
          /** Optional successor preparation does not consume the startup resource budget. */
          const {prepareIssuedSuccessor} = await import("./prepareIssuedSuccessor");
          return await prepareIssuedSuccessor({ref: preparedRef, scope: preparationScope, version,
            parent, input, userId, locale,
            services, signal, owns: ownsPreparation, canUse: canUsePreparedQuestions});
        } catch {
          return false;
        }
      }
      if (contextScopeRef.current !== contextScope || contextAbortRef.current!.signal.aborted) return false;
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
      const ownsDelivery = () => contextScopeRef.current === contextScope && contextVersion === contextVersionRef.current &&
        deliveryRef.current === delivery && !delivery.signal.aborted;
      /** Ordinary and Daily-fallback successes publish the same correlated authoritative snapshot. */
      const acceptRiddle = (riddle: Awaited<ReturnType<HostServices["loadRiddle"]>>) => {
        loadedRef.current = true;
        deliveredRiddleRef.current = riddle;
        deliveredScopeRef.current = preparationScope;
        postToGame({type: "host:riddleLoaded", requestId, payload: {riddle, profile: profileRef.current}});
        postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
      };
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
            ? await riddleLoadDeadline(services.loadRiddle(input, delivery.signal), delivery.signal)
            : await withActivity(() => riddleLoadDeadline(services.loadRiddle(input, delivery.signal), delivery.signal)));
          if (!ownsDelivery()) return false;
          acceptRiddle(riddle);
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
          if (!ownsDelivery()) return false;
          loadedRef.current = false;
          /** Server-confirmed completion is an expected routing outcome. */
          const dailyCompleted = input.gameMode === "challenge" && typeof error === "object" &&
            error !== null && "code" in error && error.code === "daily-completed";
          if (!dailyCompleted) reportRiddleFailure(error);
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
              }, delivery.signal), delivery.signal));
              if (!ownsDelivery()) return false;
              acceptRiddle(riddle);
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
              reportRiddleFailure(fallbackError);
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
        retireDelivery();
        contextSignal.removeEventListener("abort", retireDelivery);
        if (deliveryRef.current === delivery) deliveryRef.current = null;
        if (loadInFlightRef.current === pending) loadInFlightRef.current = null;
      });
    },
    [configurationWarning, onPlayable, onStartupUnavailable, postOperation, postToGame, services, setNotice, withActivity,
      userId, locale, canUsePreparedQuestions, preparationScope, contextScope],
  );
  /** Latest load implementation used by recovery timers. */
  const loadRiddleRef = useRef(loadRiddle);
  useLayoutEffect(() => {
    profileRef.current = profile;
    gameModeRef.current = gameMode;
    loadRiddleRef.current = loadRiddle;
    onRecoveryAttemptRef.current = onRecoveryAttempt;
    recoverySuspendedRef.current = recoverySuspended;
  }, [profile, gameMode, loadRiddle, onRecoveryAttempt, recoverySuspended]);

  useEffect(() => {
    /** Recovery work stays bound to the commit that installed these listeners. */
    const contextSignal = contextAbortRef.current!.signal;
    if (!userId) return;
    // A retired frame cannot consume newly issued Classic or Daily preparation.
    if (!recoverySuspendedRef.current) services.preloadInitialRiddles?.(locale, warmupAbortRef.current!.signal);
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
      if (cancelled || contextSignal.aborted) return;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => void recoverRiddle(), delayMs);
    };
    /** Resynchronizes the host and retries the current riddle context. */
    const recoverRiddle = async () => {
      if (loadedRef.current || recoverySuspendedRef.current || cancelled || contextSignal.aborted || recovering || navigator.onLine === false) return;
      recovering = true;
      try {
        onRecoveryAttemptRef.current();
        /** Whether the recovery produced a playable riddle. */
        const loaded = await loadRiddleRef.current({
          gameMode: gameModeRef.current,
          locale,
          classicIndex: classicIndexRef.current,
        });
        if (loaded || cancelled || contextSignal.aborted) return;
        failedAttempts += 1;
        scheduleRecovery(Math.min(30_000, 500 * 2 ** Math.min(failedAttempts, 6)));
      } finally {recovering = false;}
    };
    /** This scheduler can only be removed by its own passive cleanup. */
    const retry = () => scheduleRecovery(250);
    scheduleRecoveryRef.current = retry;
    /** Recover immediately when the browser regains connectivity or returns to the game. */
    const resumeRecovery = () => {
      if (cancelled || contextSignal.aborted || loadedRef.current || recoverySuspendedRef.current || navigator.onLine === false) return;
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
      if (scheduleRecoveryRef.current === retry) scheduleRecoveryRef.current = () => undefined;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      window.removeEventListener("online", resumeRecovery);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [contextScope, locale, services, userId]);

  return {gameMode, startupComplete, startupUnavailable, loadRiddle};
}

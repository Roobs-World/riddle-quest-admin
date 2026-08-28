import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {createHostMessageRouter} from "./bridgeRouter";
import {detectDeviceLanguage, tr, useLocale} from "./i18n";
import {createRequestId} from "./requestIds";
import {GameFrameApp} from "./GameFrameApp";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT, HOST_TO_GAME_EVENT} from "./localBridge";
import type {AuthSnapshot, CompletionResult, HostServices, ProductSummary, WebGameMode} from "./types";
import type {ListRaceCategoriesResponse, RaceOutcome} from "@qwordly/core/race";
import {SpinningWheelLoader} from "./SpinningWheelLoader";
import type {PlatformCapabilities, PlayerData, PlayerDataUpdate} from "../platform/types";
import {restoreProfileWhileServerLoads} from "../platform/playerData";
import {isRaceTo10Enabled} from "./race/logic/raceFeatureFlag";
import {trackEvent} from "../analytics/events";
import {
  createPlayHostMessageHandlers,
  getHostErrorMessage,
  getHostNoticeMessage,
  type HostOperationName,
} from "./hostMessageHandlers";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {safeBrowserStorageGet} from "./playerPreferences";
import {coordinateHostServices, type AccountDeletionServiceGate} from "./accountDeletionServiceGate";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import {ReferralSharingProvider, type ReferralSharingCapability} from "./sharing/ReferralSharingCapability";

/** Creates host message. */
const createHostMessage = <Message extends HostToGameMessage>(message: Message): Message => ({
  ...message,
  sentAt: Date.now(),
});

/** Provides play host app behavior. */
export function PlayHostApp({
  hostServices,
  hostConfigurationWarning = null,
  initialGameMode,
  onPlayable,
  onAuthoritativeComplete,
  onResultScreen,
  onAuthoritativeRaceResult,
  platformProducts,
  platformPurchase,
  platformCapabilities,
  platformPlayerId,
  externalInteractionBlocked = false,
  initialPlayerData,
  onPlayerDataChange,
  onAccountDeleted,
  onAccountDeletionRequested,
  accountDeletionServiceGate,
  registrationName,
  registrationInviterName,
  initialRaceChallengeId,
  initialRaceInbox = false,
  presenceEnabled,
  onTogglePresence,
  raceLocalePolicy = "english-only",
  onPresenceStateChange,
  referralSharing,
}: {
  /** Stores host services. */
  hostServices: HostServices;
  /** Stores host configuration warning. */
  hostConfigurationWarning?: string | null;
  /** Stores initial game mode. */
  initialGameMode?: WebGameMode;
  /** Stores on playable. */
  onPlayable?: () => void;
  /** Stores on authoritative complete. */
  onAuthoritativeComplete?: (
    input: {
      /** Stores riddle id. */
      riddleId: string; /** Stores game mode. */
      /** Stores game mode. */
      gameMode: WebGameMode;
    },
    result: CompletionResult,
  ) => void | Promise<void>;
  /** Runs only after an authoritative single-player or multiplayer result is available. */
  onResultScreen?: () => void | Promise<void>;
  /** Runs after the server returns one authoritative multiplayer outcome. */
  onAuthoritativeRaceResult?: (result: RaceOutcome) => void | Promise<void>;
  /** Stores platform products. */
  platformProducts?: ProductSummary[];
  /** Stores platform purchase. */
  platformPurchase?: (productId: string) => Promise<import("./types").PurchaseResult>;
  /** Stores platform capabilities. */
  platformCapabilities?: PlatformCapabilities;
  /** Stores platform player id. */
  platformPlayerId?: string;
  /** Stores external interaction blocked. */
  externalInteractionBlocked?: boolean;
  /** Stores initial player data. */
  initialPlayerData?: PlayerData | null;
  /** Stores on player data change. */
  onPlayerDataChange?: (update: PlayerDataUpdate) => void;
  /** Stores on account deleted. */
  onAccountDeleted?: () => void | Promise<void>;
  /** Stores on account deletion requested. */
  onAccountDeletionRequested?: () => void | Promise<void>;
  /** Stores account deletion service gate. */
  accountDeletionServiceGate?: AccountDeletionServiceGate;
  /** Stores registration name. */
  registrationName?: string;
  /** Stores registration inviter name. */
  registrationInviterName?: string;
  /** Stores initial race challenge id. */
  initialRaceChallengeId?: string;
  /** Stores initial race inbox. */
  initialRaceInbox?: boolean;
  /** Stores presence enabled. */
  presenceEnabled?: boolean;
  /** Stores on toggle presence. */
  onTogglePresence?: () => void;
  /** Stores race locale policy. */
  raceLocalePolicy?: "english-only" | "all";
  /** Stores on presence state change. */
  onPresenceStateChange?: (state: ActivePresenceState) => void;
  /** Optional outbound referral sharing supplied by the active release target. */
  referralSharing?: ReferralSharingCapability | null;
}) {
  /** Provides locale behavior. */
  const locale = useLocale();
  /** Provides session id ref behavior. */
  const sessionIdRef = useRef(createRequestId("session"));
  /** Provides services behavior. */
  const services = useMemo<HostServices>(() => {
    /** Provides configured services behavior. */
    const configuredServices: HostServices = {
      ...hostServices,
      products: platformProducts ?? hostServices.products,
      requestPurchase: platformPurchase ?? hostServices.requestPurchase,
    };
    return accountDeletionServiceGate
      ? coordinateHostServices(configuredServices, accountDeletionServiceGate)
      : configuredServices;
  }, [accountDeletionServiceGate, hostServices, platformProducts, platformPurchase]);
  /** Provides configuration warning behavior. */
  const configurationWarning = hostConfigurationWarning;
  /** Provides race build enabled behavior. */
  const raceBuildEnabled = useMemo(
    () =>
      isRaceTo10Enabled({
        search: window.location.search,
        envValue: import.meta.env.VITE_RACE_TO_10_ENABLED,
      }),
    [],
  );

  /** Provides [auth snapshot, set auth snapshot] behavior. */
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({user: null, profile: null});
  /** Provides [prefetched race categories, set prefetched race categories] behavior. */
  const [prefetchedRaceCategories, setPrefetchedRaceCategories] = useState<ListRaceCategoriesResponse["categories"]>(
    [],
  );
  /** Provides [frame ready, set frame ready] behavior. */
  const [frameReady, setFrameReady] = useState(false);
  /** Provides [game mode, set game mode] behavior. */
  const [gameMode, setGameMode] = useState<WebGameMode>(initialGameMode ?? "classic");
  /** Provides [notice, set notice] behavior. */
  const [notice, setNotice] = useState<string | null>(configurationWarning);
  /** Provides [pending server operations, set pending server operations] behavior. */
  const [pendingServerOperations, setPendingServerOperations] = useState(0);
  /** Provides [startup complete, set startup complete] behavior. */
  const [startupComplete, setStartupComplete] = useState(false);
  /** Provides server interaction active behavior. */
  const serverInteractionActive = pendingServerOperations > 0 || externalInteractionBlocked || !startupComplete;
  /** Loads ed user id ref. */
  const loadedUserIdRef = useRef<string | null>(null);
  /** Provides riddle loaded ref behavior. */
  const riddleLoadedRef = useRef(false);
  /** Provides riddle load in flight ref behavior. */
  const riddleLoadInFlightRef = useRef<Promise<boolean> | null>(null);
  /** Provides riddle context version ref behavior. */
  const riddleContextVersionRef = useRef(0);
  /** Provides schedule riddle recovery ref behavior. */
  const scheduleRiddleRecoveryRef = useRef<() => void>(() => undefined);
  /** Provides playable reported ref behavior. */
  const playableReportedRef = useRef(false);
  /** Provides account deletion completed ref behavior. */
  const accountDeletionCompletedRef = useRef(false);
  /** Provides game mode ref behavior. */
  const gameModeRef = useRef(gameMode);
  /** Provides classic index ref behavior. */
  const classicIndexRef = useRef(authSnapshot.profile?.classicIndex);
  gameModeRef.current = gameMode;
  classicIndexRef.current = authSnapshot.profile?.classicIndex;
  /** Provides bridge user behavior. */
  const bridgeUser = useMemo(
    () =>
      authSnapshot.user
        ? {...authSnapshot.user, platformRegistered: platformCapabilities?.accountUpgrade?.state === "complete"}
        : null,
    [authSnapshot.user, platformCapabilities?.accountUpgrade?.state],
  );

  /** Runs server activity. */
  const withServerActivity = useCallback(async <Result,>(operation: () => Promise<Result>): Promise<Result> => {
    /** Starts ed at. */
    const startedAt = Date.now();
    setPendingServerOperations((current) => current + 1);
    try {
      return await operation();
    } finally {
      /** Provides minimum visible time behavior. */
      const minimumVisibleTime = 180;
      /** Provides remaining time behavior. */
      const remainingTime = Math.max(0, minimumVisibleTime - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPendingServerOperations((current) => Math.max(0, current - 1));
      }, remainingTime);
    }
  }, []);
  /** Saves active game. */
  const saveActiveGame = useCallback(
    (activeGame: NonNullable<PlayerData["activeGame"]> | null) => onPlayerDataChange?.({activeGame}),
    [onPlayerDataChange],
  );

  useEffect(() => {
    detectDeviceLanguage(safeBrowserStorageGet("local", "appLanguage") ?? navigator.language);
  }, []);

  useEffect(
    () =>
      services.auth.subscribe((snapshot) => {
        setAuthSnapshot(restoreProfileWhileServerLoads(snapshot, initialPlayerData?.profile));
      }),
    [initialPlayerData?.profile, services],
  );

  useEffect(() => {
    if (authSnapshot.profile) {
      onPlayerDataChange?.({profile: authSnapshot.profile});
    }
  }, [authSnapshot.profile, onPlayerDataChange]);

  useEffect(() => {
    /** Provides cancelled behavior. */
    let cancelled = false;
    setPrefetchedRaceCategories([]);
    if (!raceBuildEnabled || !authSnapshot.user || (raceLocalePolicy === "english-only" && locale !== "en")) return;
    void services
      .getRaceAccess()
      .then(async (access) => {
        if (!access.enabled || cancelled) return;
        if (initialRaceChallengeId) return;
        try {
          /** Provides categories behavior. */
          const categories = await services.listRaceCategories(locale);
          if (!cancelled) setPrefetchedRaceCategories(categories.categories);
        } catch (error) {
          console.warn("[riddle-quest-race-prefetch] Unable to preload categories", error);
        }
      })
      .catch((error) => {
        console.warn("[riddle-quest-race-access] Unable to load rollout access", error);
      });
    return () => {
      cancelled = true;
    };
  }, [authSnapshot.user, initialRaceChallengeId, locale, raceBuildEnabled, raceLocalePolicy, services]);

  /** Provides post to game behavior. */
  const postToGame = useCallback((message: HostToGameMessage) => {
    dispatchLocalBridge(HOST_TO_GAME_EVENT, createHostMessage(message));
  }, []);

  /** Sends init. */
  const sendInit = useCallback(() => {
    postToGame({
      type: "host:init",
      requestId: createRequestId("init"),
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        sessionId: sessionIdRef.current,
        locale,
        user: bridgeUser,
        profile: authSnapshot.profile,
        gameMode,
        products: services.products,
      },
    });
  }, [authSnapshot.profile, bridgeUser, gameMode, locale, postToGame, services.products]);
  /** Sends init ref. */
  const sendInitRef = useRef(sendInit);
  sendInitRef.current = sendInit;

  /** Provides post operation behavior. */
  const postOperation = useCallback(
    (requestId: string | undefined, operation: HostOperationName, ok: boolean, data?: unknown, error?: string) => {
      postToGame({
        type: "host:operationResult",
        requestId,
        payload: {
          operation,
          ok,
          data,
          error,
        },
      });
    },
    [postToGame],
  );

  /** Applies purchase balance. */
  const applyPurchaseBalance = useCallback((result: import("./types").PurchaseResult) => {
    if (typeof result.newCoins !== "number") return;
    setAuthSnapshot((current) =>
      current.profile ? {...current, profile: {...current.profile, coins: result.newCoins!}} : current,
    );
  }, []);

  /** Provides run race operation behavior. */
  const runRaceOperation = useCallback(
    async (requestId: string | undefined, operation: HostOperationName, action: () => Promise<unknown>) => {
      /** Starts ed at. */
      const startedAt = performance.now();
      try {
        // The multiplayer surface owns its pending states. Using the global
        // server-activity wrapper here blocks the entire game behind an overlay
        // while a race request is in flight, including the initial screen open.
        postOperation(requestId, operation, true, await action());
        /** Provides duration ms behavior. */
        const durationMs = Math.round(performance.now() - startedAt);
        /** Provides report behavior. */
        const report = durationMs >= 2_000 ? console.warn : console.info;
        report("[riddle-quest-race-latency]", operation, {
          ok: true,
          durationMs,
          slow: durationMs >= 2_000,
        });
      } catch (error) {
        captureBrowserException(error, {component: "play_host", operation});
        postOperation(requestId, operation, false, undefined, getHostErrorMessage(error));
        console.warn("[riddle-quest-race-latency]", operation, {
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
    },
    [postOperation],
  );

  /** Provides sync race achievement progress behavior. */
  const syncRaceAchievementProgress = useCallback(
    async (result: {
      /** Stores newly unlocked achievement ids. */
      newlyUnlockedAchievementIds?: string[]; /** Stores new coins. */
      /** Stores new coins. */
      newCoins?: number;
    }) => {
      if (typeof result.newCoins === "number") {
        setAuthSnapshot((current) =>
          current.profile ? {...current, profile: {...current.profile, coins: result.newCoins!}} : current,
        );
      }
      for (const achievementId of result.newlyUnlockedAchievementIds ?? []) {
        trackEvent("unlock_achievement", {achievement_id: achievementId, source: "multiplayer"});
      }
      /** Provides r. */
      const user = authSnapshot.user;
      if (!user) return;
      try {
        /** Provides profile behavior. */
        const profile = await services.loadProfile(user.uid);
        setAuthSnapshot((current) => ({...current, profile}));
        postToGame({
          type: "host:authState",
          requestId: createRequestId("race-profile"),
          payload: {user: bridgeUser, profile},
        });
      } catch (error) {
        console.warn("[riddle-quest-race-achievements] Profile refresh failed", error);
      }
    },
    [authSnapshot.user, bridgeUser, postToGame, services],
  );

  /** Handles authoritative complete. */
  const handleAuthoritativeComplete = useCallback(
    async (
      input: {
        /** Stores riddle id. */
        riddleId: string; /** Stores game mode. */
        /** Stores game mode. */
        gameMode: WebGameMode;
      },
      result: CompletionResult,
    ) => {
      await onAuthoritativeComplete?.(input, result);
      await onResultScreen?.();
    },
    [onAuthoritativeComplete, onResultScreen],
  );

  /** Handles authoritative race result. */
  const handleAuthoritativeRaceResult = useCallback(
    async (result: RaceOutcome) => {
      await onAuthoritativeRaceResult?.(result);
      await onResultScreen?.();
    },
    [onAuthoritativeRaceResult, onResultScreen],
  );

  /** Loads and post riddle. */
  const loadAndPostRiddle = useCallback(
    async (
      input: {
        /** Stores game mode. */
        gameMode: WebGameMode; /** Stores locale. */
        /** Stores locale. */
        locale: string; /** Stores classic index. */
        /** Stores classic index. */
        classicIndex?: number;
      },
      requestId?: string,
    ) => {
      // Automatic ready/recovery calls may share one request. Correlated game
      // requests must run independently so their requestId always receives a response.
      if (!requestId && riddleLoadInFlightRef.current) return riddleLoadInFlightRef.current;
      /** Provides context version behavior. */
      const contextVersion = riddleContextVersionRef.current;
      /** Provides pending behavior. */
      const pending = (async () => {
        try {
          setGameMode(input.gameMode);
          /** Provides riddle behavior. */
          const riddle = await withServerActivity(() => services.loadRiddle(input));
          if (contextVersion !== riddleContextVersionRef.current) return false;
          riddleLoadedRef.current = true;
          postToGame({
            type: "host:riddleLoaded",
            requestId,
            payload: {
              riddle,
              profile: authSnapshot.profile,
            },
          });
          postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
          trackEvent("level_start", {
            game_mode: riddle.gameMode,
            level_name: riddle.index === undefined ? riddle.gameMode : `${riddle.gameMode}_${riddle.index}`,
            level_number: riddle.index,
          });
          setNotice(configurationWarning);
          setStartupComplete(true);
          if (!playableReportedRef.current) {
            playableReportedRef.current = true;
            onPlayable?.();
          }
          return true;
        } catch (error) {
          riddleLoadedRef.current = false;
          captureBrowserException(error, {component: "play_host", operation: "loadRiddle"});
          /** Provides message behavior. */
          const message = getHostErrorMessage(error);
          setNotice(message);
          postOperation(requestId, "loadRiddle", false, undefined, message);
          scheduleRiddleRecoveryRef.current();
          return false;
        }
      })();
      riddleLoadInFlightRef.current = pending;
      return pending.finally(() => {
        if (riddleLoadInFlightRef.current === pending) riddleLoadInFlightRef.current = null;
      });
    },
    [authSnapshot.profile, configurationWarning, onPlayable, postOperation, postToGame, services, withServerActivity],
  );
  /** Loads and post riddle ref. */
  const loadAndPostRiddleRef = useRef(loadAndPostRiddle);
  loadAndPostRiddleRef.current = loadAndPostRiddle;

  useEffect(() => {
    postToGame({
      type: "host:authState",
      requestId: createRequestId("auth"),
      payload: {...authSnapshot, user: bridgeUser},
    });
  }, [authSnapshot, bridgeUser, postToGame]);

  /** Provides router behavior. */
  const router = useMemo(
    () =>
      createHostMessageRouter(
        createPlayHostMessageHandlers({
          authSnapshot,
          gameMode,
          locale,
          services,
          loadedUserIdRef,
          playableReportedRef,
          setFrameReady,
          setNotice,
          sendInit,
          loadAndPostRiddle,
          postOperation,
          runRaceOperation,
          withServerActivity,
          applyPurchaseBalance,
          syncRaceAchievementProgress,
          onPlayable,
          onAuthoritativeComplete: handleAuthoritativeComplete,
          onAuthoritativeRaceResult: handleAuthoritativeRaceResult,
          onAccountDeleted,
          onAccountDeletionRequested,
          accountDeletionCompletedRef,
        }),
      ),
    [
      applyPurchaseBalance,
      authSnapshot.profile,
      onAccountDeleted,
      onAccountDeletionRequested,
      authSnapshot.user,
      gameMode,
      loadAndPostRiddle,
      locale,
      handleAuthoritativeComplete,
      handleAuthoritativeRaceResult,
      onResultScreen,
      onPlayable,
      postOperation,
      runRaceOperation,
      sendInit,
      services,
      syncRaceAchievementProgress,
      withServerActivity,
    ],
  );

  useEffect(() => {
    /** Handles local message. */
    const handleLocalMessage = (event: Event) => {
      void router((event as CustomEvent<unknown>).detail).catch((error) => {
        captureBrowserException(error, {component: "play_host", operation: "route_local_message"});
        setNotice(getHostErrorMessage(error));
      });
    };
    window.addEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    return () => {
      window.removeEventListener(GAME_TO_HOST_EVENT, handleLocalMessage);
    };
  }, [router]);

  useEffect(() => {
    if (!authSnapshot.user) {
      loadedUserIdRef.current = null;
      riddleLoadedRef.current = false;
      return;
    }

    if (!frameReady || loadedUserIdRef.current === authSnapshot.user.uid) {
      return;
    }

    loadedUserIdRef.current = authSnapshot.user.uid;
    void loadAndPostRiddle({
      gameMode,
      locale,
      classicIndex: authSnapshot.profile?.classicIndex,
    });
  }, [authSnapshot.profile?.classicIndex, authSnapshot.user, frameReady, gameMode, loadAndPostRiddle, locale]);

  useEffect(() => {
    riddleContextVersionRef.current += 1;
    riddleLoadInFlightRef.current = null;
    riddleLoadedRef.current = false;
    /** Provides r. */
    const user = authSnapshot.user;
    if (!user) return;
    /** Provides cancelled behavior. */
    let cancelled = false;
    /** Provides recovery timer behavior. */
    let recoveryTimer: number | undefined;
    /** Provides failed attempts behavior. */
    let failedAttempts = 0;
    /** Provides schedule recovery behavior. */
    const scheduleRecovery = (delayMs: number) => {
      if (cancelled) return;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => void recoverHostAndRiddle(), delayMs);
    };
    /** Provides recover host and riddle behavior. */
    const recoverHostAndRiddle = async () => {
      sendInitRef.current();
      if (riddleLoadedRef.current || cancelled) return;
      /** Loads ed. */
      const loaded = await loadAndPostRiddleRef.current({
        gameMode: gameModeRef.current,
        locale,
        classicIndex: classicIndexRef.current,
      });
      if (loaded || cancelled) return;
      failedAttempts += 1;
      /** Provides retry delay ms behavior. */
      const retryDelayMs = Math.min(30_000, 500 * 2 ** Math.min(failedAttempts, 6));
      scheduleRecovery(retryDelayMs);
    };
    scheduleRiddleRecoveryRef.current = () => scheduleRecovery(250);
    scheduleRecovery(250);
    return () => {
      cancelled = true;
      scheduleRiddleRecoveryRef.current = () => undefined;
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
    };
  }, [authSnapshot.user?.uid, locale]);

  useEffect(() => {
    /** Provides on visibility change behavior. */
    const onVisibilityChange = () => {
      postToGame({
        type: document.visibilityState === "hidden" ? "host:pause" : "host:resume",
        requestId: createRequestId("visibility"),
        payload: {},
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [postToGame]);

  if (!authSnapshot.user) {
    return (
      <main className="route-loading" aria-live="polite">
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_GAME")} progress={72} />
      </main>
    );
  }

  return (
    <ReferralSharingProvider capability={referralSharing}>
      <div className="play-game-shell">
        {notice && <div className="play-alert game-shell-alert">{getHostNoticeMessage(notice)}</div>}
        <GameFrameApp
          localBridge
          interactionBlocked={serverInteractionActive}
          restoredGame={initialPlayerData?.activeGame}
          onSaveGame={saveActiveGame}
          registrationName={registrationName}
          registrationInviterName={registrationInviterName}
          initialRaceChallengeId={initialRaceChallengeId}
          initialRaceInbox={initialRaceInbox}
          raceFeatureEnabled={raceBuildEnabled}
          prefetchedRaceCategories={prefetchedRaceCategories}
          presenceEnabled={presenceEnabled}
          onTogglePresence={onTogglePresence}
          nativeSocial={platformCapabilities?.nativeSocial}
          matchmaking={platformCapabilities?.matchmaking}
          playerOverlay={platformCapabilities?.overlay}
          platformPlayerId={platformCapabilities?.overlay ? platformPlayerId : undefined}
          tournaments={platformCapabilities?.tournaments}
          contextBoard={platformCapabilities?.contextBoard}
          raceLocalePolicy={raceLocalePolicy}
          onPresenceStateChange={onPresenceStateChange}
        />
        {serverInteractionActive ? (
          <SpinningWheelLoader
            overlay
            message={!startupComplete ? tr("WebPortal.STARTUP_GAME") : undefined}
            progress={!startupComplete ? 88 : undefined}
          />
        ) : null}
      </div>
    </ReferralSharingProvider>
  );
}

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BridgeProfile, HostToGameMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {createHostMessageRouter} from "./bridgeRouter";
import {detectDeviceLanguage, tr, useLocale} from "./i18n";
import {createRequestId} from "./requestIds";
import {GameFrameApp} from "./GameFrameApp";
import {dispatchLocalBridge, GAME_TO_HOST_EVENT, HOST_TO_GAME_EVENT} from "./localBridge";
import type {CompletionResult, HostServices, ProductSummary, WebGameMode} from "./types";
import type {RaceOutcome} from "@qwordly/core/race";
import {SpinningWheelLoader} from "./SpinningWheelLoader";
import type {PlatformCapabilities, PlayerData, PlayerDataUpdate} from "../platform/types";
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
import {useHostOperations} from "./useHostOperations";
import {useHostRiddleLifecycle} from "./useHostRiddleLifecycle";
import {useHostRaceCoordination} from "./useHostRaceCoordination";
import {useHostAuthSession} from "./useHostAuthSession";

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
  /** Provides [frame ready, set frame ready] behavior. */
  const [frameReady, setFrameReady] = useState(false);
  /** Provides [notice, set notice] behavior. */
  const [notice, setNotice] = useState<string | null>(configurationWarning);
  /** Loads ed user id ref. */
  const loadedUserIdRef = useRef<string | null>(null);
  /** Provides playable reported ref behavior. */
  const playableReportedRef = useRef(false);
  /** Reports readiness at most once across recovery and bridge-ready paths. */
  const reportPlayable = useCallback(() => {
    if (playableReportedRef.current) return;
    playableReportedRef.current = true;
    onPlayable?.();
  }, [onPlayable]);
  /** Provides account deletion completed ref behavior. */
  const accountDeletionCompletedRef = useRef(false);
  /** Saves active game. */
  const saveActiveGame = useCallback(
    (activeGame: NonNullable<PlayerData["activeGame"]> | null) => onPlayerDataChange?.({activeGame}),
    [onPlayerDataChange],
  );

  useEffect(() => {
    detectDeviceLanguage(safeBrowserStorageGet("local", "appLanguage") ?? navigator.language);
  }, []);

  /** Provides post to game behavior. */
  const postToGame = useCallback((message: HostToGameMessage) => {
    dispatchLocalBridge(HOST_TO_GAME_EVENT, createHostMessage(message));
  }, []);
  /** Persists an authoritative profile through the active target adapter. */
  const persistProfile = useCallback(
    (profile: BridgeProfile) => onPlayerDataChange?.({profile}),
    [onPlayerDataChange],
  );

  /** Authenticated state, persistence, and game-bridge synchronization. */
  const {
    snapshot: authSnapshot,
    bridgeUser,
    applyCoinBalance,
    replaceProfile,
  } = useHostAuthSession({
    services,
    initialProfile: initialPlayerData?.profile,
    platformRegistered: platformCapabilities?.accountUpgrade?.state === "complete",
    onProfileChange: persistProfile,
    postToGame,
  });

  /** Latest init delivery, used by riddle recovery without a dependency cycle. */
  const sendInitRef = useRef<() => void>(() => undefined);
  /** Delivers the latest init state before an automatic riddle recovery. */
  const sendRecoveryInit = useCallback(() => sendInitRef.current(), []);

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

  /** Server-operation module shared by bridge handlers and the host view. */
  const {
    activityActive: serverActivityActive,
    withActivity: withServerActivity,
    runRace: runRaceOperation,
  } = useHostOperations({postOperation});

  /** Single-player riddle loading, recovery, and readiness module. */
  const {
    gameMode,
    startupComplete,
    loadRiddle: loadAndPostRiddle,
  } = useHostRiddleLifecycle({
    userId: authSnapshot.user?.uid,
    profile: authSnapshot.profile,
    initialGameMode: initialGameMode ?? "classic",
    locale,
    services,
    withActivity: withServerActivity,
    postToGame,
    postOperation,
    configurationWarning,
    setNotice,
    onPlayable: reportPlayable,
    onRecoveryAttempt: sendRecoveryInit,
  });
  /** Whether startup, server work, or the target lifecycle blocks interaction. */
  const serverInteractionActive = serverActivityActive || externalInteractionBlocked || !startupComplete;

  /** Sends the complete current host state to the game. */
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
  sendInitRef.current = sendInit;

  /** Applies purchase balance. */
  const applyPurchaseBalance = useCallback(
    (result: import("./types").PurchaseResult) => applyCoinBalance(result.newCoins),
    [applyCoinBalance],
  );

  /** Multiplayer rollout, preload, and authoritative reward reconciliation. */
  const {
    enabled: raceBuildEnabled,
    prefetchedCategories: prefetchedRaceCategories,
    syncProgress: syncRaceAchievementProgress,
  } = useHostRaceCoordination({
    authSnapshot,
    bridgeUser,
    locale,
    services,
    initialRaceChallengeId,
    raceLocalePolicy,
    applyCoinBalance,
    replaceProfile,
    postToGame,
  });

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

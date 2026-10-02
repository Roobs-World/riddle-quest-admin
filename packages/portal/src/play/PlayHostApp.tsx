import {deliverHostRaceResult} from "./hostRaceResultEffects";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BridgeProfile, HostToGameMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {detectDeviceLanguage, tr, useLocale} from "./i18n";
import {createRequestId} from "./requestIds";
import {GameFrameApp} from "./GameFrameApp";
import {dispatchLocalBridge, HOST_TO_GAME_EVENT} from "./localBridge";
import type {CompletionResult, WebGameMode} from "./types";
import type {RaceOutcome} from "@qwordly/core/race";
import {SpinningWheelLoader} from "./SpinningWheelLoader";
import type {PlayerData} from "../platform/types";
import {getHostNoticeMessage, type HostOperationName} from "./hostMessageHandlers";
import {safeBrowserStorageGet} from "./playerPreferences";
import {ReferralSharingProvider} from "./sharing/ReferralSharingCapability";
import {useHostOperations} from "./useHostOperations";
import {useHostRiddleLifecycle} from "./useHostRiddleLifecycle";
import {useHostRaceCoordination} from "./useHostRaceCoordination";
import {useHostAuthSession} from "./useHostAuthSession";
import {useHostBridgeLifecycle} from "./useHostBridgeLifecycle";
import {createHostedPlayCommandModule} from "./HostedPlayCommandModule";
import type {HostedPlaySession} from "./HostedPlaySession";
/** Creates host message. */
const createHostMessage = <Message extends HostToGameMessage>(message: Message): Message => ({
  ...message,
  sentAt: Date.now(),
});
/** Provides play host app behavior. */
export function PlayHostApp({
  session: {
    services,
    authority,
    hostConfigurationWarning,
    initialGameMode,
    platformCapabilities,
    platformPlayerId,
    externalInteractionBlocked,
    initialPlayerData,
    onPlayerDataChange,
    registrationName,
    registrationInviterName,
    initialRaceChallengeId,
    initialRaceInbox,
    initialRaceLobby,
    initialRaceTournamentLocale,
    raceLocalePolicy,
    onPresenceStateChange,
    referralSharing,
  },
  onPlayable,
  onStartupUnavailable,
  onAuthoritativeGuessWin,
  onAuthoritativeComplete,
  onResultScreen,
  onAuthoritativeRaceResult,
  onAccountDeleted,
  onAccountDeletionRequested,
}: {
  /** Target-owned hosted-play session. */
  session: HostedPlaySession;
  /** Stores on playable. */
  onPlayable?: () => void;
  /** Reports that a recoverable startup error surface is ready to be shown. */
  onStartupUnavailable?: () => void;
  /** Runs when a correct answer is confirmed before reward delivery. */
  onAuthoritativeGuessWin?: (input: {
    /** Stores riddle id. */
    riddleId: string;
    /** Stores session token. */
    sessionToken: string;
    /** Stores game mode. */
    gameMode: WebGameMode;
  }) => void;
  /** Stores on authoritative complete. */
  onAuthoritativeComplete?: (
    input: {
      /** Stores riddle id. */
      riddleId: string;
      /** Stores game mode. */
      gameMode: WebGameMode;
    },
    result: CompletionResult,
  ) => void | Promise<void>;
  /** Runs only after an authoritative single-player or multiplayer result is available. */
  onResultScreen?: () => void | Promise<void>;
  /** Runs after the server returns one authoritative multiplayer outcome. */
  onAuthoritativeRaceResult?: (result: RaceOutcome) => void | Promise<void>;
  /** Stores on account deleted. */
  onAccountDeleted?: () => void | Promise<void>;
  /** Stores on account deletion requested. */
  onAccountDeletionRequested?: () => void | Promise<void>;
}) {
  /** Provides locale behavior. */
  const locale = useLocale();
  /** Provides session id ref behavior. */
  const sessionIdRef = useRef(createRequestId("session"));
  /** Tracks the product catalog most recently projected into the game frame. */
  const sentProductsRef = useRef<readonly import("./types").ProductSummary[] | undefined>(undefined);
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
  /** Dismisses provider loading once an error surface is rendered, without claiming playable content. */
  const reportStartupUnavailable = useCallback(() => {
    if (playableReportedRef.current || !onStartupUnavailable) return;
    playableReportedRef.current = true;
    onStartupUnavailable();
  }, [onStartupUnavailable]);
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
  const persistProfile = useCallback((profile: BridgeProfile) => onPlayerDataChange?.({profile}), [onPlayerDataChange]);
  /** Authenticated state, persistence, and game-bridge synchronization. */
  const {
    snapshot: authSnapshot,
    bridgeUser,
    applyCoinBalance,
    replaceProfile,
    ownsAccount,
    captureAccount,
  } = useHostAuthSession({
    services: authority.identity,
    initialProfile: initialPlayerData?.profile,
    platformRegistered: platformCapabilities?.accountUpgrade
      ? platformCapabilities.accountUpgrade.state === "complete"
      : undefined,
    onProfileChange: persistProfile,
    postToGame,
  });
  /** Caches immediate unlock presentation without mutating authoritative auth state. */
  const persistAchievementProjection = useCallback(
    (achievementIds: string[]) => {
      if (!authSnapshot.profile) return;
      onPlayerDataChange?.({
        profile: {
          ...authSnapshot.profile,
          achievements: [...new Set([...authSnapshot.profile.achievements, ...achievementIds])],
        },
      });
    },
    [authSnapshot.profile, onPlayerDataChange],
  );
  /** Latest init delivery, used by riddle recovery without a dependency cycle. */
  const sendInitRef = useRef<() => void>(() => undefined);
  /** Delivers the latest init state before an automatic riddle recovery. */
  const sendRecoveryInit = useCallback(() => sendInitRef.current(), []);
  /** Provides post operation behavior. */
  const postOperation = useCallback(
    (
      requestId: string | undefined,
      operation: HostOperationName,
      ok: boolean,
      data?: unknown,
      error?: string,
      errorKind?: "retryable" | "rejected",
    ) => {
      postToGame({
        type: "host:operationResult",
        requestId,
        payload: {
          operation,
          ok,
          data,
          error,
          errorKind,
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
    initialGameMode,
    locale,
    services: authority.gameplay,
    withActivity: withServerActivity,
    postToGame,
    postOperation,
    configurationWarning,
    setNotice,
    onPlayable: reportPlayable,
    onStartupUnavailable: reportStartupUnavailable,
    onRecoveryAttempt: sendRecoveryInit,
  });
  useEffect(() => {
    if (!startupComplete || !notice || notice === configurationWarning) return;
    /** Dismisses a transient host notice. */
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice, configurationWarning, startupComplete]);
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
        products: authority.commerce?.products ?? [],
      },
    });
  }, [authSnapshot.profile, authority.commerce, bridgeUser, gameMode, locale, postToGame]);
  sendInitRef.current = sendInit;

  // Catalog reads and subscription activation finish asynchronously. Re-send
  // host state whenever that catalog identity changes so an open or reopened
  // paywall cannot retain an offer the player now owns.
  useEffect(() => {
    if (!frameReady) return;
    /** Provides products behavior. */
    const products = authority.commerce?.products;
    if (sentProductsRef.current === products) return;
    sentProductsRef.current = products;
    sendInit();
  }, [authority.commerce, frameReady, sendInit]);
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
    race: authority.race,
    identity: authority.identity,
    initialRaceChallengeId,
    raceLocalePolicy,
    applyCoinBalance,
    replaceProfile,
    ownsAccount,
    captureAccount,
    postToGame,
  });
  /** Handles authoritative complete. */
  const handleAuthoritativeComplete = useCallback(
    async (
      input: {
        /** Stores riddle id. */
        riddleId: string;
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
  const raceResultOwner = captureAccount(authSnapshot.user?.uid);
  /** Both callback boundaries retain the originating authentication visit. */
  const handleAuthoritativeRaceResult = useCallback(
    (result: RaceOutcome) => deliverHostRaceResult(result, raceResultOwner, onAuthoritativeRaceResult, onResultScreen),
    [onAuthoritativeRaceResult, onResultScreen, raceResultOwner],
  );
  /** Provides hosted-play command behavior. */
  const commands = useMemo(
    () =>
      createHostedPlayCommandModule({
        session: {authSnapshot, gameMode, locale, loadedUserIdRef, playableReportedRef, accountDeletionCompletedRef},
        delivery: {setFrameReady, setNotice, sendInit, loadAndPostRiddle, postOperation},
        execution: {
          authority,
          runRaceOperation,
          withServerActivity,
          applyPurchaseBalance,
          syncRaceAchievementProgress,
          persistAchievementProjection,
        },
        callbacks: {
          onPlayable,
          onAuthoritativeGuessWin,
          onAuthoritativeComplete: handleAuthoritativeComplete,
          onAuthoritativeRaceResult: handleAuthoritativeRaceResult,
          onAccountDeleted,
          onAccountDeletionRequested,
        },
      }),
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
      onAuthoritativeGuessWin,
      postOperation,
      runRaceOperation,
      sendInit,
      authority,
      syncRaceAchievementProgress,
      persistAchievementProjection,
      withServerActivity,
    ],
  );
  /** Stable local message routing and document visibility projection. */
  useHostBridgeLifecycle({router: commands.execute, postToGame, setNotice, lifecycle: platformCapabilities?.lifecycle});

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
          raceOwnerId={authSnapshot.user?.uid}
          localBridge
          interactionBlocked={serverInteractionActive}
          restoredGame={initialPlayerData?.activeGame}
          onSaveGame={saveActiveGame}
          registrationName={registrationName}
          registrationInviterName={registrationInviterName}
          initialRaceChallengeId={initialRaceChallengeId}
          initialRaceInbox={initialRaceInbox}
          initialRaceLobby={initialRaceLobby}
          initialRaceTournamentLocale={platformCapabilities?.tournaments ? initialRaceTournamentLocale : undefined}
          raceFeatureEnabled={raceBuildEnabled}
          prefetchedRaceCategories={prefetchedRaceCategories}
          nativeSocial={platformCapabilities?.nativeSocial}
          matchmaking={platformCapabilities?.matchmaking}
          playerOverlay={platformCapabilities?.overlay}
          platformPlayerId={platformCapabilities?.overlay ? platformPlayerId : undefined}
          tournaments={platformCapabilities?.tournaments}
          contextBoard={platformCapabilities?.contextBoard}
          attemptRecovery={platformCapabilities?.attemptRecovery}
          raceLocalePolicy={raceLocalePolicy}
          onPresenceStateChange={onPresenceStateChange}
        />
        {!startupComplete ? (
          <SpinningWheelLoader
            overlay
            message={notice ? getHostNoticeMessage(notice) : tr("WebPortal.STARTUP_GAME")}
            progress={notice ? undefined : 88}
          />
        ) : null}
      </div>
    </ReferralSharingProvider>
  );
}

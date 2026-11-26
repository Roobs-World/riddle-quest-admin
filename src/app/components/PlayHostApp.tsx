import {deliverHostRaceResult} from "../../races/browser/hostRaceResultEffects";
import {createHostCoinActionEffects, createHostCompletionEffects, createHostGuessEffects, type HostCompletionInput} from "../../progression/browser/hostCompletionEffects";
import {useCallback, useEffect, useMemo, useRef, useState, type ComponentType} from "react";
import type {BridgeProfile, HostToGameMessage} from "../../platform/bridge/messages";
import {BRIDGE_PROTOCOL_VERSION} from "../../platform/bridge/constants";
import {detectDeviceLanguage, tr, useLocale} from "../../localization/browser/i18n";
import {createRequestId} from "../../gameplay/session/requestIds";
import {GameFrameApp} from "../../gameplay/components/GameFrameApp";
import {dispatchLocalBridge, HOST_TO_GAME_EVENT} from "../../platform/bridge/browser/localBridge";
import type {CompletionResult, SinglePlayerGuessResult, WebGameMode} from "../../platform/contracts/hostServices";
import type {RaceOutcome} from "../../races/contracts/index";
import {SpinningWheelLoader} from "./feedback/SpinningWheelLoader";
import type {PlayerData} from "../../platform/contracts/capabilities";
import {createHostedPlayCommandModule, getHostNoticeMessage, type HostOperationName} from "../../platform/bridge/browser/hostMessageHandlers";
import {safeBrowserStorageGet} from "../../settings/browser/playerPreferences";
import {ReferralSharingProvider} from "../../sharing/components/ReferralSharingCapability";
import {NotificationSettingsProvider} from "../../notifications/components/NotificationSettingsContext";
import {useHostOperations} from "../../gameplay/hooks/browser/useHostOperations";
import {useHostRiddleLifecycle} from "../../gameplay/hooks/browser/useHostRiddleLifecycle";
import {useHostRaceCoordination} from "../../races/hooks/useHostRaceCoordination";
import {useHostAuthSession} from "../../accounts/hooks/useHostAuthSession";
import {useHostBridgeLifecycle} from "../../platform/bridge/browser/useHostBridgeLifecycle";
import {useHostNotice} from "../hooks/useHostNotice";
import {BridgeStartupRecovery} from "./recovery/BridgeStartupRecovery";
import type {RaceTo10GameProps} from "../../races/components/recorded/RaceTo10Game.types.ts";
import type {HostedPlaySession} from "../session/HostedPlaySession";
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
    canUsePreparedQuestions,
    hostConfigurationWarning,
    initialGameMode,
    platformCapabilities,
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
    notificationProvider,
  },
  raceSurface,
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
  /** Target-owned multiplayer presentation; omitted for shared live PvP. */
  raceSurface?: ComponentType<RaceTo10GameProps>;
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
    input: HostCompletionInput,
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
  const [sessionIdRef] = useState(() => ({current: createRequestId("session")}));
  /** Tracks initialized game settings independently of profile-only host notifications. */
  const sentInitializationRef = useRef<{
    /** Last projected immutable target product catalog, absent when commerce is unavailable. */
    products: readonly import("../../platform/contracts/hostServices").ProductSummary[] | undefined;
    /** Last content language actually delivered to the embedded game. */
    locale: typeof locale;
    /** Last mode actually delivered to the embedded game. */
    gameMode: WebGameMode;
  } | null>(null);
  /** Provides configuration warning behavior. */
  const configurationWarning = hostConfigurationWarning;
  /** Provides [frame ready, set frame ready] behavior. */
  const [frameReady, setFrameReady] = useState(false);
  /** Failed browser module loading retires the game frame until the player reloads. */
  const [bridgeUnavailable, setBridgeUnavailable] = useState(false);
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
  useEffect(() => {
    if (bridgeUnavailable) reportStartupUnavailable();
  }, [bridgeUnavailable, reportStartupUnavailable]);
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
  /** A new authentication visit cannot inherit another player's transient notice or dismiss timer. */
  const {notice, setNotice} = useHostNotice({owner: captureAccount, configurationWarning,
    ownsMessage: authSnapshot.user ? captureAccount(authSnapshot.user.uid) : undefined});
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
  } = useHostOperations({postOperation, owner: captureAccount});
  /** Single-player riddle loading, recovery, and readiness module. */
  const {
    gameMode,
    startupComplete,
    startupUnavailable,
    loadRiddle: loadAndPostRiddle,
  } = useHostRiddleLifecycle({
    userId: authSnapshot.user?.uid,
    accountGeneration: authSnapshot.user?.accountGeneration,
    profile: authSnapshot.profile,
    initialGameMode,
    locale,
    services: authority.gameplay,
    canUsePreparedQuestions,
    withActivity: withServerActivity,
    postToGame,
    postOperation,
    configurationWarning,
    setNotice,
    onPlayable: reportPlayable,
    onStartupUnavailable: reportStartupUnavailable,
    recoverySuspended: bridgeUnavailable,
    onRecoveryAttempt: sendRecoveryInit,
  });
  useEffect(() => {
    if (!startupComplete || !notice || notice === configurationWarning) return;
    /** Dismisses a transient host notice. */
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice, configurationWarning, startupComplete, setNotice]);
  /** Whether startup, server work, or the target lifecycle blocks interaction. */
  const serverInteractionActive = serverActivityActive || externalInteractionBlocked || (!startupComplete && !startupUnavailable);
  /** Sends the complete current host state to the game. */
  const sendInit = useCallback(() => {
    sentInitializationRef.current = {products: authority.commerce?.products, locale, gameMode};
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

  // Catalog and locale loads finish independently of the first ready message.
  // Re-send changed game settings while profile-only notifications retain the
  // current round through the separate authentication projection.
  useEffect(() => {
    if (!frameReady) return;
    /** Provides products behavior. */
    const products = authority.commerce?.products;
    /** Commerce absence must not suppress an asynchronously loaded content locale. */
    const sent = sentInitializationRef.current;
    if (sent && sent.products === products && sent.locale === locale && sent.gameMode === gameMode) return;
    sendInit();
  }, [authority.commerce, frameReady, gameMode, locale, sendInit]);
  /** Applies purchase balance. */
  const applyPurchaseBalance = useCallback(
    (result: import("../../platform/contracts/hostServices").PurchaseResult) => applyCoinBalance(result.newCoins),
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
  /** Consumption is durable hook state rather than an evictable render optimization. */
  const singlePlayerEffectsRef = useRef<{
    /** Profile-only renders retain the same authentication visit identity. */
    owner: typeof captureAccount;
    /** Optional completion work consumed during this account visit. */
    deliver: ReturnType<typeof createHostCompletionEffects>;
    /** Accepted guess effects retain the same visit ownership as completion effects. */
    guess: ReturnType<typeof createHostGuessEffects>;
    /** Confirmed coin receipts survive profile updates and command-module replacement. */
    coin: ReturnType<typeof createHostCoinActionEffects>;
  } | null>(null);
  if (singlePlayerEffectsRef.current?.owner !== captureAccount) {
    /** One captured guard rejects old callbacks before a replacement render commits. */
    const owned = captureAccount(authSnapshot.user?.uid);
    singlePlayerEffectsRef.current = {
      owner: captureAccount,
      deliver: createHostCompletionEffects(owned),
      guess: createHostGuessEffects(owned),
      coin: createHostCoinActionEffects(owned),
    };
  }
  /** Old handlers retain their retired consumer while new handlers own a fresh one. */
  const {deliver: deliverCompletionEffects, guess: deliverGuessEffects, coin: deliverCoinActionEffects} = singlePlayerEffectsRef.current;
  /** Accepted guess retries cannot prompt a different account or duplicate telemetry. */
  const handleAuthoritativeGuess = useCallback(
    (input: HostCompletionInput, result: SinglePlayerGuessResult) =>
      deliverGuessEffects(input, result, onAuthoritativeGuessWin),
    [deliverGuessEffects, onAuthoritativeGuessWin],
  );
  /** Acknowledged retries retain their receipt without repeating target side effects. */
  const handleAuthoritativeComplete = useCallback(
    (input: HostCompletionInput, result: CompletionResult) =>
      deliverCompletionEffects(input, result, onAuthoritativeComplete, onResultScreen),
    [deliverCompletionEffects, onAuthoritativeComplete, onResultScreen],
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
        authSnapshot,
        gameMode,
        locale,
        loadedUserIdRef,
        playableReportedRef,
        accountDeletionCompletedRef,
        setFrameReady,
        setNotice,
        sendInit,
        loadAndPostRiddle,
        postOperation,
        authority,
        runRaceOperation,
        withServerActivity,
        applyPurchaseBalance,
        syncRaceAchievementProgress,
        onPlayable,
        onAuthoritativeGuess: handleAuthoritativeGuess,
        onAuthoritativeCoinAction: deliverCoinActionEffects,
        onAuthoritativeComplete: handleAuthoritativeComplete,
        onAuthoritativeRaceResult: handleAuthoritativeRaceResult,
        onAccountDeleted,
        onAccountDeletionRequested,
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
      handleAuthoritativeGuess,
      deliverCoinActionEffects,
      postOperation,
      runRaceOperation,
      sendInit,
      authority,
      syncRaceAchievementProgress,
      withServerActivity,
      setNotice,
    ],
  );
  /** Stable local message routing and document visibility projection. */
  useHostBridgeLifecycle({router: commands.execute, postToGame, setNotice,
    ownsMessage: captureAccount(authSnapshot.user?.uid), onUnavailable: () => setBridgeUnavailable(true),
    lifecycle: platformCapabilities?.lifecycle});

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

  if (bridgeUnavailable) return <BridgeStartupRecovery />;

  if (!authSnapshot.user) {
    return (
      <main className="route-loading" aria-live="polite">
        <SpinningWheelLoader message={tr("WebPortal.STARTUP_GAME")} progress={72} />
      </main>
    );
  }

  return (
    <ReferralSharingProvider key={authSnapshot.user?.uid ?? "guest"} capability={referralSharing}>
      <NotificationSettingsProvider provider={notificationProvider}>
      <div className="play-game-shell">
        {notice && <div className="play-alert game-shell-alert">{getHostNoticeMessage(notice)}</div>}
        <GameFrameApp
          raceSurface={raceSurface}
          raceOwnerId={authSnapshot.user?.uid}
          onLiveRaceBalance={applyCoinBalance}
          localBridge
          prepareClassicQuestions
          economyAvailable={Boolean(authority.economy)}
          startupError={startupUnavailable && !startupComplete && notice ? getHostNoticeMessage(notice) : undefined}
          interactionBlocked={serverInteractionActive}
          restoredGame={initialPlayerData?.activeGame}
          onSaveGame={onPlayerDataChange ? saveActiveGame : undefined}
          registrationName={registrationName}
          registrationInviterName={registrationInviterName}
          initialRaceChallengeId={initialRaceChallengeId}
          initialRaceInbox={initialRaceInbox}
          initialRaceLobby={initialRaceLobby}
          initialRaceTournamentLocale={platformCapabilities?.tournaments ? initialRaceTournamentLocale : undefined}
          raceFeatureEnabled={raceBuildEnabled}
          prefetchedRaceCategories={prefetchedRaceCategories}
          matchmaking={platformCapabilities?.matchmaking}
          tournaments={platformCapabilities?.tournaments}
          raceLocalePolicy={raceLocalePolicy}
          onPresenceStateChange={onPresenceStateChange}
        />
        {!startupComplete && !startupUnavailable ? (
          <SpinningWheelLoader
            overlay
            message={notice ? getHostNoticeMessage(notice) : tr("WebPortal.STARTUP_GAME")}
            progress={notice ? undefined : 88}
          />
        ) : null}
      </div>
      </NotificationSettingsProvider>
    </ReferralSharingProvider>
  );
}

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {PlayHostApp} from "../play/PlayHostApp";
import {JestSdkPlatform} from "./JestSdkPlatform";
import {JestPurchaseCoordinator} from "./purchases";
import {
  JEST_SDK_INIT_TIMEOUT_MESSAGE,
  markJestPlayable,
  startJestSession,
  stopJestLoadingHeartbeat,
  type JestStartupUpdate,
} from "./startup";
import type {JestSession} from "./types";
import {tr, useLocale} from "../play/i18n";
import {MockJestPlatform} from "./MockJestPlatform";
import {recordAuthoritativeCompletion} from "./milestone";
import {useJestNotifications} from "./notifications/useJestNotifications";
import {createNotificationOperationGate} from "./notifications/operationGate";
import {useJestSharing} from "./sharing/useJestSharing";
import {resolveJestRuntimeMode, shouldEnableJestSubscriptions} from "./runtimeMode";
import {trackScreen} from "../analytics/events";
import {hasTrustedTestHarnessMarker} from "../testHarness";
import {resolveRaceChallengeId} from "./entryIntent";
import {createJestBackend} from "./createJestBackend";
import {
  JestAccountDeleted,
  JestRegistrationAlert,
  JestStartupError,
  JestStartupProgress,
} from "./JestSessionViews";
import {useJestProductCatalog} from "./useJestProductCatalog";
import {useJestPurchase} from "./useJestPurchase";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {
  ACCOUNT_DELETION_PENDING_PHASE,
  AccountDeletionCleanupError,
  completeTombstonedAccountDeletion,
  getAccountDeletionPendingPhase,
  isAccountDeletionCleanupPending,
  markAccountDeletionRequested,
  purgeDeletedPlayerState,
  recoverPendingAccountDeletion,
  runAccountDeletionAwareIdentityOperation,
} from "./accountDeletionCleanup";
import {useJestPlayerStateWrites} from "./useJestPlayerStateWrites";
import {useAccountDeletionQuiescence} from "./useAccountDeletionQuiescence";
import {commitJestStartupSession} from "./commitJestStartupSession";
import {clearJestFirebaseAuthentication} from "./clearJestFirebaseAuthentication";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "../play/services";
import {useJestFunnelTracking, useJestPlatformActivity} from "./useJestPlatformOperations";
import {useJestPresence} from "./useJestPresence";
import {useJestRegistration} from "./useJestRegistration";
/** Provides jest play app behavior. */
export function JestPlayApp() {
  const locale = useLocale();
  const hostServicesMode = useMemo(() => resolveHostServicesMode(), []);
  const hostServices = useMemo(() => createHostServices(hostServicesMode), [hostServicesMode]);
  const hostConfigurationWarning = getHostConfigurationWarning(hostServicesMode);
  const searchParams = new URLSearchParams(window.location.search);
  const harness = searchParams.get("harness");
  const runtimeMode = resolveJestRuntimeMode({
    development: import.meta.env.DEV,
    embedded: window.parent !== window,
    harness,
    testHarnessEnabled: import.meta.env.DEV || hasTrustedTestHarnessMarker(),
  });
  const {authHarness, mockBackend: mockRuntime} = runtimeMode;
  // Subscription checkout is beta and currently stalls in Jest's live sandbox.
  // Keep the UI available in local development, but never expose it from an
  // uploaded production artifact until the release gate is deliberately changed.
  const subscriptionsEnabled = shouldEnableJestSubscriptions(import.meta.env.DEV);
  const mockRegistered = searchParams.get("registered") === "1";
  const platform = useMemo(
    () =>
      runtimeMode.useSdkPlatform ? new JestSdkPlatform() : new MockJestPlatform(mockRegistered),
    [mockRegistered, runtimeMode.useSdkPlatform],
  );
  const backend = useMemo(() => createJestBackend({authHarness, mockRuntime}), [authHarness, mockRuntime]);
  const purchases = useMemo(() => new JestPurchaseCoordinator(platform, backend), [backend, platform]);
  const [session, setSession] = useState<JestSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [startup, setStartup] = useState<JestStartupUpdate>({stage: "connecting", progress: 5});
  const [engagementProgress, setEngagementProgress] = useState({
    level: 1,
    winStreak: 0,
    wins: 0,
  });
  const [notificationOperationGate] = useState(createNotificationOperationGate);
  const deletionCleanupOptions = useMemo(() => ({
    clearFirebaseAuthentication: authHarness || mockRuntime ? undefined : clearJestFirebaseAuthentication,
    waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
    withExclusiveNotificationAccess: notificationOperationGate.runExclusive,
  }), [authHarness, mockRuntime, notificationOperationGate]);
  const sessionRef = useRef<JestSession | null>(null);
  sessionRef.current = session;
  const {pendingPlatformOperations, withPlatformActivity, withBackgroundPlatformActivity} =
    useJestPlatformActivity(notificationOperationGate);
  const trackFunnel = useJestFunnelTracking({
    gate: notificationOperationGate,
    platform,
    sessionRef,
  });
  const playerStateWrites = useJestPlayerStateWrites({
    platform,
    gate: notificationOperationGate,
    sessionRef,
    setSession,
    setEngagementProgress,
    trackFailure: trackFunnel,
  });
  const accountDeletionQuiesced = useAccountDeletionQuiescence(notificationOperationGate);
  useJestNotifications({
    locale,
    mockRuntime,
    session,
    engagementProgress,
    playerFallback: tr("WebPortal.NOTIFICATION_PLAYER_FALLBACK"),
    assetReference: import.meta.env.VITE_JEST_NOTIFICATION_ASSET_REFERENCE || undefined,
    platform,
    notificationsEnabled: notificationOperationGate.isOpen,
    withPlatformActivity: notificationOperationGate.run,
    trackFunnel,
  });
  const referralSharing = useJestSharing({
    locale,
    session,
    platform,
    backend,
    withPlatformActivity,
    withBackgroundPlatformActivity,
    trackFunnel,
    authHarness,
  });
  const [jestProducts, setJestProducts] = useJestProductCatalog({
    purchases,
    session,
    subscriptionsEnabled,
    trackFunnel,
    withPlatformActivity: withBackgroundPlatformActivity,
  });
  const purchaseProduct = useJestPurchase({
    products: jestProducts,
    purchases,
    session,
    setProducts: setJestProducts,
    subscriptionsEnabled,
    trackFunnel,
  });
  const authenticateJestIdentity = useCallback(
    async (token: string) => {
      if (authHarness) {
        (
          window as typeof window & {
            __RIDDLE_QUEST_JEST_AUTH_TEST__?: {firebaseTokens: string[]};
          }
        ).__RIDDLE_QUEST_JEST_AUTH_TEST__?.firebaseTokens.push(token);
      } else if (!mockRuntime) {
        const [{signInWithCustomToken}, {auth}, {ensureJestFirebaseAppCheckReady}] = await Promise.all([
          import("firebase/auth"),
          import("../firebase"),
          import("./JestFirebaseAppCheck"),
        ]);
        await signInWithCustomToken(auth, token);
        await ensureJestFirebaseAppCheckReady();
      }
    },
    [authHarness, mockRuntime],
  );
  const completeTombstonedPlayerCleanup = useCallback(async (playerSigned: string) => {
    await completeTombstonedAccountDeletion(
      platform,
      playerSigned,
        notificationOperationGate,
        async (signed) => {
          const result = await backend.retryAccountDeletion(signed);
          if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
        },
        deletionCleanupOptions.clearFirebaseAuthentication,
      );
    notificationOperationGate.close();
    playerStateWrites.disable();
    sessionRef.current = null;
    setSession(null);
    setAccountDeleted(true);
  }, [backend, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites]);
  useEffect(() => {
    let active = true;
    playerStateWrites.disable();
    const deletionRecovery = getAccountDeletionPendingPhase() === ACCOUNT_DELETION_PENDING_PHASE.authoritativeDeletion;
    void startJestSession(platform, backend, purchases, authenticateJestIdentity, setStartup, {
      onInitialized: () => recoverPendingAccountDeletion(platform, "initialized", deletionCleanupOptions),
      onAuthenticated: isAccountDeletionCleanupPending,
      onIdentityDeleted: completeTombstonedPlayerCleanup,
      deletionRecovery,
      recoverAccountDeletion: (playerSigned) => recoverPendingAccountDeletion(platform, "signed", {
        clearFirebaseAuthentication: deletionCleanupOptions.clearFirebaseAuthentication,
        retryAuthoritativeDeletion: async () => {
          const result = await backend.retryAccountDeletion(playerSigned);
          if (!result.accountDeleted) throw new Error("account-deletion-recovery-rejected");
        },
        waitForPendingNotificationOperations: notificationOperationGate.waitForPending,
      }).then((recovered) => {
        if (!recovered) throw new Error("account-deletion-recovery-state-changed");
      }),
      // Recovery owns the exclusive lock through identity, authority, and client purge.
      // Ordinary identity is shared work and is rechecked immediately after lock release.
      withIdentityOperation: (operation) => runAccountDeletionAwareIdentityOperation(
        deletionRecovery,
        notificationOperationGate,
        operation,
      ),
      withAccountOperation: notificationOperationGate.run,
    }).then(async (result) => {
      if (!active) return;
      if (result.status === "account-deleted") {
        notificationOperationGate.close();
        setAccountDeleted(true);
        return;
      }
      if (result.status === "success") {
        try {
          await commitJestStartupSession({
            gate: notificationOperationGate,
            isActive: () => active,
            session: result.value,
            enablePlayerStateWrites: playerStateWrites.enable,
            setEngagementProgress,
            setSession,
            trackFunnel,
          });
        } catch (commitError) {
          captureBrowserException(commitError, {component: "jest_startup_commit"});
          setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
        }
      } else {
        const message = "message" in result
          ? result.message
          : tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN");
        setError(
          message === JEST_SDK_INIT_TIMEOUT_MESSAGE
            ? tr("Errors.CHECK_INTERNET_AND_TRY_AGAIN")
            : message,
        );
      }
    });
    return () => {
      active = false;
      playerStateWrites.disable();
      stopJestLoadingHeartbeat(platform);
    };
  }, [authenticateJestIdentity, backend, completeTombstonedPlayerCleanup, deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites, purchases, trackFunnel]);
  /** Clears app-owned browser and Jest state only after server-side account deletion succeeds. */
  const clearPlayerState = useCallback(async () => {
    notificationOperationGate.close();
    await playerStateWrites.drainAndClear();
    try {
      await purgeDeletedPlayerState(platform, deletionCleanupOptions);
    } catch (clearError) {
      console.warn("[riddle-quest] Player-state clear failed after account deletion", clearError);
      const cleanupError = clearError instanceof AccountDeletionCleanupError ? clearError : undefined;
      trackFunnel("player_state_clear_failed", {
        notifications: cleanupError?.notificationsFailed ?? true,
        platform: cleanupError?.platformFailed ?? true,
        browser: cleanupError?.browserFailed ?? true,
      });
      throw clearError;
    }
    sessionRef.current = null;
    setSession(null);
    setAccountDeleted(true);
  }, [deletionCleanupOptions, notificationOperationGate, platform, playerStateWrites, trackFunnel]);
  const {
    showRegistration,
    registrationPending,
    registrationFailure,
    open: openRegistrationPrompt,
    dismiss: dismissRegistration,
    register,
    login,
  } = useJestRegistration({
    platform,
    backend,
    sessionRef,
    setSession,
    setError,
    authenticateIdentity: authenticateJestIdentity,
    completeDeletedPlayerCleanup: completeTombstonedPlayerCleanup,
    withPlatformActivity,
    trackFunnel,
  });
  const handleAuthoritativeComplete = useCallback(
    async (
      input: {gameMode: "classic" | "challenge"},
      result: {isCorrect: boolean; newLevel?: number; newWinStreak?: number},
    ) => {
      if (!session || !result.isCorrect) return;
      trackFunnel("authoritative_puzzle_won", {
        gameMode: input.gameMode,
        winStreak: result.newWinStreak ?? 0,
      });
      setEngagementProgress((current) => ({
        level: result.newLevel ?? current.level,
        winStreak: result.newWinStreak ?? current.winStreak,
        wins: current.wins + 1,
      }));
      const recorded = await notificationOperationGate.run(() => recordAuthoritativeCompletion(platform, session, {
          gameMode: input.gameMode,
          isCorrect: result.isCorrect,
          newWinStreak: result.newWinStreak,
        }));
      if (recorded.status !== "success") {
        trackFunnel("first_milestone_failed", {status: recorded.status});
        return;
      }
      setSession((current) => (current ? {...current, preferences: recorded.value.preferences} : current));
      if (recorded.value.milestoneMarked) trackFunnel("first_milestone_marked");
      if (recorded.value.shouldPromptRegistration) {
        openRegistrationPrompt("authoritative_win", true);
      }
    },
    [notificationOperationGate, openRegistrationPrompt, platform, session, trackFunnel],
  );
  const {setPresenceState, togglePresence} = useJestPresence({
    gate: notificationOperationGate,
    platform,
    session,
    sessionRef,
    setSession,
    trackFailure: trackFunnel,
  });
  useEffect(() => {
    trackScreen(error ? "startup_error" : accountDeleted ? "account_deleted" : !session ? "startup_loading" : !session.player.registered && showRegistration
      ? "registration_prompt"
      : "game");
  }, [accountDeleted, error, session, showRegistration]);
  if (error) {
    return <JestStartupError message={error} />;
  }
  if (accountDeleted) {
    return <JestAccountDeleted />;
  }
  if (!session || accountDeletionQuiesced) {
    return <JestStartupProgress startup={startup} />;
  }
  return (
    <>
      {registrationFailure ? (
        <div
          className="play-alert game-shell-alert"
          role="alert"
          style={{top: "auto", bottom: "max(12px, env(safe-area-inset-bottom))"}}
        >
          {registrationFailure}
        </div>
      ) : null}
      {!session.player.registered && showRegistration ? (
        <JestRegistrationAlert
          blocked={pendingPlatformOperations > 0 || registrationPending}
          session={session}
          onRegister={register}
          onLogin={login}
          onDismiss={dismissRegistration}
        />
      ) : null}
      <PlayHostApp
        hostServices={hostServices}
        hostConfigurationWarning={hostConfigurationWarning}
        initialGameMode={session.entryIntent.gameMode}
        initialRaceChallengeId={resolveRaceChallengeId(session.entryIntent)}
        initialRaceInbox={session.entryIntent.challengeDestination === "inbox"}
        registrationName={session.entryIntent.customName}
        registrationInviterName={session.entryIntent.inviterName}
        onPlayable={() => markJestPlayable(platform)}
        onAuthoritativeComplete={handleAuthoritativeComplete}
        platformProducts={jestProducts}
        platformPurchase={purchaseProduct}
        platformCapabilities={{
          accountUpgrade: {
            state: session.player.registered ? "complete" : "available",
            begin: async () => ({status: "unavailable", message: "Use the Jest registration controls."}),
          },
        }}
        externalInteractionBlocked={pendingPlatformOperations > 0}
        initialPlayerData={session.playerData}
        onPlayerDataChange={playerStateWrites.savePlayerData}
        accountDeletionServiceGate={notificationOperationGate}
        onAccountDeletionRequested={markAccountDeletionRequested}
        onAccountDeleted={clearPlayerState}
        presenceEnabled={session.preferences.presenceEnabled === true}
        onTogglePresence={togglePresence}
        onPresenceStateChange={setPresenceState}
        referralSharing={referralSharing}
      />
    </>
  );
}
